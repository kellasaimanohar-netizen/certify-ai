"""Report exporters — JSON, SARIF 2.1.0, HTML dashboard.

Quick usage:
    from agent_audit.exporters import export_all
    export_all(report, prefix="out/my_agent")
    # writes: out/my_agent.json, out/my_agent.sarif, out/my_agent.html
"""
from __future__ import annotations

from pathlib import Path

from agent_audit.exporters.html_exporter import export_html
from agent_audit.exporters.json_exporter import export_json
from agent_audit.exporters.sarif_exporter import export_sarif
from agent_audit.runner import AuditReport

__all__ = ["export_all", "export_html", "export_json", "export_sarif"]


def export_all(report: AuditReport, prefix: str | Path) -> dict[str, Path]:
    """Write JSON, SARIF and HTML reports with a shared path prefix.

    Args:
        report:  The completed AuditReport.
        prefix:  Path prefix — extensions are appended automatically.
                 Example: ``"out/my_agent"``  →  ``out/my_agent.json``, etc.

    Returns:
        Dict mapping format name → written Path.
    """
    p = Path(prefix).expanduser()
    return {
        "json":  export_json(report,  p.with_suffix(".json")),
        "sarif": export_sarif(report, p.with_suffix(".sarif")),
        "html":  export_html(report,  p.with_suffix(".html")),
    }
