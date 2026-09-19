# Live-Tenant Smoke Tests

These scripts confirm that the vendor connectors' **field-mappings match a real
tenant**. The connectors are unit-tested against simulated APIs (130 tests pass
offline), but vendor APIs drift — these scripts are the 5-minute check you run in
**your** environment, with **your** credentials, before trusting a connector
against a live agent.

Each script validates **both sides** of the product for one vendor:

| Vendor              | Certify (drive the agent)        | Monitor (pull runs)                |
|---------------------|----------------------------------|------------------------------------|
| Salesforce Agentforce | `smoke_agentforce.py`          | same script, Part 2                |
| UiPath              | `smoke_uipath.py`                | same script, Part 2                |
| Automation Anywhere | `smoke_aa.py`                    | same script, Part 2                |
| Azure AI Foundry    | `smoke_foundry.py`               | same script, Part 2                |

## How to run

```bash
pip install -e . --break-system-packages      # from the repo root
# export the vendor's env vars (see each script's header)
python smoke_tests/smoke_agentforce.py
python smoke_tests/smoke_uipath.py
python smoke_tests/smoke_aa.py
```

## Safety

- The **monitor** half is always **read-only** (it pulls run history).
- The **certify** half **starts a job / sends a message** to the agent. Point it
  at a **sandbox/test agent**, never a production money-mover. Use
  `--skip-certify` to run only the read-only monitor check.

## What a pass means

`ALL CHECKS PASSED` means the connector's auth works against your tenant and the
adapter/source correctly normalizes your tenant's real response shape into the
canonical form every certification phase and monitor check reads. You're then
cleared to run real `agent-audit run --mode certify` and `agent-audit monitor`
against that agent.

## What a failure means

A `FIELD-MAPPING MISMATCH` is expected-and-fixable: the connector logic is sound,
but your org/tenant returns a slightly different field shape. Each script prints
exactly which file and function to adjust (`live/adapters.py`,
`monitor/sources/<vendor>_source.py`). Capture the raw response, reconcile the
field names, and re-run.
