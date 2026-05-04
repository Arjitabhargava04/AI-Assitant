"""
auth/routes.py
==============
Authentication endpoints — signup, login, me.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from auth.utils import hash_password, verify_password, create_token
from auth.middleware import require_auth
from db.queries import create_user, get_user_by_email
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


# ── POST /auth/signup ─────────────────────────────────────

@router.post("/signup")
async def signup(req: SignupRequest):
    log_separator("SIGNUP")
    log("AUTH", f"Signup attempt: {req.email}", "info")

    if not req.email or "@" not in req.email:
        raise HTTPException(status_code=400, detail="Invalid email address.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    existing = get_user_by_email(req.email)
    if existing:
        log("AUTH", f"Email already exists: {req.email}", "warn")
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    display  = req.display_name.strip() or req.email.split("@")[0]
    hashed   = hash_password(req.password)
    user     = create_user(req.email, hashed, display)
    token    = create_token(user["id"], user["email"])

    # ── FIXED: compare against ADMIN_EMAIL not against itself ──
    is_admin = user["email"].lower().strip() == ADMIN_EMAIL.lower().strip()

    log("AUTH", f"Signup successful: {req.email} | admin={is_admin}", "success")

    return {
        "token":        token,
        "user_id":      user["id"],
        "email":        user["email"],
        "display_name": user["display_name"],
        "is_admin":     is_admin,
    }


# ── POST /auth/login ──────────────────────────────────────

@router.post("/login")
async def login(req: LoginRequest):
    log_separator("LOGIN")
    log("AUTH", f"Login attempt: {req.email}", "info")

    user = get_user_by_email(req.email)
    if not user:
        log("AUTH", f"Email not found: {req.email}", "warn")
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not verify_password(req.password, user["password_hash"]):
        log("AUTH", f"Wrong password for: {req.email}", "warn")
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token    = create_token(user["id"], user["email"])
    is_admin = user["email"].lower().strip() == ADMIN_EMAIL.lower().strip()

    log("AUTH", f"Login successful: {req.email} | admin={is_admin}", "success")

    return {
        "token":        token,
        "user_id":      user["id"],
        "email":        user["email"],
        "display_name": user["display_name"],
        "is_admin":     is_admin,
    }


# ── GET /auth/me ──────────────────────────────────────────

@router.get("/me")
async def me(user: dict = Depends(require_auth)):
    is_admin = user["email"].lower().strip() == ADMIN_EMAIL.lower().strip()
    return {
        "user_id":      user["id"],
        "email":        user["email"],
        "display_name": user["display_name"],
        "is_admin":     is_admin,
    }