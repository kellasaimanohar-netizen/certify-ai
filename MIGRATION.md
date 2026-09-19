# Migration guide

## v6 → v7

### What's new

v7 adds five new audit phases that fill coverage gaps for specialised agent types:

| Phase | Key  | Agent type covered |
|-------|------|--------------------|
| Phase 15 | `voice`          | Voice agents (ElevenLabs, Rasa Voice, Twilio) |
| Phase 16 | `data_analysis`  | Data analysis agents (Databricks, Code Interpreter) |
| Phase 17 | `decision`       | Decision/recommendation agents (Bedrock, Vertex AI) |
| Phase 18 | `security_agent` | Security agents (CrowdStrike, Sentinel AI) |
| Phase 19 | `browser`        | Browser agents (Browserbase, Playwright-based) |

### Zero breaking changes

All v6 phases (1–11, 14), target YAML formats (v3 and v4), CLI flags, and output formats
are preserved exactly. Existing pipelines continue to work without modification.

### Version bump

`__version__` is now `"7.0.0"`. Update any hard-coded version checks in CI.

### New CLI phase names

```bash
# Available in v7
agent-audit run --phase voice
agent-audit run --phase data_analysis
agent-audit run --phase decision
agent-audit run --phase security_agent
agent-audit run --phase browser
agent-audit run --phase all   # now includes all 17 phases
```

### New target YAML fields for v7 phases

**Voice agents** — add to security section:
```yaml
security:
  data_classification: ["DPDP_PERSONAL"]   # triggers consent check
compliance_frameworks:
  - india_dpdp_2023
```

**Browser agents** — declare action types as tools:
```yaml
capabilities:
  tools: ["navigate", "click", "fill", "screenshot"]
  destructive_tools: ["submit_payment", "delete_account", "download_file"]
  requires_hitl: true
```

**Decision agents** — tag as high-risk AI:
```yaml
security:
  data_classification: ["DPDP_PERSONAL", "EU_HIGH_RISK"]
compliance_frameworks:
  - eu_ai_act
  - india_dpdp_2023
```

**Security agents** — mark ALL remediation tools as destructive:
```yaml
capabilities:
  tools: ["block_ip", "isolate_host", "create_ticket"]
  destructive_tools: ["block_ip", "isolate_host"]
  requires_hitl: true
```

### New mock scenarios (mock_client.py)

Four new scenarios are available for `--mode validate`:

| Scenario key | Used by |
|---|---|
| `voice_asr_blocked` | Phase 15 — blocked ASR injection |
| `browser_action` | Phase 19 — browser action policy refusal |
| `decision_output` | Phase 17 — structured decision response |
| `threat_intel_blocked` | Phase 18 — blocked threat-intel injection |

### New custom checker files

Four ready-to-use checker files are provided in `checkers/`:

- `v7_voice_checkers.yaml` — call recording consent, masked account numbers, no OTP
- `v7_browser_checkers.yaml` — password autofill domain guard, internal redirect blocker
- `v7_decision_checkers.yaml` — adverse action notice, confidence score range
- `v7_security_agent_checkers.yaml` — IOC format validation, credential redaction

---

## v3 → v4 (unchanged from v6)

v3 flat YAML targets auto-detected and loaded unchanged. See original MIGRATION.md history.
