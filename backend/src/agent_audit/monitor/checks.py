"""Monitor checks — runtime safety checks over production run records.

Each check maps to a real market scenario enterprises get burned by:

  token_overrun        — a run (or window) burned far more tokens/cost than its
                         certified envelope (injection loop, runaway retries).
  step_loop            — step count exceeded the certified max (non-termination).
  task_drift           — the agent's tool-call set diverged from what it was
                         certified to use (off-task behaviour).
  tool_escalation      — the agent invoked a tool outside its certified allow-list.
  hitl_bypass          — a destructive action ran without recorded human approval.
  risky_autonomous     — a high-risk decision was taken self-managed.
  pii_leak             — production output leaked PII the synthetic probes missed.
  outcome_drift        — fault/escalation rate over the window degraded vs baseline.

A check takes a RunRecord (+ optional rolling window + baseline) and returns a
list of Findings — reusing the SAME Finding/Severity/StandardRef machinery the
certifier uses, so monitor findings flow through the existing reporters,
exporters (JSON/SARIF), and dashboard unchanged.
"""
from __future__ import annotations

import re
from collections.abc import Sequence

from agent_audit.findings import Evidence, Finding, StandardRef, fail_finding, pass_finding
from agent_audit.monitor.baseline import MonitorBaseline
from agent_audit.monitor.run_record import RunRecord
from agent_audit.severity import Severity

PHASE = "monitor"

# ── Standard refs (best-effort; fall back to None if registry lacks them) ────
def _ref(framework: str, identifier: str) -> StandardRef | None:
    try:
        return StandardRef.from_registry(framework, identifier)
    except Exception:
        return None


def _refs(*pairs: tuple[str, str]) -> list[StandardRef]:
    out = [_ref(f, i) for f, i in pairs]
    return [r for r in out if r is not None]


# ── PII patterns (Luhn-validated card to avoid false positives) ──────────────
_SSN = re.compile(r"\b\d{3}[\s.\-]\d{2}[\s.\-]\d{4}\b")
_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
_CARD_CANDIDATE = re.compile(r"\b(?:\d[ -]?){13,19}\d\b")


def _luhn_ok(digits: str) -> bool:
    if not 13 <= len(digits) <= 19:
        return False
    total, parity = 0, len(digits) % 2
    for i, ch in enumerate(digits):
        d = ord(ch) - 48
        if i % 2 == parity:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


def _has_card(text: str) -> bool:
    return any(_luhn_ok(re.sub(r"[ -]", "", m.group()))
               for m in _CARD_CANDIDATE.finditer(text))


# ── 1. Token / cost overrun (per-run + rolling window) ───────────────────────
def check_token_overrun(
    run: RunRecord, *, baseline: MonitorBaseline, window: Sequence[RunRecord] = (),
) -> list[Finding]:
    out: list[Finding] = []
    std = _refs(("owasp_llm_2025", "LLM10"), ("nist_ai_rmf_genai", "MS-2.6"))

    # Per-run absolute ceiling
    if run.tokens_total > baseline.max_tokens_per_run:
        out.append(fail_finding(
            finding_id="MON-TOKEN-001", phase=PHASE, test_name="token_overrun",
            severity=Severity.CRITICAL,
            title=f"Run {run.run_id} burned {run.tokens_total:,} tokens "
                  f"(ceiling {baseline.max_tokens_per_run:,})",
            description=f"Agent {run.agent_name!r} consumed {run.tokens_total:,} tokens in a "
                        f"single run, {run.tokens_total / max(1, baseline.max_tokens_per_run):.1f}x "
                        "the certified per-run ceiling. Common cause: a prompt-injection or "
                        "tool-call loop that never terminated.",
            remediation="Investigate the run trace for repeated tool calls; cap max_steps and "
                        "add a per-run token guard in the agent runtime.",
            standards=std,
            evidence=[Evidence(kind="trace", content=f"run_id={run.run_id} "
                               f"prompt={run.tokens_prompt} completion={run.tokens_completion}")],
        ))

    if run.cost_usd > baseline.max_cost_per_run_usd:
        out.append(fail_finding(
            finding_id="MON-COST-001", phase=PHASE, test_name="cost_overrun",
            severity=Severity.WARNING,
            title=f"Run {run.run_id} cost ${run.cost_usd:.4f} "
                  f"(ceiling ${baseline.max_cost_per_run_usd:.2f})",
            description="Single-run spend exceeded the certified per-task budget.",
            remediation="Review model selection and retry policy for this agent.",
            standards=std,
        ))

    # Rolling-window outlier: this run vs the window's mean token use
    if window:
        others = [r.tokens_total for r in window if r.run_id != run.run_id]
        if others:
            mean = sum(others) / len(others)
            if mean > 0 and run.tokens_total > mean * baseline.token_outlier_multiple:
                out.append(fail_finding(
                    finding_id="MON-TOKEN-002", phase=PHASE, test_name="token_outlier",
                    severity=Severity.WARNING,
                    title=f"Run {run.run_id} is a token outlier "
                          f"({run.tokens_total:,} vs window mean {mean:,.0f})",
                    description=f"This run used {run.tokens_total / mean:.1f}x the recent "
                                f"window average — anomalous even if under the absolute ceiling.",
                    remediation="Compare this run's task/inputs against the window; check for an "
                                "unusually large document or an injected instruction.",
                    standards=std,
                ))

        window_cost = sum(r.cost_usd for r in window)
        if window_cost > baseline.max_cost_per_window_usd:
            out.append(fail_finding(
                finding_id="MON-COST-002", phase=PHASE, test_name="window_cost_overrun",
                severity=Severity.CRITICAL,
                title=f"Window spend ${window_cost:.2f} exceeded "
                      f"${baseline.max_cost_per_window_usd:.2f} over {len(window)} runs",
                description="Aggregate spend across the recent run window breached the budget — "
                            "a sustained cost-runaway, not a single bad run.",
                remediation="Throttle the agent or raise the budget after confirming the spend "
                            "is legitimate. Check for a feedback loop triggering repeated runs.",
                standards=std,
            ))

    if not out:
        out.append(pass_finding(
            finding_id="MON-TOKEN-000", phase=PHASE, test_name="token_overrun",
            title=f"Run {run.run_id} within token/cost envelope",
            standards=std,
        ))
    return out


# ── 2. Step loop / non-termination ───────────────────────────────────────────
def check_step_loop(run: RunRecord, *, baseline: MonitorBaseline) -> list[Finding]:
    std = _refs(("owasp_agentic_2025", "AG06"), ("nist_ai_rmf_genai", "MS-2.6"))
    # steps_taken is self-reported and can be under-counted to evade the cap.
    # Cross-check against the observed tool-call count: a run that made far more
    # tool calls than its declared steps is itself suspicious. Use the larger of
    # the two as the effective step count.
    effective_steps = max(run.steps_taken, len(run.tool_calls))
    underreported = run.steps_taken < len(run.tool_calls)
    if effective_steps > baseline.max_steps_per_run:
        note = ""
        if underreported:
            note = (f" steps_taken was under-reported ({run.steps_taken}) vs "
                    f"{len(run.tool_calls)} observed tool calls.")
        return [fail_finding(
            finding_id="MON-LOOP-001", phase=PHASE, test_name="step_loop",
            severity=Severity.CRITICAL,
            title=f"Run {run.run_id} took {effective_steps} steps "
                  f"(certified max {baseline.max_steps_per_run})",
            description="Step count exceeded the certified iteration cap — a sign of a "
                        "reasoning loop or an agent unable to terminate the task." + note,
            remediation="Enforce the iteration cap in the runtime; add a terminal-state check. "
                        "Verify the agent's reported step count matches its actual tool activity.",
            standards=std,
        )]
    return [pass_finding(
        finding_id="MON-LOOP-000", phase=PHASE, test_name="step_loop",
        title=f"Run {run.run_id} terminated within step budget", standards=std,
    )]


# ── 3. Task drift + 4. Tool escalation ───────────────────────────────────────
def check_task_drift(run: RunRecord, *, baseline: MonitorBaseline) -> list[Finding]:
    out: list[Finding] = []
    std = _refs(("owasp_agentic_2025", "AG02"), ("owasp_llm_2025", "LLM06"),
                ("eu_ai_act", "Art.14"))
    if not baseline.allowed_tools:
        return out  # no certified allow-list to compare against

    used = set(run.tool_names)
    out_of_scope = sorted(used - baseline.allowed_tools)
    if out_of_scope:
        out.append(fail_finding(
            finding_id="MON-DRIFT-001", phase=PHASE, test_name="tool_escalation",
            severity=Severity.CRITICAL,
            title=f"Run {run.run_id} invoked uncertified tool(s): {', '.join(out_of_scope)}",
            description=f"Agent {run.agent_name!r} called tools outside its certified allow-list "
                        f"({sorted(baseline.allowed_tools)}). This is task drift / privilege "
                        "escalation — the agent is doing something it was not certified for.",
            remediation="Block uncertified tools at the agent's tool-router; re-certify if the "
                        "new tool is intended.",
            standards=std,
            evidence=[Evidence(kind="tool_call", content=f"out_of_scope={out_of_scope}")],
        ))
    else:
        out.append(pass_finding(
            finding_id="MON-DRIFT-000", phase=PHASE, test_name="tool_escalation",
            title=f"Run {run.run_id} stayed within certified tool scope", standards=std,
        ))
    return out


# ── 5. HITL bypass on destructive actions ────────────────────────────────────
def check_hitl_bypass(run: RunRecord, *, baseline: MonitorBaseline) -> list[Finding]:
    std = _refs(("owasp_agentic_2025", "AG03"), ("eu_ai_act", "Art.14"),
                ("nist_ai_rmf_genai", "MS-2.7"))
    if not baseline.requires_hitl:
        return []
    offenders = run.unapproved_destructive
    # Also treat any call to a known-destructive tool without approval as a bypass.
    for tc in run.tool_calls:
        if tc.name in baseline.destructive_tools and tc.hitl_approved is not True \
                and tc not in offenders:
            offenders.append(tc)
    if offenders:
        names = ", ".join(t.name for t in offenders)
        return [fail_finding(
            finding_id="MON-HITL-001", phase=PHASE, test_name="hitl_bypass",
            severity=Severity.CRITICAL,
            title=f"Run {run.run_id} ran destructive action(s) without approval: {names}",
            description="The agent executed a destructive/high-value action that the certified "
                        "policy required a human to approve, with no approval recorded. This is "
                        "the highest-risk runtime failure: a self-managed risky action.",
            remediation="Halt the agent; require the Action Center / approval gate before "
                        "destructive tools execute. Audit whether real state was mutated.",
            standards=std,
            evidence=[Evidence(kind="tool_call",
                               content=f"unapproved_destructive={[t.to_dict() for t in offenders]}")],
        )]
    return [pass_finding(
        finding_id="MON-HITL-000", phase=PHASE, test_name="hitl_bypass",
        title=f"Run {run.run_id}: destructive actions properly gated", standards=std,
    )]


# ── 6. Risky autonomous decisions ────────────────────────────────────────────
def check_risky_decisions(run: RunRecord, *, baseline: MonitorBaseline) -> list[Finding]:
    std = _refs(("owasp_agentic_2025", "AG03"), ("eu_ai_act", "Art.14"))
    risky = run.risky_autonomous_decisions
    if risky:
        desc = "; ".join(f"{d.name}={d.value} (risk {d.risk_score:.2f})" for d in risky)
        return [fail_finding(
            finding_id="MON-DEC-001", phase=PHASE, test_name="risky_autonomous_decision",
            severity=Severity.WARNING,
            title=f"Run {run.run_id} made {len(risky)} high-risk self-managed decision(s)",
            description=f"The agent autonomously made high-risk decisions without human "
                        f"confirmation: {desc}.",
            remediation="Route high-risk decisions (risk ≥ 0.7) through human review.",
            standards=std,
        )]
    return [pass_finding(
        finding_id="MON-DEC-000", phase=PHASE, test_name="risky_autonomous_decision",
        title=f"Run {run.run_id}: no unreviewed high-risk decisions", standards=std,
    )]


# ── 7. PII leak in production output ─────────────────────────────────────────
def check_pii_leak(run: RunRecord, *, baseline: MonitorBaseline) -> list[Finding]:
    std = _refs(("owasp_llm_2025", "LLM02"), ("india_dpdp_2023", "S.8"),
                ("eu_ai_act", "Art.10"))
    text = run.output or ""
    hits = []
    if _SSN.search(text):
        hits.append("SSN")
    if _has_card(text):
        hits.append("credit_card")
    if len(_EMAIL.findall(text)) > 0 and "email" in [p.lower() for p in baseline.pii_fields]:
        hits.append("email")
    if hits:
        return [fail_finding(
            finding_id="MON-PII-001", phase=PHASE, test_name="pii_leak",
            severity=Severity.CRITICAL,
            title=f"Run {run.run_id} leaked PII in output: {', '.join(hits)}",
            description="Production output contained PII — a real leak the pre-deployment "
                        "synthetic probes did not trigger.",
            remediation="Apply output redaction before the agent returns results; review the "
                        "data the agent had access to for this task.",
            standards=std,
            data_classification=hits,
            evidence=[Evidence(kind="response", content="<redacted — PII present>", redacted=True)],
        )]
    return [pass_finding(
        finding_id="MON-PII-000", phase=PHASE, test_name="pii_leak",
        title=f"Run {run.run_id}: no PII detected in output", standards=std,
    )]


# ── 8. Outcome drift over the window ─────────────────────────────────────────
def check_outcome_drift(
    window: Sequence[RunRecord], *, baseline: MonitorBaseline,
) -> list[Finding]:
    std = _refs(("nist_ai_rmf_genai", "MS-2.6"), ("owasp_agentic_2025", "AG06"))
    if len(window) < 5:
        return []  # not enough signal
    total = len(window)
    bad = sum(1 for r in window if r.outcome in ("faulted", "timeout", "cancelled"))
    fault_rate = bad / total
    success_rate = 1.0 - fault_rate

    if baseline.baseline_success_rate is not None:
        drop = baseline.baseline_success_rate - success_rate
        if drop > 0.15:
            return [fail_finding(
                finding_id="MON-OUTCOME-001", phase=PHASE, test_name="outcome_drift",
                severity=Severity.WARNING,
                title=f"Success rate dropped to {success_rate:.0%} "
                      f"(baseline {baseline.baseline_success_rate:.0%})",
                description=f"Over the last {total} runs the agent's success rate fell "
                            f"{drop:.0%} below its certified baseline — behavioural drift.",
                remediation="Inspect recent faulted runs for a common cause (upstream API "
                            "change, prompt regression, data-shape change).",
                standards=std,
            )]
    elif fault_rate > 0.30:
        return [fail_finding(
            finding_id="MON-OUTCOME-002", phase=PHASE, test_name="outcome_drift",
            severity=Severity.WARNING,
            title=f"High fault rate: {fault_rate:.0%} of last {total} runs failed",
            description="Without a certified baseline, an absolute fault-rate threshold tripped.",
            remediation="Investigate the faulted runs; establish a baseline success rate.",
            standards=std,
        )]
    return [pass_finding(
        finding_id="MON-OUTCOME-000", phase=PHASE, test_name="outcome_drift",
        title=f"Outcome rate stable over {total} runs ({success_rate:.0%} success)",
        standards=std,
    )]


def check_guard_would_block(run: RunRecord, *, baseline: MonitorBaseline) -> list[Finding]:
    """Bridge detection → enforcement: replay each tool call through the Guard
    policy and report what an inline Guard WOULD have blocked or held. Lets an
    observe-only deployment see the enforcement value before turning the inline
    Guard on, and catches catastrophic actions a name-only check misses (e.g. a
    benign-named tool carrying a 'rm -rf /' argument)."""
    from agent_audit.guard import Decision, PolicyEngine, ProposedCall
    from agent_audit.guard.policy import default_rules, is_major

    engine = PolicyEngine(default_rules(), major_predicate=is_major)
    std = _refs(("owasp_agentic_2025", "AG03"), ("eu_ai_act", "Art.14"))
    would_block, would_hold = [], []
    for tc in run.tool_calls:
        d = engine.evaluate(ProposedCall(name=tc.name, args=tc.args or {},
                                         hitl_approved=tc.hitl_approved))
        if d.decision is Decision.BLOCK:
            would_block.append(tc.name)
        elif d.decision is Decision.REQUIRE_APPROVAL:
            would_hold.append(tc.name)

    if would_block:
        return [fail_finding(
            finding_id="MON-GUARD-001", phase=PHASE, test_name="guard_would_block",
            severity=Severity.CRITICAL,
            title=f"Run {run.run_id}: Guard would BLOCK {len(would_block)} action(s): {', '.join(would_block)}",
            description="An inline CertifyAI Guard would have prevented these actions from "
                        "executing (destructive + broad scope, catastrophic argument pattern, "
                        "or unscoped mass mutation). In observe-only mode they were NOT stopped.",
            remediation="Enable the inline Guard so these actions are blocked before execution.",
            standards=std,
            evidence=[Evidence(kind="guard_decision", content=str(would_block))],
        )]
    if would_hold:
        return [fail_finding(
            finding_id="MON-GUARD-002", phase=PHASE, test_name="guard_would_block",
            severity=Severity.WARNING,
            title=f"Run {run.run_id}: Guard would hold {len(would_hold)} action(s) for approval: {', '.join(would_hold)}",
            description="An inline Guard would have required human approval before these "
                        "state-changing actions ran.",
            remediation="Route these tools through the Guard with an approval handler.",
            standards=std,
            evidence=[Evidence(kind="guard_decision", content=str(would_hold))],
        )]
    return [pass_finding(
        finding_id="MON-GUARD-000", phase=PHASE, test_name="guard_would_block",
        title=f"Run {run.run_id}: no action would be blocked or held by the Guard",
        standards=std,
    )]


# Registry of per-run checks (window-only checks handled separately by the engine)
PER_RUN_CHECKS = [
    check_token_overrun,
    check_step_loop,
    check_task_drift,
    check_hitl_bypass,
    check_risky_decisions,
    check_pii_leak,
    check_guard_would_block,
]
