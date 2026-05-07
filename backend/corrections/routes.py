"""
corrections/routes.py"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from auth.middleware import require_admin, require_super_admin
from db.queries import (
    save_correction_v2, get_corrections_for_super_admin,
    get_corrections_by_user, approve_correction,
    deactivate_correction, update_correction
)
from utils.debug import log

router = APIRouter()


class SaveCorrectionRequest(BaseModel):
    gemini_summary: str
    correct_answer: str
    question_text:  str = ""
    input_type:     str = "text"


@router.post("")
async def save(req: SaveCorrectionRequest, user: dict = Depends(require_admin)):
    """
    Save a correction.
    Super admin → status = approved immediately.
    Small admin → status = pending, needs super admin approval.
    """
    if not req.gemini_summary.strip():
        raise HTTPException(status_code=400, detail="gemini_summary is required.")
    if not req.correct_answer.strip():
        raise HTTPException(status_code=400, detail="correct_answer is required.")

    status = "approved" if user["is_super"] else "pending"

    correction = save_correction_v2(
        gemini_summary = req.gemini_summary,
        correct_answer = req.correct_answer,
        question_text  = req.question_text,
        submitted_by   = user["id"],
        status         = status,
        input_type     = req.input_type,
    )
    log("CORRECTIONS", f"Saved: {correction['id']} | status={status}", "success")
    return {"ok": True, "correction": correction}


@router.get("")
async def list_corrections(
    submitted_by: str = None,
    user: dict = Depends(require_super_admin)
):
    """
    Super admin — get all corrections.
    Optional filter: ?submitted_by=user_id
    """
    corrections = get_corrections_for_super_admin(submitted_by)
    return {"corrections": corrections}


@router.get("/mine")
async def my_corrections(user: dict = Depends(require_admin)):
    """Small admin — get only their own corrections."""
    corrections = get_corrections_by_user(user["id"])
    return {"corrections": corrections}


@router.patch("/{correction_id}/approve")
async def approve(correction_id: str, user: dict = Depends(require_super_admin)):
    """Super admin approves a pending correction — makes it live."""
    approve_correction(correction_id)
    return {"ok": True}


@router.patch("/{correction_id}/deactivate")
async def deactivate(correction_id: str, user: dict = Depends(require_super_admin)):
    """Super admin deactivates — sets back to pending."""
    from db.queries import update_correction_status
    update_correction_status(correction_id, "pending")
    return {"ok": True}


@router.delete("/{correction_id}")
async def delete_correction(correction_id: str, user: dict = Depends(require_super_admin)):
    """Super admin permanently deletes a correction."""
    from db.queries import hard_delete_correction
    hard_delete_correction(correction_id)
    return {"ok": True}


class UpdateCorrectionRequest(BaseModel):
    correct_answer: str


@router.patch("/{correction_id}/update")
async def update(
    correction_id: str,
    req: UpdateCorrectionRequest,
    user: dict = Depends(require_admin)
):
    """
    Small admin edits their correction → back to pending.
    Super admin edits → stays approved.
    """
    new_status = "approved" if user["is_super"] else "pending"
    update_correction(correction_id, req.correct_answer, new_status)
    return {"ok": True}