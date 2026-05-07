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
    token = extract_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Session expired.")

    user = get_user_by_id(payload["user_id"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")

    user["role"]     = payload.get("role", "user")
    user["is_admin"] = user["role"] in ("super_admin", "small_admin")
    user["is_super"] = user["role"] == "super_admin"
    return user


async def require_admin(user: dict = Depends(require_auth)) -> dict:
    """Requires small_admin OR super_admin."""
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user


async def require_super_admin(user: dict = Depends(require_auth)) -> dict:
    """Requires super_admin only."""
    if not user.get("is_super"):
        raise HTTPException(status_code=403, detail="Super admin access required.")
    return user