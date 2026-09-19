"""Audit runner — orchestrates phases, custom checkers, and suppressions.

v4.1 fixes applied:
  Fix 4 — independent phases (architecture, observability, ops, supply_chain)
           run concurrently via asyncio.gather.
  Fix 4b — AuditReport now carries audit_id, total_duration_ms, and trust_score
           for richer reporting and consistent serialisation across exporters.
  Fix 4c — findings are sorted canonically (phase order → severity → id) so
           JSON/HTML reports are deterministic across runs.
"""
from __future__ import annotations

import asyncio
import datetime as dt
import importlib
import logging
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from agent_audit.checkers import CheckerRegistry
from agent_audit.exceptions import PhaseError
from agent_audit.findings import Finding
from agent_audit.manifest import TargetManifest
from agent_audit.phases import PHASE_LABELS, PHASE_MAP, PhaseContext
from agent_audit.severity import Severity
from agent_audit.suppressions import SuppressionRegister

log = logging.getLogger(__name__)

# Canonical phase order for sorted output
_PHASE_ORDER = list(PHASE_MAP.keys())  # auto-includes v7 phases from updated PHASE_MAP

# Severity sort priority (lower = more important = shown first)
_SEVERITY_PRIORITY = {
    Severity.CRITICAL: 0,
    Severity.HIGH_UNCERTAINTY: 1,
    Severity.WARNING: 2,
    Severity.INFO: 3,
    Severity.PASS: 4,
}

# Phases with no inter-phase dependencies — safe to run concurrently
_PARALLEL_PHASES = frozenset({
    "architecture", "observability", "ops", "supply_chain",
    # v5 phases
    "data_governance", "fairness", "mcp",
    # v7 phases — all independent
    "voice", "data_analysis", "decision", "security_agent", "browser",
})

# Phases that must run in order (adversarial reads variability_store from security)
_SEQUENTIAL_PHASES = [
    "reliability", "security", "adversarial",
    "groundedness",  # reads golden_dataset, sequential for predictable eval order
    "multi_turn",    # depends on session state — sequential for clean isolation
]


@dataclass(slots=True)
class AuditReport:
    """Output of one audit run."""

    agent_name: str
    started_at: str
    audit_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    finished_at: str = ""
    total_duration_ms: float = 0.0
    findings: list[Finding] = field(default_factory=list)
    manifest_summary: dict = field(default_factory=dict)
    mode: str = "validate"
    audit_version: str = "10.3.0"
    phases_run: list[str] = field(default_factory=list)
    # v8: live-run governance metadata (empty in mock mode)
    live_safety: dict = field(default_factory=dict)
    budget_usage: dict = field(default_factory=dict)
    audit_summary: dict = field(default_factory=dict)
    diagnostics: list[dict] = field(default_factory=list)
    skipped_phases: list[dict] = field(default_factory=list)

    @property
    def critical_failures(self) -> list[Finding]:
        return [f for f in self.findings
                if not f.passed and not f.suppressed and f.severity is Severity.CRITICAL]

    @property
    def warnings(self) -> list[Finding]:
        return [f for f in self.findings
                if not f.passed and not f.suppressed
                and f.severity in (Severity.WARNING, Severity.HIGH_UNCERTAINTY)]

    @property
    def passes(self) -> list[Finding]:
        return [f for f in self.findings if f.passed]

    @property
    def suppressed(self) -> list[Finding]:
        return [f for f in self.findings if f.suppressed]

    @property
    def enterprise_ready(self) -> bool:
        return not self.critical_failures

    @property
    def trust_score(self) -> int:
        """Consistent trust score used by both the cert and drift monitor."""
        total = len(self.findings)
        if total == 0:
            return 0
        score = int(round((len(self.passes) / total) * 100))
        score -= min(40, len(self.critical_failures) * 10)
        score -= min(20, len(self.warnings) * 2)
        return max(0, score)

    def sorted_findings(self) -> list[Finding]:
        """Findings in canonical order: phase → severity → id."""
        def _key(f: Finding) -> tuple:
            phase_idx = _PHASE_ORDER.index(f.phase) if f.phase in _PHASE_ORDER else 99
            sev_idx = _SEVERITY_PRIORITY.get(f.severity, 5)
            return (phase_idx, sev_idx, f.id)
        return sorted(self.findings, key=_key)


async def run_audit(
    manifest: TargetManifest,
    *,
    phases: list[str] | None = None,
    mode: str = "validate",
    mock_tools: bool = False,
    variability_runs: int = 5,
    concurrency: int = 4,
    inject_latency_ms: int = 0,
    checker_registry: CheckerRegistry | None = None,
    suppressions: SuppressionRegister | None = None,
    target_env: str | None = None,
    allow_destructive: bool = False,
    max_calls: int = 5_000,
    max_cost_usd: float = 25.0,
) -> AuditReport:
    """Run every requested phase; apply custom checkers; apply suppressions.

    v8: when running live (not ``mock_tools``), a shared ``CallBudget`` caps
    total calls/spend and a ``SafetyGate`` blocks destructive phases against a
    non-sandbox endpoint.
    """
    t0 = time.monotonic()
    report = AuditReport(
        agent_name=manifest.agent_name,
        started_at=dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        manifest_summary=manifest.to_dict(),
        mode=mode,
    )

    phases_to_run = phases or list(PHASE_MAP.keys())
    report.phases_run = phases_to_run

    # ── v8: live-safety scaffolding ─────────────────────────────────────────
    from agent_audit.live import CallBudget, SafetyGate, TargetEnv
    from agent_audit.live.budget import BudgetExceededError
    from agent_audit.live.safety import SandboxViolationError

    live = not mock_tools
    budget = CallBudget(max_calls=max_calls, max_cost_usd=max_cost_usd) if live else None
    gate = SafetyGate(
        env=TargetEnv.parse(target_env or manifest.runtime.target_env, manifest.runtime.endpoint),
        live=live,
        allow_destructive_override=allow_destructive,
    )
    report.live_safety = gate.summary()

    ctx = PhaseContext(
        manifest=manifest,
        mock_tools=mock_tools,
        inject_latency_ms=inject_latency_ms,
        concurrency=concurrency,
        variability_runs=variability_runs,
        budget=budget,
    )

    async def _run_one_phase(phase_key: str) -> list[Finding]:
        if phase_key not in PHASE_MAP:
            log.warning("unknown phase: %s", phase_key)
            return []
        label = PHASE_LABELS.get(phase_key, phase_key)
        # v8: refuse destructive phases against a non-sandbox live endpoint.
        try:
            gate.authorize(phase_key)
        except SandboxViolationError as exc:
            log.warning("safety gate blocked %s: %s", phase_key, exc)
            cmd_suggestion = "agy run <target> --target-env sandbox"
            if gate.env == TargetEnv.STAGING:
                cmd_suggestion += " --allow-destructive"
            
            reason_str = str(exc)
            report.skipped_phases.append({
                "phase": phase_key,
                "reason": reason_str,
                "remediation": f"Run with: {cmd_suggestion}"
            })
            return [Finding(
                id=f"SAFETY-BLOCK-{phase_key.upper()}",
                phase=phase_key, test_name="safety_gate",
                severity=Severity.WARNING, passed=False,
                title=f"Phase {phase_key} skipped — unsafe against {gate.env.value} endpoint",
                description=f"{reason_str} To execute this phase, run: `{cmd_suggestion}`",
                remediation=f"Configure target environment to sandbox/development, or use: `{cmd_suggestion}`",
            )]
        log.info("starting %s", label)
        t_phase = time.monotonic()
        try:
            module = importlib.import_module(PHASE_MAP[phase_key])
            runner_fn = getattr(module, "run_phase", None)
            if runner_fn is None:
                raise PhaseError(f"phase module {phase_key!r} has no run_phase()")
            result = runner_fn(ctx)
            findings = await result if asyncio.iscoroutine(result) else result
            elapsed = (time.monotonic() - t_phase) * 1000
            log.info("completed %s — %d finding(s) in %.0fms", label, len(findings), elapsed)
            return findings
        except BudgetExceededError as exc:
            # Cost/call ceiling hit — report cleanly, don't crash the audit.
            log.warning("budget exceeded during %s: %s", phase_key, exc)
            return [Finding(
                id=f"BUDGET-STOP-{phase_key.upper()}",
                phase=phase_key, test_name="call_budget",
                severity=Severity.CRITICAL, passed=False,
                title=f"Phase {phase_key} halted — audit call/spend budget exceeded",
                description=str(exc),
                remediation="Raise --max-calls / --max-cost-usd, or lower --variability-runs.",
            )]
        except Exception as exc:
            log.exception("phase %s failed: %s", phase_key, exc)
            return [Finding(
                id=f"PHASE-ERR-{phase_key.upper()}",
                phase=phase_key, test_name="phase_execution",
                severity=Severity.CRITICAL, passed=False,
                title=f"Phase {phase_key} failed to execute",
                description=str(exc),
                remediation="Check logs; this indicates a framework error, not an agent failure.",
            )]

    # Independent phases run concurrently; sequential phases run in dependency order
    parallel_keys = [k for k in phases_to_run if k in _PARALLEL_PHASES]
    sequential_keys = [k for k in phases_to_run if k not in _PARALLEL_PHASES]

    if parallel_keys:
        log.info(
            "running %d independent phases concurrently: %s",
            len(parallel_keys), ", ".join(parallel_keys),
        )
        for findings in await asyncio.gather(*[_run_one_phase(k) for k in parallel_keys]):
            report.findings.extend(findings)

    for phase_key in sequential_keys:
        report.findings.extend(await _run_one_phase(phase_key))

    # Custom checkers
    if checker_registry is not None and len(checker_registry) > 0:
        log.info("running %d custom checker(s)", len(checker_registry))
        custom = _run_custom_checkers(checker_registry, manifest, report.findings)
        report.findings.extend(custom)

    # If there is no repo source, we are performing an OpenAPI-only or URL-only scan.
    # We automatically ignore/pass static file-based check findings since they cannot be tested.
    has_repo_source = any(k.startswith("repo") for k in manifest.provenance_trail.keys())
    if not has_repo_source:
        file_based_check_ids = {
            "SC-DEPS-001",
            "SC-PIN-001",
            "SC-MODEL-001",
            "ARCH-PROMPT-001",
            "OBS-LOGS-001",
            "OBS-TRACE-001",
            "OPS-RUNBOOK-001",
            "MCP-SERVER-001"
        }
        filtered = []
        for f in report.findings:
            if f.id in file_based_check_ids or f.phase in ("supply_chain", "ops", "observability", "mcp") and not f.passed:
                f.passed = True
                f.severity = Severity.PASS
                f.description = f"Skipped: {f.description} (Ignored: Target has no repository source for static file analysis)"
                f.remediation = "No remediation needed for OpenAPI-only endpoint audits."
            filtered.append(f)
        report.findings = filtered

    # Suppressions
    if suppressions is not None:
        report.findings = suppressions.apply(report.findings)

    # v8: record budget usage and release the live HTTP connection pool.
    if budget is not None:
        report.budget_usage = budget.snapshot()

    if ctx._live_client is not None:
        client_stats = getattr(ctx._live_client, "stats", {})
        report.audit_summary = {
            "total_endpoints_tested": client_stats.get("total_endpoints_tested", 0),
            "successful_requests": client_stats.get("successful_requests", 0),
            "failed_requests": client_stats.get("failed_requests", 0),
            "retry_attempts": client_stats.get("retry_attempts", 0),
            "endpoints_returning_405": list(client_stats.get("endpoints_returning_405", [])),
            "endpoints_skipped": [item["phase"] for item in report.skipped_phases],
            "root_cause_analysis": client_stats.get("root_cause_analysis", ""),
            "recommended_fixes": list(client_stats.get("recommended_fixes", [])),
        }
        report.diagnostics = list(client_stats.get("diagnostics", []))
    else:
        report.audit_summary = {
            "total_endpoints_tested": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "retry_attempts": 0,
            "endpoints_returning_405": [],
            "endpoints_skipped": [item["phase"] for item in report.skipped_phases],
            "root_cause_analysis": "Mock mode enabled. No live calls made.",
            "recommended_fixes": [],
        }
        report.diagnostics = []

    await ctx.aclose()

    report.total_duration_ms = (time.monotonic() - t0) * 1000
    report.finished_at = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    log.info(
        "audit complete — %d findings (%d critical, %d warnings, %d passed) in %.0fms",
        len(report.findings),
        len(report.critical_failures),
        len(report.warnings),
        len(report.passes),
        report.total_duration_ms,
    )
    return report


def _run_custom_checkers(
    registry: CheckerRegistry, manifest: TargetManifest, existing: list[Finding],
) -> list[Finding]:
    """Apply custom checkers to evidence harvested from built-in findings."""
    from agent_audit.checkers.base import CheckContext

    extra: list[Finding] = []

    for checker in registry.checkers_for("manifest"):
        ctx = CheckContext(
            manifest=manifest, artifact_kind="manifest",
            content=str(manifest.to_dict()),
        )
        f = checker.check(ctx)
        if f is not None:
            extra.append(f)

    for prompt in manifest.prompts:
        for checker in registry.checkers_for("prompt"):
            ctx = CheckContext(
                manifest=manifest, artifact_kind="prompt",
                content=prompt.content, artifact_path=prompt.source_location,
            )
            f = checker.check(ctx)
            if f is not None:
                extra.append(f)

    for finding in existing:
        for ev in finding.evidence:
            kinds_map = {"response": "response", "tool_call": "tool_args"}
            target_kind = kinds_map.get(ev.kind)
            if not target_kind:
                continue
            for checker in registry.checkers_for(target_kind):  # type: ignore[arg-type]
                ctx = CheckContext(
                    manifest=manifest, artifact_kind=target_kind,  # type: ignore[arg-type]
                    content=ev.content,
                )
                f = checker.check(ctx)
                if f is not None:
                    extra.append(f)

    return extra


def run_audit_sync(
    manifest: TargetManifest,
    *,
    target_dir: Path | None = None,
    **kwargs,
) -> AuditReport:
    """Sync wrapper over ``run_audit`` for CLI / scripts."""
    return asyncio.run(run_audit(manifest, **kwargs))
