#!/usr/bin/env python3
"""
LIVE SMOKE TEST — Azure AI Foundry (Foundry Agent Service)
==========================================================
Run in YOUR environment with a real Foundry project to confirm the connector's
field-mappings match your tenant. The sandbox where this was built cannot reach
Azure, so this validation is yours to run.

Checks both sides end to end:
  1. CERTIFY  — FoundryAdapter fetches an agent (assistant) definition and maps
     it to a manifest (config only; the agent is NOT run).
  2. MONITOR  — FoundrySource lists recent threads/runs and normalizes them into
     RunRecords.

Both halves are READ-ONLY (GET requests). Nothing is created or invoked.

------------------------------------------------------------------------------
PREREQUISITES
------------------------------------------------------------------------------
1. An Azure AI Foundry project with at least one agent (assistant) and, ideally,
   some past runs so the monitor half has data.
2. `pip install azure-identity` and sign in:  `az login`
   (or provide a managed identity / service principal via env vars — anything
   DefaultAzureCredential accepts). Your identity needs at least the Azure AI
   User RBAC role on the project.
3. Export:

     export FOUNDRY_PROJECT_ENDPOINT="https://<res>.services.ai.azure.com/api/projects/<proj>"
     export FOUNDRY_ASSISTANT_ID="asst_..."       # the agent to certify/monitor
     # optional: export FOUNDRY_API_VERSION="2025-05-01"

USAGE:
     python smoke_foundry.py
     python smoke_foundry.py --skip-monitor      # certify (definition) only
     python smoke_foundry.py --skip-certify      # monitor (runs) only
"""
from __future__ import annotations
import argparse
import os
import sys

REQUIRED = ["FOUNDRY_PROJECT_ENDPOINT", "FOUNDRY_ASSISTANT_ID"]


def _ok(m): print(f"  \033[32m✓\033[0m {m}")
def _bad(m): print(f"  \033[31m✗\033[0m {m}")
def _hdr(m): print(f"\n{'='*70}\n{m}\n{'='*70}")


def _check_env():
    missing = [v for v in REQUIRED if not os.environ.get(v)]
    if missing:
        print("✗ Missing environment variables:", ", ".join(missing))
        return False
    return True


def test_certify() -> bool:
    _hdr("PART 1 — CERTIFY side: fetch + map the agent definition")
    from agent_audit.sources.foundry_adapter import FoundryAdapter
    spec = {
        "project_endpoint": os.environ["FOUNDRY_PROJECT_ENDPOINT"],
        "assistant_id": os.environ["FOUNDRY_ASSISTANT_ID"],
        "api_version": os.environ.get("FOUNDRY_API_VERSION", "2025-05-01"),
    }
    try:
        m = FoundryAdapter().extract(spec, agent_name="smoke-test")
        _ok(f"fetched assistant → agent_name={m.agent_name!r}")
        _ok(f"tools mapped: {[t.name for t in m.capabilities.tools]}")
        _ok(f"model: {m.models[0].model_id if m.models else '(none)'}")
        _ok(f"instructions captured: {'yes' if m.prompts else 'no'}")
        assert m.agent_name, "empty agent_name — mapping drift"
        _ok("field-mapping assertions passed")
        return True
    except Exception as e:  # noqa: BLE001
        _bad(f"{type(e).__name__}: {e}")
        _bad("Common causes: wrong project_endpoint format, assistant_id not found,")
        _bad("az login not done, or the identity lacks the Azure AI User role.")
        _bad("Endpoint must look like https://<res>.services.ai.azure.com/api/projects/<proj>")
        return False


def test_monitor() -> bool:
    _hdr("PART 2 — MONITOR side: list recent threads/runs (read-only)")
    from agent_audit.monitor.sources import FoundrySource
    cfg = {
        "project_endpoint": os.environ["FOUNDRY_PROJECT_ENDPOINT"],
        "assistant_id": os.environ.get("FOUNDRY_ASSISTANT_ID"),
        "api_version": os.environ.get("FOUNDRY_API_VERSION", "2025-05-01"),
    }
    try:
        runs = FoundrySource(cfg).fetch_runs(limit=5)
        _ok(f"pulled {len(runs)} recent run(s)")
        if not runs:
            print("  (no runs found — invoke the agent a few times, then retry)")
            return True
        r = runs[0]
        _ok(f"newest run_id={r.run_id} outcome={r.outcome} "
            f"tokens={r.tokens_prompt}+{r.tokens_completion} tools={len(r.tool_calls)}")
        assert r.source == "foundry" and r.run_id
        _ok("RunRecord field-mapping assertions passed")
        return True
    except Exception as e:  # noqa: BLE001
        _bad(f"{type(e).__name__}: {e}")
        _bad("Common causes: identity lacks read on threads/runs, wrong api-version,")
        _bad("or the threads/runs response shape differs from what the source expects.")
        return False


def main():
    ap = argparse.ArgumentParser(description="Live smoke test for Azure AI Foundry")
    ap.add_argument("--skip-certify", action="store_true")
    ap.add_argument("--skip-monitor", action="store_true")
    args = ap.parse_args()
    print("Azure AI Foundry — Live Tenant Smoke Test")
    if not _check_env():
        sys.exit(2)
    results = []
    if not args.skip_certify:
        results.append(test_certify())
    if not args.skip_monitor:
        results.append(test_monitor())
    _hdr("RESULT")
    if all(results):
        print("  \033[32mALL CHECKS PASSED\033[0m — connector matches this Foundry project.")
        sys.exit(0)
    print("  \033[31mSOME CHECKS FAILED\033[0m — see field-mapping notes above.")
    sys.exit(1)


if __name__ == "__main__":
    main()
