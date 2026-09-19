"""Drift monitor — compare a current audit against a baseline certificate.

Exit codes (see README):
  0  STABLE (or EXPIRY_WARNING only)
  1  CERT_INVALID
  2  DRIFT_DETECTED
  3  CRITICAL_DRIFT
"""
from __future__ import annotations

import asyncio
import json
import logging
import urllib.request  # kept for fallback; prefer httpx where available
from dataclasses import dataclass
from enum import IntEnum
from pathlib import Path
from typing import Any

from agent_audit.certificate import load_and_verify
from agent_audit.runner import run_audit
from agent_audit.sources import load_target

log = logging.getLogger(__name__)


class DriftExit(IntEnum):
    STABLE = 0
    CERT_INVALID = 1
    DRIFT_DETECTED = 2
    CRITICAL_DRIFT = 3


@dataclass(slots=True)
class DriftResult:
    status: str
    exit_code: DriftExit
    baseline_score: int
    current_score: int
    new_critical: int
    cert_days_remaining: int
    details: dict[str, Any]


async def check_drift(
    *,
    cert_path: str | Path,
    target_path: str | Path,
    variability_runs: int = 10,
    mock_tools: bool = False,
    webhook: str | None = None,
) -> DriftResult:
    """Compare current audit to the signed certificate baseline."""
    try:
        # Pin the issuer if AGENT_AUDIT_TRUSTED_FP is set (comma-separated
        # fingerprints). Otherwise fall back to TOFU but warn loudly — an
        # unpinned baseline can be poisoned by a swapped/forged certificate.
        import os
        pinned = [s.strip() for s in
                  os.environ.get("AGENT_AUDIT_TRUSTED_FP", "").split(",") if s.strip()]
        if pinned:
            cert = load_and_verify(cert_path, trusted_fingerprints=set(pinned))
        else:
            log.warning(
                "drift baseline loaded with NO trust anchor (TOFU) — set "
                "AGENT_AUDIT_TRUSTED_FP to pin the issuer key; a forged certificate "
                "could otherwise set the drift baseline."
            )
            cert = load_and_verify(cert_path, allow_untrusted=True)
    except Exception as exc:
        log.error("certificate invalid: %s", exc)
        return DriftResult(
            status="CERT_INVALID", exit_code=DriftExit.CERT_INVALID,
            baseline_score=0, current_score=0, new_critical=0,
            cert_days_remaining=0,
            details={"error": str(exc)},
        )

    manifest = load_target(target_path)
    report = await run_audit(
        manifest,
        mode="certify" if not mock_tools else "validate",
        mock_tools=mock_tools,
        variability_runs=variability_runs,
    )

    current_score = report.trust_score  # uses AuditReport.trust_score (includes critical penalty)
    new_critical = len(report.critical_failures)

    if new_critical > 0:
        status = "CRITICAL_DRIFT"
        exit_code = DriftExit.CRITICAL_DRIFT
    elif current_score < cert.trust_score - 10:
        status = "DRIFT_DETECTED"
        exit_code = DriftExit.DRIFT_DETECTED
    elif cert.days_remaining <= 14:
        status = "EXPIRY_WARNING"
        exit_code = DriftExit.STABLE
    else:
        status = "STABLE"
        exit_code = DriftExit.STABLE

    result = DriftResult(
        status=status, exit_code=exit_code,
        baseline_score=cert.trust_score,
        current_score=current_score,
        new_critical=new_critical,
        cert_days_remaining=cert.days_remaining,
        details={
            "agent_name": manifest.agent_name,
            "warnings": len(report.warnings),
            "passes": len(report.passes),
        },
    )

    if webhook:
        _post_webhook(webhook, result)
    return result


def _post_webhook(url: str, result: DriftResult) -> None:
    """POST a JSON payload compatible with Slack / generic webhooks."""
    import json as _json

    emoji = {
        DriftExit.STABLE: ":white_check_mark:",
        DriftExit.DRIFT_DETECTED: ":warning:",
        DriftExit.CRITICAL_DRIFT: ":rotating_light:",
        DriftExit.CERT_INVALID: ":x:",
    }[result.exit_code]

    payload = {
        "text": (
            f"{emoji} Agent Audit drift check: *{result.status}*\n"
            f"agent: {result.details.get('agent_name')} | "
            f"score {result.current_score} (baseline {result.baseline_score}) | "
            f"critical: {result.new_critical} | "
            f"cert days left: {result.cert_days_remaining}"
        ),
    }
    body = _json.dumps(payload).encode("utf-8")

    try:
        import httpx
        response = httpx.post(url, content=body,
                              headers={"Content-Type": "application/json"}, timeout=10)
        log.info("webhook posted via httpx: %s", response.status_code)
        return
    except ImportError:
        pass  # httpx not available — fall back to urllib
    except Exception as exc:
        log.warning("webhook POST (httpx) failed: %s", exc)
        return

    # urllib fallback
    import urllib.request as _urllib
    req = _urllib.Request(url, data=body, headers={"Content-Type": "application/json"})
    try:
        with _urllib.urlopen(req, timeout=10) as resp:
            log.info("webhook posted via urllib: %s", resp.status)
    except Exception as exc:
        log.warning("webhook POST failed: %s", exc)


def main_cli(
    *, cert_path: str, target_path: str,
    variability_runs: int = 10, mock_tools: bool = False,
    webhook: str | None = None,
) -> int:
    """Synchronous entrypoint for the CLI."""
    result = asyncio.run(check_drift(
        cert_path=cert_path, target_path=target_path,
        variability_runs=variability_runs, mock_tools=mock_tools,
        webhook=webhook,
    ))
    print(json.dumps({
        "status": result.status,
        "exit_code": int(result.exit_code),
        "baseline_score": result.baseline_score,
        "current_score": result.current_score,
        "new_critical": result.new_critical,
        "cert_days_remaining": result.cert_days_remaining,
    }, indent=2))
    return int(result.exit_code)
