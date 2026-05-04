"""
chats/routes.py
===============
Chat history endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from auth.middleware import require_auth, require_admin
from db.queries import (
    create_chat, get_user_chats, get_all_chats,
    get_chat_messages, update_chat_title
)
from utils.debug import log

router = APIRouter()


# ── GET /chats — user's own chats ─────────────────────────

@router.get("")
async def list_chats(user: dict = Depends(require_auth)):
    """Get all chats for logged in user. Used to populate sidebar."""
    chats = get_user_chats(user["id"])
    log("CHATS", f"Returning {len(chats)} chats for {user['email']}", "info")
    return {"chats": chats}


# ── GET /chats/all — admin sees all users' chats ──────────

@router.get("/all")
async def all_chats(user: dict = Depends(require_admin)):
    """Admin only — get all chats from all users."""
    chats = get_all_chats()
    log("CHATS", f"Admin: returning {len(chats)} total chats", "info")
    return {"chats": chats}


# ── POST /chats — create new chat ─────────────────────────

class CreateChatRequest(BaseModel):
    title: str = "New conversation"


@router.post("")
async def create(req: CreateChatRequest, user: dict = Depends(require_auth)):
    """Create a new chat session. Returns chat_id for frontend to use."""
    chat = create_chat(user["id"], req.title)
    log("CHATS", f"Chat created: {chat['id']} for {user['email']}", "success")
    return chat


# ── GET /chats/{chat_id}/messages ─────────────────────────

@router.get("/{chat_id}/messages")
async def get_messages(chat_id: str, user: dict = Depends(require_auth)):
    """Get all messages in a chat. Used when user clicks a past conversation."""
    messages = get_chat_messages(chat_id)
    log("CHATS", f"Returning {len(messages)} messages for chat {chat_id}", "info")
    return {"messages": messages}


# ── PATCH /chats/{chat_id}/title ──────────────────────────

class UpdateTitleRequest(BaseModel):
    title: str


@router.patch("/{chat_id}/title")
async def update_title(
    chat_id: str,
    req: UpdateTitleRequest,
    user: dict = Depends(require_auth)
):
    """Update chat title — called after first message."""
    update_chat_title(chat_id, req.title)
    return {"ok": True}


from db.queries import (
    create_chat, get_user_chats, get_all_chats,
    get_chat_messages, update_chat_title,
    create_project, get_user_projects, delete_project,
    assign_chat_to_project, get_project_chats
)

# ── GET /chats/projects ───────────────────────────────────
@router.get("/projects")
async def list_projects(user: dict = Depends(require_auth)):
    projects = get_user_projects(user["id"])
    return {"projects": projects}


# ── POST /chats/projects ──────────────────────────────────
class CreateProjectRequest(BaseModel):
    name: str


@router.post("/projects")
async def create(req: CreateProjectRequest, user: dict = Depends(require_auth)):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Project name required.")
    project = create_project(user["id"], req.name.strip())
    return project


# ── DELETE /chats/projects/{id} ───────────────────────────
@router.delete("/projects/{project_id}")
async def delete(project_id: str, user: dict = Depends(require_auth)):
    delete_project(project_id, user["id"])
    return {"ok": True}


# ── PATCH /chats/{chat_id}/project ───────────────────────
class AssignProjectRequest(BaseModel):
    project_id: str


@router.patch("/{chat_id}/project")
async def assign_project(
    chat_id: str,
    req: AssignProjectRequest,
    user: dict = Depends(require_auth)
):
    assign_chat_to_project(chat_id, req.project_id)
    return {"ok": True}


# ── GET /chats/projects/{id}/chats ───────────────────────
@router.get("/projects/{project_id}/chats")
async def project_chats(project_id: str, user: dict = Depends(require_auth)):
    chats = get_project_chats(project_id, user["id"])
    return {"chats": chats}