# CertifyAI Guard — Enforcement Architecture

## Why this exists

The monitor answers "did the agent do something bad?" — *after* it happened.
That can detect a destructive action but never stop it. The Guard answers "should
this action run?" — *before* it executes, with the authority to say no. It is the
sprinkler to the monitor's smoke detector.

## The three control levels (and which CertifyAI owns)

1. **Detection** (monitor, shipped): flags destructive tool calls after a run.
2. **Enforcement** (Guard, this feature): intercepts a proposed tool call and
   ALLOWs / holds for approval / BLOCKs it before execution.
3. **Containment** (customer's environment): filesystem permissions, DB roles
   without DELETE, egress rules, backups. CertifyAI can *verify* these exist
   (posture check) but does not provide them.

## Design invariants

- **Deterministic & offline.** Policy evaluation is a pure function of the
  proposed call + policy. No network, no clock, no I/O in the decision path — the
  Guard must never be the component that hangs or breaks the agent.
- **Fail-closed for major actions.** If a rule errors on an action assessed as
  destructive/broad/catastrophic, the action is BLOCKED. Benign actions fail-open
  so the Guard is never an availability outage. Posture is keyed to assessed risk.
- **Argument-aware, not verb-name-only.** The danger is usually in the arguments.
  `copy` is benign; `copy(dst="/dev/null")` is not. `run` is benign;
  `run(cmd="rm -rf /")` is not. Rules inspect argument *content* independent of
  the tool name.
- **A BLOCK can never be downgraded** — not by an approval handler, not by a
  human "approve". Some actions are simply never allowed. Approval only upgrades
  REQUIRE_APPROVAL → ALLOW.
- **Every decision is evidence.** Recorded to an audit log so a certify run can
  prove the agent respects the Guard and a deployment has a record of what was
  stopped.

## Components

- `guard.PolicyEngine` — aggregates rules; most-restrictive decision wins;
  fail-closed on major actions; applies the HITL upgrade.
- `guard.policy` — the default rule set:
  - BLOCK destructive-verb + broad scope (`delete path=/`, `rm -rf /`)
  - BLOCK catastrophic argument patterns regardless of verb (`/dev/null`,
    `rm -rf`, `mkfs`, `dd if=`, `DROP DATABASE`, `format C:`)
  - BLOCK unscoped SQL mutation (`DELETE`/`UPDATE`/`DROP` with no `WHERE`)
  - REQUIRE_APPROVAL for destructive actions in production
  - REQUIRE_APPROVAL for any other destructive action (conservative default)
- `guard.broker.Guard.guard_tool(fn)` — wraps a real callable so it only runs on
  ALLOW; BLOCK raises `BlockedActionError` and the real function never executes.
  Approval handler defaults to **deny** (fail-safe).
- Monitor bridge — checks `MON-GUARD-001/002/000` replay a run's tool calls
  through the policy to show what an inline Guard *would* have blocked/held, so
  an observe-only deployment sees the value before enabling enforcement.

## Deployment model (honest scope)

The Guard enforces only calls that pass through it. Three ways that happens:

1. **CertifyAI-driven runs** — during a certify probe, calls already flow through
   our harness; the Guard wraps them.
2. **Platforms with a pre-execution hook** — OpenAI/Foundry-style tool calls that
   surface as `requires_action` before the tool runs can be gated.
3. **Customer-integrated** — the customer wraps their agent's tools with
   `guard_tool` / `GuardedToolset`.

What the Guard does **not** do: it cannot stop a call it never sees (a fully
autonomous in-process agent that never routes through the broker), and it does
not sandbox the agent's ambient privileges — least-privilege containment is the
customer's environment (Level 3). The default rules are heuristics on names and
argument content; a tool whose destruction is purely server-side behind an opaque
handle must be declared dangerous via a custom rule (the extension point is a
one-function add, tested in `test_pentest_guard.py::test_custom_rule_can_close_that_gap`).

## Provenance

This feature was built after a real incident in which an operator ran
`cp -r <dir> /dev/null` against the only copy of a working tree — a destructive
action with no guardrail. The `dangerous_arguments` rule blocks exactly that
pattern; see the end-to-end demonstration in the changelog notes.
