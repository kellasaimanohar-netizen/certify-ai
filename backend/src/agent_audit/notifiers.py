"""Notifiers — push critical findings to external systems.

The monitor and the certifier both produce ``Finding`` objects. A *notifier*
turns a batch of findings into an outbound message to one destination:

  * ``SlackNotifier`` / ``GenericWebhookNotifier`` — POST a JSON payload (the
    original ``--webhook`` behaviour, kept for back-compat).
  * ``TeamsNotifier``  — POST a Microsoft Teams Adaptive Card to an incoming
    webhook URL.
  * ``JiraNotifier``   — create a Jira issue per critical finding via the REST
    API (basic auth with an API token).

All notifiers:
  * fire only when there is at least one finding at or above their threshold
    (default: CRITICAL),
  * never raise — a notification failure logs a warning and is swallowed, so
    alerting can never crash an audit or a monitor sweep,
  * read secrets from the environment, never from inlined config.

Construct them from a config dict (e.g. the manifest's ``notifications`` block)
via ``build_notifiers``.
"""
from __future__ import annotations

import json
import logging
import os
import urllib.request
from collections.abc import Sequence

from agent_audit.findings import Finding
from agent_audit.severity import Severity

log = logging.getLogger(__name__)


def _criticals(findings: Sequence[Finding]) -> list[Finding]:
    return [f for f in findings if not f.passed and f.severity is Severity.CRITICAL]


def _failing(findings: Sequence[Finding]) -> list[Finding]:
    return [f for f in findings if not f.passed
            and f.severity in (Severity.CRITICAL, Severity.WARNING)]


class Notifier:
    """Base class. A notifier sends findings to one destination."""

    name = "base"

    def notify(self, findings: Sequence[Finding], *, agent_name: str,
               scope: str = "") -> bool:
        """Send a notification. Returns True if something was sent.

        Implementations must never raise — wrap I/O and swallow errors.
        """
        raise NotImplementedError


class GenericWebhookNotifier(Notifier):
    """POST a simple JSON ``{"text": ...}`` payload (Slack-compatible)."""

    name = "webhook"

    def __init__(self, url: str, *, only_critical: bool = False) -> None:
        self.url = url
        self.only_critical = only_critical

    def _selected(self, findings: Sequence[Finding]) -> list[Finding]:
        return _criticals(findings) if self.only_critical else _failing(findings)

    def notify(self, findings, *, agent_name, scope="") -> bool:
        selected = self._selected(findings)
        if not selected:
            return False
        crit = sum(1 for f in selected if f.severity is Severity.CRITICAL)
        warn = len(selected) - crit
        top = selected[0]
        emoji = ":rotating_light:" if crit else ":warning:"
        text = (f"{emoji} CertifyAI alert — *{agent_name}*"
                f"{(' (' + scope + ')') if scope else ''}\n"
                f"critical: {crit} | warnings: {warn}\n"
                f"top finding: {top.id} — {top.title}")
        return _post_json(self.url, {"text": text}, self.name)


class TeamsNotifier(Notifier):
    """POST a Microsoft Teams Adaptive Card to an incoming-webhook URL."""

    name = "teams"

    def __init__(self, url: str, *, only_critical: bool = True) -> None:
        self.url = url
        self.only_critical = only_critical

    def notify(self, findings, *, agent_name, scope="") -> bool:
        selected = _criticals(findings) if self.only_critical else _failing(findings)
        if not selected:
            return False
        crit = sum(1 for f in selected if f.severity is Severity.CRITICAL)
        facts = [{"title": f.id, "value": f.title} for f in selected[:8]]
        card = {
            "type": "message",
            "attachments": [{
                "contentType": "application/vnd.microsoft.card.adaptive",
                "content": {
                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                    "type": "AdaptiveCard",
                    "version": "1.4",
                    "body": [
                        {"type": "TextBlock", "size": "Large", "weight": "Bolder",
                         "color": "Attention" if crit else "Warning",
                         "text": f"CertifyAI alert — {agent_name}"},
                        {"type": "TextBlock", "isSubtle": True, "spacing": "None",
                         "text": f"{scope} · {crit} critical finding(s)".strip(" ·")},
                        {"type": "FactSet", "facts": facts},
                    ],
                },
            }],
        }
        return _post_json(self.url, card, self.name)


class JiraNotifier(Notifier):
    """Create one Jira issue per critical finding via the REST API v3.

    Auth: HTTP basic with ``email:api_token`` (token read from an env var).
    Config keys::

        base_url        https://your-org.atlassian.net
        project_key     e.g. "SEC"
        email_env       env var holding the Jira account email
        token_env       env var holding the Jira API token
        issue_type      default "Bug"
    """

    name = "jira"

    def __init__(self, config: dict) -> None:
        self.base_url = (config.get("base_url") or "").rstrip("/")
        self.project_key = config.get("project_key")
        self.issue_type = config.get("issue_type") or "Bug"
        email = os.environ.get(config.get("email_env", ""))
        token = os.environ.get(config.get("token_env", ""))
        if not (self.base_url and self.project_key and email and token):
            raise ValueError(
                "jira notifier needs base_url, project_key, email_env, token_env "
                "(and the named env vars must be set)"
            )
        import base64
        self._auth = base64.b64encode(f"{email}:{token}".encode()).decode()

    def notify(self, findings, *, agent_name, scope="") -> bool:
        crit = _criticals(findings)
        if not crit:
            return False
        created = 0
        for f in crit:
            issue = {
                "fields": {
                    "project": {"key": self.project_key},
                    "issuetype": {"name": self.issue_type},
                    "summary": f"[CertifyAI] {f.id}: {f.title}"[:250],
                    "description": _jira_adf(
                        f"Agent: {agent_name}\n"
                        f"Scope: {scope or 'n/a'}\n"
                        f"Finding: {f.id} ({f.severity.value})\n"
                        f"{f.title}\n\n"
                        f"Standards: " + ", ".join(
                            f"{s.framework}:{s.identifier}" for s in f.standards)
                    ),
                }
            }
            if _post_json(
                f"{self.base_url}/rest/api/3/issue", issue, self.name,
                extra_headers={"Authorization": f"Basic {self._auth}"},
            ):
                created += 1
        log.info("jira: created %d issue(s) for critical findings", created)
        return created > 0


def _jira_adf(text: str) -> dict:
    """Wrap plain text in Atlassian Document Format (required by REST v3)."""
    return {
        "type": "doc", "version": 1,
        "content": [{"type": "paragraph",
                     "content": [{"type": "text", "text": text}]}],
    }


def _post_json(url: str, payload: dict, who: str,
               *, extra_headers: dict | None = None) -> bool:
    """POST JSON. Never raises — logs and returns False on failure.

    The URL is SSRF-guarded first: a notification target that resolves to
    loopback/private/metadata addresses is refused, so a malicious manifest
    cannot turn an alert into a credential-exfiltration request.
    """
    from agent_audit.netguard import BlockedURLError, safe_urlopen
    try:
        body = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if extra_headers:
            headers.update(extra_headers)
        req = urllib.request.Request(url, data=body, headers=headers)
        # safe_urlopen validates the URL and re-validates any redirect target,
        # so an alert can't be turned into an SSRF/credential-exfil request even
        # via a 302 from a hostile endpoint.
        safe_urlopen(req, timeout=10)
        return True
    except BlockedURLError as exc:
        log.warning("%s notification blocked (unsafe url): %s", who, exc)
        return False
    except Exception as exc:  # alerting must never crash the caller
        log.warning("%s notification failed: %s", who, exc)
        return False


def build_notifiers(config: dict | None) -> list[Notifier]:
    """Build the configured notifiers from a ``notifications`` config block.

    Example config::

        notifications:
          webhook: { url_env: SLACK_URL }
          teams:   { url_env: TEAMS_URL }
          jira:    { base_url: ..., project_key: SEC,
                     email_env: JIRA_EMAIL, token_env: JIRA_TOKEN }

    Unconfigured channels are skipped. A channel that fails to construct
    (e.g. missing env var) is logged and skipped, never fatal.
    """
    notifiers: list[Notifier] = []
    if not config:
        return notifiers

    wh = config.get("webhook")
    if wh:
        url = os.environ.get(wh.get("url_env", "")) if isinstance(wh, dict) else wh
        if url:
            notifiers.append(GenericWebhookNotifier(
                url, only_critical=bool(isinstance(wh, dict) and wh.get("only_critical"))))

    tm = config.get("teams")
    if tm:
        url = os.environ.get(tm.get("url_env", "")) if isinstance(tm, dict) else tm
        if url:
            notifiers.append(TeamsNotifier(url))

    jira = config.get("jira")
    if jira:
        try:
            notifiers.append(JiraNotifier(jira))
        except ValueError as exc:
            log.warning("jira notifier not configured: %s", exc)

    return notifiers
