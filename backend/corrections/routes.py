"""
corrections/routes.py
=====================
Correction endpoints — admin only.
Save corrections, list them, deactivate wrong ones.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from auth.middleware import require_admin
from db.queries import save_correction, get_all_corrections, deactivate_correction
from corrections.injector import find_relevant_correction
from utils.debug import log, log_separator

router = APIRouter()


# ── POST /corrections — save a new correction ─────────────

class SaveCorrectionRequest(BaseModel):
    gemini_summary: str   # what Gemini understood from the question
    correct_answer: str   # what admin typed as correct answer
    input_type:     str = "text"


@router.post("")
async def save(req: SaveCorrectionRequest, user: dict = Depends(require_admin)):
    """
    Admin saves a correction.
    Called when admin presses No and submits the correct answer text box.
    """
    log_separator("SAVE CORRECTION")
    log("CORRECTIONS", f"Admin saving correction | type={req.input_type}", "info")

    if not req.gemini_summary.strip():
        raise HTTPException(status_code=400, detail="gemini_summary is required.")
    if not req.correct_answer.strip():
        raise HTTPException(status_code=400, detail="correct_answer is required.")

    correction = save_correction(
        gemini_summary=req.gemini_summary,
        correct_answer=req.correct_answer,
        input_type=req.input_type,
    )
    log("CORRECTIONS", f"Saved: {correction['id']}", "success")
    return {"ok": True, "correction": correction}


# ── GET /corrections — list all corrections ───────────────

@router.get("")
async def list_corrections(user: dict = Depends(require_admin)):
    """Admin views all saved corrections."""
    corrections = get_all_corrections()
    log("CORRECTIONS", f"Returning {len(corrections)} corrections", "info")
    return {"corrections": corrections}


# ── PATCH /corrections/{id}/deactivate ───────────────────

@router.patch("/{correction_id}/deactivate")
async def deactivate(correction_id: str, user: dict = Depends(require_admin)):
    """Admin deactivates a wrong correction — stops it being injected."""
    deactivate_correction(correction_id)
    return {"ok": True}


# ── POST /corrections/check — check if correction exists ──

class CheckRequest(BaseModel):
    gemini_summary: str
    question_text:  str = ""


@router.post("/check")
async def check_correction(req: CheckRequest, user: dict = Depends(require_admin)):
    """
    Admin can test if a correction would be found for a given summary.
    Useful for verifying correction matching works.
    """
    result = await find_relevant_correction(req.gemini_summary, req.question_text)
    return {"correction_found": result is not None, "correction": result}
