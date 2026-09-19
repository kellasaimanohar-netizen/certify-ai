"""Centralised logging setup — rich-formatted, colour-aware, phase-timing aware.

All modules do ``log = logging.getLogger(__name__)``. The CLI calls
``configure_logging()`` once at startup. Libraries never configure root logger.

Levels (set via --log-level or AGENT_AUDIT_LOG_LEVEL env var):
  DEBUG   — full HTTP payloads, adapter internals
  INFO    — phase start/end, check results (default)
  WARNING — retries, contested facts, suppression warnings
  ERROR   — phase crashes, cert failures

Format (stderr, human):
  14:32:01 INFO     security       :: SEC-INJ-DIRECT-001 complete (312ms)
  14:32:01 WARNING  phases         :: agent returned 503 on attempt 1 — retrying in 1s

In CI (no TTY) rich colour codes are stripped automatically.
"""
from __future__ import annotations

import logging
import os
import sys
import time
from typing import ClassVar

_CONFIGURED = False

# Colour codes — stripped automatically when stderr is not a TTY
_RESET  = "\033[0m"
_BOLD   = "\033[1m"
_DIM    = "\033[2m"
_RED    = "\033[91m"
_YELLOW = "\033[93m"
_GREEN  = "\033[92m"
_CYAN   = "\033[96m"
_BLUE   = "\033[94m"

_LEVEL_COLOURS = {
    "DEBUG":    _DIM,
    "INFO":     _CYAN,
    "WARNING":  _YELLOW,
    "ERROR":    _RED,
    "CRITICAL": _RED + _BOLD,
}

_use_colour = sys.stderr.isatty()


class _AuditFormatter(logging.Formatter):
    """Compact, colour-aware formatter with relative timing."""

    _start: ClassVar[float] = time.monotonic()

    def format(self, record: logging.LogRecord) -> str:
        elapsed = time.monotonic() - self._start
        mins, secs = divmod(int(elapsed), 60)
        ts = f"{mins:02d}:{secs:02d}"

        level = record.levelname
        # Abbreviate logger name: agent_audit.phases.phase3_security → security
        name = record.name.replace("agent_audit.", "").split(".")[-1]
        msg = record.getMessage()
        if record.exc_info:
            msg += "\n" + self.formatException(record.exc_info)

        if _use_colour:
            col = _LEVEL_COLOURS.get(level, "")
            return (
                f"{_DIM}{ts}{_RESET} "
                f"{col}{level:<7}{_RESET} "
                f"{_DIM}{name:<14}{_RESET} :: {msg}"
            )
        return f"{ts} {level:<7} {name:<14} :: {msg}"


def configure_logging(level: str | int | None = None) -> None:
    """Configure package-level logging. Idempotent — safe to call multiple times."""
    global _CONFIGURED
    if _CONFIGURED:
        return

    lvl = level or os.environ.get("AGENT_AUDIT_LOG_LEVEL", "INFO")
    if isinstance(lvl, str):
        lvl = getattr(logging, lvl.upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(_AuditFormatter())

    pkg_logger = logging.getLogger("agent_audit")
    pkg_logger.setLevel(lvl)
    pkg_logger.addHandler(handler)
    pkg_logger.propagate = False

    _CONFIGURED = True


def reset_for_testing() -> None:
    """Allow tests to re-configure logging. Not for production use."""
    global _CONFIGURED
    _CONFIGURED = False
    pkg_logger = logging.getLogger("agent_audit")
    pkg_logger.handlers.clear()
