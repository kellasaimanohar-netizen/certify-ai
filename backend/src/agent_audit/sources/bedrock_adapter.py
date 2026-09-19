"""AWS Bedrock Agents source adapter.

Pulls an Amazon Bedrock Agent's configuration and turns it into a partial
``TargetManifest``:

  * action groups          → tools (each action becomes a ToolSpec)
  * foundation model       → ModelSpec (provider inferred from the model id)
  * instruction            → a system PromptSpec
  * idle session TTL etc.  → capability hints

Two ways to supply the agent config:

  1. **Live (default):** give ``agent_id`` and ``region``; the adapter calls the
     Bedrock Agent control-plane API (``GetAgent`` + ``ListAgentActionGroups`` +
     ``ListAgentAliases``) via boto3. Credentials come from the standard AWS
     chain (env, profile, instance role) — never inlined here.

  2. **Offline:** pass a ``config`` dict (the shape boto3 would return). This lets
     the adapter be unit-tested without AWS and lets you certify an exported
     agent definition. The smoke test uses live mode.

Spec block (in the target YAML)::

    - type: bedrock
      agent_id: ABCDEFGH
      region: us-east-1
      # optional offline override:
      # config: { agent: {...}, action_groups: [...] }
"""
from __future__ import annotations

import logging
from typing import Any

from agent_audit.exceptions import SourceError
from agent_audit.manifest import ModelSpec, PromptSpec, TargetManifest, ToolSpec
from agent_audit.sources.base import SourceAdapter

log = logging.getLogger(__name__)

# model-id substring -> provider (Bedrock hosts many vendors)
_PROVIDER_BY_HINT = {
    "anthropic.": "anthropic",
    "claude": "anthropic",
    "amazon.": "amazon",
    "titan": "amazon",
    "nova": "amazon",
    "meta.": "meta",
    "llama": "meta",
    "mistral.": "mistral",
    "cohere.": "cohere",
    "ai21.": "ai21",
}

# Action names that imply a destructive / state-changing operation.
_DESTRUCTIVE_HINTS = ("delete", "remove", "cancel", "refund", "transfer",
                      "pay", "issue", "update", "drop", "terminate", "revoke",
                      "wipe", "erase", "purge", "destroy", "reset", "close",
                      "deactivate", "disable", "send", "charge", "withdraw",
                      "approve", "execute", "grant", "modify", "overwrite")


def _provider_for(model_id: str) -> str:
    mid = (model_id or "").lower()
    for hint, prov in _PROVIDER_BY_HINT.items():
        if hint in mid:
            return prov
    return "aws"


def _looks_destructive(name: str) -> bool:
    n = (name or "").lower()
    return any(h in n for h in _DESTRUCTIVE_HINTS)


class BedrockAdapter(SourceAdapter):
    """Build a manifest from an AWS Bedrock Agent definition."""

    source_type = "bedrock"
    default_confidence = 0.8   # control-plane declared config, not human-authored

    def extract(self, spec: dict[str, Any], *, agent_name: str) -> TargetManifest:
        config = spec.get("config")
        if config is None:
            config = self._fetch_live(spec)
        if not isinstance(config, dict):
            config = {}

        agent = config.get("agent")
        if not isinstance(agent, dict):
            agent = {}
        action_groups = config.get("action_groups")
        if not isinstance(action_groups, list):
            action_groups = []

        tools: list[ToolSpec] = []
        for ag in action_groups:
            if not isinstance(ag, dict):
                continue
            ag_name = ag.get("actionGroupName") or ag.get("name") or "action_group"
            for action in _iter_actions(ag):
                tools.append(ToolSpec(
                    name=action,
                    destructive=_looks_destructive(action),
                    declared_in="bedrock",
                    source_location=f"action_group:{ag_name}",
                ))

        models: list[ModelSpec] = []
        model_id = agent.get("foundationModel") or agent.get("foundationModelArn")
        if model_id:
            model_id = str(model_id)
            models.append(ModelSpec(
                provider=_provider_for(model_id),
                model_id=model_id,
                source_location="bedrock:foundationModel",
            ))

        prompts: list[PromptSpec] = []
        instruction = agent.get("instruction")
        if instruction:
            instruction = str(instruction)
            prompts.append(PromptSpec(
                name="bedrock_instruction",
                content=instruction,
                source_location="bedrock:instruction",
                role="system",
            ))

        manifest = TargetManifest(
            agent_name=agent.get("agentName") or agent_name,
            prompts=prompts,
            models=models,
        )
        manifest.capabilities.tools = tools
        # idle session TTL is a soft signal for max session length, not steps.
        manifest.provenance_trail["bedrock"] = [
            "tools_from_action_groups", "model", "instruction",
        ]
        return manifest

    # ── live fetch via boto3 ────────────────────────────────────────────────
    def _fetch_live(self, spec: dict[str, Any]) -> dict[str, Any]:
        agent_id = spec.get("agent_id")
        region = spec.get("region")
        if not (agent_id and region):
            raise SourceError(
                "bedrock source needs agent_id + region (or an offline 'config' dict)"
            )
        try:
            import boto3  # imported lazily so the dep is optional
        except ImportError as exc:  # pragma: no cover - env-dependent
            raise SourceError(
                "bedrock live mode needs boto3 (`pip install boto3`), or pass an "
                "offline 'config' dict in the spec"
            ) from exc

        client = boto3.client("bedrock-agent", region_name=region)
        agent = client.get_agent(agentId=agent_id)["agent"]

        groups = []
        paginator = client.get_paginator("list_agent_action_groups")
        for page in paginator.paginate(agentId=agent_id, agentVersion="DRAFT"):
            for summary in page.get("actionGroupSummaries", []):
                detail = client.get_agent_action_group(
                    agentId=agent_id, agentVersion="DRAFT",
                    actionGroupId=summary["actionGroupId"],
                )["agentActionGroup"]
                groups.append(detail)

        return {"agent": agent, "action_groups": groups}


def _iter_actions(action_group: dict[str, Any]) -> list[str]:
    """Pull action/function names from an action group.

    Bedrock expresses actions two ways: a function schema (list of functions) or
    an OpenAPI schema (paths). Tolerate both; fall back to the group name.
    """
    names: list[str] = []
    fschema = action_group.get("functionSchema")
    fs = (fschema or {}).get("functions") if isinstance(fschema, dict) else None
    for fn in (fs or []):
        if isinstance(fn, dict) and fn.get("name"):
            names.append(fn["name"])

    api = action_group.get("apiSchema") or {}
    paths = (api.get("payload") or {}) if isinstance(api, dict) else {}
    if isinstance(paths, dict):
        for path, methods in (paths.get("paths") or {}).items():
            if isinstance(methods, dict):
                for method in methods:
                    names.append(f"{method.upper()} {path}")

    if not names:
        gname = action_group.get("actionGroupName") or action_group.get("name")
        if gname:
            names.append(gname)
    return names
