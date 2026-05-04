"""
auth/middleware.py
==================
JWT authentication dependency for FastAPI routes.
Use as: user = Depends(require_auth)
Use as: user = Depends(require_admin)
"""

from fastapi import Header, HTTPException, Depends
from auth.utils import extract_token, decode_token
from db.queries import get_user_by_id
from utils.debug import log


async def require_auth(authorization: str | None = Header(default=None)) -> dict:
    """
    FastAPI dependency — requires valid JWT token.
    Returns user dict from database.
    Raises 401 if token missing, invalid, or user not found.
    """
    token = extract_token(authorization)
    if not token:
        log("AUTH", "No token provided", "warn")
        raise HTTPException(status_code=401, detail="Not authenticated. Please log in.")

    payload = decode_token(token)
    if not payload:
        log("AUTH", "Token decode failed", "warn")
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")

    user = get_user_by_id(payload["user_id"])
    if not user:
        log("AUTH", f"User not found: {payload['user_id']}", "warn")
        raise HTTPException(status_code=401, detail="User not found.")

    # Attach admin status from token
    user["is_admin"] = payload.get("is_admin", False)
    return user


async def require_admin(user: dict = Depends(require_auth)) -> dict:
    """
    FastAPI dependency — requires admin user.
    Raises 403 if user is not admin.
    """
    if not user.get("is_admin"):
        log("AUTH", f"Admin access denied for {user.get('email')}", "warn")
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user
