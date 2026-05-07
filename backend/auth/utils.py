"""
auth/utils.py
=============
Password hashing and JWT token handling.
"""

import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
from config.settings import JWT_SECRET, JWT_EXPIRE_HOURS, ADMIN_EMAIL
from utils.debug import log


# ── Password ──────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Hash a plain text password. Never store plain passwords."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain password against stored hash."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception as e:
        log("AUTH", f"Password verify error: {e}", "error")
        return False


# ── JWT ───────────────────────────────────────────────────

def create_token(user_id: str, email: str, role: str = "user") -> str:
    """Create JWT token with role included."""
    expire = datetime.now(timezone.utc) + timedelta(hours=int(JWT_EXPIRE_HOURS))
    payload = {
        "user_id": user_id,
        "email":   email,
        "role":    role,
        "exp":     expire,
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    log("AUTH", f"Token created for {email} | role={role} | expires={expire.date()}", "success")
    return token


def decode_token(token: str) -> dict | None:
    """
    Decode and verify a JWT token.
    Returns payload dict or None if invalid/expired.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        log("AUTH", "Token expired", "warn")
        return None
    except jwt.InvalidTokenError as e:
        log("AUTH", f"Invalid token: {e}", "warn")
        return None


def extract_token(authorization: str | None) -> str | None:
    """Extract token from 'Bearer <token>' header."""
    if not authorization:
        return None
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1]
