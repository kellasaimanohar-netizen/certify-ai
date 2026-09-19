#!/usr/bin/env python3
"""
LIVE SMOKE TEST — UiPath
========================
Run in YOUR environment with REAL credentials to confirm the UiPath connector's
field-mappings match your Orchestrator tenant.

Checks both sides end to end:
  1. CERTIFY  — UiPathAgentClient can OAuth (Identity Server) and invoke the
     agent process, with the adapter normalizing the reply.
  2. MONITOR  — UiPathOrchestratorSource can pull recent Jobs via the OData API
     and normalize each into a RunRecord.

READ-leaning: the monitor pull is read-only. The certify invoke STARTS A JOB —
point it at a sandbox/test process, not a production money-mover.

------------------------------------------------------------------------------
PREREQUISITES
------------------------------------------------------------------------------
1. A UiPath Automation Cloud tenant with an agent process published.
2. An External Application (OAuth client-credentials) with scopes:
     OR.Jobs  OR.Monitoring  OR.Audit  OR.Execution
3. Export:

     export UIPATH_BASE_URL="https://cloud.uipath.com/ACCOUNT/TENANT"
     export UIPATH_CLIENT_ID="..."
     export UIPATH_CLIENT_SECRET="..."
     export UIPATH_RELEASE_KEY="..."        # the agent process release key (certify)
     export UIPATH_FOLDER_ID="..."          # Orchestrator folder id (certify)
     export UIPATH_PROCESS_KEY="..."        # ProcessKey to filter monitor jobs (optional)

4. pip install -e . --break-system-packages

USAGE:
     python smoke_uipath.py
     python smoke_uipath.py --skip-certify     # monitor pull only (fully read-only)
"""
from __future__ import annotations
import argparse, asyncio, os, sys

REQUIRED = ["UIPATH_BASE_URL", "UIPATH_CLIENT_ID", "UIPATH_CLIENT_SECRET"]


def _ok(m): print(f"  \033[32m✓\033[0m {m}")
def _bad(m): print(f"  \033[31m✗\033[0m {m}")
def _hdr(m): print(f"\n{'='*70}\n{m}\n{'='*70}")


def _check_env(extra=()):
    missing = [v for v in list(REQUIRED) + list(extra) if not os.environ.get(v)]
    if missing:
        print("✗ Missing environment variables:", ", ".join(missing))
        return False
    return True


async def test_certify() -> bool:
    _hdr("PART 1 — CERTIFY side: invoke the agent process (starts a job)")
    if not _check_env(["UIPATH_RELEASE_KEY", "UIPATH_FOLDER_ID"]):
        _bad("certify needs UIPATH_RELEASE_KEY and UIPATH_FOLDER_ID — skipping.")
        return False
    from agent_audit.live.uipath_client import UiPathAgentClient
    from agent_audit.live.budget import CallBudget

    class _P:
        name = "uipath"
        config = {
            "base_url": os.environ["UIPATH_BASE_URL"],
            "client_id_env": "UIPATH_CLIENT_ID",
            "client_secret_env": "UIPATH_CLIENT_SECRET",
            "release_key": os.environ["UIPATH_RELEASE_KEY"],
            "folder_id": os.environ["UIPATH_FOLDER_ID"],
        }
    class _R:
        provider = _P(); timeout_s = 90.0
    class _M:
        agent_name = "smoke-test-agent"; runtime = _R()

    client = UiPathAgentClient(_M(), budget=CallBudget())
    try:
        canonical, latency_ms = await client.invoke({"input": "connectivity test"})
        _ok(f"OAuth + job start/poll returned ({latency_ms:.0f} ms)")
        _ok(f"normalized output: {str(canonical.get('output'))[:80]!r}")
        assert "output" in canonical and "tool_calls" in canonical
        _ok("field-mapping assertions passed")
        return True
    except AssertionError as e:
        _bad(f"FIELD-MAPPING MISMATCH: {e} — adjust the UiPath adapter.")
        return False
    except Exception as e:
        _bad(f"{type(e).__name__}: {e}")
        _bad("Common causes: wrong base_url/release_key/folder_id, missing OR.Execution")
        _bad("scope, or the process isn't published to that folder.")
        return False
    finally:
        await client.aclose()


def test_monitor() -> bool:
    _hdr("PART 2 — MONITOR side: pull recent Jobs (read-only)")
    from agent_audit.monitor.sources import UiPathOrchestratorSource
    cfg = {
        "base_url": os.environ["UIPATH_BASE_URL"],
        "client_id_env": "UIPATH_CLIENT_ID",
        "client_secret_env": "UIPATH_CLIENT_SECRET",
        "agent_name": os.environ.get("UIPATH_PROCESS_KEY"),
    }
    try:
        runs = UiPathOrchestratorSource(cfg).fetch_runs(limit=5)
        _ok(f"pulled {len(runs)} recent job(s)")
        if not runs:
            print("  (no jobs found — run the process a few times, then retry)")
            return True
        r = runs[0]
        _ok(f"newest run_id={r.run_id} outcome={r.outcome} tools={len(r.tool_calls)}")
        assert r.source == "uipath" and r.run_id
        _ok("RunRecord field-mapping assertions passed")
        return True
    except AssertionError as e:
        _bad(f"FIELD-MAPPING MISMATCH: {e} — adjust _normalize_job in uipath_source.py.")
        return False
    except Exception as e:
        _bad(f"{type(e).__name__}: {e}")
        _bad("Common causes: OR.Jobs scope missing, wrong base_url, or OData Jobs")
        _bad("entity shape differs (check $expand=Release).")
        return False


def main():
    ap = argparse.ArgumentParser(description="Live smoke test for UiPath")
    ap.add_argument("--skip-certify", action="store_true")
    ap.add_argument("--skip-monitor", action="store_true")
    args = ap.parse_args()
    print("UiPath — Live Tenant Smoke Test")
    if not _check_env():
        sys.exit(2)
    results = []
    if not args.skip_certify:
        results.append(asyncio.run(test_certify()))
    if not args.skip_monitor:
        results.append(test_monitor())
    _hdr("RESULT")
    if all(results):
        print("  \033[32mALL CHECKS PASSED\033[0m — connector matches this tenant.")
        sys.exit(0)
    print("  \033[31mSOME CHECKS FAILED\033[0m — see field-mapping notes above.")
    sys.exit(1)


if __name__ == "__main__":
    main()
