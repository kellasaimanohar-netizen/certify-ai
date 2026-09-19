"""Terminal reporter — rich rendering of findings, timings and summary.

Used by the CLI for the human-readable audit run output. All colour is
handled via rich markup; colour codes are stripped automatically in CI
(no TTY) so logs stay readable.
"""
from __future__ import annotations

from rich.console import Console
from rich.table import Table

from agent_audit.findings import Finding
from agent_audit.runner import AuditReport
from agent_audit.severity import Severity

console = Console(stderr=False)   # stdout so it can be piped separately from logs


def print_header(agent_name: str, mode: str, variability_runs: int, audit_id: str = "") -> None:
    console.print()
    id_suffix = f"  [dim](audit {audit_id})[/dim]" if audit_id else ""
    console.rule(f"[bold]Agent Audit V7 — {agent_name}[/bold]{id_suffix}")

    if mode == "validate":
        console.print("  [dim]Mode: FRAMEWORK VALIDATION  (mock tools — not a real cert)[/dim]")
    else:
        console.print("  [bold yellow]Mode: AGENT CERTIFICATION[/bold yellow]")

    if variability_runs < 10:
        console.print(
            f"  [dim]Variability runs: {variability_runs} "
            f"(use --variability-runs 10 for production, 50 for ROBUST verdict)[/dim]"
        )
    console.print()


def print_phase_header(name: str, duration_ms: float | None = None) -> None:
    dur = f"  [dim]{duration_ms:.0f}ms[/dim]" if duration_ms else ""
    console.print(f"\n  [bold dim]{name}[/bold dim]{dur}")


def print_finding(f: Finding) -> None:
    dur = f" [dim]({f.duration_ms:.0f}ms)[/dim]" if f.duration_ms else ""
    var = ""
    if f.variability:
        v = f.variability
        var = f" [dim][{v.passes}/{v.runs} runs  CI {v.ci_lower:.2f}–{v.ci_upper:.2f}][/dim]"

    if f.suppressed:
        console.print(f"    [dim]◌  {f.title} — suppressed[/dim]{dur}")
        return
    if f.passed:
        console.print(f"    [green]✓[/green]  [green]{f.title}[/green]{dur}{var}")
        return
    if f.severity is Severity.CRITICAL:
        console.print(f"    [bold red]✗[/bold red]  [red]{f.id}  {f.title}[/red]{dur}{var}")
        if f.remediation:
            console.print(f"       [dim]→ {f.remediation[:140]}[/dim]")
    elif f.severity is Severity.HIGH_UNCERTAINTY:
        console.print(f"    [yellow]⚠[/yellow]  [yellow]{f.id}  {f.title}[/yellow]{dur}{var}")
        console.print(f"       [dim]→ Increase --variability-runs for a definitive verdict[/dim]")
    else:
        console.print(f"    [yellow]⚠[/yellow]  [yellow]{f.id}  {f.title}[/yellow]{dur}{var}")
        if f.remediation:
            console.print(f"       [dim]→ {f.remediation[:140]}[/dim]")


def print_summary(report: AuditReport) -> None:
    console.print()
    console.rule()

    # Verdict
    if report.enterprise_ready:
        console.print(f"  [bold green]ENTERPRISE READY[/bold green]   score {report.trust_score}/100")
    else:
        console.print(f"  [bold red]NOT ENTERPRISE READY[/bold red]   score {report.trust_score}/100")

    total = len(report.findings)
    passed = len(report.passes)
    elapsed = f"{report.total_duration_ms / 1000:.1f}s" if report.total_duration_ms else ""
    console.print(
        f"  Critical: [red]{len(report.critical_failures)}[/red]   "
        f"Warnings: [yellow]{len(report.warnings)}[/yellow]   "
        f"Passed: [green]{passed}/{total}[/green]   "
        f"Suppressed: [dim]{len(report.suppressed)}[/dim]"
        + (f"   Elapsed: [dim]{elapsed}[/dim]" if elapsed else "")
    )

    # Critical failures detail
    if report.critical_failures:
        console.print()
        console.print("  [bold red]Critical failures:[/bold red]")
        for f in report.critical_failures:
            console.print(f"    [red]✗  {f.id}[/red]  {f.title}")
            if f.remediation:
                console.print(f"       [dim]→ {f.remediation[:140]}[/dim]")

    # High-uncertainty — prompt to increase runs
    hi_unc = [f for f in report.findings
              if f.severity is Severity.HIGH_UNCERTAINTY and not f.passed and not f.suppressed]
    if hi_unc:
        console.print()
        console.print(
            "  [bold yellow]High-uncertainty checks[/bold yellow] "
            "[dim](re-run with --variability-runs 20+):[/dim]"
        )
        for f in hi_unc:
            console.print(f"    [yellow]⚠  {f.id}[/yellow]  {f.title}")

    # HITL reminder
    if report.manifest_summary.get("capabilities", {}).get("requires_hitl"):
        console.print()
        console.print(
            "  [dim]HITL declared — ensure human-in-the-loop review is active "
            "for all destructive tool calls before production deployment.[/dim]"
        )

    # Standards coverage table
    if report.findings:
        _print_standards_coverage(report)

    console.rule()
    console.print()


def _print_standards_coverage(report: AuditReport) -> None:
    coverage: dict[str, dict[str, int]] = {}
    for f in report.findings:
        for s in f.standards:
            fw = coverage.setdefault(s.framework, {"pass": 0, "fail": 0})
            fw["pass" if f.passed else "fail"] += 1
    if not coverage:
        return
    console.print()
    console.print("  [dim]Standards coverage:[/dim]")
    table = Table(show_header=True, header_style="dim", box=None, pad_edge=False, padding=(0, 2))
    table.add_column("framework", style="dim")
    table.add_column("passed", justify="right", style="green")
    table.add_column("failed", justify="right", style="red")
    for framework, counts in sorted(coverage.items()):
        table.add_row(framework, str(counts["pass"]), str(counts["fail"]))
    console.print(table)
