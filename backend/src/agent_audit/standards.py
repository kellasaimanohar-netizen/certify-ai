"""Standards catalog.

Canonical IDs + human names + URLs for every framework a Finding can map to.
Each entry is immutable; phases reference these by ID rather than re-typing
the name every time.

Sources (verify URLs on release):
- OWASP Top 10 for LLM Applications 2025: https://genai.owasp.org/llm-top-10/
- OWASP Agentic AI Top 10: https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/
- NIST AI RMF 1.0 & Generative AI Profile (AI 600-1):
    https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf
- MITRE ATLAS: https://atlas.mitre.org/
- EU AI Act (Regulation 2024/1689): https://eur-lex.europa.eu/eli/reg/2024/1689/oj
- India DPDP Act 2023: https://www.meity.gov.in/
- CWE: https://cwe.mitre.org/
- ISO/IEC 42001:2023: ISO catalogue
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Final


@dataclass(frozen=True, slots=True)
class StandardEntry:
    """One entry in one framework (e.g. 'LLM01' in OWASP LLM Top 10)."""

    framework: str
    identifier: str
    name: str
    url: str


# ─── OWASP Top 10 for LLM Applications 2025 ─────────────────────────────
OWASP_LLM_2025: Final[dict[str, StandardEntry]] = {
    e.identifier: e
    for e in [
        StandardEntry("owasp_llm_2025", "LLM01", "Prompt Injection", "https://genai.owasp.org/llmrisk/llm01-prompt-injection/"),
        StandardEntry("owasp_llm_2025", "LLM02", "Sensitive Information Disclosure", "https://genai.owasp.org/llmrisk/llm02-sensitive-information-disclosure/"),
        StandardEntry("owasp_llm_2025", "LLM03", "Supply Chain", "https://genai.owasp.org/llmrisk/llm03-supply-chain/"),
        StandardEntry("owasp_llm_2025", "LLM04", "Data and Model Poisoning", "https://genai.owasp.org/llmrisk/llm04-data-and-model-poisoning/"),
        StandardEntry("owasp_llm_2025", "LLM05", "Improper Output Handling", "https://genai.owasp.org/llmrisk/llm05-improper-output-handling/"),
        StandardEntry("owasp_llm_2025", "LLM06", "Excessive Agency", "https://genai.owasp.org/llmrisk/llm06-excessive-agency/"),
        StandardEntry("owasp_llm_2025", "LLM07", "System Prompt Leakage", "https://genai.owasp.org/llmrisk/llm07-system-prompt-leakage/"),
        StandardEntry("owasp_llm_2025", "LLM08", "Vector and Embedding Weaknesses", "https://genai.owasp.org/llmrisk/llm08-vector-and-embedding-weaknesses/"),
        StandardEntry("owasp_llm_2025", "LLM09", "Misinformation", "https://genai.owasp.org/llmrisk/llm09-misinformation/"),
        StandardEntry("owasp_llm_2025", "LLM10", "Unbounded Consumption", "https://genai.owasp.org/llmrisk/llm10-unbounded-consumption/"),
    ]
}

# ─── OWASP Agentic AI Top 10 (2025 draft IDs) ───────────────────────────
OWASP_AGENTIC_2025: Final[dict[str, StandardEntry]] = {
    e.identifier: e
    for e in [
        StandardEntry("owasp_agentic_2025", "AG01", "Memory Poisoning", "https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/"),
        StandardEntry("owasp_agentic_2025", "AG02", "Tool Misuse", "https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/"),
        StandardEntry("owasp_agentic_2025", "AG03", "Privilege Compromise", "https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/"),
        StandardEntry("owasp_agentic_2025", "AG04", "Resource Overload", "https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/"),
        StandardEntry("owasp_agentic_2025", "AG05", "Cascading Hallucination", "https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/"),
        StandardEntry("owasp_agentic_2025", "AG06", "Intent Breaking and Goal Manipulation", "https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/"),
        StandardEntry("owasp_agentic_2025", "AG07", "Misaligned Behaviors", "https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/"),
        StandardEntry("owasp_agentic_2025", "AG08", "Repudiation and Untraceability", "https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/"),
        StandardEntry("owasp_agentic_2025", "AG09", "Identity Spoofing", "https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/"),
        StandardEntry("owasp_agentic_2025", "AG10", "Multi-Agent Exploitation", "https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/"),
    ]
}

# ─── NIST AI RMF Generative AI Profile (NIST AI 600-1) ──────────────────
# Action IDs in the form GV-X.Y / MP-X.Y / MS-X.Y / MG-X.Y (Govern/Map/Measure/Manage).
NIST_AI_RMF_GENAI: Final[dict[str, StandardEntry]] = {
    e.identifier: e
    for e in [
        StandardEntry("nist_ai_rmf_genai", "GV-1.1", "Govern: legal and regulatory requirements", "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"),
        StandardEntry("nist_ai_rmf_genai", "MP-2.3", "Map: scientific integrity and validity", "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"),
        StandardEntry("nist_ai_rmf_genai", "MS-1.1", "Measure: approaches for measurement", "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"),
        StandardEntry("nist_ai_rmf_genai", "MS-2.6", "Measure: safety risks", "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"),
        StandardEntry("nist_ai_rmf_genai", "MS-2.7", "Measure: security and resilience", "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"),
        StandardEntry("nist_ai_rmf_genai", "MG-4.1", "Manage: post-deployment monitoring", "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"),
    ]
}

# ─── EU AI Act (Regulation 2024/1689) — article-level refs ──────────────
EU_AI_ACT: Final[dict[str, StandardEntry]] = {
    e.identifier: e
    for e in [
        StandardEntry("eu_ai_act", "Art.9", "Risk management system", "https://eur-lex.europa.eu/eli/reg/2024/1689/oj"),
        StandardEntry("eu_ai_act", "Art.10", "Data and data governance", "https://eur-lex.europa.eu/eli/reg/2024/1689/oj"),
        StandardEntry("eu_ai_act", "Art.12", "Record-keeping", "https://eur-lex.europa.eu/eli/reg/2024/1689/oj"),
        StandardEntry("eu_ai_act", "Art.13", "Transparency to deployers", "https://eur-lex.europa.eu/eli/reg/2024/1689/oj"),
        StandardEntry("eu_ai_act", "Art.14", "Human oversight", "https://eur-lex.europa.eu/eli/reg/2024/1689/oj"),
        StandardEntry("eu_ai_act", "Art.15", "Accuracy, robustness, cybersecurity", "https://eur-lex.europa.eu/eli/reg/2024/1689/oj"),
        StandardEntry("eu_ai_act", "Art.17", "Quality management system", "https://eur-lex.europa.eu/eli/reg/2024/1689/oj"),
    ]
}

# ─── MITRE ATLAS (AI adversarial TTPs) ──────────────────────────────────
MITRE_ATLAS: Final[dict[str, StandardEntry]] = {
    e.identifier: e
    for e in [
        StandardEntry("mitre_atlas", "AML.T0051", "LLM Prompt Injection", "https://atlas.mitre.org/techniques/AML.T0051"),
        StandardEntry("mitre_atlas", "AML.T0054", "LLM Jailbreak", "https://atlas.mitre.org/techniques/AML.T0054"),
        StandardEntry("mitre_atlas", "AML.T0057", "LLM Data Leakage", "https://atlas.mitre.org/techniques/AML.T0057"),
        StandardEntry("mitre_atlas", "AML.T0053", "LLM Plugin Compromise", "https://atlas.mitre.org/techniques/AML.T0053"),
        StandardEntry("mitre_atlas", "AML.T0018", "Manipulate AI Model", "https://atlas.mitre.org/techniques/AML.T0018"),
    ]
}

# ─── India DPDP Act 2023 — section-level refs ───────────────────────────
INDIA_DPDP_2023: Final[dict[str, StandardEntry]] = {
    e.identifier: e
    for e in [
        StandardEntry("india_dpdp_2023", "S.4", "Grounds for processing personal data", "https://www.meity.gov.in/"),
        StandardEntry("india_dpdp_2023", "S.6", "Consent", "https://www.meity.gov.in/"),
        StandardEntry("india_dpdp_2023", "S.8", "General obligations of Data Fiduciary", "https://www.meity.gov.in/"),
        StandardEntry("india_dpdp_2023", "S.9", "Processing of children's data", "https://www.meity.gov.in/"),
        StandardEntry("india_dpdp_2023", "S.16", "Cross-border transfer", "https://www.meity.gov.in/"),
    ]
}

# ─── CWE (weakness taxonomy) — the few we use directly ──────────────────
CWE: Final[dict[str, StandardEntry]] = {
    e.identifier: e
    for e in [
        StandardEntry("cwe", "CWE-77", "Command Injection", "https://cwe.mitre.org/data/definitions/77.html"),
        StandardEntry("cwe", "CWE-200", "Exposure of Sensitive Information", "https://cwe.mitre.org/data/definitions/200.html"),
        StandardEntry("cwe", "CWE-285", "Improper Authorization", "https://cwe.mitre.org/data/definitions/285.html"),
        StandardEntry("cwe", "CWE-400", "Uncontrolled Resource Consumption", "https://cwe.mitre.org/data/definitions/400.html"),
        StandardEntry("cwe", "CWE-532", "Insertion of Sensitive Information into Log File", "https://cwe.mitre.org/data/definitions/532.html"),
        StandardEntry("cwe", "CWE-915", "Improperly Controlled Modification of Dynamically-Determined Object Attributes", "https://cwe.mitre.org/data/definitions/915.html"),
        StandardEntry("cwe", "CWE-1427", "Improper Neutralization of Input Used for LLM Prompting", "https://cwe.mitre.org/data/definitions/1427.html"),
    ]
}

# ─── Master registry: framework -> dict[id, entry] ──────────────────────
REGISTRY: Final[dict[str, dict[str, StandardEntry]]] = {
    "owasp_llm_2025": OWASP_LLM_2025,
    "owasp_agentic_2025": OWASP_AGENTIC_2025,
    "nist_ai_rmf_genai": NIST_AI_RMF_GENAI,
    "eu_ai_act": EU_AI_ACT,
    "mitre_atlas": MITRE_ATLAS,
    "india_dpdp_2023": INDIA_DPDP_2023,
    "cwe": CWE,
}


def lookup(framework: str, identifier: str) -> StandardEntry:
    """Look up a canonical standard entry or raise KeyError."""
    try:
        return REGISTRY[framework][identifier]
    except KeyError as exc:
        raise KeyError(f"Unknown standard: {framework}/{identifier}") from exc


def all_frameworks() -> list[str]:
    """List all registered framework IDs."""
    return sorted(REGISTRY.keys())

# ─── ISO/IEC 42001:2023 (AI management system) ───────────────────────────
ISO_42001: Final[dict[str, StandardEntry]] = {
    e.identifier: e
    for e in [
        StandardEntry("iso_42001", "6.1", "Actions to address risks and opportunities", "https://www.iso.org/standard/81230.html"),
        StandardEntry("iso_42001", "8.4", "AI system impact assessment", "https://www.iso.org/standard/81230.html"),
        StandardEntry("iso_42001", "9.1", "Monitoring, measurement, analysis and evaluation", "https://www.iso.org/standard/81230.html"),
        StandardEntry("iso_42001", "10.1", "Continual improvement", "https://www.iso.org/standard/81230.html"),
    ]
}

# ─── Additional NIST AI RMF controls needed for v5 phases ────────────────
NIST_AI_RMF_GENAI.update({
    e.identifier: e
    for e in [
        StandardEntry("nist_ai_rmf_genai", "GV-4.2", "Govern: organizational teams are committed to risk policies", "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"),
        StandardEntry("nist_ai_rmf_genai", "MP-4.1", "Map: team focuses on AI risks", "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"),
        StandardEntry("nist_ai_rmf_genai", "MS-2.5", "Measure: fairness and bias", "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"),
        StandardEntry("nist_ai_rmf_genai", "MS-2.10", "Measure: privacy", "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"),
        StandardEntry("nist_ai_rmf_genai", "MG-2.2", "Manage: mechanisms to sustain effectiveness", "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"),
    ]
})

# ─── Additional EU AI Act articles for v5 phases ─────────────────────────
EU_AI_ACT.update({
    e.identifier: e
    for e in [
        StandardEntry("eu_ai_act", "Art.10.3", "Data governance — bias monitoring", "https://eur-lex.europa.eu/eli/reg/2024/1689/oj"),
        StandardEntry("eu_ai_act", "Art.16", "Obligations of providers of high-risk systems", "https://eur-lex.europa.eu/eli/reg/2024/1689/oj"),
    ]
})

# ─── Additional India DPDP controls for Phase 8 ──────────────────────────
INDIA_DPDP_2023.update({
    e.identifier: e
    for e in [
        StandardEntry("india_dpdp_2023", "S.7", "Notice for processing personal data", "https://www.meity.gov.in/"),
        StandardEntry("india_dpdp_2023", "S.11", "Right to correction and erasure", "https://www.meity.gov.in/"),
        StandardEntry("india_dpdp_2023", "S.12", "Right to grievance redressal", "https://www.meity.gov.in/"),
    ]
})

# ─── Additional MITRE ATLAS techniques for MCP/multi-agent ───────────────
MITRE_ATLAS.update({
    e.identifier: e
    for e in [
        StandardEntry("mitre_atlas", "AML.T0048", "Societal Harm", "https://atlas.mitre.org/techniques/AML.T0048"),
        StandardEntry("mitre_atlas", "AML.T0058", "Backdoor ML Model", "https://atlas.mitre.org/techniques/AML.T0058"),
        StandardEntry("mitre_atlas", "AML.T0043", "Craft Adversarial Data", "https://atlas.mitre.org/techniques/AML.T0043"),
    ]
})

# ─── Register new frameworks in master registry ───────────────────────────
REGISTRY["iso_42001"] = ISO_42001
