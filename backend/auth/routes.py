"""
auth/routes.py
==============
Authentication endpoints — signup, login, me.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from auth.utils import hash_password, verify_password, create_token
from auth.middleware import require_auth
from db.queries import create_user, get_user_by_email, set_user_role, get_user_role
from config.settings import ADMIN_EMAIL
from utils.debug import log, log_separator

router = APIRouter()


class SignupRequest(BaseModel):
    email:        str
    password:     str
    display_name: str = ""


class LoginRequest(BaseModel):
    email:    str
    password: str


def _resolve_role(email: str, db_role: str) -> str:
    """
    Super admin email from .env always gets super_admin role.
    Otherwise use whatever is in the database.
    """
    if email.lower().strip() == ADMIN_EMAIL.lower().strip():
        return "super_admin"
    return db_role or "user"


@router.post("/signup")
async def signup(req: SignupRequest):
    log_separator("SIGNUP")
    if not req.email or "@" not in req.email:
        raise HTTPException(status_code=400, detail="Invalid email address.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    existing = get_user_by_email(req.email)
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    display = req.display_name.strip() or req.email.split("@")[0]
    hashed  = hash_password(req.password)
    user    = create_user(req.email, hashed, display)

    role = _resolve_role(req.email, "user")
    if role == "super_admin":
        set_user_role(user["id"], "super_admin")

    token = create_token(user["id"], user["email"], role)
    log("AUTH", f"Signup: {req.email} | role={role}", "success")

    return {
        "token":        token,
        "user_id":      user["id"],
        "email":        user["email"],
        "display_name": user["display_name"],
        "role":         role,
        "is_admin":     role in ("super_admin", "small_admin"),
        "is_super":     role == "super_admin",
    }


@router.post("/login")
async def login(req: LoginRequest):
    log_separator("LOGIN")
    user = get_user_by_email(req.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    db_role = get_user_role(user["id"])
    role    = _resolve_role(req.email, db_role)

    if role == "super_admin" and db_role != "super_admin":
        set_user_role(user["id"], "super_admin")

    token = create_token(user["id"], user["email"], role)
    log("AUTH", f"Login: {req.email} | role={role}", "success")

    return {
        "token":        token,
        "user_id":      user["id"],
        "email":        user["email"],
        "display_name": user["display_name"],
        "role":         role,
        "is_admin":     role in ("super_admin", "small_admin"),
        "is_super":     role == "super_admin",
    }


@router.get("/me")
async def me(user: dict = Depends(require_auth)):
    role = user.get("role", "user")
    return {
        "user_id":      user["id"],
        "email":        user["email"],
        "display_name": user["display_name"],
        "role":         role,
        "is_admin":     role in ("super_admin", "small_admin"),
        "is_super":     role == "super_admin",
    }