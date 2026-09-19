# Changelog

## 10.3.0

### CertifyAI Guard — in-path enforcement (new capability)
The monitor detects bad actions *after* they happen; the Guard *stops* them
*before* they execute. New `agent_audit.guard` subpackage:
- **PolicyEngine** — deterministic, offline decision core. Aggregates rules
  (most-restrictive wins); ALLOW / REQUIRE_APPROVAL / BLOCK.
- **Fail-closed on major actions** — if a rule errors on a destructive/broad
  action it BLOCKS; benign actions fail-open so the guard is never an outage.
- **Argument-aware policy** — blocks destructive-verb + broad-scope (rm -rf /,
  delete path=/), catastrophic argument patterns regardless of verb name
  (copy dst=/dev/null, run cmd='rm -rf /'), and unscoped SQL mutation
  (DELETE without WHERE). Production-targeted destructive actions require human
  approval; a BLOCK can never be downgraded by approval.
- **Broker** — `guard_tool` wraps a real callable so it only runs on ALLOW;
  BLOCK raises `BlockedActionError` and the real function never executes.
  Approval handler defaults to deny (fail-safe). Every decision is audited.
- **Monitor bridge** — new checks MON-GUARD-001/002/000 replay each run's tool
  calls through the Guard to show what an inline Guard would have blocked/held,
  so observe-only deployments see the enforcement value before enabling it.
- +20 tests (236 total).

Honest scope: the Guard can only enforce calls that pass through it — agents
CertifyAI drives, or platforms with a pre-execution tool-call hook, or customers
who route their tools through `guard_tool`. It cannot stop a call it never sees;
least-privilege sandboxing of the agent remains the customer's environment.

## 10.2.0

### Connector
- **Azure AI Foundry** — new certify adapter (`sources/foundry_adapter.py`) and
  monitor source (`monitor/sources/foundry_source.py`). Maps a Foundry agent
  (assistant) definition — instructions, tools (function + built-in), model —
  into a manifest, and normalizes threads/runs into RunRecords. Entra auth via
  azure-identity; SSRF-guarded endpoints; offline `config` mode for tests. Built
  against the GA threads/runs API (api-version 2025-05-01), structured so the
  newer Responses API can be added without a rewrite. Live-tenant validation via
  `smoke_tests/smoke_foundry.py`. This is the 5th vendor connector, symmetric on
  certify + monitor. +11 tests (203 total).

## 10.1.0

**Version realignment.** The package version was bumped from 9.0.0 directly to
10.1.0 to align the code's version number with the product/document release line
(the pitch deck and collateral were already labelled v10). This is a *numbering*
realignment — there were not ten major code releases. Functionally 10.1.0 is the
9.0.0 codebase plus the fixes below.

### Security (penetration-test findings fixed)
- **Notifier SSRF** — outbound alert URLs (Slack/Teams/Jira) are now SSRF-guarded
  via a shared `netguard.assert_public_url`; a manifest can no longer point an
  alert at cloud-metadata/loopback/private addresses to exfiltrate credentials.
- **Bedrock destructive-action under-detection** — expanded the destructive-verb
  hint list (wipe/erase/purge/destroy/reset/…); actions like `wipe_account` are
  now correctly flagged destructive (HITL-required).
- **Bedrock malformed-config crash** — the adapter now type-guards its input and
  degrades instead of raising on hostile/garbage config.
- **Repo scanner symlink escape** — the scanner rejects `.py`/prompt files that
  resolve outside the repo root (via a new `_within_root` guard), closing a
  path-traversal / scope-escape that could read files outside the audited tree.

### Features
- **5-tier badge grades** (Platinum/Gold/Silver/Bronze/Failed) derived from the
  signed trust_score + critical count (tamper-evident); surfaced in the CLI and
  `cert.json`, plus capability badges (Secure/Production Ready/Enterprise Ready).
- **Framework detection 6 → 11** — added Semantic Kernel, Google ADK, Haystack,
  PydanticAI on top of LangChain, OpenAI SDK, CrewAI, MCP, LlamaIndex, AutoGen.
- **AWS Bedrock connector**, **Jira/Teams/Slack notifiers**, and **intra-phase
  concurrency** (from the 9.0.0 line, carried forward).

### Tests
- 192 passing (76 in the security/pen-test subset).
