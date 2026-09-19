# agent-audit v10 — CertifyAI

> **The Trust Layer for Autonomous AI.**  
> Multi-source, standards-mapped, statistically honest pre-deployment certification and runtime governance for AI agents.

[![Version](https://img.shields.io/badge/version-10.3.0-blue)](https://certifyai.in)
[![Python](https://img.shields.io/badge/python-3.10%20%7C%203.11%20%7C%203.12-blue)](https://pypi.org/project/agent-audit)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%2B%20SSE-009688)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61DAFB)](https://vitejs.dev)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](LICENSE)
[![Contact](https://img.shields.io/badge/contact-audit%40certifyai.in-informational)](mailto:audit@certifyai.in)

---

## 📑 Table of Contents
- [Executive Overview](#-executive-overview)
- [What's New in v10](#-whats-new-in-v10)
- [Role-Based Governance: Admin vs. User Capabilities](#-role-based-governance-admin-vs-user-capabilities)
  - [Summary Comparison Matrix](#-summary-comparison-matrix)
  - [Admin Capabilities (Super Admin / Enterprise AI Governance)](#-admin-capabilities-super-admin--enterprise-ai-governance)
  - [User Capabilities (Auditor / QA Engineer / Safety Researcher)](#-user-capabilities-auditor--qa-engineer--safety-researcher)
  - [Default Accounts & Credentials](#-default-accounts--credentials)
- [Architecture & Standards Mapping](#-architecture--standards-mapping)
- [Prerequisites & Installation](#-prerequisites--installation)
- [How to Run the Project (Web Dashboard & API)](#-how-to-run-the-project-web-dashboard--api)
- [The 3 Ingestion Methods](#-the-3-ingestion-methods)
- [All 17 Audit Phases Catalog](#-all-17-audit-phases-catalog)
- [REST API Reference & SSE Streaming](#-rest-api-reference--sse-streaming)
- [Frontend Dashboard Features](#-frontend-dashboard-features)
- [CLI Reference & Automated Workflows](#-cli-reference--automated-workflows)
- [Certificate Tiers & Verification](#-certificate-tiers--verification)
- [Environment Variables & Security Config](#-environment-variables--security-config)
- [Project Directory Structure](#-project-directory-structure)

---

## 🚀 Executive Overview

**Agent Audit (CertifyAI)** is an enterprise-grade certification framework designed to assess, audit, stress-test, and cryptographically verify autonomous AI agents before and during production deployment.

Like SSL certificates established foundational trust for web protocols, **CertifyAI** provides mathematically sound, verifiable trust tokens (`certificate.json`) signed with **Ed25519** public-key cryptography.

```
┌─────────────────┐       ┌──────────────────────┐       ┌────────────────────────┐
│ Ingestion Layer │ ────► │ 17-Phase Eval Engine │ ────► │  Cryptographic Issuer  │
│ (YAML/Repo/API) │       │ (Wilson Score Stats) │       │ (Ed25519 Signed Certs) │
└─────────────────┘       └──────────────────────┘       └────────────────────────┘
```

---

## 🌟 What's New in v10

* **AWS Bedrock Integration**: Direct evaluators and mock clients tailored for AWS Bedrock agent configurations.
* **Incident Alerting Integrations**: Built-in webhook notifiers for **Jira**, **Microsoft Teams**, and **Slack** on compliance failure.
* **Framework Code Scanners**: Static AST and pattern analysis for **LlamaIndex** workflows and **AutoGen** multi-agent structures.
* **High-Throughput Concurrent Execution**: Asynchronous batching with adjustable concurrency for multi-turn variability evaluations.
* **Specialized Agent Safety Phases (v7-v10)**:
  * **Voice Agents** (ASR injection, TTS safety, call escalation)
  * **Data Analysis Agents** (SQL injection, boundary testing, statistical bias)
  * **Decision Agents** (Outcome drift, adverse action explanations)
  * **Security Agents** (Alert flood tolerance, IOC validation)
  * **Browser Agents** (Navigation boundaries, clickjacking, credential isolation)

---

## 🛡️ Role-Based Governance: Admin vs. User Capabilities

CertifyAI V10 enforces strict Role-Based Access Control (RBAC) and architectural separation between **Enterprise Governance & Fleet Monitoring (Admin)** and **Autonomous Agent Testing & Certification (User / Auditor)**.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CertifyAI V10 RBAC Architecture                                │
├───────────────────────────────────────────────┬──────────────────────────────────────────────────┤
│           🛡️ ADMIN / GOVERNANCE PORTAL        │          🧪 USER / AUDITOR TEST STUDIO           │
│   (Enterprise AI Governance & Super Admin)    │      (AI Safety Researcher / QA Engineer)        │
├───────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ 👁️ VIEW:                                      │ 👁️ VIEW:                                         │
│   • Enterprise KPIs & Organization Pass Rates │   • Live SSE Streaming Terminal & Phase Progress │
│   • Centralized "Who Tested What" Audit Trail │   • Detailed Findings Explorer & Rule Checks     │
│   • Auditor Performance & Account Stats       │   • Ed25519 Cryptographic Certificate Tokens     │
│   • Monitored Fleet Inventory & Safety Scores │   • Diagnostic Stacks (HTTP, Payloads, Fixes)    │
│   • Immutable Security & Activity Logs        │   • My Certified Reports Vault & PDF Previews    │
│   • Real-Time Threat Telemetry Feeds          │   • Rule Library Catalog & Standards Mappings    │
│                                               │   • Compliance Copilot Remediation Threads       │
│ ⚙️ MANAGE:                                    │ ⚙️ MANAGE:                                       │
│   • Auditor & User Account Provisioning (RBAC)│   • Ingestion Inputs (YAML / Git Repo / OpenAPI) │
│   • Target Agent Specifications (.yaml CRUD)  │   • Audit Modes (Validate vs Certify)            │
│   • Dispatch Target Agents to Runner Studio   │   • Variability Runs (N) & Concurrency Limits    │
│   • One-Click CSV / JSON Audit Trail Exports  │   • Phase Selection (17 Modular Safety Phases)   │
│   • Alerting Webhooks (Slack/Teams/Jira)      │   • PDF / JSON Audit Report & Cert Downloads     │
│   • Global Engine & Drift Sensitivity Config  │   • Copilot AI Remediation Prompts & Code Fixes  │
│                                               │                                                  │
│ 📡 MONITOR:                                   │ 📡 MONITOR:                                      │
│   • Enterprise AI Safety Health & Drift       │   • Real-Time Test Execution & Phase Milestones  │
│   • Live Telemetry Stream & Runtime Violations│   • Wilson 95% Confidence Statistical Stability  │
│   • Auditor Accountability & Test Integrity   │   • Agent Production Readiness Against Thresholds│
│   • Login & System Authentication Events      │                                                  │
└───────────────────────────────────────────────┴──────────────────────────────────────────────────┘
```

---

### 📊 Summary Comparison Matrix

| Feature / Capability | 🛡️ Enterprise Admin (`Super Admin`) | 🧪 Standard User (`Auditor`) |
| :--- | :---: | :---: |
| **Enterprise KPI Dashboard** (Pass rate, total tests, zero-day blocks) | ✅ **Full Access** | ❌ *Hidden* |
| **"Who Tested What" Central Audit Trail** | ✅ **Full Access** (All auditors) | ❌ *Hidden* |
| **Auditor Account Management** (Create, list, deactivate users) | ✅ **Full Management** | ❌ *No Access* |
| **Monitored Agent Fleet Overview** | ✅ **Full Access** | ❌ *Hidden* |
| **Security & System Activity Logs** (Logins, user creations, runs) | ✅ **Full Access** | ❌ *Hidden* |
| **Audit Trail Export** (CSV / JSON for EU AI Act / NIST filings) | ✅ **1-Click Export** | ❌ *No Access* |
| **Engine & Alerting Settings** (Webhooks, drift sensitivity, API token) | ✅ **Full Configuration** | ❌ *Read-only defaults* |
| **Real-Time Runtime Telemetry Stream** | ✅ **Full Stream** | ❌ *No Access* |
| **Autonomous Audit Runner Studio** (Run tests on agents) | ✅ **Can Dispatch & Run** | ✅ **Full Execution** |
| **Ingestion Manager** (YAML manifest, Git repo, OpenAPI 3.x) | ✅ **Supported** | ✅ **Full Access** |
| **Live SSE Terminal & Progress Output** | ✅ **Supported** | ✅ **Live Streaming** |
| **Findings Explorer & Diagnostic Stack** | ✅ **Supported** | ✅ **Full Analysis** |
| **Ed25519 Signed Certificate Inspector** | ✅ **Supported** | ✅ **Full Verification** |
| **Generate & Download PDF Audit Reports** | ✅ **Supported** | ✅ **Full Export** |
| **Compliance Copilot AI Assistant** | ✅ **Supported** | ✅ **Full Remediation** |
| **Rule Library & Standards Reference** | ✅ **Supported** | ✅ **Full Reference** |
| **Data Sources & Connection Status** | ✅ **Supported** | ✅ **Full Access** |

---

### 🛡️ Admin Capabilities (Super Admin / Enterprise AI Governance)

The **Admin Portal** is designed for Chief AI Safety Officers, Enterprise SecOps Leads, and Compliance Directors.

#### 1. 👁️ What Admin Can VIEW
* **Enterprise KPI Analytics**:
  * **Total Tests Conducted**: Organization-wide count of all agent evaluation runs.
  * **Certification Pass Rate (%)**: Percentage of agents achieving `CERTIFIED` status.
  * **Critical Vulnerabilities Blocked**: Total zero-day prompt injections, credential extractions, and PII leaks intercepted before production.
  * **Active Auditors Count**: Number of authorized testers currently active.
  * **Pass / Conditional / Fail Breakdown**: Visual distribution chart of issued certificate tiers.
  * **Execution Mode Distribution**: Ratio of quick syntax `validate` scans vs full multi-turn `certify` runs.
* **"Who Tested What" Centralized Live Audit Trail**:
  * Comprehensive table recording every single test executed via UI, CLI, or CI/CD pipelines.
  * Captures: `Audit ID`, `Agent Target`, `Tested By (Email & Name)`, `Auditor Role`, `Mode`, `Runs (N)`, `Concurrency`, `Selected Phases`, `Trust Score (%)`, `Certification Tier`, `Enterprise Readiness Flag`, `Critical/Warning/Pass Counts`, `Execution Duration (ms)`, `Timestamp (UTC)`, and `Client IP / Notes`.
  * Clickable row drill-down to view individual test failure reasons, rule violations, and diagnostics.
* **Auditor Team Performance & Governance Analytics**:
  * List of all registered auditors, department, assigned role, total audits conducted, certified agents count, average trust scores awarded, and last active timestamp.
* **Monitored Agent Fleet Overview**:
  * Aggregated metrics per agent target: total times audited, average trust score, total criticals caught, latest certification status, and latest audit timestamp.
* **Security & System Activity Logs**:
  * Immutable activity stream tracking: user logins, failed authentication attempts, new auditor provisioning, role changes, and audit run triggers with status badges (`SUCCESS`, `WARNING`, `FAILED`).
* **Real-Time Telemetry Stream & Alert Traces**:
  * Live trace logs capturing real-time agent invocations, PII leak blocks, token consumption spikes, and latency SLO compliance.
* **Audit Engine & Governance Configuration**:
  * System API token parameters, drift sensitivity thresholds, and webhook dispatch URLs.

#### 2. ⚙️ What Admin Can MANAGE
* **Auditor & User RBAC Provisioning**:
  * Register new auditor accounts with credentials (`Email`, `Password`, `Full Name`, `Role`, `Department`, `Avatar URL`).
  * Assign roles: `Super Admin`, `Lead Auditor`, `Auditor`, `Compliance Officer`.
  * Deactivate or reactivate user accounts.
* **Agent Target Manifests (`/api/targets/`)**:
  * Create, edit, save, and delete `.yaml` agent target specifications stored on the server.
  * Select any target from the fleet and dispatch it directly to the Audit Runner studio.
* **Audit Records & Compliance Export**:
  * Filter test records by Auditor, Certification Tier, Mode, or Agent Name.
  * **Export to CSV**: Formatted spreadsheet for compliance records and executive reports.
  * **Export to JSON**: Structured machine-readable schema for automated regulatory reporting (EU AI Act Article 15, NIST AI RMF).
* **System & Alerting Settings**:
  * Configure incident webhook integrations for **Slack**, **Microsoft Teams**, and **Jira**.
  * Adjust drift sensitivity thresholds (`High`, `Medium`, `Low`).
  * Configure Bearer Authentication tokens (`AA_API_TOKEN`).

#### 3. 📡 What Admin Can MONITOR
* **Enterprise AI Safety Posture**: Real-time fleet health across all business units and autonomous agents.
* **Real-Time Runtime Telemetry**: Live telemetry stream intercepting prompt injections, PII disclosures, and memory poisoning.
* **Auditor Accountability & Integrity**: Continuous tracking of who executed each test, what settings were used, and whether failing agents were blocked.
* **Authentication & Access Security**: Monitoring failed login attempts, unauthorized API calls, and privilege escalation attempts.

---

### 🧪 User Capabilities (Auditor / QA Engineer / Safety Researcher)

The **User Testing Studio** is optimized for AI engineers, red-team auditors, and QA practitioners who test, debug, and certify specific AI agents.

#### 1. 👁️ What User Can VIEW
* **Interactive Audit Runner Console**:
  * Real-time Server-Sent Events (SSE) streaming terminal displaying step-by-step evaluation logs.
  * Live progress bar ($0\% \to 100\%$) indicating active phase completion.
* **Detailed Audit Results & Security Findings Explorer**:
  * **Agent Specifications**: Target Name, Invoker Endpoint, Max Iteration Steps, Context Token Budget, Declared Capabilities/Tools (highlighting destructive tools in red), Monitored PII Fields, and Target Frameworks.
  * **Trust Score & Tier**: Overall numerical trust score ($0 - 100$) and certification status badge (`CERTIFIED`, `CONDITIONAL`, `NOT_CERTIFIED`).
  * **Phase Score Breakdown**: Individual percentage scores across all evaluated phases (Architecture, Reliability, Security, Observability, Ops, Adversarial, Voice, etc.).
  * **Finding Details**: Severity badges (`CRITICAL`, `WARNING`, `PASS`, `INFO`), check rule ID (e.g. `SEC-PII-001`, `ADV-CHAIN-001`), international standard mappings (OWASP LLM, NIST AI RMF, EU AI Act, India DPDP), descriptions, and concrete remediation instructions.
  * **Diagnostic Stack**: Exact HTTP method used, failed endpoint, expected vs actual responses, and suggested configuration fixes.
* **Cryptographic Ed25519 Certificate Inspector**:
  * Visual certificate badge, Issuer authority, Subject Agent, Issue/Expiration dates, Wilson statistical confidence lower bound, Ed25519 Public Key fingerprint, and cryptographic signature hash.
* **My Certified Reports Vault**:
  * History of generated agent reports with instant viewing and download options.
* **Rule Library Catalog**:
  * Comprehensive reference of all safety and compliance rules across all 17 audit phases.
* **Connected Data Sources**:
  * Verification of connected YAML specifications, local/Git code repositories, and OpenAPI 3.x endpoints.
* **Compliance Copilot AI Assistant**:
  * Auto-generated remediation thread pre-loaded with the agent's specific failure findings to explain issues and provide code patches.

#### 2. ⚙️ What User Can MANAGE
* **Target Ingestion & Input Selection**:
  * **YAML Manifest**: In-browser YAML editor with syntax checking and sample templates (`Default`, `HR Compensation Advisor`, `Voice Dispatch 911 Agent`).
  * **Git / Local Repository**: Specify local folder path or remote Git URL for AST scanning of LangChain, LlamaIndex, AutoGen, and CrewAI code.
  * **OpenAPI 3.x Discovery**: Provide API documentation URL (`/openapi.json`) for automatic route discovery and boundary fuzzing.
* **Audit Execution Parameters**:
  * **Mode Toggle**: Choose between `validate` (fast structural check) and `certify` (full rigorous multi-turn testing).
  * **Variability Runs ($N$)**: Configure repeated test executions ($N=1$ to $50+$) to measure LLM non-determinism.
  * **Concurrency Limit**: Adjust parallel execution threads for high-throughput batch evaluations.
  * **Phase Filtering**: Selectively toggle any subset of the 17 audit phases.
* **Report & Certificate Export**:
  * **PDF Audit Report**: One-click generation of professional multi-page PDF audit reports with compliance matrices and finding tables (`jspdf`).
  * **JSON Report**: Download full raw JSON audit results (`{agent_name}_audit_report.json`).
  * **Ed25519 Certificate Token**: Copy raw cryptographic certificate payload for production CI/CD gate validation.
* **Compliance Copilot Iteration**:
  * Prompt the AI Copilot for tailored Python/TypeScript fixes and YAML schema corrections.

#### 3. 📡 What User Can MONITOR
* **Live Test Execution Progress**: Real-time phase milestone tracking and diagnostic log streaming.
* **Statistical Stability & Non-Determinism**: Real-time Wilson 95% confidence interval calculations across variability runs.
* **Compliance Thresholds**: Instant feedback on whether the target meets enterprise deployment standards ($\ge 80\%$ trust score, $0$ critical failures).

---

### 🔑 Default Accounts & Credentials

The system strictly supports two roles (`ADMIN` and `USER`):

| User Name | Identifier / Email | Password | Assigned Role | Dedicated Workspace & Purpose |
| :--- | :--- | :--- | :---: | :--- |
| **Syed** | `syed` *(or `syed@certifyai.in` / `admin`)* | `admin` | **ADMIN** | 🛡️ **Admin Governance Workspace** (`/admin`)<br>• Monitors all testing activity & "Who Tested What"<br>• Organization KPIs, user & fleet management, reports export |
| **Ismeet** | `ismeet` *(or `ismeet@certifyai.in` / `user`)* | `user` | **USER** | 🧪 **User Testing Studio** (`/user`)<br>• Tests AI agents (YAML, Git Repo, OpenAPI)<br>• Analyzes scores, reviews own test history, downloads reports |

---

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
* **Node.js**: 18.x or 20.x (with `npm`)
* **Docker** *(Optional)*: Required only if running audits in isolated container sandboxes.

### 1. Python Backend Installation
```bash
# Clone the repository
git clone https://github.com/certifyai/agent-audit.git
cd V10/backend

# Create & activate a virtual environment
python -m venv .venv

# On Windows (PowerShell):
.\.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Frontend Installation
```bash
cd ../frontend
npm install
```

---

## 🖥 How to Run the Project (Web Dashboard & API)

Run the backend and frontend simultaneously across two terminal windows.

### Terminal 1: Start Backend API (FastAPI)
```powershell
cd backend
.\.venv\Scripts\activate
python backend.py
```
* **API Server**: `http://127.0.0.1:8000`
* **Swagger Interactive Docs**: `http://127.0.0.1:8000/docs`

### Terminal 2: Start Frontend UI (React + Vite)
```powershell
cd frontend
npm run dev
```
* **Dashboard URL**: `http://localhost:5173`

---

## 🔌 The 3 Ingestion Methods

Agent Audit can evaluate target systems through three primary ingestion channels:

```
                  ┌──────────────────────────────┐
                  │ 1. Direct YAML Manifest      │
                  ├──────────────────────────────┤
  Target System ─►│ 2. Repository Source Code    │ ─► Unified Target Model
                  ├──────────────────────────────┤
                  │ 3. OpenAPI 3.0+ Endpoint     │
                  └──────────────────────────────┘
```

### 1. Direct YAML Manifest (`--target agent.yaml`)
Explicitly declare tool schemas, context token caps, HITL permissions, and runtime hooks:
```yaml
agent_name: hr_compensation_advisor
version: 1.0.0
capabilities:
  max_steps: 10
  context_budget_tokens: 8000
  requires_hitl: true
  destructive_tools:
    - update_payroll_database
  tools:
    - query_employee_salary
    - compute_bonus_ratio
security:
  pii_fields:
    - national_id
    - base_salary
```

### 2. Repository Source Code Scan (`--repo-path ./my-agent-repo`)
Scans Python repositories (LangChain, LlamaIndex, AutoGen, CrewAI) for:
* Unbounded tool execution loops
* Hardcoded credentials and API tokens
* Missing input validation sanitizers on tool arguments

### 3. OpenAPI Auto-Discovery (`--openapi-url http://.../openapi.json`)
Automatically ingests OpenAPI 3.x endpoints, discovers available routes as agent tools, detects parameter schemas, and generates targeted boundary-fuzzing checks.

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

The FastAPI backend exposes endpoints for orchestration, live streaming, target management, and certificate verification:

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

## 🎨 Frontend Dashboard Features

The React frontend (`frontend/`) provides an interactive interface for running audits:

* **Interactive Audit Runner**: Configure runs, concurrency, and phase filters with a single click.
* **Live SSE Terminal**: Streaming output console displaying real-time audit phases and progress bars.
* **Compliance Matrix**: Direct cross-referencing of every finding with OWASP, NIST, EU AI Act, and DPDP IDs.
* **Ed25519 Certificate Inspector**: View validity badges, cryptographic signatures, public keys, and expiration timers.
* **PDF Audit Report Export**: Generate comprehensive audit reports using `jspdf` and `jspdf-autotable`.
* **Target YAML Editor**: In-browser YAML editor with schema validation and pre-configured templates.

---

## 💻 CLI Reference & Automated Workflows

You can integrate `agent-audit` directly into your CI/CD pipelines (GitHub Actions, GitLab CI):

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

When an audit completes, a cryptographic certificate (`certificate.json`) is generated:

| Status Tier | Criteria | Validity Period | Description |
| :--- | :--- | :---: | :--- |
| **`CERTIFIED`** | `0` Critical Findings, Trust Score $\ge 80\%$ | **90 Days** | Enterprise production approved. |
| **`CONDITIONAL`** | `0` Critical Findings, Trust Score $< 80\%$ or warnings | **60 Days** | Conditionally permitted with remediation plan. |
| **`NOT_CERTIFIED`** | $\ge 1$ Critical Failures | **Not Issued** | Blocked from production deployment. |

### Mathematical Scoring & Wilson Confidence Interval
Variability testing computes Wilson score intervals at 95% confidence to ensure statistically sound reliability and non-determinism bounds across LLM outputs:

$$w = \frac{p + \frac{z^2}{2n} \pm z \sqrt{\frac{p(1-p)}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}}$$

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

---

## 📁 Project Directory Structure

```
c:/Personal/V10/
├── backend/
│   ├── backend.py                   # FastAPI server with SSE streaming & runner hooks
│   ├── requirements.txt             # Python dependencies
│   ├── pyproject.toml               # Package configuration
│   ├── routers/
│   │   └── targets.py               # Target management API endpoints
│   ├── src/agent_audit/
│   │   ├── cli.py                   # CLI entry points (run, verify, drift, inspect)
│   │   ├── runner.py                # Audit orchestrator & concurrent runner
│   │   ├── manifest.py              # Multi-source ingestion & manifest schema
│   │   ├── certificate.py           # Ed25519 cryptographic key generation & signing
│   │   ├── variability.py           # Wilson statistical confidence engine
│   │   ├── standards.py             # OWASP, NIST, EU AI Act, DPDP mappings
│   │   ├── findings.py              # Finding schema & severity classifiers
│   │   ├── checkers/                # AST, regex, and LLM judge checkers
│   │   └── phases/                  # All 17 audit phase implementation modules
│   └── targets/                     # Pre-configured agent target manifests (.yaml)
├── frontend/
│   ├── src/
│   │   ├── App.tsx                  # Main interactive dashboard component
│   │   ├── components/              # Modular UI components (Certificate, Terminal, etc.)
│   │   └── utils/                   # Report formatters and PDF generators
│   ├── package.json                 # Node scripts and dependencies
│   └── vite.config.ts               # Vite configuration
├── CertifyAI_Guard_Architecture.md  # Deep dive architecture documentation
├── SECURITY_REVIEW_certificates.md  # Cryptographic security audit
├── SIMULATION_REPORT.md             # Benchmark simulation results
├── CHANGELOG.md                     # Version history
└── README.md                        # Master project documentation
```

---

## 🤝 Support & Enterprise Inquiries

* **Website**: [certifyai.in](https://certifyai.in)
* **Audit & Certification Inquiries**: [audit@certifyai.in](mailto:audit@certifyai.in)

> *"The SSL certificate gave the internet a trust layer. CertifyAI gives AI the same."*
