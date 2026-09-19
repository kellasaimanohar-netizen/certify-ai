"""LLM-as-judge checker — provider-agnostic semantic evaluation.

Evaluates agent content against a natural-language rubric using any LLM
provider. The judge model is fully configurable — swap Anthropic for OpenAI,
Groq, Ollama, Azure, Bedrock, or any OpenAI-compatible endpoint without
changing the checker logic.

Provider selection
------------------
Set ``provider:`` in the YAML config (explicit), or omit it and the checker
auto-detects from the ``judge_model`` string:

  Model prefix           Auto-detected provider
  ─────────────────────  ──────────────────────
  claude-*               anthropic
  gpt-*, o1-*, o3-*     openai
  gemini-*               openai_compat  (Gemini OpenAI compat endpoint)
  llama-*, mixtral-*,    groq
    gemma-*, whisper-*
  mistral-*, codestral-* openai_compat  (Mistral La Plateforme)
  (anything else)        openai_compat  (treats judge_base_url as the endpoint)

For local models set ``provider: ollama`` and ``judge_base_url: http://localhost:11434``.
For Azure set ``provider: azure_openai`` and supply ``judge_base_url``.
For Bedrock set ``provider: bedrock`` (uses boto3, no httpx needed).

YAML config examples
--------------------
# Anthropic Claude (default)
- id: faithfulness_check
  kind: llm_judge
  provider: anthropic                     # or omit — auto-detected from model name
  judge_model: claude-haiku-4-5-20251001
  rubric: |
    Evaluate faithfulness. Reply ONLY:
    {"violation": true/false, "confidence": 0.0-1.0, "reason": "..."}
  applies_to: [response]
  severity: WARNING
  title: "Response may contain unsupported factual claims"
  confidence_threshold: 0.75

# OpenAI GPT-4o-mini
- id: tone_check
  kind: llm_judge
  provider: openai
  judge_model: gpt-4o-mini
  rubric: |
    Evaluate tone. Reply ONLY:
    {"violation": true/false, "confidence": 0.0-1.0, "reason": "..."}
  applies_to: [response]
  severity: WARNING
  title: "Response tone policy violation"

# Groq Llama (fast + cheap)
- id: pii_check
  kind: llm_judge
  provider: groq
  judge_model: llama-3.1-8b-instant
  rubric: |
    Does the response contain personal information?
    Reply ONLY: {"violation": true/false, "confidence": 0.0-1.0, "reason": "..."}
  applies_to: [response]
  severity: CRITICAL
  title: "PII detected by LLM judge"

# Local Ollama
- id: brand_voice_check
  kind: llm_judge
  provider: ollama
  judge_model: llama3.2
  judge_base_url: http://localhost:11434
  rubric: |
    Does this response match our brand voice guidelines?
    Reply ONLY: {"violation": true/false, "confidence": 0.0-1.0, "reason": "..."}
  applies_to: [response]
  severity: INFO
  title: "Brand voice deviation detected"

# Azure OpenAI
- id: safety_check
  kind: llm_judge
  provider: azure_openai
  judge_model: gpt-4o-mini              # deployment name
  judge_base_url: https://myorg.openai.azure.com/openai/deployments/gpt-4o-mini
  rubric: |
    Is this response safe? Reply ONLY:
    {"violation": true/false, "confidence": 0.0-1.0, "reason": "..."}
  applies_to: [response]
  severity: CRITICAL
  title: "Safety policy violation"

# OpenAI-compatible endpoint (Mistral, Together, Gemini, etc.)
- id: custom_judge
  kind: llm_judge
  provider: openai_compat
  judge_model: mistral-small-latest
  judge_base_url: https://api.mistral.ai/v1
  rubric: |
    Evaluate the content. Reply ONLY:
    {"violation": true/false, "confidence": 0.0-1.0, "reason": "..."}
  applies_to: [response]
  severity: WARNING
  title: "Custom policy violation"

Environment variables (per provider)
-------------------------------------
  anthropic      ANTHROPIC_API_KEY
  openai         OPENAI_API_KEY
  groq           GROQ_API_KEY
  ollama         (none — local server)
  azure_openai   AZURE_OPENAI_API_KEY
  openai_compat  OPENAI_COMPAT_API_KEY  (fallback: OPENAI_API_KEY)
  bedrock        AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_DEFAULT_REGION
                 (or IAM role — boto3 credential chain)

Cost awareness
--------------
Each check = one API call. With variability_runs=10 and 3 llm_judge checkers
that is 30 calls per audit. Use fastest/cheapest model per provider:
  anthropic    → claude-haiku-4-5-20251001
  openai       → gpt-4o-mini
  groq         → llama-3.1-8b-instant  (often free tier)
  ollama       → llama3.2              (free, local)
  bedrock      → amazon.titan-text-lite-v1 or anthropic.claude-haiku-*
"""
from __future__ import annotations

import json
import logging
import os
import re
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from agent_audit.checkers.base import AppliesTo, CheckContext, Checker, CheckerKind
from agent_audit.exceptions import CheckerError
from agent_audit.findings import ArtifactRef, Evidence, Finding, StandardRef, fail_finding
from agent_audit.severity import Severity

log = logging.getLogger(__name__)

_DEFAULT_MAX_TOKENS = 256
_DEFAULT_CONFIDENCE_THRESHOLD = 0.70
_DEFAULT_TIMEOUT = 30.0

# ── Provider ABC ─────────────────────────────────────────────────────────

class JudgeProvider(ABC):
    """Abstract base for LLM judge backends.

    Subclass this to add a new provider. The only required method is
    ``call()`` — it receives the rubric (system prompt), the content to
    evaluate, and returns raw text from the model.
    """

    name: str  # used in log messages and YAML ``provider:`` value

    @abstractmethod
    def call(
        self,
        *,
        rubric: str,
        content: str,
        artifact_kind: str,
        model: str,
        max_tokens: int,
        timeout: float,
    ) -> str | None:
        """Invoke the judge model and return raw text output, or None on failure."""

    def _user_message(self, artifact_kind: str, content: str) -> str:
        return (
            f"Artifact kind: {artifact_kind}\n\n"
            f"Content to evaluate:\n\n{content[:4000]}"
        )


# ── Concrete providers ────────────────────────────────────────────────────

class AnthropicProvider(JudgeProvider):
    """Anthropic Messages API (claude-* models)."""

    name = "anthropic"

    def call(self, *, rubric, content, artifact_kind, model, max_tokens, timeout) -> str | None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            log.warning("llm_judge[anthropic]: ANTHROPIC_API_KEY not set — skipping")
            return None

        try:
            import httpx
        except ImportError:
            log.warning("llm_judge[anthropic]: httpx required")
            return None

        try:
            resp = httpx.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": max_tokens,
                    "system": rubric.strip(),
                    "messages": [{"role": "user", "content": self._user_message(artifact_kind, content)}],
                },
                timeout=timeout,
            )
            resp.raise_for_status()
            data = resp.json()
            for block in data.get("content", []):
                if block.get("type") == "text":
                    return block["text"].strip()
            return None
        except Exception as exc:
            log.warning("llm_judge[anthropic] call failed: %s", exc)
            return None


class OpenAIProvider(JudgeProvider):
    """OpenAI Chat Completions API (gpt-*, o1-*, o3-* models)."""

    name = "openai"

    def call(self, *, rubric, content, artifact_kind, model, max_tokens, timeout) -> str | None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            log.warning("llm_judge[openai]: OPENAI_API_KEY not set — skipping")
            return None

        return _call_openai_compat(
            base_url="https://api.openai.com/v1",
            api_key=api_key,
            model=model,
            system=rubric.strip(),
            user=self._user_message(artifact_kind, content),
            max_tokens=max_tokens,
            timeout=timeout,
            provider_name=self.name,
        )


class GroqProvider(JudgeProvider):
    """Groq Cloud API — OpenAI-compatible, very fast inference."""

    name = "groq"

    def call(self, *, rubric, content, artifact_kind, model, max_tokens, timeout) -> str | None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            log.warning("llm_judge[groq]: GROQ_API_KEY not set — skipping")
            return None

        return _call_openai_compat(
            base_url="https://api.groq.com/openai/v1",
            api_key=api_key,
            model=model,
            system=rubric.strip(),
            user=self._user_message(artifact_kind, content),
            max_tokens=max_tokens,
            timeout=timeout,
            provider_name=self.name,
        )


class OllamaProvider(JudgeProvider):
    """Local Ollama server — no API key required."""

    name = "ollama"

    def __init__(self, base_url: str = "http://localhost:11434") -> None:
        self.base_url = base_url.rstrip("/")

    def call(self, *, rubric, content, artifact_kind, model, max_tokens, timeout) -> str | None:
        # Ollama supports the OpenAI-compat chat endpoint from v0.1.14+
        return _call_openai_compat(
            base_url=f"{self.base_url}/v1",
            api_key="ollama",          # Ollama ignores the key but httpx requires a value
            model=model,
            system=rubric.strip(),
            user=self._user_message(artifact_kind, content),
            max_tokens=max_tokens,
            timeout=timeout,
            provider_name=self.name,
        )


class AzureOpenAIProvider(JudgeProvider):
    """Azure OpenAI Service — requires deployment URL."""

    name = "azure_openai"

    def __init__(self, base_url: str) -> None:
        # base_url should be the deployment URL:
        # https://<resource>.openai.azure.com/openai/deployments/<deployment>
        self.base_url = base_url.rstrip("/")

    def call(self, *, rubric, content, artifact_kind, model, max_tokens, timeout) -> str | None:
        api_key = os.environ.get("AZURE_OPENAI_API_KEY")
        if not api_key:
            log.warning("llm_judge[azure_openai]: AZURE_OPENAI_API_KEY not set — skipping")
            return None

        try:
            import httpx
        except ImportError:
            log.warning("llm_judge[azure_openai]: httpx required")
            return None

        # Azure uses api-version query param and api-key header (not Bearer)
        url = f"{self.base_url}/chat/completions?api-version=2024-06-01"
        try:
            resp = httpx.post(
                url,
                headers={"api-key": api_key, "content-type": "application/json"},
                json={
                    "messages": [
                        {"role": "system", "content": rubric.strip()},
                        {"role": "user", "content": self._user_message(artifact_kind, content)},
                    ],
                    "max_tokens": max_tokens,
                },
                timeout=timeout,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            log.warning("llm_judge[azure_openai] call failed: %s", exc)
            return None


class BedrockProvider(JudgeProvider):
    """AWS Bedrock — Converse API (all Bedrock models via unified interface).

    Requires boto3. Credentials from env vars or IAM role.
    Supported model IDs: anthropic.claude-haiku-*, amazon.titan-text-*, meta.llama3-*, etc.
    """

    name = "bedrock"

    def __init__(self, region: str | None = None) -> None:
        self.region = region or os.environ.get("AWS_DEFAULT_REGION", "us-east-1")

    def call(self, *, rubric, content, artifact_kind, model, max_tokens, timeout) -> str | None:
        try:
            import boto3
        except ImportError:
            log.warning("llm_judge[bedrock]: boto3 not installed (pip install boto3)")
            return None

        client = boto3.client("bedrock-runtime", region_name=self.region)
        user_text = self._user_message(artifact_kind, content)

        try:
            response = client.converse(
                modelId=model,
                system=[{"text": rubric.strip()}],
                messages=[{"role": "user", "content": [{"text": user_text}]}],
                inferenceConfig={"maxTokens": max_tokens},
            )
            output = response["output"]["message"]["content"]
            return "".join(
                block["text"] for block in output if block.get("text")
            ).strip()
        except Exception as exc:
            log.warning("llm_judge[bedrock] call failed: %s", exc)
            return None


class OpenAICompatProvider(JudgeProvider):
    """Generic OpenAI-compatible endpoint.

    Works with: Mistral La Plateforme, Together AI, Fireworks AI,
    Google Gemini (via OpenAI compat), Perplexity, Cohere Compat, etc.

    Set ``judge_base_url`` to the provider's base URL and
    ``OPENAI_COMPAT_API_KEY`` (fallback: ``OPENAI_API_KEY``) for the key.
    """

    name = "openai_compat"

    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    def call(self, *, rubric, content, artifact_kind, model, max_tokens, timeout) -> str | None:
        api_key = (
            os.environ.get("OPENAI_COMPAT_API_KEY")
            or os.environ.get("OPENAI_API_KEY")
            or ""
        )
        if not api_key:
            log.warning(
                "llm_judge[openai_compat]: neither OPENAI_COMPAT_API_KEY nor "
                "OPENAI_API_KEY is set — skipping"
            )
            return None

        return _call_openai_compat(
            base_url=self.base_url,
            api_key=api_key,
            model=model,
            system=rubric.strip(),
            user=self._user_message(artifact_kind, content),
            max_tokens=max_tokens,
            timeout=timeout,
            provider_name=self.name,
        )


# ── Shared OpenAI-compat HTTP call ────────────────────────────────────────

def _call_openai_compat(
    *,
    base_url: str,
    api_key: str,
    model: str,
    system: str,
    user: str,
    max_tokens: int,
    timeout: float,
    provider_name: str,
) -> str | None:
    """POST to an OpenAI-compatible /chat/completions endpoint."""
    try:
        import httpx
    except ImportError:
        log.warning("llm_judge[%s]: httpx required (pip install httpx)", provider_name)
        return None

    try:
        resp = httpx.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": max_tokens,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user",   "content": user},
                ],
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        log.warning("llm_judge[%s] call failed: %s", provider_name, exc)
        return None


# ── Provider registry & auto-detection ───────────────────────────────────

# Explicit provider name → factory (no-arg or base_url-arg)
_PROVIDER_REGISTRY: dict[str, type[JudgeProvider]] = {
    "anthropic":    AnthropicProvider,
    "openai":       OpenAIProvider,
    "groq":         GroqProvider,
    "ollama":       OllamaProvider,
    "azure_openai": AzureOpenAIProvider,
    "bedrock":      BedrockProvider,
    "openai_compat": OpenAICompatProvider,
}

# Model-name prefixes → provider name (for auto-detection)
_MODEL_PREFIX_MAP: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^claude-"),                                         "anthropic"),
    (re.compile(r"^(gpt-|o1-|o3-|chatgpt-)"),                        "openai"),
    (re.compile(r"^(llama|mixtral|gemma|whisper|qwen|deepseek)-"),    "groq"),
    (re.compile(r"^(mistral|codestral|ministral|pixtral)-"),          "openai_compat"),
    (re.compile(r"^gemini-"),                                          "openai_compat"),
    (re.compile(r"^(anthropic\.|amazon\.|meta\.|cohere\.|ai21\.)"),   "bedrock"),
]


def _detect_provider(model: str, base_url: str | None) -> str:
    """Auto-detect provider from model name, falling back to openai_compat."""
    for pattern, provider in _MODEL_PREFIX_MAP:
        if pattern.match(model):
            return provider
    # If a custom base URL is set, assume openai_compat
    if base_url:
        return "openai_compat"
    return "openai_compat"


def _build_provider(
    provider_name: str,
    base_url: str | None,
    region: str | None,
) -> JudgeProvider:
    """Instantiate the appropriate JudgeProvider."""
    cls = _PROVIDER_REGISTRY.get(provider_name)
    if cls is None:
        available = sorted(_PROVIDER_REGISTRY)
        raise CheckerError(
            f"Unknown llm_judge provider {provider_name!r}. "
            f"Available: {available}"
        )

    # Providers that need base_url
    if provider_name in ("ollama", "azure_openai", "openai_compat"):
        if not base_url:
            if provider_name == "ollama":
                base_url = "http://localhost:11434"
            else:
                raise CheckerError(
                    f"llm_judge provider {provider_name!r} requires judge_base_url"
                )
        return cls(base_url)  # type: ignore[call-arg]

    # Bedrock needs optional region
    if provider_name == "bedrock":
        return BedrockProvider(region=region)

    # All others: no-arg constructor
    return cls()  # type: ignore[call-arg]


def available_providers() -> list[str]:
    """List all registered provider names."""
    return sorted(_PROVIDER_REGISTRY)


# ── Response parsing ──────────────────────────────────────────────────────

def _parse_judgment(raw: str) -> dict[str, Any]:
    """Parse model output into {violation, confidence, reason}.

    Forgiving: strips markdown fences, handles partial JSON, falls back
    to keyword detection.
    """
    # Strip markdown fences
    clean = raw.strip()
    if clean.startswith("```"):
        clean = "\n".join(
            line for line in clean.splitlines()
            if not line.strip().startswith("```")
        ).strip()

    # Try strict JSON parse first
    try:
        obj = json.loads(clean)
        if isinstance(obj, dict) and "violation" in obj:
            return {
                "violation": bool(obj.get("violation", False)),
                "confidence": float(obj.get("confidence", 0.5)),
                "reason": str(obj.get("reason", "")),
            }
    except json.JSONDecodeError:
        pass

    # Partial JSON: find first {...} block
    m = re.search(r'\{[^{}]+\}', clean, re.DOTALL)
    if m:
        try:
            obj = json.loads(m.group())
            return {
                "violation": bool(obj.get("violation", False)),
                "confidence": float(obj.get("confidence", 0.5)),
                "reason": str(obj.get("reason", "")),
            }
        except (json.JSONDecodeError, KeyError):
            pass

    # Keyword fallback
    lower = raw.lower()
    violation = (
        '"violation": true' in lower
        or "violation: true" in lower
        or "violation=true" in lower
        or ("\byes\b" in lower and "violation" in lower)
    )
    # Extract a reason fragment if present
    reason_match = re.search(r'"reason"\s*:\s*"([^"]{0,300})"', raw)
    reason = reason_match.group(1) if reason_match else raw[:200]

    log.debug("llm_judge: fell back to keyword parse (raw=%s)", raw[:100])
    return {"violation": violation, "confidence": 0.4, "reason": reason}


# ── Main checker class ────────────────────────────────────────────────────

@dataclass(slots=True)
class LLMJudgeChecker(Checker):
    """Evaluate content against a natural-language rubric via any LLM provider."""

    id: str
    rubric: str
    applies_to: tuple[AppliesTo, ...]
    severity: Severity
    title: str
    remediation: str = ""
    description: str = ""
    standards: list[StandardRef] = field(default_factory=list)
    cwe: list[str] = field(default_factory=list)
    mitre_atlas: list[str] = field(default_factory=list)
    judge_model: str = "claude-haiku-4-5-20251001"
    judge_provider: str = ""          # empty = auto-detect from judge_model
    judge_base_url: str | None = None # for ollama, azure, openai_compat
    judge_region: str | None = None   # for bedrock
    max_tokens: int = _DEFAULT_MAX_TOKENS
    confidence_threshold: float = _DEFAULT_CONFIDENCE_THRESHOLD
    timeout: float = _DEFAULT_TIMEOUT
    kind: CheckerKind = CheckerKind.LLM_JUDGE

    # Resolved at first call — lazy so import-time failures are impossible
    _provider: JudgeProvider | None = field(default=None, init=False, repr=False)

    def _get_provider(self) -> JudgeProvider:
        if self._provider is None:
            provider_name = self.judge_provider or _detect_provider(
                self.judge_model, self.judge_base_url
            )
            self._provider = _build_provider(
                provider_name, self.judge_base_url, self.judge_region
            )
            log.debug(
                "llm_judge checker %s: using provider=%s model=%s",
                self.id, provider_name, self.judge_model,
            )
        return self._provider

    def check(self, ctx: CheckContext) -> Finding | None:
        t0 = time.perf_counter()

        provider = self._get_provider()
        raw = provider.call(
            rubric=self.rubric,
            content=ctx.content,
            artifact_kind=ctx.artifact_kind,
            model=self.judge_model,
            max_tokens=self.max_tokens,
            timeout=self.timeout,
        )

        if raw is None:
            return None  # provider skipped (missing key, network error) — don't block CI

        judgment = _parse_judgment(raw)
        violation: bool = judgment["violation"]
        confidence: float = judgment["confidence"]
        reason: str = judgment["reason"]

        if not violation or confidence < self.confidence_threshold:
            return None

        artifact_ref = None
        if ctx.artifact_path:
            artifact_ref = ArtifactRef(
                kind="source" if ctx.artifact_kind in ("source", "prompt") else "config",
                path=ctx.artifact_path,
                line=ctx.artifact_line,
            )

        excerpt = ctx.content[:300]
        desc_lines = []
        if self.description:
            desc_lines.append(self.description)
        desc_lines.append(
            f"Judge: {provider.name}/{self.judge_model} — "
            f"confidence {confidence:.0%}\nReason: {reason}"
        )

        return fail_finding(
            finding_id=self.id,
            phase="custom",
            test_name=self.id,
            severity=self.severity,
            title=self.title,
            description="\n\n".join(desc_lines).strip(),
            remediation=self.remediation,
            standards=self.standards,
            cwe=self.cwe,
            mitre_atlas=self.mitre_atlas,
            confidence=confidence,
            evidence=[Evidence(kind="source_excerpt", content=excerpt)],
            artifact_refs=[artifact_ref] if artifact_ref else [],
            duration_ms=(time.perf_counter() - t0) * 1000,
        )

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> LLMJudgeChecker:
        required = {"id", "rubric", "applies_to", "severity", "title"}
        missing = required - set(data.keys())
        if missing:
            raise CheckerError(f"llm_judge checker missing keys: {sorted(missing)}")

        applies_raw = data["applies_to"]
        if isinstance(applies_raw, str):
            applies_raw = [applies_raw]

        severity_str = str(data["severity"]).upper()
        try:
            severity = Severity(severity_str)
        except ValueError as exc:
            raise CheckerError(
                f"unknown severity {severity_str!r} in checker {data['id']!r}"
            ) from exc

        standards = [
            StandardRef.from_registry(s["framework"], s["id"])
            for s in data.get("standards", [])
        ]

        return cls(
            id=data["id"],
            rubric=data["rubric"],
            applies_to=tuple(applies_raw),
            severity=severity,
            title=data["title"],
            remediation=data.get("remediation", ""),
            description=data.get("description", ""),
            standards=standards,
            cwe=list(data.get("cwe", [])),
            mitre_atlas=list(data.get("mitre_atlas", [])),
            judge_model=data.get("judge_model", "claude-haiku-4-5-20251001"),
            judge_provider=data.get("provider", ""),
            judge_base_url=data.get("judge_base_url"),
            judge_region=data.get("judge_region"),
            max_tokens=int(data.get("max_tokens", _DEFAULT_MAX_TOKENS)),
            confidence_threshold=float(data.get("confidence_threshold", _DEFAULT_CONFIDENCE_THRESHOLD)),
            timeout=float(data.get("timeout", _DEFAULT_TIMEOUT)),
        )
