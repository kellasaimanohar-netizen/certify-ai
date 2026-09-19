"""Azure AI Foundry (Foundry Agent Service) source adapter.

Turns an Azure AI Foundry agent definition into a partial ``TargetManifest``:

  * tools           → ToolSpec list (function tools + built-in tools like
                      code_interpreter / file_search / bing / mcp)
  * model           → ModelSpec (the model deployment name; provider inferred)
  * instructions    → a system PromptSpec

Azure AI Foundry Agent Service exposes an assistants/threads/runs API (GA
api-version ``2025-05-01``). An agent ("assistant") is fetched with::

    GET {project_endpoint}/assistants/{assistant_id}?api-version=2025-05-01
    Authorization: Bearer <Entra token>

where ``project_endpoint`` looks like
``https://<resource>.services.ai.azure.com/api/projects/<project>``.

Two ways to supply the definition:

  1. **Live (default):** give ``project_endpoint`` + ``assistant_id`` (+ optional
     ``api_version``). The adapter acquires an Entra token via
     ``azure-identity`` (DefaultAzureCredential — env/CLI/managed-identity chain,
     never an inlined secret) and GETs the assistant definition. This certifies
     the *configuration* only; it does not run the agent.

  2. **Offline:** pass a ``config`` dict (the assistant JSON the API returns).
     Used by tests and to certify an exported definition.

Spec block (in the target YAML)::

    - type: foundry
      project_endpoint: https://myres.services.ai.azure.com/api/projects/MyProj
      assistant_id: asst_abc123
      # api_version: "2025-05-01"        # optional, defaults to GA
      # config: { ... }                  # optional offline override

Note: this targets the current GA threads/runs API. Microsoft's newer Foundry
Agent Service exposes a single Responses API entry point; the mapping below is
deliberately isolated in ``_assistant_to_manifest`` so a Responses-API fetch can
be added without touching the manifest logic.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from agent_audit.exceptions import SourceError
from agent_audit.manifest import ModelSpec, PromptSpec, TargetManifest, ToolSpec
from agent_audit.sources.base import SourceAdapter

log = logging.getLogger(__name__)

_DEFAULT_API_VERSION = "2025-05-01"

# model-deployment substring -> provider. Foundry hosts many vendors; the
# deployment name is customer-chosen, so this is a best-effort hint.
_PROVIDER_BY_HINT = {
    "gpt-": "openai", "gpt4": "openai", "gpt-4": "openai", "o1": "openai",
    "o3": "openai", "text-embedding": "openai",
    "claude": "anthropic",
    "llama": "meta", "phi": "microsoft", "mistral": "mistral",
    "gemini": "google", "cohere": "cohere",
}

# Built-in Foundry tool types that are inherently powerful / worth flagging.
# code_interpreter runs code; the others reach external data/systems.
_ELEVATED_TOOL_TYPES = {"code_interpreter", "bing_grounding", "azure_function",
                        "openapi", "mcp", "fabric", "azure_ai_search"}
_DESTRUCTIVE_HINTS = ("delete", "remove", "cancel", "refund", "transfer", "pay",
                      "issue", "update", "drop", "terminate", "revoke", "wipe",
                      "erase", "purge", "destroy", "reset", "close", "deactivate",
                      "disable", "send", "charge", "withdraw", "approve",
                      "execute", "grant", "modify", "overwrite")


def _provider_for(model: str) -> str:
    m = (model or "").lower()
    for hint, prov in _PROVIDER_BY_HINT.items():
        if hint in m:
            return prov
    return "azure"


def _looks_destructive(name: str) -> bool:
    n = str(name or "").lower()
    return any(h in n for h in _DESTRUCTIVE_HINTS)


class FoundryAdapter(SourceAdapter):
    """Build a manifest from an Azure AI Foundry agent (assistant) definition."""

    source_type = "foundry"
    default_confidence = 0.8   # declared config from the control plane

    def extract(self, spec: dict[str, Any], *, agent_name: str) -> TargetManifest:
        config = spec.get("config")
        if config is None:
            config = self._fetch_live(spec)
        if not isinstance(config, dict):
            config = {}
        return self._assistant_to_manifest(config, agent_name)

    # ── mapping (isolated so a Responses-API fetch can reuse it) ────────────
    def _assistant_to_manifest(self, a: dict[str, Any], agent_name: str) -> TargetManifest:
        tools: list[ToolSpec] = []
        for tool in (a.get("tools") or []):
            if not isinstance(tool, dict):
                continue
            ttype = tool.get("type", "")
            if ttype == "function":
                fn = tool.get("function") or {}
                fname = fn.get("name") or "function"
                tools.append(ToolSpec(
                    name=fname,
                    destructive=_looks_destructive(fname),
                    declared_in="foundry",
                    source_location="assistant.tools.function",
                ))
            elif ttype:
                # built-in tool (code_interpreter, file_search, bing, mcp, ...)
                tools.append(ToolSpec(
                    name=ttype,
                    destructive=(ttype == "code_interpreter"),
                    declared_in="foundry",
                    source_location=f"assistant.tools.{ttype}",
                ))

        models: list[ModelSpec] = []
        model = a.get("model")
        if model:
            model = str(model)
            models.append(ModelSpec(
                provider=_provider_for(model),
                model_id=model,
                source_location="assistant.model",
            ))

        prompts: list[PromptSpec] = []
        instructions = a.get("instructions")
        if instructions:
            prompts.append(PromptSpec(
                name="foundry_instructions",
                content=str(instructions),
                source_location="assistant.instructions",
                role="system",
            ))

        manifest = TargetManifest(
            agent_name=a.get("name") or agent_name,
            prompts=prompts,
            models=models,
        )
        manifest.capabilities.tools = tools
        manifest.provenance_trail["foundry"] = ["tools", "model", "instructions"]
        return manifest

    # ── live fetch via Entra + REST ─────────────────────────────────────────
    def _fetch_live(self, spec: dict[str, Any]) -> dict[str, Any]:
        endpoint = (spec.get("project_endpoint") or "").rstrip("/")
        assistant_id = spec.get("assistant_id")
        api_version = spec.get("api_version") or _DEFAULT_API_VERSION
        if not (endpoint and assistant_id):
            raise SourceError(
                "foundry source needs project_endpoint + assistant_id "
                "(or an offline 'config' dict)"
            )
        try:
            from azure.identity import DefaultAzureCredential
        except ImportError as exc:  # pragma: no cover - env-dependent
            raise SourceError(
                "foundry live mode needs azure-identity "
                "(`pip install azure-identity`), or pass an offline 'config' dict"
            ) from exc
        import urllib.request

        # SSRF guard: the endpoint can come from a manifest. safe_urlopen
        # validates the URL and re-validates any redirect target.
        from agent_audit.netguard import BlockedURLError, safe_urlopen
        url = f"{endpoint}/assistants/{assistant_id}?api-version={api_version}"

        cred = DefaultAzureCredential()
        token = cred.get_token("https://ai.azure.com/.default").token
        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        })
        try:
            with safe_urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode())
        except BlockedURLError as exc:
            raise SourceError(f"refusing foundry endpoint: {exc}") from exc
        except Exception as exc:  # noqa: BLE001
            raise SourceError(f"foundry fetch failed: {exc}") from exc
