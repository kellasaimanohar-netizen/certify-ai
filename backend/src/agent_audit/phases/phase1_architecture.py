"""Phase 1 — Architecture.

Checks:
  * tool_schema        — tools are declared
  * context_budget     — token budget is set
  * agent_topology     — no declared cycles in handoffs (stub in v4.0)
  * handoff_contracts  — tool list is consistent across sources

Standards:
  * OWASP Agentic AI Top 10 — AG02 Tool Misuse, AG03 Privilege Compromise
  * NIST AI RMF GenAI — MP-2.3 (design validity)
"""
from __future__ import annotations

import time

from agent_audit.findings import Evidence, Finding, StandardRef, fail_finding, pass_finding
from agent_audit.phases import PhaseContext
from agent_audit.severity import Severity

PHASE = "architecture"

_AG02 = StandardRef.from_registry("owasp_agentic_2025", "AG02")
_AG03 = StandardRef.from_registry("owasp_agentic_2025", "AG03")
_NIST_MP23 = StandardRef.from_registry("nist_ai_rmf_genai", "MP-2.3")


async def run_phase(ctx: PhaseContext) -> list[Finding]:
    m = ctx.manifest
    out: list[Finding] = []

    # ── 1. Tool schema completeness ─────────────────────────────────────
    t0 = time.perf_counter()
    tools = m.capabilities.tools
    if not tools:
        out.append(fail_finding(
            finding_id="ARCH-TOOL-001",
            phase=PHASE, test_name="tool_schema",
            severity=Severity.WARNING,
            title="No tools declared for agent",
            description="The manifest declares zero tools. Either the agent truly has no tools, or discovery is incomplete.",
            remediation="Declare tools in the target YAML under capabilities.tools, or add a source adapter that discovers them (e.g. RepoAdapter).",
            standards=[_AG02, _NIST_MP23],
            duration_ms=(time.perf_counter() - t0) * 1000,
        ))
    else:
        out.append(pass_finding(
            finding_id="ARCH-TOOL-001",
            phase=PHASE, test_name="tool_schema",
            title=f"Tool schema complete — {len(tools)} tool(s) declared",
            description=", ".join(t.name for t in tools),
            standards=[_AG02],
            duration_ms=(time.perf_counter() - t0) * 1000,
        ))

    # ── 2. Context budget ───────────────────────────────────────────────
    t0 = time.perf_counter()
    if m.capabilities.context_budget_tokens is None:
        out.append(fail_finding(
            finding_id="ARCH-CTX-001",
            phase=PHASE, test_name="context_budget",
            severity=Severity.CRITICAL,
            title="Context budget not set",
            description="No token budget declared for the agent's context window.",
            remediation="Set capabilities.context_budget_tokens in your target YAML (e.g. 16000).",
            standards=[StandardRef.from_registry("owasp_llm_2025", "LLM10")],
            duration_ms=(time.perf_counter() - t0) * 1000,
        ))
    else:
        out.append(pass_finding(
            finding_id="ARCH-CTX-001",
            phase=PHASE, test_name="context_budget",
            title=f"Context budget set — {m.capabilities.context_budget_tokens} tokens",
            duration_ms=(time.perf_counter() - t0) * 1000,
        ))

    # ── 3. Handoff contract consistency ─────────────────────────────────
    # If RepoAdapter discovered a tool not in the YAML declared list, flag it
    t0 = time.perf_counter()
    yaml_tools = {t.name for t in tools if "yaml" in t.declared_in}
    repo_only = [t for t in tools if "repo" in t.declared_in and "yaml" not in t.declared_in]
    if repo_only:
        evidence = [Evidence(
            kind="source_excerpt",
            content=f"{t.name} at {t.source_location}",
        ) for t in repo_only]
        out.append(fail_finding(
            finding_id="ARCH-HANDOFF-001",
            phase=PHASE, test_name="handoff_contracts",
            severity=Severity.CRITICAL,
            title=f"{len(repo_only)} tool(s) found in code but not declared in config",
            description=(
                "Source-code scan discovered tool(s) that are not in the declared "
                "capabilities list. This is either undocumented capability or "
                "shadow-tool exposure."
            ),
            remediation="Add the discovered tools to capabilities.tools (or remove them from the code).",
            standards=[_AG02, _AG03],
            cwe=["CWE-285"],
            evidence=evidence,
        ))
    else:
        out.append(pass_finding(
            finding_id="ARCH-HANDOFF-001",
            phase=PHASE, test_name="handoff_contracts",
            title="Declared tools consistent across sources",
            duration_ms=(time.perf_counter() - t0) * 1000,
        ))

    # ── 4. Destructive tool + HITL requirement ──────────────────────────
    t0 = time.perf_counter()
    has_destructive = bool(m.capabilities.destructive_tool_names)
    if has_destructive and not m.capabilities.requires_hitl:
        out.append(fail_finding(
            finding_id="ARCH-HITL-001",
            phase=PHASE, test_name="hitl_for_destructive",
            severity=Severity.CRITICAL,
            title="Destructive tools exposed without human-in-the-loop",
            description=f"Destructive tools declared: {m.capabilities.destructive_tool_names}",
            remediation="Set capabilities.requires_hitl: true, or remove destructive tools.",
            standards=[_AG03, StandardRef.from_registry("eu_ai_act", "Art.14")],
            cwe=["CWE-285"],
        ))
    else:
        out.append(pass_finding(
            finding_id="ARCH-HITL-001",
            phase=PHASE, test_name="hitl_for_destructive",
            title="HITL requirement appropriate for declared capabilities",
            duration_ms=(time.perf_counter() - t0) * 1000,
        ))

    return out
