from fastapi import APIRouter, HTTPException, Depends, Header, Query
from fastapi.responses import StreamingResponse, PlainTextResponse
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import json
import uuid
import io
import csv
from datetime import datetime, timezone, timedelta
from database import get_db_connection, hash_password
from versioning import normalize_agent_name, compute_agent_versions, enrich_test_runs_with_versions, group_agents_with_versions

router = APIRouter(prefix="/api/admin", tags=["admin"])


class CreateUserRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "USER"  # Strictly ADMIN or USER
    department: str = "AI Quality Assurance & Testing"
    avatar_url: Optional[str] = None


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    department: Optional[str] = None


@router.get("/dashboard")
def get_admin_dashboard():
    """Returns organization-wide dashboard metrics for Syed."""
    conn = get_db_connection()
    cursor = conn.cursor()

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_date_str = now.strftime("%Y-%m-%d")

    # 1. Tests Today
    cursor.execute("""
    SELECT COUNT(*) FROM test_runs 
    WHERE created_at >= ? OR date(created_at) = ?
    """, (today_start, today_date_str))
    tests_today = cursor.fetchone()[0]

    # 2. Agents Tested Today (Distinct count of agents tested today)
    cursor.execute("""
    SELECT COUNT(DISTINCT agent_name) FROM test_runs 
    WHERE created_at >= ? OR date(created_at) = ?
    """, (today_start, today_date_str))
    agents_today = cursor.fetchone()[0]

    # 3. Total Tests
    cursor.execute("SELECT COUNT(*) FROM test_runs")
    total_tests = cursor.fetchone()[0]

    # 4. Average Score
    cursor.execute("SELECT AVG(trust_score) FROM test_runs")
    avg_score_raw = cursor.fetchone()[0]
    avg_score = round(avg_score_raw, 1) if avg_score_raw is not None else 0.0

    # 5. Certification Tier Breakdown
    cursor.execute("SELECT COUNT(*) FROM test_runs WHERE tier = 'CERTIFIED'")
    certified_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM test_runs WHERE tier = 'CONDITIONAL'")
    conditional_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM test_runs WHERE tier = 'NOT_CERTIFIED'")
    not_certified_count = cursor.fetchone()[0]

    # 6. Total Critical Findings
    cursor.execute("SELECT SUM(critical_count) FROM test_runs")
    critical_findings_count = cursor.fetchone()[0] or 0

    # 7. Recent Testing Activity (Who Tested Which Agent?) with version iterations
    cursor.execute("""
    SELECT id, audit_id, user_id, tested_by_name, tested_by_email, user_role,
           agent_name, mode, trust_score, tier, critical_count, warning_count, pass_count,
           duration_ms, created_at
    FROM test_runs
    ORDER BY created_at ASC, id ASC
    """)
    all_runs = [dict(row) for row in cursor.fetchall()]
    conn.close()

    enriched_runs = enrich_test_runs_with_versions(all_runs)
    recent_activity = list(reversed(enriched_runs))[:10]

    return {
        "kpis": {
            "tests_today": tests_today,
            "agents_today": agents_today,
            "total_tests": total_tests,
            "average_score": avg_score,
            "certified_count": certified_count,
            "conditional_count": conditional_count,
            "not_certified_count": not_certified_count,
            "critical_findings_count": critical_findings_count
        },
        "recent_activity": recent_activity
    }


@router.get("/activity")
@router.get("/tests")
def get_testing_activity(
    user: Optional[str] = None,
    agent: Optional[str] = None,
    status: Optional[str] = None,
    date_filter: Optional[str] = None,
    min_score: Optional[float] = None,
    max_score: Optional[float] = None,
    group_by_agent: bool = False,
    limit: int = 100
):
    """Returns 'Who Tested What' testing activity with full filter options and v1, v2, v3 versioning."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT id, audit_id, user_id, tested_by_name, tested_by_email, user_role,
           agent_name, mode, runs_count, concurrency, phases_selected, trust_score, tier,
           enterprise_ready, critical_count, warning_count, pass_count, info_count,
           duration_ms, created_at, notes, full_result_json
    FROM test_runs
    ORDER BY created_at ASC, id ASC
    """)
    all_runs = [dict(row) for row in cursor.fetchall()]

    query = "SELECT * FROM test_runs WHERE 1=1"
    params = []

    if user and user.lower() != "all":
        query += " AND (LOWER(tested_by_name) LIKE ? OR LOWER(tested_by_email) LIKE ?)"
        params.extend([f"%{user.lower()}%", f"%{user.lower()}%"])

    if agent and agent.lower() != "all":
        query += " AND LOWER(agent_name) LIKE ?"
        params.append(f"%{agent.lower()}%")

    if status and status.upper() != "ALL":
        query += " AND UPPER(tier) = ?"
        params.append(status.strip().upper())

    if min_score is not None:
        query += " AND trust_score >= ?"
        params.append(min_score)

    if max_score is not None:
        query += " AND trust_score <= ?"
        params.append(max_score)

    if date_filter:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        if date_filter.lower() == "today":
            query += " AND created_at >= ?"
            params.append(today_start.isoformat())
        elif date_filter.lower() == "yesterday":
            yesterday_start = today_start - timedelta(days=1)
            query += " AND created_at >= ? AND created_at < ?"
            params.extend([yesterday_start.isoformat(), today_start.isoformat()])
        elif date_filter.lower() in ("7d", "last 7 days"):
            start = (now - timedelta(days=7)).isoformat()
            query += " AND created_at >= ?"
            params.append(start)
        elif date_filter.lower() in ("30d", "last 30 days"):
            start = (now - timedelta(days=30)).isoformat()
            query += " AND created_at >= ?"
            params.append(start)

    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)

    cursor.execute(query, params)
    rows = [dict(row) for row in cursor.fetchall()]

    for r in rows:
        if r.get("phases_selected"):
            try:
                r["phases_selected"] = json.loads(r["phases_selected"])
            except Exception:
                pass
        if r.get("full_result_json"):
            try:
                r["full_result"] = json.loads(r["full_result_json"])
            except Exception:
                pass

    enriched_rows = enrich_test_runs_with_versions(rows, all_runs)

    if group_by_agent:
        cursor.execute("SELECT * FROM agents ORDER BY id ASC")
        agent_rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        grouped = group_agents_with_versions(agent_rows, all_runs)
        return {"tests": enriched_rows, "grouped_agents": grouped, "count": len(enriched_rows)}

    conn.close()
    return {"tests": enriched_rows, "count": len(enriched_rows)}


@router.get("/tests/{test_id}")
def get_admin_test_detail(test_id: int):
    """Returns full technical test result for Syed with version meta."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM test_runs ORDER BY created_at ASC, id ASC")
    all_runs = [dict(r) for r in cursor.fetchall()]
    conn.close()

    enriched_runs = enrich_test_runs_with_versions(all_runs)
    target_test = next((r for r in enriched_runs if r["id"] == test_id), None)

    if not target_test:
        raise HTTPException(status_code=404, detail="Test record not found")

    if target_test.get("phases_selected") and isinstance(target_test["phases_selected"], str):
        try:
            target_test["phases_selected"] = json.loads(target_test["phases_selected"])
        except Exception:
            pass

    if target_test.get("full_result_json"):
        try:
            target_test["full_result"] = json.loads(target_test["full_result_json"])
        except Exception:
            target_test["full_result"] = {}
    else:
        target_test["full_result"] = {}

    return {"test": target_test}


@router.get("/users")
def get_admin_users():
    """Returns list of users with test counts and avg scores."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT u.id, u.name, u.email, u.role, u.status, u.department, u.avatar_url, u.created_at, u.last_login,
           COUNT(t.id) as total_tests,
           AVG(t.trust_score) as avg_score,
           SUM(CASE WHEN t.tier = 'CERTIFIED' THEN 1 ELSE 0 END) as certified_count,
           MAX(t.created_at) as last_test_at
    FROM users u
    LEFT JOIN test_runs t ON u.id = t.user_id
    GROUP BY u.id
    ORDER BY u.id ASC
    """)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()

    for r in rows:
        r["avg_score"] = round(r["avg_score"], 1) if r["avg_score"] is not None else None

    return {"users": rows, "count": len(rows)}


@router.post("/users")
def create_admin_user(req: CreateUserRequest):
    """Registers a new user (Syed can create new USER or ADMIN)."""
    conn = get_db_connection()
    cursor = conn.cursor()

    clean_email = req.email.strip().lower()
    pw_hash = hash_password(req.password)
    now_iso = datetime.now(timezone.utc).isoformat()
    clean_role = req.role.strip().upper()
    if clean_role not in ("ADMIN", "USER"):
        clean_role = "USER"

    try:
        cursor.execute("""
        INSERT INTO users (name, email, password_hash, role, status, department, avatar_url, created_at, last_login)
        VALUES (?, ?, ?, ?, 'Active', ?, ?, ?, ?)
        """, (
            req.name.strip(),
            clean_email,
            pw_hash,
            clean_role,
            req.department,
            req.avatar_url or "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
            now_iso,
            now_iso
        ))
        new_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return {"success": True, "id": new_id, "name": req.name, "email": clean_email, "role": clean_role}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Failed to create user: {str(e)}")


@router.get("/users/{user_id}")
def get_admin_user_detail(user_id: int):
    """Returns detailed user metrics, test history, and score trend for Syed."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id, name, email, role, status, department, avatar_url, created_at, last_login FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    user_dict = dict(user)

    # User test metrics
    cursor.execute("SELECT COUNT(*) FROM test_runs WHERE user_id = ?", (user_id,))
    total_tests = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(DISTINCT agent_name) FROM test_runs WHERE user_id = ?", (user_id,))
    agents_tested = cursor.fetchone()[0]

    cursor.execute("SELECT AVG(trust_score) FROM test_runs WHERE user_id = ?", (user_id,))
    avg_score_raw = cursor.fetchone()[0]
    avg_score = round(avg_score_raw, 1) if avg_score_raw is not None else 0.0

    cursor.execute("SELECT COUNT(*) FROM test_runs WHERE user_id = ? AND tier = 'CERTIFIED'", (user_id,))
    certified_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM test_runs WHERE user_id = ? AND tier = 'CONDITIONAL'", (user_id,))
    conditional_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM test_runs WHERE user_id = ? AND tier = 'NOT_CERTIFIED'", (user_id,))
    not_certified_count = cursor.fetchone()[0]

    cursor.execute("SELECT MAX(created_at) FROM test_runs WHERE user_id = ?", (user_id,))
    last_test_at = cursor.fetchone()[0]

    # Test history
    cursor.execute("""
    SELECT id, audit_id, agent_name, mode, trust_score, tier, critical_count, warning_count, pass_count,
           duration_ms, created_at
    FROM test_runs
    WHERE user_id = ?
    ORDER BY id DESC
    """, (user_id,))
    test_history = [dict(row) for row in cursor.fetchall()]

    # Score trend
    now = datetime.now(timezone.utc)
    score_trend = []
    for i in range(13, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        cursor.execute("""
        SELECT AVG(trust_score), COUNT(*) 
        FROM test_runs 
        WHERE user_id = ? AND created_at >= ? AND created_at < ?
        """, (user_id, day_start.isoformat(), day_end.isoformat()))
        row = cursor.fetchone()
        score_trend.append({
            "date": day_start.strftime("%b %d"),
            "score": round(row[0], 1) if row[0] is not None else None,
            "count": row[1]
        })

    conn.close()

    return {
        "user": user_dict,
        "stats": {
            "total_tests": total_tests,
            "agents_tested": agents_tested,
            "average_score": avg_score,
            "certified_count": certified_count,
            "conditional_count": conditional_count,
            "not_certified_count": not_certified_count,
            "last_test_at": last_test_at
        },
        "test_history": test_history,
        "score_trend": score_trend
    }


@router.put("/users/{user_id}")
def update_admin_user(user_id: int, req: UpdateUserRequest):
    """Updates user status, role, name, or department."""
    conn = get_db_connection()
    cursor = conn.cursor()

    updates = []
    params = []
    if req.name:
        updates.append("name = ?")
        params.append(req.name.strip())
    if req.email:
        updates.append("email = ?")
        params.append(req.email.strip().lower())
    if req.role and req.role.upper() in ("ADMIN", "USER"):
        updates.append("role = ?")
        params.append(req.role.upper())
    if req.status and req.status in ("Active", "Inactive"):
        updates.append("status = ?")
        params.append(req.status)
    if req.department:
        updates.append("department = ?")
        params.append(req.department)

    if not updates:
        conn.close()
        return {"success": True, "message": "No updates provided"}

    params.append(user_id)
    query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
    cursor.execute(query, params)
    conn.commit()
    conn.close()
    return {"success": True, "user_id": user_id}


@router.get("/agents")
def get_admin_agents():
    """Returns fleet agent summary grouped as 1 instance per agent with full v1, v2, v3... version history."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM agents ORDER BY id ASC")
    agents = [dict(r) for r in cursor.fetchall()]

    cursor.execute("""
    SELECT id, audit_id, user_id, agent_name, tested_by_email, tested_by_name, user_role, mode,
           runs_count, concurrency, phases_selected, trust_score, tier, enterprise_ready,
           critical_count, warning_count, pass_count, info_count, duration_ms, created_at, notes, full_result_json
    FROM test_runs
    ORDER BY created_at ASC, id ASC
    """)
    all_runs = [dict(r) for r in cursor.fetchall()]
    conn.close()

    grouped_agents = group_agents_with_versions(agents, all_runs)
    return {"agents": grouped_agents, "count": len(grouped_agents)}


@router.get("/agents/{agent_id}")
def get_admin_agent_detail(agent_id: int):
    """Returns detailed agent info and version evolution history."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM agents WHERE id = ?", (agent_id,))
    agent = cursor.fetchone()
    if not agent:
        conn.close()
        raise HTTPException(status_code=404, detail="Agent not found")

    ag_dict = dict(agent)
    norm_name = normalize_agent_name(ag_dict["name"])

    cursor.execute("""
    SELECT id, audit_id, user_id, agent_name, tested_by_name, tested_by_email, mode, trust_score, tier,
           critical_count, warning_count, pass_count, info_count, duration_ms, created_at, notes, full_result_json
    FROM test_runs
    ORDER BY created_at ASC, id ASC
    """)
    all_runs = [dict(r) for r in cursor.fetchall()]
    conn.close()

    grouped = group_agents_with_versions([ag_dict], all_runs)
    target_group = grouped[0] if grouped else ag_dict

    return {
        "agent": target_group,
        "stats": {
            "total_tests": target_group.get("total_tests", 0),
            "total_iterations": target_group.get("total_iterations", 0),
            "latest_version": target_group.get("latest_version", "UNTESTED"),
            "first_score": target_group.get("first_score"),
            "latest_score": target_group.get("latest_score"),
            "score_improvement": target_group.get("score_improvement"),
            "avg_score": target_group.get("avg_score", 0.0),
            "best_score": target_group.get("best_score"),
            "lowest_score": target_group.get("lowest_score"),
            "latest_status": target_group.get("latest_status", "UNTESTED"),
            "last_tested": target_group.get("last_tested"),
            "last_tested_by": target_group.get("last_tested_by")
        },
        "version_progression": target_group.get("version_progression", []),
        "history": list(reversed(target_group.get("versions", [])))
    }


@router.get("/analytics")
def get_admin_analytics(days: int = 30):
    """Returns analytics data: test volume, score trend, certification distribution, agent & user rankings."""
    conn = get_db_connection()
    cursor = conn.cursor()

    now = datetime.now(timezone.utc)
    start_dt = (now - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)

    # 1. Single query for all test runs
    cursor.execute("""
    SELECT trust_score, created_at, tier, agent_name, tested_by_name, tested_by_email
    FROM test_runs
    ORDER BY created_at ASC
    """)
    all_runs = [dict(r) for r in cursor.fetchall()]
    conn.close()

    # Pre-populate date buckets
    daily_buckets = {}
    for i in range(days - 1, -1, -1):
        d_obj = now - timedelta(days=i)
        d_key = d_obj.strftime("%Y-%m-%d")
        d_label = d_obj.strftime("%b %d")
        daily_buckets[d_key] = {"date": d_label, "scores": []}

    cert_counts = {"CERTIFIED": 0, "CONDITIONAL": 0, "NOT_CERTIFIED": 0}
    agent_stats = {}
    user_stats = {}

    for r in all_runs:
        c_at = str(r.get("created_at") or "")
        score = float(r["trust_score"]) if r.get("trust_score") is not None else 0.0
        tier = r.get("tier") or ("CERTIFIED" if score >= 80 else "CONDITIONAL" if score >= 70 else "NOT_CERTIFIED")
        agent_name = r.get("agent_name") or "Unknown"
        user_name = r.get("tested_by_name") or "Ismeet"
        user_email = r.get("tested_by_email") or "ismeet@certifyai.in"

        # Certification distribution
        cert_counts[tier] = cert_counts.get(tier, 0) + 1

        # Agent stats
        if agent_name not in agent_stats:
            agent_stats[agent_name] = {"agent_name": agent_name, "scores": [], "test_count": 0}
        agent_stats[agent_name]["scores"].append(score)
        agent_stats[agent_name]["test_count"] += 1

        # User stats
        user_key = user_email.lower()
        if user_key not in user_stats:
            user_stats[user_key] = {"name": user_name, "email": user_email, "scores": [], "test_count": 0}
        user_stats[user_key]["scores"].append(score)
        user_stats[user_key]["test_count"] += 1

        # Match to day bucket
        if c_at:
            d_key = c_at[:10]
            if d_key in daily_buckets:
                daily_buckets[d_key]["scores"].append(score)

    volume_trend = []
    for d_key, b in daily_buckets.items():
        cnt = len(b["scores"])
        avg_s = round(sum(b["scores"]) / cnt, 1) if cnt > 0 else None
        volume_trend.append({
            "date": b["date"],
            "test_count": cnt,
            "avg_score": avg_s
        })

    cert_dist = [{"tier": t, "count": c} for t, c in cert_counts.items() if c > 0]

    agent_rankings = []
    for ag in agent_stats.values():
        agent_rankings.append({
            "agent_name": ag["agent_name"],
            "test_count": ag["test_count"],
            "avg_score": round(sum(ag["scores"]) / len(ag["scores"]), 1) if ag["scores"] else 0.0
        })
    agent_rankings.sort(key=lambda x: x["avg_score"], reverse=True)

    user_rankings = []
    for u in user_stats.values():
        user_rankings.append({
            "name": u["name"],
            "email": u["email"],
            "test_count": u["test_count"],
            "avg_score": round(sum(u["scores"]) / len(u["scores"]), 1) if u["scores"] else 0.0
        })
    user_rankings.sort(key=lambda x: x["test_count"], reverse=True)

    return {
        "days": days,
        "volume_trend": volume_trend,
        "certification_distribution": cert_dist,
        "agent_rankings": agent_rankings,
        "user_rankings": user_rankings
    }


@router.get("/reports")
def get_admin_reports():
    """Returns all audit reports across all users enriched with versioning."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT id, audit_id, user_id, tested_by_name, tested_by_email, agent_name, mode,
           trust_score, tier, critical_count, warning_count, pass_count, duration_ms, created_at, full_result_json
    FROM test_runs
    ORDER BY created_at ASC, id ASC
    """)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    enriched = enrich_test_runs_with_versions(rows)
    enriched_rev = list(reversed(enriched))

    reports = []
    for r in enriched_rev:
        cert_data = None
        if r.get("full_result_json"):
            try:
                full_obj = json.loads(r["full_result_json"])
                cert_data = full_obj.get("cert")
            except Exception:
                pass

        reports.append({
            "id": r["id"],
            "audit_id": r["audit_id"],
            "agent_name": r["agent_name"],
            "canonical_agent_name": r.get("canonical_agent_name", r["agent_name"]),
            "version": r.get("version", "v1"),
            "version_num": r.get("version_num", 1),
            "is_latest": r.get("is_latest", False),
            "score_delta": r.get("score_delta", 0.0),
            "tested_by_name": r["tested_by_name"],
            "tested_by_email": r["tested_by_email"],
            "mode": r["mode"],
            "trust_score": r["trust_score"],
            "tier": r["tier"],
            "critical_count": r["critical_count"],
            "warning_count": r["warning_count"],
            "pass_count": r["pass_count"],
            "created_at": r["created_at"],
            "certificate": cert_data
        })

    return {"reports": reports, "count": len(reports)}


@router.get("/reports/export")
def export_reports(
    format: str = Query(default="csv", pattern="^(csv|json)$"),
    user: Optional[str] = None,
    agent: Optional[str] = None,
    status: Optional[str] = None,
    date_filter: Optional[str] = None
):
    """Exports filtered test activity to CSV or JSON."""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM test_runs WHERE 1=1"
    params = []

    if user and user.lower() != "all":
        query += " AND (LOWER(tested_by_name) LIKE ? OR LOWER(tested_by_email) LIKE ?)"
        params.extend([f"%{user.lower()}%", f"%{user.lower()}%"])

    if agent and agent.lower() != "all":
        query += " AND LOWER(agent_name) LIKE ?"
        params.append(f"%{agent.lower()}%")

    if status and status.upper() != "ALL":
        query += " AND UPPER(tier) = ?"
        params.append(status.strip().upper())

    if date_filter:
        now = datetime.now(timezone.utc)
        if date_filter.lower() == "today":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
            query += " AND created_at >= ?"
            params.append(start)
        elif date_filter.lower() == "7d":
            start = (now - timedelta(days=7)).isoformat()
            query += " AND created_at >= ?"
            params.append(start)
        elif date_filter.lower() == "30d":
            start = (now - timedelta(days=30)).isoformat()
            query += " AND created_at >= ?"
            params.append(start)

    query += " ORDER BY id DESC"
    cursor.execute(query, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    if format == "json":
        clean_rows = []
        for r in rows:
            clean = dict(r)
            if clean.get("full_result_json"):
                try:
                    clean["full_result"] = json.loads(clean["full_result_json"])
                    del clean["full_result_json"]
                except Exception:
                    pass
            clean_rows.append(clean)
        return clean_rows

    # CSV Format
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Audit ID", "User Name", "User Email", "Agent Name", "Mode",
        "Trust Score (%)", "Status Tier", "Critical Failures", "Warnings", "Pass Count",
        "Duration (ms)", "Date (UTC)", "Notes"
    ])

    for r in rows:
        writer.writerow([
            r["id"], r["audit_id"], r["tested_by_name"], r["tested_by_email"],
            r["agent_name"], r["mode"], r["trust_score"], r["tier"],
            r["critical_count"], r["warning_count"], r["pass_count"],
            r["duration_ms"], r["created_at"], r.get("notes", "")
        ])

    csv_data = output.getvalue()
    return PlainTextResponse(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=certifyai_audit_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )
