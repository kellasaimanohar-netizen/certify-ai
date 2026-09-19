#!/usr/bin/env python3
"""
LIVE SMOKE TEST — Automation Anywhere
=====================================
Run in YOUR environment with REAL credentials to confirm the AA connector's
field-mappings match your Control Room.

Checks both sides end to end:
  1. CERTIFY  — AAAgentClient can authenticate to the Control Room and invoke
     the AI Agent Studio agent, with the adapter normalizing the reply.
  2. MONITOR  — AAControlRoomSource can pull recent agent activity/audit records
     and normalize each into a RunRecord.

READ-leaning: the monitor pull is read-only. The certify invoke RUNS THE AGENT —
use a sandbox/test agent, not a production money-mover.

------------------------------------------------------------------------------
PREREQUISITES
------------------------------------------------------------------------------
1. An Automation Anywhere Control Room with an AI Agent Studio agent.
2. An API user + API key (or a full bearer token).
3. Export:

     export AA_CONTROL_ROOM="https://your-cr.automationanywhere.digital"
     export AA_API_KEY="..."               # API key or token
     export AA_USERNAME="apiuser"          # optional if AA_API_KEY is a full token
     export AA_AGENT_ID="..."              # the agent to invoke (certify)
     export AA_AGENT_NAME="..."            # name to filter monitor activity (optional)

4. pip install -e . --break-system-packages

USAGE:
     python smoke_aa.py
     python smoke_aa.py --skip-certify     # monitor pull only (fully read-only)
"""
from __future__ import annotations
import argparse, asyncio, os, sys

REQUIRED = ["AA_CONTROL_ROOM", "AA_API_KEY"]


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
    _hdr("PART 1 — CERTIFY side: invoke the AI Agent Studio agent")
    if not _check_env(["AA_AGENT_ID"]):
        _bad("certify needs AA_AGENT_ID — skipping.")
        return False
    from agent_audit.live.aa_client import AAAgentClient
    from agent_audit.live.budget import CallBudget

    class _P:
        name = "automation_anywhere"
        config = {
            "control_room": os.environ["AA_CONTROL_ROOM"],
            "api_key_env": "AA_API_KEY",
            "username": os.environ.get("AA_USERNAME"),
            "agent_id": os.environ["AA_AGENT_ID"],
        }
    class _R:
        provider = _P(); timeout_s = 90.0
    class _M:
        agent_name = "smoke-test-agent"; runtime = _R()

    client = AAAgentClient(_M(), budget=CallBudget())
    try:
        canonical, latency_ms = await client.invoke({"input": "connectivity test"})
        _ok(f"Control Room auth + agent invoke returned ({latency_ms:.0f} ms)")
        _ok(f"normalized output: {str(canonical.get('output'))[:80]!r}")
        assert "output" in canonical and "tool_calls" in canonical
        _ok("field-mapping assertions passed")
        return True
    except AssertionError as e:
        _bad(f"FIELD-MAPPING MISMATCH: {e} — adjust the AA adapter.")
        return False
    except Exception as e:
        _bad(f"{type(e).__name__}: {e}")
        _bad("Common causes: wrong control_room URL, API key lacks AI Agent Studio")
        _bad("permission, or the agent_id is wrong.")
        return False
    finally:
        await client.aclose()


def test_monitor() -> bool:
    _hdr("PART 2 — MONITOR side: pull recent agent activity (read-only)")
    from agent_audit.monitor.sources import AAControlRoomSource
    cfg = {
        "control_room": os.environ["AA_CONTROL_ROOM"],
        "api_key_env": "AA_API_KEY",
        "username": os.environ.get("AA_USERNAME"),
        "agent_name": os.environ.get("AA_AGENT_NAME"),
    }
    try:
        runs = AAControlRoomSource(cfg).fetch_runs(limit=5)
        _ok(f"pulled {len(runs)} recent activity record(s)")
        if not runs:
            print("  (no activity found — run the agent a few times, then retry)")
            return True
        r = runs[0]
        _ok(f"newest run_id={r.run_id} outcome={r.outcome} tools={len(r.tool_calls)}")
        assert r.source == "automation_anywhere" and r.run_id
        _ok("RunRecord field-mapping assertions passed")
        return True
    except AssertionError as e:
        _bad(f"FIELD-MAPPING MISMATCH: {e} — adjust _normalize in aa_source.py.")
        return False
    except Exception as e:
        _bad(f"{type(e).__name__}: {e}")
        _bad("Common causes: auth endpoint differs, API key lacks audit-read, or the")
        _bad("activity record shape differs from what the source expects.")
        return False


def main():
    ap = argparse.ArgumentParser(description="Live smoke test for Automation Anywhere")
    ap.add_argument("--skip-certify", action="store_true")
    ap.add_argument("--skip-monitor", action="store_true")
    args = ap.parse_args()
    print("Automation Anywhere — Live Tenant Smoke Test")
    if not _check_env():
        sys.exit(2)
    results = []
    if not args.skip_certify:
        results.append(asyncio.run(test_certify()))
    if not args.skip_monitor:
        results.append(test_monitor())
    _hdr("RESULT")
    if all(results):
        print("  \033[32mALL CHECKS PASSED\033[0m — connector matches this Control Room.")
        sys.exit(0)
    print("  \033[31mSOME CHECKS FAILED\033[0m — see field-mapping notes above.")
    sys.exit(1)


if __name__ == "__main__":
    main()
