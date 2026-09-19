"""Tests for the notifiers (Jira, Teams, generic webhook).

No real network: ``urllib.request.urlopen`` is monkeypatched to capture the
outbound request. We assert on what *would* be sent and on the gating logic
(only fire on the configured severity; never raise).
"""
from __future__ import annotations

import json

import pytest

from agent_audit import notifiers as N
from agent_audit.findings import Finding
from agent_audit.severity import Severity


def _finding(fid, sev, passed=False, title="t"):
    return Finding(id=fid, phase="monitor", test_name=fid, severity=sev,
                   passed=passed, title=title)


CRIT = [_finding("MON-HITL-001", Severity.CRITICAL, title="destructive w/o approval")]
WARN = [_finding("MON-COST-001", Severity.WARNING, title="cost overrun")]
PASS = [_finding("MON-TOKEN-000", Severity.PASS, passed=True)]


@pytest.fixture
def captured(monkeypatch):
    """Capture urlopen calls instead of hitting the network.

    These happy-path tests exercise payload *formatting* and gating, not the
    SSRF guard, so we set the dev-override to let placeholder URLs through.
    The SSRF guard itself is covered separately in the pen-test suite.
    """
    monkeypatch.setenv("AGENT_AUDIT_ALLOW_PRIVATE_FETCH", "1")
    calls = []

    class _Resp:
        def read(self): return b"{}"
        def __enter__(self): return self
        def __exit__(self, *a): return False

    def fake_urlopen(req, timeout=None):
        calls.append({
            "url": req.full_url,
            "headers": dict(req.headers),
            "body": json.loads(req.data.decode()) if req.data else None,
        })
        return _Resp()

    import agent_audit.netguard as netguard
    monkeypatch.setattr(netguard, "safe_urlopen", fake_urlopen)
    return calls


# ── generic webhook ──────────────────────────────────────────────────────────
def test_webhook_fires_on_failing(captured):
    sent = N.GenericWebhookNotifier("https://hook").notify(CRIT, agent_name="A", scope="run 1")
    assert sent is True
    assert len(captured) == 1
    assert "MON-HITL-001" in captured[0]["body"]["text"]


def test_webhook_only_critical_skips_warning(captured):
    n = N.GenericWebhookNotifier("https://hook", only_critical=True)
    assert n.notify(WARN, agent_name="A") is False
    assert captured == []


def test_webhook_silent_on_all_pass(captured):
    assert N.GenericWebhookNotifier("https://hook").notify(PASS, agent_name="A") is False
    assert captured == []


# ── Teams ────────────────────────────────────────────────────────────────────
def test_teams_posts_adaptive_card_on_critical(captured):
    sent = N.TeamsNotifier("https://teams").notify(CRIT, agent_name="A", scope="run 9")
    assert sent is True
    card = captured[0]["body"]
    assert card["attachments"][0]["contentType"].endswith("adaptive")
    facts = card["attachments"][0]["content"]["body"][2]["facts"]
    assert any(f["title"] == "MON-HITL-001" for f in facts)


def test_teams_default_ignores_warning_only(captured):
    assert N.TeamsNotifier("https://teams").notify(WARN, agent_name="A") is False
    assert captured == []


# ── Jira ─────────────────────────────────────────────────────────────────────
def test_jira_requires_full_config(monkeypatch):
    monkeypatch.delenv("JIRA_EMAIL", raising=False)
    with pytest.raises(ValueError):
        N.JiraNotifier({"base_url": "https://x.atlassian.net", "project_key": "SEC",
                        "email_env": "JIRA_EMAIL", "token_env": "JIRA_TOKEN"})


def test_jira_creates_issue_per_critical(captured, monkeypatch):
    monkeypatch.setenv("JIRA_EMAIL", "me@x.com")
    monkeypatch.setenv("JIRA_TOKEN", "tok")
    n = N.JiraNotifier({"base_url": "https://x.atlassian.net/", "project_key": "SEC",
                        "email_env": "JIRA_EMAIL", "token_env": "JIRA_TOKEN"})
    two = CRIT + [_finding("MON-PII-001", Severity.CRITICAL, title="pii leak")]
    sent = n.notify(two, agent_name="A", scope="run 5")
    assert sent is True
    assert len(captured) == 2  # one issue per critical
    assert captured[0]["url"].endswith("/rest/api/3/issue")
    assert captured[0]["headers"].get("Authorization", "").startswith("Basic ")
    assert captured[0]["body"]["fields"]["project"]["key"] == "SEC"


def test_jira_skips_when_no_critical(captured, monkeypatch):
    monkeypatch.setenv("JIRA_EMAIL", "me@x.com")
    monkeypatch.setenv("JIRA_TOKEN", "tok")
    n = N.JiraNotifier({"base_url": "https://x.atlassian.net", "project_key": "SEC",
                        "email_env": "JIRA_EMAIL", "token_env": "JIRA_TOKEN"})
    assert n.notify(WARN, agent_name="A") is False
    assert captured == []


# ── notification failures never raise ────────────────────────────────────────
def test_notifier_swallows_network_error(monkeypatch):
    monkeypatch.setenv("AGENT_AUDIT_ALLOW_PRIVATE_FETCH", "1")
    def boom(req, timeout=None):
        raise OSError("network down")
    import agent_audit.netguard as netguard
    monkeypatch.setattr(netguard, "safe_urlopen", boom)
    # Must return False, not raise.
    assert N.GenericWebhookNotifier("https://hook").notify(CRIT, agent_name="A") is False


# ── build_notifiers wiring ───────────────────────────────────────────────────
def test_build_notifiers_from_config(monkeypatch):
    monkeypatch.setenv("SLACK_URL", "https://slack")
    monkeypatch.setenv("TEAMS_URL", "https://teams")
    monkeypatch.setenv("JIRA_EMAIL", "me@x.com")
    monkeypatch.setenv("JIRA_TOKEN", "tok")
    cfg = {
        "webhook": {"url_env": "SLACK_URL"},
        "teams": {"url_env": "TEAMS_URL"},
        "jira": {"base_url": "https://x.atlassian.net", "project_key": "SEC",
                 "email_env": "JIRA_EMAIL", "token_env": "JIRA_TOKEN"},
    }
    built = N.build_notifiers(cfg)
    kinds = {n.name for n in built}
    assert kinds == {"webhook", "teams", "jira"}


def test_build_notifiers_empty_config():
    assert N.build_notifiers(None) == []
    assert N.build_notifiers({}) == []
