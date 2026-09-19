# agent-audit v10 — CertifyAI Backend & Engine

> **The Trust Layer for Autonomous AI.**  
> Multi-source, standards-mapped, statistically honest pre-deployment certification and runtime governance for AI agents.

[![Version](https://img.shields.io/badge/version-10.3.0-blue)](https://certifyai.in)
[![Python](https://img.shields.io/badge/python-3.10%20%7C%203.11%20%7C%203.12-blue)](https://pypi.org/project/agent-audit)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%2B%20SSE-009688)](https://fastapi.tiangolo.com)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](LICENSE)

---

## 📑 Table of Contents
- [Architecture & Standards Mapping](#-architecture--standards-mapping)
- [Prerequisites & Installation](#-prerequisites--installation)
- [How to Run the Backend API](#-how-to-run-the-backend-api)
- [The 3 Ingestion Methods](#-the-3-ingestion-methods)
- [All 17 Audit Phases Catalog](#-all-17-audit-phases-catalog)
- [REST API Reference & SSE Streaming](#-rest-api-reference--sse-streaming)
- [CLI Reference & Automated Workflows](#-cli-reference--automated-workflows)
- [Certificate Tiers & Verification](#-certificate-tiers--verification)
- [Environment Variables & Security Config](#-environment-variables--security-config)

---

## 🏛 Architecture & Standards Mapping

Findings generated across all audit phases automatically map directly to international compliance and safety standards:

| Regulatory / Standard Framework | Description & Coverage |
| :--- | :--- |
| **OWASP Top 10 for LLM & Agents** | Prompt injection (ASI-01), excessive agency (ASI-02), sensitive info leakage (ASI-06), supply chain vulnerabilities (ASI-05). |
| **NIST AI RMF 1.0** | MAP, MEASURE, MANAGE trust characteristics (Safety, Reliability, Resilience, Transparency). |
| **EU AI Act** | Article 14 (Human Oversight), Article 15 (Accuracy, Robustness, Cybersecurity), High-Risk AI obligations. |
| **India DPDP Act (2023)** | Data principal rights, purpose limitation, PII minimization, and erasure policies. |
| **MITRE ATLAS** | Adversarial Threat Landscape for Artificial-Intelligence Systems. |

---

## 📦 Prerequisites & Installation

### System Requirements
* **Python**: 3.10, 3.11, or 3.12
* **Docker** *(Optional)*: Required only if running audits in isolated container sandboxes.

```bash
# Create & activate a virtual environment
python -m venv .venv

# On Windows (PowerShell):
.\.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

---

## 🖥 How to Run the Backend API

```powershell
.\.venv\Scripts\activate
python backend.py
```
* **API Server**: `http://127.0.0.1:8000`
* **Swagger Interactive Docs**: `http://127.0.0.1:8000/docs`

---

## 🔌 The 3 Ingestion Methods

Agent Audit evaluates target systems through three primary ingestion channels:

1. **Direct YAML Manifest (`--target agent.yaml`)**: Explicitly declare tool schemas, token budgets, HITL gates, and runtime endpoints.
2. **Repository Source Code Scan (`--repo-path ./my-agent-repo`)**: Scans Python repositories (LangChain, LlamaIndex, AutoGen, CrewAI) for vulnerability patterns and excessive agency.
3. **OpenAPI Auto-Discovery (`--openapi-url http://.../openapi.json`)**: Ingests OpenAPI 3.x endpoints, discovers routes as tools, and generates boundary checks.

---

## 📊 All 17 Audit Phases Catalog

| # | Phase Key | Phase Name | Primary Checks Evaluated |
| :---: | :--- | :--- | :--- |
| **1** | `architecture` | Architecture & Limits | Tool definitions, context token budget, human-in-the-loop (HITL) gates, tool contract handoffs. |
| **2** | `reliability` | Reliability & Isolation | Execution timeouts, maximum iteration caps, output schema validation, session isolation. |
| **3** | `security` | Core Security | Indirect prompt injection, PII leakages, credential extraction, tool permission abuse. |
| **4** | `observability` | Observability & Tracing | Distributed trace propagation, latency SLO enforcement, token cost tracking. |
| **5** | `ops` | Operational Readiness | Runbook completeness, graceful degradation on failure, canary deployment routing. |
| **6** | `adversarial` | Adversarial Robustness | Multi-stage toolchain attacks, time-delayed triggers, context flooding / cache poisoning. |
| **7** | `supply_chain` | Supply Chain & Provenance | Dependency lock validation, vulnerable package inventory, base foundation model provenance. |
| **8** | `data_governance` | Data Governance | User consent mechanisms, data retention limits, right-to-be-forgotten / erasure checks. |
| **9** | `groundedness` | Groundedness & Accuracy | Golden benchmark dataset evaluations, citation accuracy, hallucination detection, valid abstention. |
| **10** | `fairness` | Fairness & Demographic Parity | Toxicity score variance across demographics, demographic parity, sentiment equity. |
| **11** | `multi_turn` | Multi-Turn Conversation | Memory accumulation boundaries, context poisoning across turns, privilege escalation. |
| **14** | `mcp` | Model Context Protocol (MCP) | Tool squatting, tool description prompt injection, auth scope violations, result spoofing. |
| **15** | `voice` | Voice Agent Safety | ASR audio injection payloads, TTS output safety filters, emergency call escalation, consent capture. |
| **16** | `data_analysis` | Data Analysis Agent Safety | SQL injection in generated queries, numeric calculation precision, schema boundary violation, statistical bias. |
| **17** | `decision` | Decision & Action Safety | Policy groundedness, adverse action explanation transparency, outcome drift over time. |
| **18** | `security_agent` | Autonomous SecOps Safety | Alert flood resilience, false positive rate threshold, threat intelligence injection, IOC validation. |
| **19** | `browser` | Browser Agent Safety | Cross-origin boundary enforcement, credential autofill exfiltration, clickjacking defense, session separation. |

---

## 📡 REST API Reference & SSE Streaming

### 1. `POST /api/audit` (Server-Sent Events)
Initiates an audit and streams real-time logs and progress updates.

* **Request Body**:
```json
{
  "yaml_content": "agent_name: my_agent\n...",
  "repo_path": null,
  "openapi_url": null,
  "mode": "certify",
  "runs": 20,
  "concurrency": 10,
  "selected_phases": ["security", "voice", "browser"]
}
```

* **SSE Event Stream Format**:
```
data: {"type": "progress", "val": 40}
data: {"type": "log", "message": "[Phase 3: Security] Evaluating prompt injection robustness..."}
data: {"type": "result", "data": { "trust_score": 92, "tier": "CERTIFIED", ... }}
```

### 2. `GET /api/agents`
Returns historical records of evaluated agents and their certification status.

### 3. Target Management Endpoints
* `GET /api/targets/`: List all stored `.yaml` test target specifications.
* `GET /api/targets/{name}`: Retrieve YAML content for a target file.
* `POST /api/targets/{name}`: Save or update a YAML target specification.
* `DELETE /api/targets/{name}`: Remove a target file.

---

## 💻 CLI Reference & Automated Workflows

```bash
# Framework validation (syntax, schemas, and static safety checks)
python -m agent_audit.cli run --target targets/my_agent_v4.yaml --mode validate

# Full 17-Phase Certification run with reports
python -m agent_audit.cli run \
  --target targets/my_agent_v4.yaml \
  --mode certify \
  --variability-runs 20 \
  --concurrency 10 \
  --output audit_report.json \
  --sarif audit_report.sarif \
  --html audit_report.html \
  --cert-output certificate.json

# Run individual phase
python -m agent_audit.cli run --target targets/voice_agent_v7.yaml --phase voice

# Statistical drift monitor
python -m agent_audit.cli drift \
  --cert certificate.json \
  --target targets/my_agent_v4.yaml \
  --variability-runs 10 \
  --webhook https://hooks.slack.com/services/xxx/yyy/zzz

# Offline cryptographic verification of an issued certificate
python -m agent_audit.cli verify --cert certificate.json
```

---

## 🎖 Certificate Tiers & Verification

| Status Tier | Criteria | Validity Period | Description |
| :--- | :--- | :---: | :--- |
| **`CERTIFIED`** | `0` Critical Findings, Trust Score $\ge 80\%$ | **90 Days** | Enterprise production approved. |
| **`CONDITIONAL`** | `0` Critical Findings, Trust Score $< 80\%$ or warnings | **60 Days** | Conditionally permitted with remediation plan. |
| **`NOT_CERTIFIED`** | $\ge 1$ Critical Failures | **Not Issued** | Blocked from production deployment. |

---

## ⚙️ Environment Variables & Security Config

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `AA_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed CORS origins for the API server. |
| `AA_API_TOKEN` | *(None)* | Optional Bearer token required on API endpoints. |
| `AA_REPO_BASE` | Project root | Directory boundary restricting repository scans. |
| `AA_USE_DOCKER_SANDBOX` | `0` | Set to `1` to run evaluations in isolated Docker containers. |
| `AA_DOCKER_IMAGE` | `agent-audit:latest` | Docker image tag used for sandboxed runs. |
| `AGENT_AUDIT_ALLOW_PRIVATE_FETCH` | `1` | Permits fetching from localhost/internal networks for scans. |
