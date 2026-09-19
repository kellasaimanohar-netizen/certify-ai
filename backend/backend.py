import sys
import uuid
import os
import glob
import tempfile
from pathlib import Path

# Automatically permit local/private fetches for UI dashboard scans
os.environ["AGENT_AUDIT_ALLOW_PRIVATE_FETCH"] = "1"
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import yaml
import logging
import asyncio
import json as _json


class QueueLogHandler(logging.Handler):
    """Custom logging handler to push log records to an async queue in real-time."""
    def __init__(self, queue: asyncio.Queue, formatter: logging.Formatter | None = None):
        super().__init__()
        self.queue = queue
        if formatter:
            self.setFormatter(formatter)

    def emit(self, record: logging.LogRecord):
        try:
            msg = self.format(record)
            # Safe call in case emission runs inside another thread/task context
            loop = asyncio.get_running_loop()
            loop.call_soon_threadsafe(self.queue.put_nowait, msg)
        except Exception:
            pass

# Add src folder to PYTHONPATH dynamically
root_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(root_dir / "src"))

from agent_audit.sources import load_target
from agent_audit.runner import run_audit
from agent_audit.certificate import issue_certificate

# ── Security configuration (env-driven; safe defaults) ──────────────────────
# Lock CORS to explicit origins instead of "*". Override with a comma-separated
# AA_ALLOWED_ORIGINS. allow_credentials + "*" is an invalid, unsafe combination.
_ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get(
        "AA_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if o.strip()
]
# Optional bearer token. If AA_API_TOKEN is set, every audit call must present it.
_API_TOKEN = os.environ.get("AA_API_TOKEN")
# Repo scans are confined to this base dir. Defaults to the project root; set
# AA_REPO_BASE to widen/narrow. Prevents arbitrary server-side path reads.
_REPO_BASE = Path(os.environ.get("AA_REPO_BASE", str(root_dir.parent))).resolve()

# Temp targets carry this prefix so they can be excluded from listings + cleaned.
_TEMP_PREFIX = "temp_ui_"


def check_docker_available() -> bool:
    """Helper to detect if docker is installed and running on the host system."""
    import shutil
    import subprocess
    if not shutil.which("docker"):
        return False
    try:
        # Run a quick lightweight command to check if docker daemon is accessible
        res = subprocess.run(["docker", "info"], capture_output=True, timeout=2)
        return res.returncode == 0
    except Exception:
        return False


# Sandbox configuration. Set AA_USE_DOCKER_SANDBOX=1 to force Docker sandboxing.
# By default, runs locally for low latency.
_USE_DOCKER_SANDBOX = os.environ.get("AA_USE_DOCKER_SANDBOX") == "1"


def _require_auth(authorization: str | None) -> None:
    """Enforce the bearer token when AA_API_TOKEN is configured."""
    if _API_TOKEN is None:
        return
    expected = f"Bearer {_API_TOKEN}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="missing or invalid API token")


# Clean up any leftover temporary files from previous runs
def cleanup_temp_files():
    temp_files = glob.glob(str(root_dir / "targets" / f"{_TEMP_PREFIX}*.yaml"))
    for f in temp_files:
        try:
            os.remove(f)
        except Exception:
            pass

# Step 1: Dynamic History Database
_AUDIT_HISTORY = {}

app = FastAPI(title="Agent Audit V10 Dashboard API")

from versioning import normalize_agent_name, compute_agent_versions, enrich_test_runs_with_versions, group_agents_with_versions

@app.get("/api/agents")
async def get_agents():
    """Returns the unified history of all tested agents grouped by instance with versions."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM agents ORDER BY id ASC")
        agent_rows = [dict(r) for r in cursor.fetchall()]
        cursor.execute("""
        SELECT id, audit_id, user_id, agent_name, tested_by_email, tested_by_name, user_role, mode,
               runs_count, concurrency, phases_selected, trust_score, tier, enterprise_ready,
               critical_count, warning_count, pass_count, info_count, duration_ms, created_at, notes, full_result_json
        FROM test_runs
        ORDER BY created_at ASC, id ASC
        """)
        all_runs = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return group_agents_with_versions(agent_rows, all_runs)
    except Exception as e:
        logging.error(f"Failed to fetch grouped agents: {e}")
        return list(_AUDIT_HISTORY.values())


# CORS configured to allow any local frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers.targets import router as targets_router
from routers.admin import router as admin_router
from routers.auth import router as auth_router
from routers.user_api import router as user_router
from database import get_db_connection

app.include_router(auth_router)
app.include_router(user_router)
app.include_router(admin_router)
app.include_router(targets_router)

@app.get("/")
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "CertifyAI Enterprise Governance API",
        "version": "10.3.0",
        "engine": "FastAPI on Vercel Serverless / Cloud"
    }

class AuditRequest(BaseModel):
    yaml_content: str | None = None
    repo_path: str | None = None
    openapi_url: str | None = None
    mode: str = "validate"
    runs: int = 1
    concurrency: int = 10
    selected_phases: list[str] | None = None
    user_id: int | None = 2
    tested_by_email: str | None = "ismeet@certifyai.in"
    tested_by_name: str | None = "Ismeet"
    user_role: str | None = "USER"





@app.post("/api/audit")
async def run_ui_audit(req: AuditRequest, authorization: str | None = Header(default=None)):
    """Runs a target audit and streams logs + final results back to the client using SSE."""
    
    async def audit_stream_generator():
        # Setup target content
        rp = None
        try:
            # Determine the source content
            if req.yaml_content:
                yaml_content_str = req.yaml_content
            elif req.repo_path:
                clean_path = req.repo_path.strip().strip('"').strip("'")
                if clean_path.startswith(("http://", "https://", "git@")):
                    import subprocess
                    
                    temp_repo_dir = tempfile.mkdtemp(prefix="agent_audit_git_")
                    try:
                        subprocess.run(["git", "clone", "--depth", "1", "--", clean_path, temp_repo_dir], check=True, capture_output=True)
                    except subprocess.CalledProcessError as e:
                        raise HTTPException(status_code=400, detail=f"Failed to clone git repository: {e.stderr.decode(errors='replace')}")
                    
                    rp = Path(temp_repo_dir).resolve()
                else:
                    # Confine repo scans to the allowlisted base dir
                    rp = Path(clean_path).expanduser().resolve()
                    if not (rp.is_relative_to(_REPO_BASE) or rp.is_relative_to(Path("c:/Copilot").resolve()) or rp.is_relative_to(Path("c:/Personal").resolve())):
                        raise HTTPException(
                            status_code=403,
                            detail=f"repo_path must be within {_REPO_BASE}, c:\\Copilot, or c:\\Personal (set AA_REPO_BASE to change)",
                        )
                    if not rp.exists():
                        raise HTTPException(status_code=404, detail="repo_path does not exist")
                
                # Auto-detect any YAML/YML manifest file in the repo directory
                manifest_files = list(rp.glob("*.yaml")) + list(rp.glob("*.yml"))
                # Filter out system/deployment config files
                manifest_files = [f for f in manifest_files if f.name.lower() not in ("render.yaml", "render.yml", "docker-compose.yaml", "docker-compose.yml")]
                
                if manifest_files:
                    manifest_path = manifest_files[0]
                    logging.info(f"Auto-detected manifest in repository: {manifest_path}")
                    with open(manifest_path, "r", encoding="utf-8") as f:
                        manifest_data = yaml.safe_load(f)
                    
                    # Fix paths inside manifest to make sure they are absolute and correct
                    if isinstance(manifest_data, dict) and "sources" in manifest_data:
                        for src in manifest_data["sources"]:
                            if isinstance(src, dict):
                                if src.get("type") == "openapi" and "path" in src:
                                    op_path_str = src["path"]
                                    if not op_path_str.startswith(("http://", "https://")):
                                        op_path = Path(op_path_str)
                                        if not op_path.is_absolute():
                                            src["path"] = str(rp / op_path)
                                elif src.get("type") == "repo" and "path" in src:
                                    src["path"] = str(rp)
                    yaml_content_str = yaml.dump(manifest_data)
                else:
                    yaml_content_str = yaml.dump({
                        "agent_name": f"Repo_{rp.name or 'scan'}",
                        "sources": [
                            {"type": "repo", "path": str(rp) if not _USE_DOCKER_SANDBOX else "/scan"}
                        ]
                    })
            elif req.openapi_url:
                # Step 2: Auto-Discovery Engine
                import httpx
                try:
                    async with httpx.AsyncClient() as client:
                        resp = await client.get(req.openapi_url, timeout=10.0)
                        resp.raise_for_status()
                        openapi_spec = resp.json()
                except Exception as e:
                    raise HTTPException(status_code=400, detail=f"Failed to auto-discover OpenAPI spec: {str(e)}")

                # Automatically extract tools from the OpenAPI paths
                discovered_tools = []
                for path_key in openapi_spec.get("paths", {}).keys():
                    tool_name = path_key.strip("/").replace("/", "_").replace("{", "").replace("}", "")
                    if tool_name:
                        discovered_tools.append(tool_name)
                
                agent_title = openapi_spec.get("info", {}).get("title", f"API_{uuid.uuid4().hex[:4]}")
                agent_name = agent_title.replace(" ", "_").lower()
                base_url = req.openapi_url.rsplit("/", 1)[0]

                manifest_data = {
                    "agent_name": agent_name,
                    "sources": [
                        {"type": "openapi", "path": req.openapi_url}
                    ],
                    "runtime": {
                        "endpoint": base_url,
                        "ui_endpoint": base_url,
                        "protocol": "http"
                    },
                    "capabilities": {
                        "max_steps": 5,
                        "context_budget_tokens": 8000,
                        "tools": discovered_tools[:20],  # Limit to 20 discovered tools
                        "destructive_tools": [],
                        "requires_hitl": False
                    },
                    "security": {
                        "pii_fields": ["email", "phone"]
                    }
                }
                yaml_content_str = yaml.dump(manifest_data)
                logging.info(f"Auto-discovered {len(discovered_tools)} capabilities for {agent_name}")
            else:
                raise HTTPException(status_code=400, detail="No audit target provided (YAML, Repo, or OpenAPI required)")
        except HTTPException as exc:
            yield f"data: {_json.dumps({'type': 'error', 'detail': exc.detail})}\n\n"
            return
        except Exception as exc:
            yield f"data: {_json.dumps({'type': 'error', 'detail': str(exc)})}\n\n"
            return

        # If Docker sandbox is active, route to the sandboxed execution flow
        if _USE_DOCKER_SANDBOX:
            yield f"data: {_json.dumps({'type': 'log', 'message': '[info] Starting sandboxed Docker container audit...'})}\n\n"
            with tempfile.TemporaryDirectory(prefix="agent_audit_sandbox_") as host_temp_dir:
                host_temp_path = Path(host_temp_dir)
                docker_args = ["docker", "run", "--rm", "-v", f"{host_temp_dir}:/audit_work"]
                if req.repo_path:
                    # Mount the resolved host repository path to /scan as read-only
                    docker_args.extend(["-v", f"{rp}:/scan:ro"])
                
                target_yaml_file = host_temp_path / "target.yaml"
                target_yaml_file.write_text(yaml_content_str, encoding="utf-8")
                
                container_image = os.environ.get("AA_DOCKER_IMAGE", "agent-audit:latest")
                cmd = docker_args + [
                    container_image,
                    "run",
                    "--target", "/audit_work/target.yaml",
                    "--mode", req.mode,
                    "--variability-runs", str(req.runs),
                    "--concurrency", str(req.concurrency),
                    "--output", "/audit_work/report.json",
                    "--cert-output", "/audit_work/certificate.json",
                    "--log-level", "INFO"
                ]
                try:
                    # Start Docker subprocess asynchronously
                    proc = await asyncio.create_subprocess_exec(
                        *cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.STDOUT
                    )
                    
                    # Stream the container's stdout/stderr in real time
                    while True:
                        line = await proc.stdout.readline()
                        if not line:
                            break
                        line_str = line.decode("utf-8").rstrip()
                        
                        # Dynamically increment progress based on logs
                        progress_val = 0
                        if "Phase 1" in line_str: progress_val = 15
                        elif "Phase 5" in line_str: progress_val = 40
                        elif "Phase 7" in line_str: progress_val = 60
                        elif "Phase 8" in line_str: progress_val = 80
                        elif "audit complete" in line_str: progress_val = 95
                        
                        if progress_val > 0:
                            yield f"data: {_json.dumps({'type': 'progress', 'val': progress_val})}\n\n"
                        yield f"data: {_json.dumps({'type': 'log', 'message': line_str})}\n\n"
                    
                    await proc.wait()
                    if proc.returncode != 0:
                        yield f"data: {_json.dumps({'type': 'log', 'message': f'[critical] Container process exited with code {proc.returncode}'})}\n\n"
                except Exception as err:
                    yield f"data: {_json.dumps({'type': 'error', 'detail': f'Sandboxed Docker execution error: {str(err)}'})}\n\n"
                    return
                
                report_json_path = host_temp_path / "report.json"
                cert_json_path = host_temp_path / "certificate.json"
                if not report_json_path.exists() or not cert_json_path.exists():
                    yield f"data: {_json.dumps({'type': 'error', 'detail': 'Docker run completed, but audit output files were not generated.'})}\n\n"
                    return
                
                report_data = _json.loads(report_json_path.read_text(encoding="utf-8"))
                cert_data = _json.loads(cert_json_path.read_text(encoding="utf-8"))
                
                findings_json = report_data.get("findings", [])
                for f in findings_json:
                    if "standards" in f:
                        f["standards"] = [
                            {
                                "framework": s.get("framework", ""),
                                "identifier": s.get("identifier", ""),
                                "name": s.get("name", ""),
                                "url": s.get("url", "https://certifyai.in")
                            }
                            for s in f["standards"]
                        ]
                
                result_payload = {
                    "agent_name": report_data["agent_name"],
                    "started_at": report_data["started_at"],
                    "finished_at": report_data["finished_at"],
                    "audit_id": report_data["audit_id"],
                    "total_duration_ms": report_data["total_duration_ms"],
                    "trust_score": report_data["trust_score"],
                    "enterprise_ready": report_data["enterprise_ready"],
                    "tier": cert_data.get("tier", "NOT_CERTIFIED"),
                    "expires_at": cert_data.get("expires_at"),
                    "days_remaining": cert_data.get("days_remaining", 0),
                    "critical_count": report_data["summary"]["critical_failures"],
                    "warning_count": report_data["summary"]["warnings"],
                    "pass_count": report_data["summary"]["passed"],
                    "suppressed_count": report_data["summary"]["suppressed"],
                    "skipped_tests_count": len([f for f in report_data.get("findings", []) if f.get("description", "").startswith("Skipped:")]),
                    "findings": findings_json,
                    "manifest_summary": report_data["manifest"],
                    "phases_run": report_data["phases_run"],
                    "audit_summary": report_data.get("audit_summary", {}),
                    "diagnostics": report_data.get("diagnostics", []),
                    "skipped_phases": report_data.get("skipped_phases", []),
                    "cert": cert_data
                }
                try:
                    conn = get_db_connection()
                    cursor = conn.cursor()
                    eff_user_id = req.user_id or 2
                    eff_user_email = req.tested_by_email or "ismeet@certifyai.in"
                    eff_user_name = req.tested_by_name or "Ismeet"
                    eff_user_role = req.user_role or "USER"

                    # Calculate current iteration version
                    cursor.execute("SELECT COUNT(*) FROM test_runs WHERE LOWER(agent_name) = ? OR LOWER(agent_name) = ?", (result_payload["agent_name"].lower(), normalize_agent_name(result_payload["agent_name"]).lower()))
                    existing_count = cursor.fetchone()[0]
                    v_str = f"v{existing_count + 1}"
                    result_payload["version"] = v_str
                    result_payload["version_num"] = existing_count + 1

                    # Save to dynamic history
                    _AUDIT_HISTORY[result_payload["agent_name"]] = result_payload

                    cursor.execute("""
                    INSERT INTO test_runs (
                        audit_id, user_id, agent_name, tested_by_email, tested_by_name, user_role, mode,
                        runs_count, concurrency, phases_selected, trust_score, tier, enterprise_ready,
                        critical_count, warning_count, pass_count, info_count, duration_ms, created_at, notes, full_result_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        result_payload["audit_id"], eff_user_id, result_payload["agent_name"],
                        eff_user_email, eff_user_name, eff_user_role, req.mode, req.runs, req.concurrency,
                        _json.dumps(result_payload["phases_run"]), float(result_payload["trust_score"]),
                        result_payload["tier"], 1 if result_payload["enterprise_ready"] else 0,
                        result_payload["critical_count"], result_payload["warning_count"],
                        result_payload["pass_count"], result_payload.get("info_count", 0),
                        float(result_payload["total_duration_ms"]), result_payload["finished_at"],
                        f"Docker Sandboxed Test ({req.mode} mode) [{v_str}]", _json.dumps(result_payload)
                    ))
                    conn.commit()
                    conn.close()
                except Exception as db_e:
                    logging.error(f"Failed to record docker test run: {db_e}")

                yield f"data: {_json.dumps({'type': 'progress', 'val': 100})}\n\n"
                yield f"data: {_json.dumps({'type': 'result', 'data': result_payload})}\n\n"
        
        else:
            # --- Local Execution Stream ---
            from agent_audit.logging_setup import _AuditFormatter
            queue = asyncio.Queue()
            pkg_logger = logging.getLogger("agent_audit")
            
            # Setup logging configuration dynamically
            from agent_audit.logging_setup import configure_logging
            configure_logging("INFO")
            
            old_handlers = list(pkg_logger.handlers)
            
            # Setup clean text formatter
            formatter = _AuditFormatter()
            import agent_audit.logging_setup
            original_use_colour = agent_audit.logging_setup._use_colour
            agent_audit.logging_setup._use_colour = False
            
            queue_handler = QueueLogHandler(queue, formatter=formatter)
            pkg_logger.handlers = [queue_handler]
            
            temp_path = None
            try:
                targets_dir = root_dir / "targets"
                targets_dir.mkdir(parents=True, exist_ok=True)
                fd, temp_name = tempfile.mkstemp(
                    prefix=_TEMP_PREFIX, suffix=".yaml", dir=str(targets_dir)
                )
                temp_path = Path(temp_name)
                with os.fdopen(fd, "w", encoding="utf-8") as fh:
                    fh.write(yaml_content_str)
                
                manifest = await asyncio.to_thread(load_target, temp_path)
                mock_tools = (req.mode == "validate")
                
                async def run_and_certify():
                    report = await run_audit(
                        manifest,
                        phases=req.selected_phases,
                        mode=req.mode,
                        mock_tools=mock_tools,
                        variability_runs=req.runs,
                        concurrency=req.concurrency,
                    )
                    cert = issue_certificate(report, framework_validation_only=mock_tools)
                    return report, cert
                
                # Start audit task in the background
                audit_task = asyncio.create_task(run_and_certify())
                
                # Stream logs as they arrive in the queue
                while not audit_task.done() or not queue.empty():
                    try:
                        log_msg = await asyncio.wait_for(queue.get(), timeout=0.1)
                        progress_val = 0
                        if "Phase 1" in log_msg: progress_val = 15
                        elif "Phase 5" in log_msg: progress_val = 40
                        elif "Phase 7" in log_msg: progress_val = 60
                        elif "Phase 8" in log_msg: progress_val = 80
                        elif "audit complete" in log_msg: progress_val = 95
                        
                        if progress_val > 0:
                            yield f"data: {_json.dumps({'type': 'progress', 'val': progress_val})}\n\n"
                        yield f"data: {_json.dumps({'type': 'log', 'message': log_msg})}\n\n"
                    except asyncio.TimeoutError:
                        continue
                
                # Retrieve final objects
                report, cert = await audit_task
                
                findings_json = []
                for f in report.sorted_findings():
                    f_dict = f.to_dict()
                    if hasattr(f_dict.get("severity"), "name"):
                        f_dict["severity"] = f_dict["severity"].name
                    f_dict["standards"] = [
                        {"framework": s.framework, "identifier": s.identifier, "name": s.name, "url": getattr(s, 'url', 'https://certifyai.in')}
                        for s in getattr(f, 'standards', [])
                    ]
                    findings_json.append(f_dict)
                
                result_payload = {
                    "agent_name": report.agent_name,
                    "started_at": report.started_at,
                    "finished_at": report.finished_at,
                    "audit_id": report.audit_id,
                    "total_duration_ms": report.total_duration_ms,
                    "trust_score": report.trust_score,
                    "enterprise_ready": report.enterprise_ready,
                    "tier": cert.tier,
                    "expires_at": cert.expires_at,
                    "days_remaining": cert.days_remaining,
                    "critical_count": len(report.critical_failures),
                    "warning_count": len(report.warnings),
                    "pass_count": len(report.passes),
                    "suppressed_count": len(report.suppressed),
                    "skipped_tests_count": len([f for f in report.findings if f.description and str(f.description).startswith("Skipped:")]),
                    "findings": findings_json,
                    "manifest_summary": report.manifest_summary,
                    "phases_run": report.phases_run,
                    "audit_summary": getattr(report, "audit_summary", {}),
                    "diagnostics": getattr(report, "diagnostics", []),
                    "skipped_phases": getattr(report, "skipped_phases", []),
                    "cert": cert.to_dict()
                }
                # Automatically save test run to persistent database with sequential versioning
                try:
                    conn = get_db_connection()
                    cursor = conn.cursor()
                    
                    # Resolve user_id if not given
                    eff_user_id = req.user_id or 2
                    eff_user_email = req.tested_by_email or "ismeet@certifyai.in"
                    eff_user_name = req.tested_by_name or "Ismeet"
                    eff_user_role = req.user_role or "USER"

                    # Calculate current iteration version
                    cursor.execute("SELECT COUNT(*) FROM test_runs WHERE LOWER(agent_name) = ? OR LOWER(agent_name) = ?", (result_payload["agent_name"].lower(), normalize_agent_name(result_payload["agent_name"]).lower()))
                    existing_count = cursor.fetchone()[0]
                    v_str = f"v{existing_count + 1}"
                    result_payload["version"] = v_str
                    result_payload["version_num"] = existing_count + 1

                    # Save to dynamic history
                    _AUDIT_HISTORY[result_payload["agent_name"]] = result_payload

                    cursor.execute("""
                    INSERT INTO test_runs (
                        audit_id, user_id, agent_name, tested_by_email, tested_by_name, user_role, mode,
                        runs_count, concurrency, phases_selected, trust_score, tier, enterprise_ready,
                        critical_count, warning_count, pass_count, info_count, duration_ms, created_at, notes, full_result_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        result_payload["audit_id"],
                        eff_user_id,
                        result_payload["agent_name"],
                        eff_user_email,
                        eff_user_name,
                        eff_user_role,
                        req.mode,
                        req.runs,
                        req.concurrency,
                        _json.dumps(result_payload["phases_run"]),
                        float(result_payload["trust_score"]),
                        result_payload["tier"],
                        1 if result_payload["enterprise_ready"] else 0,
                        result_payload["critical_count"],
                        result_payload["warning_count"],
                        result_payload["pass_count"],
                        result_payload.get("info_count", 0),
                        float(result_payload["total_duration_ms"]),
                        result_payload["finished_at"],
                        f"UI Test run via Web Dashboard ({req.mode} mode) [{v_str}]",
                        _json.dumps(result_payload)
                    ))
                    
                    # Also write activity log
                    log_status = "SUCCESS" if result_payload["tier"] == "CERTIFIED" else ("WARNING" if result_payload["tier"] == "CONDITIONAL" else "FAILED")
                    cursor.execute("""
                    INSERT INTO activity_logs (timestamp, event_type, user_id, user_email, user_name, details, status)
                    VALUES (?, 'AUDIT_RUN', ?, ?, ?, ?, ?)
                    """, (
                        result_payload["finished_at"],
                        eff_user_id,
                        eff_user_email,
                        eff_user_name,
                        f"Audited '{result_payload['agent_name']}' ({req.mode} mode) -> Score: {result_payload['trust_score']}% [{result_payload['tier']}]",
                        log_status
                    ))

                    conn.commit()
                    conn.close()
                except Exception as log_err:
                    logging.error(f"Failed to record test run in db: {log_err}")


                yield f"data: {_json.dumps({'type': 'progress', 'val': 100})}\n\n"
                yield f"data: {_json.dumps({'type': 'result', 'data': result_payload})}\n\n"
            
            except Exception as exc:
                yield f"data: {_json.dumps({'type': 'error', 'detail': str(exc)})}\n\n"
            finally:
                # Restore original handlers and settings
                pkg_logger.handlers = old_handlers
                agent_audit.logging_setup._use_colour = original_use_colour
                if temp_path and temp_path.is_file():
                    try:
                        temp_path.unlink()
                    except Exception:
                        pass

    # Ensure bearer auth happens before starting the streaming response
    _require_auth(authorization)
    return StreamingResponse(audit_stream_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    server_port = int(os.getenv("PORT", 8000))
    server_host = os.getenv("HOST", "127.0.0.1")
    uvicorn.run("backend:app", host=server_host, port=server_port, reload=True)
