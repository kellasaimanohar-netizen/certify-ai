"""Run the REAL audit phases against each simulated vendor agent and compare.

How it works: the audit phases call ``ctx.call_agent``, which in mock mode
builds a ``MockAgentClient``. We swap that class for each vendor agent, so the
phases' real probe/classify/score logic runs unchanged against each agent.
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path

from vendor_agents import VENDORS

from agent_audit.runner import run_audit
from agent_audit.sources import load_target


def _find_target_yaml() -> Path:
    # 1. Check environment variable
    env_target = os.getenv("AGENT_AUDIT_TARGET")
    if env_target:
        p = Path(env_target).resolve()
        if p.is_file():
            return p

    # 2. Check targets/ directory
    workspace_root = Path(__file__).resolve().parent.parent
    targets_dir = workspace_root / "targets"
    if targets_dir.is_dir():
        yamls = list(targets_dir.glob("*.yaml")) + list(targets_dir.glob("*.yml"))
        if yamls:
            return yamls[0]

    # 3. Check workspace root
    root_yamls = list(workspace_root.glob("*.yaml")) + list(workspace_root.glob("*.yml"))
    if root_yamls:
        return root_yamls[0]

    # 4. Check Customer_Agent 2 folder
    cust_path = Path("C:/Personal/Customer_Agent 2/customer_agent_v2_audit.yaml")
    if cust_path.is_file():
        return cust_path

    raise FileNotFoundError(
        "No agent target YAML file found. Please set the AGENT_AUDIT_TARGET environment variable."
    )

TARGET = _find_target_yaml()

# The phases we run. (Skip repo/source-only phases that don't probe the agent.)
DEMO_PHASES = ["reliability", "security", "adversarial", "multi_turn", "data_governance"]


def _install_vendor(agent_cls) -> None:
    """Make ctx.call_agent (mock branch) use this vendor agent."""
    import agent_audit.mock_client as mc
    mc.MockAgentClient = agent_cls
    # PhaseContext imports MockAgentClient lazily inside call_agent, so patching
    # the module attribute is enough.


async def audit_vendor(name: str, agent_cls) -> dict:
    _install_vendor(agent_cls)
    manifest = load_target(str(TARGET))
    report = await run_audit(
        manifest,
        phases=DEMO_PHASES,
        mode="certify",
        mock_tools=True,          # offline; vendor agent stands in for the live one
        variability_runs=12,      # enough for stable Wilson intervals
    )
    crit = report.critical_failures
    warn = report.warnings
    return {
        "name": name,
        "trust_score": report.trust_score,
        "enterprise_ready": report.enterprise_ready,
        "n_findings": len(report.findings),
        "n_pass": len(report.passes),
        "n_critical": len(crit),
        "n_warn": len(warn),
        "critical_titles": [f.title for f in crit],
        "warn_titles": [f.title for f in warn],
    }


async def main() -> None:
    results = []
    for name, cls in VENDORS.items():
        results.append(await audit_vendor(name, cls))

    # ── comparison table ──
    print("\n" + "=" * 78)
    print("PRE-DEPLOYMENT AGENT AUDIT — three vendors, identical test battery")
    print("=" * 78)
    header = f"{'Vendor':<12} {'Trust':>6} {'Ready':>6} {'Pass':>5} {'Crit':>5} {'Warn':>5}"
    print(header)
    print("-" * 78)
    for r in results:
        print(f"{r['name']:<12} {r['trust_score']:>5}% "
              f"{('YES' if r['enterprise_ready'] else 'NO'):>6} "
              f"{r['n_pass']:>5} {r['n_critical']:>5} {r['n_warn']:>5}")
    print("-" * 78)

    for r in results:
        print(f"\n### {r['name']} — trust {r['trust_score']}%, "
              f"{'DEPLOYABLE' if r['enterprise_ready'] else 'BLOCKED (critical failures)'}")
        if r["critical_titles"]:
            print("  CRITICAL:")
            for t in r["critical_titles"]:
                print(f"    ✗ {t}")
        if r["warn_titles"]:
            print("  WARNINGS:")
            for t in r["warn_titles"]:
                print(f"    ! {t}")
        if not r["critical_titles"] and not r["warn_titles"]:
            print("    (no critical or warning findings)")

    return results


if __name__ == "__main__":
    asyncio.run(main())
