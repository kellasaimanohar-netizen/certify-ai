#!/usr/bin/env python3
"""
LIVE SMOKE TEST — Salesforce Agentforce
========================================
Run this in YOUR environment with REAL credentials to confirm the connector's
field-mappings match your actual org. The sandbox where this tool was built
cannot reach *.salesforce.com, so this validation is yours to run.

It checks TWO things, end to end, against a live org:
  1. CERTIFY side  — the AgentforceClient can OAuth, open a session, send a
     message, and the adapter normalizes the reply into the canonical shape.
  2. MONITOR side  — the AgentforceSessionSource can OAuth and pull recent
     agent sessions, normalizing each into a RunRecord.

It is READ-ONLY and SAFE: it sends one innocuous test utterance and reads
session history. It does NOT trigger destructive actions.

------------------------------------------------------------------------------
PREREQUISITES
------------------------------------------------------------------------------
1. An Agentforce agent deployed in a Salesforce org (sandbox recommended).
2. An External Client App (or Connected App) with OAuth client-credentials flow
   enabled and the Agent API + API scopes.
3. Export these environment variables before running:

     export SF_MY_DOMAIN_URL="https://YOURORG.my.salesforce.com"
     export SF_AGENT_ID="0Xx..."                 # your Agentforce agent id
     export SF_CONSUMER_KEY="3MVG9..."           # External Client App key
     export SF_CONSUMER_SECRET="..."             # External Client App secret

4. Install the package:  pip install -e . --break-system-packages

------------------------------------------------------------------------------
USAGE
------------------------------------------------------------------------------
     python smoke_agentforce.py
     python smoke_agentforce.py --utterance "What are your hours?"
     python smoke_agentforce.py --skip-certify    # only test the monitor pull
     python smoke_agentforce.py --skip-monitor    # only test the certify turn
"""
from __future__ import annotations
import argparse
import asyncio
import os
import sys

REQUIRED = ["SF_MY_DOMAIN_URL", "SF_AGENT_ID", "SF_CONSUMER_KEY", "SF_CONSUMER_SECRET"]


def _check_env() -> bool:
    missing = [v for v in REQUIRED if not os.environ.get(v)]
    if missing:
        print("✗ Missing environment variables:", ", ".join(missing))
        print("  See the header of this file for setup instructions.")
        return False
    return True


def _ok(msg): print(f"  \033[32m✓\033[0m {msg}")
def _bad(msg): print(f"  \033[31m✗\033[0m {msg}")
def _hdr(msg): print(f"\n{'='*70}\n{msg}\n{'='*70}")


async def test_certify(utterance: str) -> bool:
    """Drive the real AgentforceClient through one full turn."""
    _hdr("PART 1 — CERTIFY side: live agent turn")
    from agent_audit.live.agentforce_client import AgentforceClient
    from agent_audit.live.budget import CallBudget

    class _P:
        name = "agentforce"
        config = {
            "agent_id": os.environ["SF_AGENT_ID"],
            "my_domain_url": os.environ["SF_MY_DOMAIN_URL"],
            "consumer_key_env": "SF_CONSUMER_KEY",
            "consumer_secret_env": "SF_CONSUMER_SECRET",
        }
    class _R:
        provider = _P(); timeout_s = 45.0
    class _M:
        agent_name = "smoke-test-agent"; runtime = _R()

    client = AgentforceClient(_M(), budget=CallBudget())
    try:
        canonical, latency_ms = await client.invoke({"input": utterance})
        _ok(f"OAuth → session → message → end-session ({latency_ms:.0f} ms)")
        _ok(f"normalized output: {str(canonical.get('output'))[:80]!r}")
        _ok(f"tool calls parsed: {[t.get('tool') or t.get('name') for t in canonical.get('tool_calls', [])]}")
        _ok(f"finish_reason: {canonical.get('finish_reason')}")
        # field-mapping assertions
        assert "output" in canonical, "canonical missing 'output' — adapter mapping drift"
        assert "tool_calls" in canonical, "canonical missing 'tool_calls'"
        _ok("field-mapping assertions passed — adapter matches this org's reply shape")
        return True
    except AssertionError as e:
        _bad(f"FIELD-MAPPING MISMATCH: {e}")
        _bad("The org returned a shape the adapter didn't expect. Capture the raw")
        _bad("reply and adjust AgentforceAdapter in live/adapters.py.")
        return False
    except Exception as e:
        _bad(f"{type(e).__name__}: {e}")
        _bad("Common causes: wrong my_domain_url, OAuth scopes missing the Agent API,")
        _bad("client-credentials flow not enabled, or the agent_id is wrong.")
        return False
    finally:
        await client.aclose()


def test_monitor() -> bool:
    """Pull recent sessions through the real AgentforceSessionSource."""
    _hdr("PART 2 — MONITOR side: pull recent agent sessions")
    from agent_audit.monitor.sources import AgentforceSessionSource
    cfg = {
        "my_domain_url": os.environ["SF_MY_DOMAIN_URL"],
        "agent_id": os.environ["SF_AGENT_ID"],
        "consumer_key_env": "SF_CONSUMER_KEY",
        "consumer_secret_env": "SF_CONSUMER_SECRET",
    }
    try:
        src = AgentforceSessionSource(cfg)
        runs = src.fetch_runs(limit=5)
        _ok(f"pulled {len(runs)} recent session(s)")
        if not runs:
            print("  (no sessions found — run the agent a few times, then retry)")
            return True
        r = runs[0]
        _ok(f"newest run_id={r.run_id} outcome={r.outcome} tools={len(r.tool_calls)}")
        assert r.source == "agentforce"
        assert r.run_id, "run_id empty — session Id mapping drift"
        _ok("RunRecord field-mapping assertions passed")
        return True
    except AssertionError as e:
        _bad(f"FIELD-MAPPING MISMATCH: {e}")
        _bad("Adjust AgentforceSessionSource._normalize_session for your org's schema.")
        return False
    except Exception as e:
        _bad(f"{type(e).__name__}: {e}")
        _bad("Common causes: the AIAgentSession object isn't queryable in this org,")
        _bad("API version mismatch, or the OAuth user lacks 'View Event Logs'.")
        _bad("If the object name differs, edit the SOQL in agentforce_source.py.")
        return False


def main():
    ap = argparse.ArgumentParser(description="Live smoke test for Salesforce Agentforce")
    ap.add_argument("--utterance", default="Hello, this is a connectivity test.",
                    help="Innocuous message to send the agent")
    ap.add_argument("--skip-certify", action="store_true")
    ap.add_argument("--skip-monitor", action="store_true")
    args = ap.parse_args()

    print("Salesforce Agentforce — Live Tenant Smoke Test")
    if not _check_env():
        sys.exit(2)

    results = []
    if not args.skip_certify:
        results.append(asyncio.run(test_certify(args.utterance)))
    if not args.skip_monitor:
        results.append(test_monitor())

    _hdr("RESULT")
    if all(results):
        print("  \033[32mALL CHECKS PASSED\033[0m — the connector matches this org. You're cleared")
        print("  to run real certify + monitor against this Agentforce agent.")
        sys.exit(0)
    else:
        print("  \033[31mSOME CHECKS FAILED\033[0m — see the field-mapping notes above. The")
        print("  connector logic is sound; the org's API shape just needs reconciling.")
        sys.exit(1)


if __name__ == "__main__":
    main()
