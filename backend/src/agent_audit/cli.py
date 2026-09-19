#!/usr/bin/env python3
"""agent-audit CLI v10 — multi-source, standards-mapped certification.

Commands:
    run      — audit an agent target
    verify   — verify a certificate offline
    drift    — check for regression against a baseline cert
    inspect  — show what sources contribute to the manifest
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

VALID_PHASES = [
    "architecture", "reliability", "security", "observability",
    "ops", "adversarial", "supply_chain",
    # v5 phases
    "data_governance", "groundedness", "fairness", "multi_turn", "mcp",
    # v7 phases
    "voice", "data_analysis", "decision", "security_agent", "browser",
    "all",
]


def main(argv: list[str] | None = None) -> None:
    # Reconfigure stdout/stderr to UTF-8 to prevent UnicodeEncodeError on Windows
    import sys
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    if hasattr(sys.stderr, "reconfigure"):
        try:
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass

    parser = argparse.ArgumentParser(
        prog="agent-audit",
        description="AI Agent pre-deployment certification v10.3",
    )
    parser.add_argument(
        "--log-level", default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
    )
    sub = parser.add_subparsers(dest="command")

    # ── run ──────────────────────────────────────────────────────────
    run_p = sub.add_parser("run", help="Run audit against an agent target")
    run_p.add_argument("--target", help="Path to target YAML")
    run_p.add_argument("--repo", help="Path to target repository folder to scan")
    run_p.add_argument("--openapi", help="URL or path to target OpenAPI specification")
    run_p.add_argument("--phase", default="all", choices=VALID_PHASES)
    run_p.add_argument(
        "--mode", default="validate", choices=["validate", "certify"],
        help="validate=mock framework check, certify=real agent audit",
    )
    run_p.add_argument("--critical-only", action="store_true")
    run_p.add_argument("--fail-on", choices=["critical", "any"], default=None)
    run_p.add_argument("--output", default=None, help="JSON report path")
    run_p.add_argument("--sarif", default=None, help="SARIF 2.1.0 report path")
    run_p.add_argument("--html", default=None, help="HTML dashboard path")
    run_p.add_argument("--cert-output", default=None, help="Certificate JSON path")
    run_p.add_argument("--mock-tools", action="store_true")
    run_p.add_argument(
        "--target-env", default=None, choices=["sandbox", "staging", "production"],
        help="Declared environment of the live endpoint. Destructive/adversarial "
             "phases only run against a sandbox (or staging with --allow-destructive).",
    )
    run_p.add_argument(
        "--allow-destructive", action="store_true",
        help="Permit destructive phases against a STAGING endpoint (never production).",
    )
    run_p.add_argument(
        "--max-calls", type=int, default=5_000,
        help="Hard cap on total live agent calls for the audit (default 5000).",
    )
    run_p.add_argument(
        "--max-cost-usd", type=float, default=25.0,
        help="Hard cap on total live agent spend in USD for the audit (default 25.0).",
    )
    run_p.add_argument("--inject-latency", type=int, default=0, metavar="MS")
    run_p.add_argument("--concurrency", type=int, default=4)
    run_p.add_argument(
        "--variability-runs", type=int, default=5,
        help="Runs per probabilistic test (5 default, 10+ production, 50+ ROBUST)",
    )
    run_p.add_argument(
        "--checkers-dir", default=None,
        help="Directory containing custom checker YAML files",
    )
    run_p.add_argument(
        "--suppressions", default=None,
        help="Path to .audit-suppressions.yaml",
    )

    # ── verify ──────────────────────────────────────────────────────
    verify_p = sub.add_parser("verify", help="Verify certificate integrity")
    verify_p.add_argument("--cert", required=True, help="Certificate JSON path")
    verify_p.add_argument(
        "--trusted-fingerprint", action="append", default=None, metavar="FP",
        help="Pin the issuer key by fingerprint (32 hex chars). Repeatable. "
             "Without a pin, verification checks integrity only and cannot detect "
             "a forgery signed with an attacker's own key.",
    )
    verify_p.add_argument(
        "--trusted-key", action="append", default=None, metavar="B64",
        help="Pin the issuer key by base64 raw Ed25519 public key. Repeatable.",
    )

    # ── drift ───────────────────────────────────────────────────────
    drift_p = sub.add_parser("drift", help="Compare current state to certificate baseline")
    drift_p.add_argument("--cert", required=True)
    drift_p.add_argument("--target", help="Path to target YAML")
    drift_p.add_argument("--repo", help="Path to target repository folder to scan")
    drift_p.add_argument("--openapi", help="URL or path to target OpenAPI specification")
    drift_p.add_argument("--variability-runs", type=int, default=10)
    drift_p.add_argument("--mock-tools", action="store_true")
    drift_p.add_argument("--webhook", default=None, help="Slack / generic webhook URL")

    # ── inspect ─────────────────────────────────────────────────────
    inspect_p = sub.add_parser("inspect", help="Show resolved manifest from all sources")
    inspect_p.add_argument("--target", help="Path to target YAML")
    inspect_p.add_argument("--repo", help="Path to target repository folder to scan")
    inspect_p.add_argument("--openapi", help="URL or path to target OpenAPI specification")

    # ── monitor ─────────────────────────────────────────────────────
    monitor_p = sub.add_parser(
        "monitor", help="Runtime monitor: evaluate production agent runs against a baseline")
    monitor_p.add_argument("--target", required=True, help="Target YAML (defines the baseline)")
    monitor_p.add_argument(
        "--source", required=True,
        choices=["agentforce", "uipath", "automation_anywhere", "foundry", "mock"],
        help="Telemetry source to pull runs from")
    monitor_p.add_argument("--since", default=None, help="ISO timestamp: only runs after this")
    monitor_p.add_argument("--limit", type=int, default=100, help="Max runs to pull")
    monitor_p.add_argument("--cert", default=None, help="Certificate to derive the baseline from")
    monitor_p.add_argument("--webhook", default=None, help="Slack / generic webhook for alerts")
    monitor_p.add_argument("--output", default=None, help="Write findings JSON to this path")
    monitor_p.add_argument("--sarif", default=None, help="Write findings SARIF to this path")
    monitor_p.add_argument(
        "--mock-runs", default=None,
        help="Path to a JSON file of RunRecord dicts (for --source mock)")

    args = parser.parse_args(argv)

    if args.command in ("run", "drift", "inspect"):
        provided = sum(1 for x in (args.target, args.repo, args.openapi) if x is not None)
        if provided == 0:
            parser.error("Must specify one of --target, --repo, or --openapi")
        elif provided > 1:
            parser.error("Cannot specify more than one of --target, --repo, or --openapi")

    # Logging
    from agent_audit.logging_setup import configure_logging
    configure_logging(args.log_level)

    if args.command == "run":
        _cmd_run(args)
    elif args.command == "verify":
        _cmd_verify(args)
    elif args.command == "drift":
        _cmd_drift(args)
    elif args.command == "inspect":
        _cmd_inspect(args)
    elif args.command == "monitor":
        _cmd_monitor(args)
    else:
        parser.print_help()
        sys.exit(0)


# ─── target resolution helper ───────────────────────────────────────────
def _resolve_target(args: argparse.Namespace) -> tuple[str, str | None]:
    """Resolves target from target YAML, repo, or OpenAPI, returning (target_path, temp_file_path)."""
    import tempfile
    import yaml
    import uuid
    from pathlib import Path
    import os

    target = getattr(args, "target", None)
    repo = getattr(args, "repo", None)
    openapi = getattr(args, "openapi", None)

    if target:
        return str(target), None

    if repo:
        repo_path = str(Path(repo).resolve())
        yaml_content = {
            "agent_name": f"Repo_{Path(repo_path).name or 'scan'}",
            "sources": [
                {"type": "repo", "path": repo_path}
            ]
        }
        fd, temp_path = tempfile.mkstemp(suffix=".yaml", prefix="agent_audit_")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            yaml.dump(yaml_content, f)
        return temp_path, temp_path

    if openapi:
        yaml_content = {
            "agent_name": f"OpenAPI_{uuid.uuid4().hex[:4]}",
            "sources": [
                {"type": "openapi", "path": openapi}
            ]
        }
        fd, temp_path = tempfile.mkstemp(suffix=".yaml", prefix="agent_audit_")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            yaml.dump(yaml_content, f)
        return temp_path, temp_path

    raise ValueError("Target could not be resolved")


# ─── run command ────────────────────────────────────────────────────────
def _cmd_run(args: argparse.Namespace) -> None:
    from rich.console import Console
    console = Console()

    target_path, temp_path = _resolve_target(args)
    try:
        # Auto-enable mock-tools in validate mode
        if args.mode == "validate" and not args.mock_tools:
            args.mock_tools = True
            console.print("[dim]--mode validate: auto-enabling --mock-tools[/dim]")

        if args.mode == "certify" and args.mock_tools:
            console.print(
                "[yellow]Warning: --mode certify with --mock-tools — "
                "certificate will be FRAMEWORK_VALIDATION_ONLY[/yellow]"
            )

        # v8: live certify against an undeclared environment is risky — warn loudly.
        if args.mode == "certify" and not args.mock_tools and not args.target_env:
            console.print(
                "[yellow]Warning: live certify without --target-env. Destructive phases "
                "will be BLOCKED (fail-closed). Pass --target-env sandbox to run them.[/yellow]"
            )

        # Load target
        from agent_audit.sources import load_target
        try:
            manifest = load_target(target_path)
        except Exception as exc:
            console.print(f"[bold red]Error loading target:[/bold red] {exc}")
            sys.exit(1)

        # Phases
        from agent_audit.phases import PHASE_MAP
        if args.phase == "all":
            phases = list(PHASE_MAP.keys())
        else:
            phases = [args.phase]

        # Custom checkers
        from agent_audit.checkers import load_checkers
        checkers_dir = Path(args.checkers_dir) if args.checkers_dir else None
        # Also scan custom_checkers from target YAML if present
        # (load_target doesn't store these — re-read YAML for them)
        import yaml
        target_raw = yaml.safe_load(Path(target_path).read_text(encoding="utf-8")) if Path(target_path).is_file() else None
        config_checkers = target_raw.get("custom_checkers", []) if target_raw else []
        checker_registry = load_checkers(
            from_config=config_checkers or None,
            from_dir=checkers_dir,
        )

        # Suppressions
        from agent_audit.suppressions import load_suppressions
        sup_path = args.suppressions
        if sup_path is None:
            # Default to .audit-suppressions.yaml next to target
            default_sup = Path(target_path).parent / ".audit-suppressions.yaml"
            if default_sup.is_file():
                sup_path = str(default_sup)
        suppressions = load_suppressions(sup_path)

        # Reporter header
        from agent_audit.reporter import (
            print_header, print_phase_header, print_finding, print_summary,
        )
        from agent_audit.phases import PHASE_LABELS
        print_header(manifest.agent_name, args.mode, args.variability_runs, audit_id="")

        # Run
        from agent_audit.runner import run_audit
        report = asyncio.run(run_audit(
            manifest,
            phases=phases,
            mode=args.mode,
            mock_tools=args.mock_tools,
            variability_runs=args.variability_runs,
            concurrency=args.concurrency,
            inject_latency_ms=args.inject_latency,
            checker_registry=checker_registry,
            suppressions=suppressions,
            target_env=args.target_env,
            allow_destructive=args.allow_destructive,
            max_calls=args.max_calls,
            max_cost_usd=args.max_cost_usd,
        ))

        # Print findings grouped by phase (canonical order)
        current_phase = None
        for f in report.sorted_findings():
            if f.phase != current_phase:
                current_phase = f.phase
                label = PHASE_LABELS.get(current_phase, current_phase)
                print_phase_header(label)
            if args.critical_only and f.passed:
                continue
            print_finding(f)
        print_summary(report)

        # Exports
        if args.output:
            from agent_audit.exporters import export_json
            export_json(report, args.output)
            console.print(f"  JSON  → [bold]{args.output}[/bold]")
        if args.sarif:
            from agent_audit.exporters import export_sarif
            export_sarif(report, args.sarif)
            console.print(f"  SARIF → [bold]{args.sarif}[/bold]")
        if args.html:
            from agent_audit.exporters import export_html
            export_html(report, args.html)
            console.print(f"  HTML  → [bold]{args.html}[/bold]")

        # Certificate
        if args.cert_output:
            from agent_audit.certificate import issue_certificate
            fv_only = args.mock_tools and args.mode == "certify"
            cert = issue_certificate(
                report,
                framework_validation_only=fv_only,
                suppressions_embedded=[s.to_dict() for s in suppressions.active_entries()],
            )
            cert.save(args.cert_output)
            tier_color = "green" if cert.tier == "CERTIFIED" else "yellow"
            console.print()
            console.print(f"  Certificate: [{tier_color}]{cert.tier}[/{tier_color}]")
            console.print(f"  Grade:       {cert.grade}")
            console.print(f"  Score:       {cert.trust_score}/100")
            console.print(f"  Expires:     {cert.expires_at[:10]} ({cert.days_remaining} days)")
            console.print(f"  Saved  →     [bold]{args.cert_output}[/bold]")
            console.print()

        # Exit code
        if args.fail_on == "critical" and report.critical_failures:
            sys.exit(1)
        elif args.fail_on == "any" and (report.critical_failures or report.warnings):
            sys.exit(1)
        sys.exit(0)
    finally:
        if temp_path:
            try:
                Path(temp_path).unlink()
            except Exception:
                pass


# ─── verify command ─────────────────────────────────────────────────────
def _cmd_verify(args: argparse.Namespace) -> None:
    from rich.console import Console
    console = Console()
    try:
        from agent_audit.certificate import load_and_verify
        trusted_fps = list(args.trusted_fingerprint or [])
        trusted_keys = list(args.trusted_key or [])
        pinned = bool(trusted_fps or trusted_keys)
        cert = load_and_verify(
            args.cert,
            trusted_keys=trusted_keys or None,
            trusted_fingerprints=trusted_fps or None,
            allow_untrusted=not pinned,
        )
        console.print()
        console.print("  [bold green]✓ CERTIFICATE VALID[/bold green]")
        console.print(f"  Agent:    {cert.agent_name}")
        console.print(f"  Tier:     [bold]{cert.tier}[/bold]")
        console.print(f"  Score:    {cert.trust_score}/100")
        console.print(f"  Expires:  {cert.expires_at[:10]} ({cert.days_remaining} days remaining)")
        console.print(f"  Hash:     {cert.content_hash[:32]}…")
        console.print(f"  Key fp:   {cert.key_fingerprint or '(legacy cert, no fingerprint)'}")
        if pinned:
            console.print("  Trust:    [green]issuer key pinned and matched[/green]")
        else:
            console.print(
                "  Trust:    [yellow]UNPINNED — signature + integrity only. Anyone can "
                "forge a cert with their own key. Pass --trusted-fingerprint to pin.[/yellow]"
            )
        console.print()
    except Exception as exc:
        console.print("\n  [bold red]✗ CERTIFICATE INVALID[/bold red]")
        console.print(f"  {exc}")
        sys.exit(1)


# ─── drift command ──────────────────────────────────────────────────────
def _cmd_drift(args: argparse.Namespace) -> None:
    from agent_audit.drift_monitor import main_cli
    target_path, temp_path = _resolve_target(args)
    try:
        code = main_cli(
            cert_path=args.cert,
            target_path=target_path,
            variability_runs=args.variability_runs,
            mock_tools=args.mock_tools,
            webhook=args.webhook,
        )
        sys.exit(code)
    finally:
        if temp_path:
            try:
                Path(temp_path).unlink()
            except Exception:
                pass


# ─── inspect command ────────────────────────────────────────────────────
def _cmd_inspect(args: argparse.Namespace) -> None:
    from rich.console import Console
    from rich.syntax import Syntax
    console = Console()
    target_path, temp_path = _resolve_target(args)
    try:
        from agent_audit.sources import load_target
        try:
            manifest = load_target(target_path)
        except Exception as exc:
            console.print(f"[red]Error: {exc}[/red]")
            sys.exit(1)
        as_json = json.dumps(manifest.to_dict(), indent=2)
        console.print(Syntax(as_json, "json", theme="monokai"))
        if manifest.contested_facts:
            console.print()
            console.print("[yellow]Contested facts (sources disagree):[/yellow]")
            for field_path, facts in manifest.contested_facts.items():
                console.print(f"  {field_path}:")
                for fact in facts:
                    console.print(f"    {fact.provenance.source} → {fact.value}")
    finally:
        if temp_path:
            try:
                Path(temp_path).unlink()
            except Exception:
                pass


# ─── monitor command ────────────────────────────────────────────────────
def _cmd_monitor(args: argparse.Namespace) -> None:
    """Runtime monitor: pull production runs and evaluate them against a baseline."""
    import json as _json

    from rich.console import Console

    from agent_audit.monitor import MonitorBaseline, MonitorEngine
    from agent_audit.sources import load_target

    console = Console()

    # 1) Baseline from the target manifest (+ optional certificate)
    try:
        manifest = load_target(args.target)
    except Exception as exc:
        console.print(f"[red]Error loading target: {exc}[/red]")
        sys.exit(1)

    cert = None
    if args.cert:
        try:
            import os

            from agent_audit.certificate import load_and_verify
            pinned = [s.strip() for s in
                      os.environ.get("AGENT_AUDIT_TRUSTED_FP", "").split(",") if s.strip()]
            if pinned:
                cert = load_and_verify(args.cert, trusted_fingerprints=set(pinned))
            else:
                console.print("[yellow]Warning: certificate loaded without a trust anchor "
                              "(set AGENT_AUDIT_TRUSTED_FP to pin the issuer). A forged "
                              "certificate could otherwise set the monitor baseline.[/yellow]")
                cert = load_and_verify(args.cert, allow_untrusted=True)
        except Exception as exc:
            console.print(f"[yellow]Could not load certificate ({exc}); using manifest only.[/yellow]")

    baseline = MonitorBaseline.from_manifest(manifest, certificate=cert)

    # 2) Telemetry source
    try:
        source = _build_monitor_source(args, manifest)
    except Exception as exc:
        console.print(f"[red]Error building source: {exc}[/red]")
        sys.exit(1)

    # 3) Pull runs + evaluate (batch)
    try:
        runs = source.fetch_runs(since=args.since, limit=args.limit)
    except Exception as exc:
        console.print(f"[red]Error fetching runs: {exc}[/red]")
        sys.exit(1)

    from agent_audit.notifiers import build_notifiers
    notif_cfg = getattr(manifest, "notifications", None)
    notifiers = build_notifiers(notif_cfg)
    engine = MonitorEngine(baseline, webhook=args.webhook, notifiers=notifiers)
    result = engine.evaluate_batch(runs)

    # 4) Report
    console.print()
    console.print(f"[bold]Runtime monitor[/bold] — agent [cyan]{baseline.agent_name}[/cyan] "
                  f"via [cyan]{args.source}[/cyan]")
    console.print(f"  runs evaluated: {result.runs_evaluated}")
    console.print(f"  critical: [red]{len(result.critical)}[/red]   "
                  f"warnings: [yellow]{len(result.warnings)}[/yellow]   "
                  f"healthy: {'yes' if result.healthy else 'NO'}")
    for f in result.alerting:
        colour = "red" if f.severity.value == "CRITICAL" else "yellow"
        console.print(f"  [{colour}]✗ {f.id}[/{colour}]  {f.title}")

    # 5) Outputs
    if args.output:
        payload = {
            "summary": result.summary(),
            "baseline": baseline.to_dict(),
            "findings": [f.to_dict() for f in result.findings],
        }
        Path(args.output).write_text(_json.dumps(payload, indent=2), encoding="utf-8")
        console.print(f"  findings JSON → {args.output}")
    if args.sarif:
        _write_monitor_sarif(result, args.sarif)
        console.print(f"  findings SARIF → {args.sarif}")

    # Non-zero exit if any critical, so CI/cron can gate on it.
    sys.exit(2 if result.critical else (1 if result.warnings else 0))


def _build_monitor_source(args: argparse.Namespace, manifest):
    """Construct the telemetry source from the manifest's provider config."""
    from agent_audit.monitor.sources import (
        AAControlRoomSource,
        AgentforceSessionSource,
        FoundrySource,
        MockTelemetrySource,
        UiPathOrchestratorSource,
        make_run,
    )

    if args.source == "mock":
        runs = []
        if args.mock_runs:
            import json as _json

            from agent_audit.monitor.run_record import Decision, RunRecord, ToolCall
            raw = _json.loads(Path(args.mock_runs).read_text(encoding="utf-8"))
            for d in raw:
                tools = [ToolCall(**t) for t in d.pop("tool_calls", [])]
                decisions = [Decision(**dd) for dd in d.pop("decisions", [])]
                d.pop("tokens_total", None)
                runs.append(RunRecord(tool_calls=tools, decisions=decisions, **d))
        return MockTelemetrySource(runs)

    cfg = dict(getattr(manifest.runtime.provider, "config", {}) or {})
    cfg.setdefault("agent_name", manifest.agent_name)
    if args.source == "agentforce":
        return AgentforceSessionSource(cfg)
    if args.source == "foundry":
        return FoundrySource(cfg)
    if args.source == "uipath":
        return UiPathOrchestratorSource(cfg)
    if args.source == "automation_anywhere":
        return AAControlRoomSource(cfg)
    raise ValueError(f"unknown source {args.source!r}")


def _write_monitor_sarif(result, path: str) -> None:
    """Minimal SARIF 2.1.0 for monitor findings (SIEM ingest)."""
    import json as _json
    rules, results = {}, []
    for f in result.findings:
        if f.passed:
            continue
        rules.setdefault(f.id, {"id": f.id, "name": f.test_name,
                                "shortDescription": {"text": f.title}})
        results.append({
            "ruleId": f.id,
            "level": f.severity.sarif_level,
            "message": {"text": f.title + " — " + f.description},
        })
    sarif = {
        "version": "2.1.0",
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "runs": [{
            "tool": {"driver": {"name": "agent-audit-monitor", "version": "10.3.0",
                                "rules": list(rules.values())}},
            "results": results,
        }],
    }
    Path(path).write_text(_json.dumps(sarif, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
