"""MonitorEngine — runs the monitor checks over production runs.

Supports BOTH deployment shapes from one engine:

  * **Batch**   — ``evaluate_batch(runs)`` pulls a list (e.g. the last hour's
                  runs from a telemetry source) and returns all findings.
  * **Stream**  — ``evaluate_run(run)`` processes a single run as it completes;
                  the engine keeps a bounded rolling window internally so
                  window-based checks (token outlier, window spend, outcome
                  drift) work incrementally without re-reading history.

Findings reuse the certifier's ``Finding`` type, so they flow through the
existing JSON/SARIF exporters and the dashboard with no new plumbing. Alerts
fire on any non-passing finding via an optional webhook.
"""
from __future__ import annotations

import collections
import datetime as dt
import logging
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field

from agent_audit.findings import Finding
from agent_audit.monitor.baseline import MonitorBaseline
from agent_audit.monitor.checks import PER_RUN_CHECKS, check_outcome_drift, check_token_overrun
from agent_audit.monitor.run_record import RunRecord
from agent_audit.severity import Severity

log = logging.getLogger(__name__)


@dataclass(slots=True)
class MonitorResult:
    """Outcome of evaluating one run or a batch."""

    findings: list[Finding] = field(default_factory=list)
    runs_evaluated: int = 0
    generated_at: str = field(
        default_factory=lambda: dt.datetime.now(dt.timezone.utc)
        .isoformat(timespec="seconds").replace("+00:00", "Z")
    )

    @property
    def critical(self) -> list[Finding]:
        return [f for f in self.findings
                if not f.passed and f.severity is Severity.CRITICAL]

    @property
    def warnings(self) -> list[Finding]:
        return [f for f in self.findings
                if not f.passed and f.severity is Severity.WARNING]

    @property
    def alerting(self) -> list[Finding]:
        """All non-passing findings — the ones worth alerting on."""
        return [f for f in self.findings if not f.passed]

    @property
    def healthy(self) -> bool:
        return not self.alerting

    def summary(self) -> dict:
        return {
            "generated_at": self.generated_at,
            "runs_evaluated": self.runs_evaluated,
            "total_findings": len(self.findings),
            "critical": len(self.critical),
            "warnings": len(self.warnings),
            "alerting": len(self.alerting),
            "healthy": self.healthy,
        }


class MonitorEngine:
    """Stateful monitor. One instance per agent (keeps that agent's window)."""

    def __init__(
        self,
        baseline: MonitorBaseline,
        *,
        webhook: str | None = None,
        notifiers: "list | None" = None,
    ) -> None:
        self.baseline = baseline
        self.webhook = webhook
        self.notifiers = notifiers or []
        self._window: collections.deque[RunRecord] = collections.deque(
            maxlen=baseline.window_size
        )

    # ── Stream mode ─────────────────────────────────────────────────────────
    def evaluate_run(self, run: RunRecord, *, alert: bool = True) -> MonitorResult:
        """Evaluate one run against the baseline + current rolling window."""
        # Snapshot the window *before* adding this run, so per-run window checks
        # compare against history, not against itself.
        window_snapshot = list(self._window)
        self._window.append(run)

        findings: list[Finding] = []
        for check in PER_RUN_CHECKS:
            try:
                if check is check_token_overrun:
                    findings.extend(check(run, baseline=self.baseline, window=window_snapshot))
                else:
                    findings.extend(check(run, baseline=self.baseline))
            except Exception as exc:  # a check bug must not stop monitoring
                log.warning("monitor check %s raised on run %s: %s",
                            getattr(check, "__name__", check), run.run_id, exc)

        # Window-level outcome drift (uses the full current window incl. this run)
        try:
            findings.extend(check_outcome_drift(list(self._window), baseline=self.baseline))
        except Exception as exc:
            log.warning("outcome drift check raised: %s", exc)

        result = MonitorResult(findings=findings, runs_evaluated=1)
        if alert and (self.webhook or self.notifiers) and result.alerting:
            self._post_alert(result, run=run)
        return result

    # ── Batch mode ──────────────────────────────────────────────────────────
    def evaluate_batch(
        self, runs: Iterable[RunRecord], *, alert: bool = True,
    ) -> MonitorResult:
        """Evaluate a batch of runs in chronological order. Window builds as we go."""
        ordered = sorted(runs, key=lambda r: r.finished_at or r.started_at or "")
        all_findings: list[Finding] = []
        n = 0
        for run in ordered:
            res = self.evaluate_run(run, alert=False)  # alert once at the end
            all_findings.extend(res.findings)
            n += 1

        result = MonitorResult(findings=all_findings, runs_evaluated=n)
        if alert and (self.webhook or self.notifiers) and result.alerting:
            self._post_alert(result)
        return result

    # ── Alerting ────────────────────────────────────────────────────────────
    def _post_alert(self, result: MonitorResult, *, run: RunRecord | None = None) -> None:
        """POST a Slack/Teams/generic-compatible alert for non-passing findings,
        then fan out to any configured notifiers (Teams card, Jira issues)."""
        scope = f"run {run.run_id}" if run else f"{result.runs_evaluated} runs"
        # Structured notifiers (Teams, Jira, extra webhooks) fire on their own
        # severity gating; failures are swallowed inside each notifier.
        for notifier in self.notifiers:
            notifier.notify(result.findings, agent_name=self.baseline.agent_name,
                            scope=scope)
        if not self.webhook:
            return
        import json as _json
        import urllib.request

        crit = len(result.critical)
        warn = len(result.warnings)
        emoji = ":rotating_light:" if crit else ":warning:"
        top = result.alerting[0]
        payload = {
            "text": (
                f"{emoji} CertifyAI runtime alert — *{self.baseline.agent_name}* ({scope})\n"
                f"critical: {crit} | warnings: {warn}\n"
                f"top finding: {top.id} — {top.title}"
            )
        }
        try:
            body = _json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                self.webhook, data=body,  # type: ignore[arg-type]
                headers={"Content-Type": "application/json"},
            )
            urllib.request.urlopen(req, timeout=10)
            log.info("monitor alert posted (%d critical, %d warning)", crit, warn)
        except Exception as exc:  # alerting failure must not crash monitoring
            log.warning("failed to post monitor webhook: %s", exc)

    # ── Introspection ───────────────────────────────────────────────────────
    @property
    def window(self) -> Sequence[RunRecord]:
        return list(self._window)
