"""
admin/routes.py
===============
Super admin only routes.
Manage small admins — create, list, remove.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from auth.middleware import require_super_admin
from db.queries import (
    get_all_small_admins, get_user_by_email,
    set_user_role, get_corrections_by_user,
    get_tuning_sessions_by_user, get_all_users,
    create_user
)
from utils.debug import log

router = APIRouter()


@router.get("/small-admins")
async def list_small_admins(user: dict = Depends(require_super_admin)):
    """List all small admins."""
    admins = get_all_small_admins()
    return {"admins": admins}


class CreateSmallAdminRequest(BaseModel):
    email:        str
    password:     str
    display_name: str


@router.post("/small-admins")
async def create_small_admin(
    req: CreateSmallAdminRequest,
    user: dict = Depends(require_super_admin)
):
    """Create a brand new small admin account with email and password."""
    from auth.utils import hash_password

    if not req.email or "@" not in req.email:
        raise HTTPException(status_code=400, detail="Invalid email address.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if not req.display_name.strip():
        raise HTTPException(status_code=400, detail="Display name is required.")

    existing = get_user_by_email(req.email)
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    hashed  = hash_password(req.password)
    new_user = create_user(req.email, hashed, req.display_name.strip())
    set_user_role(new_user["id"], "small_admin")

    log("ADMIN", f"Small admin created: {req.email}", "success")
    return {
        "ok": True,
        "user": {
            "id":           new_user["id"],
            "email":        new_user["email"],
            "display_name": new_user["display_name"],
        }
    }

@router.delete("/small-admins/{admin_id}")
async def remove_small_admin(admin_id: str, user: dict = Depends(require_super_admin)):
    """Remove small_admin role — demotes back to user."""
    set_user_role(admin_id, "user")
    log("ADMIN", f"Small admin removed: {admin_id}", "warn")
    return {"ok": True}


@router.get("/small-admins/{admin_id}/corrections")
async def admin_corrections(admin_id: str, user: dict = Depends(require_super_admin)):
    """See all corrections submitted by a specific small admin."""
    corrections = get_corrections_by_user(admin_id)
    return {"corrections": corrections}


@router.get("/small-admins/{admin_id}/sessions")
async def admin_sessions(admin_id: str, user: dict = Depends(require_super_admin)):
    """See all tuning sessions by a specific small admin."""
    sessions = get_tuning_sessions_by_user(admin_id)
    return {"sessions": sessions}


@router.get("/users")
async def list_users(user: dict = Depends(require_super_admin)):
    """Get all regular users."""
    users = get_all_users()
    return {"users": users}

@router.get("/users/{user_id}/chats")
async def user_chats(user_id: str, user: dict = Depends(require_super_admin)):
    """See all chats of a specific user."""
    from db.queries import get_user_chats
    chats = get_user_chats(user_id)
    return {"chats": chats}