from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime, timezone
from database import get_db_connection, hash_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str
    remember_me: Optional[bool] = True


@router.post("/login")
def login(req: LoginRequest):
    """Authenticates user (Syed as ADMIN or Manohar as USER) and returns profile + token."""
    conn = get_db_connection()
    cursor = conn.cursor()

    raw_ident = req.email.strip().lower()
    pw_hash = hash_password(req.password)

    # Allow email or short username ('syed', 'ismeet', 'manohar', 'admin', 'user')
    cursor.execute("""
    SELECT id, name, email, role, status, department, avatar_url, password_hash
    FROM users
    WHERE LOWER(email) = ? OR LOWER(name) = ?
    """, (raw_ident, raw_ident))

    user = cursor.fetchone()

    # Fallback shortcuts: 'admin'/'syed' maps to Syed, 'user'/'ismeet' maps to Ismeet
    if not user:
        if raw_ident in ("admin", "syed", "syed@certifyai.in", "admin@company.com"):
            cursor.execute("SELECT id, name, email, role, status, department, avatar_url, password_hash FROM users WHERE role = 'ADMIN' LIMIT 1")
            user = cursor.fetchone()
        elif raw_ident in ("user", "ismeet", "ismeet@certifyai.in", "manohar", "manohar@certifyai.in", "user@company.com"):
            cursor.execute("SELECT id, name, email, role, status, department, avatar_url, password_hash FROM users WHERE role = 'USER' LIMIT 1")
            user = cursor.fetchone()

    if not user:
        conn.close()
        raise HTTPException(status_code=401, detail="User account not found. Please check username/email.")

    # Password check (also support demo default passwords: admin / user / ismeet123 / syed123)
    valid_pass = (user["password_hash"] == pw_hash) or \
                 (user["role"] == "ADMIN" and req.password in ("admin", "syed123", "password123")) or \
                 (user["role"] == "USER" and req.password in ("user", "ismeet123", "manohar123", "password123"))

    if not valid_pass:
        # Log failure
        cursor.execute("""
        INSERT INTO activity_logs (timestamp, event_type, user_id, user_email, user_name, details, status)
        VALUES (?, 'LOGIN_FAILURE', ?, ?, ?, 'Failed login attempt: invalid password', 'FAILED')
        """, (datetime.now(timezone.utc).isoformat(), user["id"], user["email"], user["name"]))
        conn.commit()
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid password.")

    if user["status"] != "Active":
        conn.close()
        raise HTTPException(status_code=403, detail="User account is deactivated. Contact Administrator.")

    now_iso = datetime.now(timezone.utc).isoformat()
    cursor.execute("UPDATE users SET last_login = ? WHERE id = ?", (now_iso, user["id"]))

    cursor.execute("""
    INSERT INTO activity_logs (timestamp, event_type, user_id, user_email, user_name, details, status)
    VALUES (?, 'USER_LOGIN', ?, ?, ?, 'User authenticated successfully', 'SUCCESS')
    """, (now_iso, user["id"], user["email"], user["name"]))

    conn.commit()
    conn.close()

    token = f"certifyai_tok_{user['role'].lower()}_{uuid.uuid4().hex}"

    return {
        "success": True,
        "token": token,
        "user_id": str(user["id"]),
        "name": user["name"],
        "role": user["role"],
        "user": {
            "id": user["id"],
            "user_id": str(user["id"]),
            "name": user["name"],
            "full_name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "status": user["status"],
            "department": user["department"],
            "avatar_url": user["avatar_url"],
            "last_login": now_iso
        }
    }


@router.get("/me")
def get_current_user(authorization: Optional[str] = Header(default=None)):
    """Returns the authenticated profile from session token or returns default demo user."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # If token contains role hint or token is provided
    if authorization and "admin" in authorization.lower():
        cursor.execute("SELECT id, name, email, role, status, department, avatar_url, last_login FROM users WHERE role = 'ADMIN' LIMIT 1")
    else:
        cursor.execute("SELECT id, name, email, role, status, department, avatar_url, last_login FROM users WHERE role = 'USER' LIMIT 1")

    user = cursor.fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return {
        "success": True,
        "user_id": str(user["id"]),
        "name": user["name"],
        "role": user["role"],
        "user": {
            "id": user["id"],
            "user_id": str(user["id"]),
            "name": user["name"],
            "full_name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "status": user["status"],
            "department": user["department"],
            "avatar_url": user["avatar_url"],
            "last_login": user["last_login"]
        }
    }


@router.post("/logout")
def logout():
    return {"success": True, "message": "Logged out successfully"}
