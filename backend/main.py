"""
main.py
=======
FastAPI application — all endpoints.

Endpoints:
  POST /auth/signup     — create account
  POST /auth/login      — login, get permanent token
  GET  /auth/me         — get current user info

  GET  /chats           — user's chat history
  POST /chats           — create new chat
  GET  /chats/{id}/messages — load a past chat
  PATCH /chats/{id}/title   — update chat title
  GET  /chats/all       — admin: all users' chats

  POST /corrections             — admin: save correction
  GET  /corrections             — admin: list corrections
  PATCH /corrections/{id}/deactivate — admin: turn off correction

  POST /query           — main AI query
  POST /speak           — on-demand TTS
  GET  /health          — health check
"""

import base64
import asyncio
from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager

from api.pipeline import handle_query
from api.router import InputPayload
from audio.tts import clean_for_tts, text_to_speech
from auth.routes import router as auth_router
from auth.middleware import require_auth
from chats.routes import router as chats_router
from corrections.routes import router as corrections_router
from admin.routes import router as admin_router
from db.connection import test_connection
from db.queries import save_message
from config.settings import DEBUG_MODE, TONE_PRESETS
from utils.debug import log, log_separator


@asynccontextmanager
async def lifespan(app: FastAPI):
    log_separator("VIKRAMADITYA AI STARTING")
    log("APP", f"Debug mode: {DEBUG_MODE}", "info")
    log("APP", f"Tones: {list(TONE_PRESETS.keys())}", "info")

    # Test DB connection on startup
    if test_connection():
        log("APP", "Database ready", "success")
    else:
        log("APP", "Database connection FAILED — check .env DB settings", "error")

    log("APP", "Server ready.", "success")
    yield
    log("APP", "Server shutting down.", "warn")


app = FastAPI(
    title="Ai Assistant",
    description="Heritage and Archaeology AI",
    version="4.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register route groups ─────────────────────────────────
app.include_router(auth_router,        prefix="/auth",        tags=["auth"])
app.include_router(chats_router,       prefix="/chats",       tags=["chats"])
app.include_router(corrections_router, prefix="/corrections", tags=["corrections"])
app.include_router(admin_router,       prefix="/admin",       tags=["admin"])


# ── POST /query ───────────────────────────────────────────

@app.post("/query")
async def query(
    text:    str        = Form(default=""),
    tone:    str        = Form(default="normal"),
    chat_id: str        = Form(default=""),
    image:   UploadFile = File(default=None),
    audio:   UploadFile = File(default=None),
    video:   UploadFile = File(default=None),
    user:    dict       = Depends(require_auth),
):
    """
    Main query endpoint — requires authentication.
    Saves user message + AI answer to chat history.
    Checks corrections database before calling AI.
    """
    log_separator("INCOMING REQUEST")
    log("APP", f"User: {user['email']} | text={bool(text)} image={bool(image)} audio={bool(audio)} video={bool(video)} tone={tone}", "info")

    if tone not in TONE_PRESETS:
        tone = "normal"

    # Detect input type for message saving
    input_type = "text"
    if image and audio and video: input_type = "mixed"
    elif image and audio:         input_type = "mixed"
    elif image and video:         input_type = "mixed"
    elif image:                   input_type = "image"
    elif audio:                   input_type = "audio"
    elif video:                   input_type = "video"

    image_bytes = await image.read() if image else None
    image_mime  = image.content_type if image else ""
    audio_bytes = await audio.read() if audio else None
    audio_mime  = audio.content_type if audio else ""
    video_bytes = await video.read() if video else None
    video_mime  = video.content_type if video else ""

    payload = InputPayload(
        text        = text,
        image_bytes = image_bytes,
        image_mime  = image_mime,
        audio_bytes = audio_bytes,
        audio_mime  = audio_mime,
        video_bytes = video_bytes,
        video_mime  = video_mime,
        tone        = tone,
        user_id     = user["id"],
        chat_id     = chat_id,
    )

    result = await handle_query(payload)

    # Save messages to DB if we have a chat_id
    if chat_id:
        try:
            # Save user message
            user_content = text or f"[{input_type} uploaded]"
            save_message(
                chat_id=chat_id,
                user_id=user["id"],
                role="user",
                content=user_content,
                input_type=input_type,
            )
            # Save assistant answer with gemini summary
            save_message(
                chat_id=chat_id,
                user_id=user["id"],
                role="assistant",
                content=result["answer"],
                gemini_summary=result.get("gemini_summary", ""),
                input_type="text",
            )
        except Exception as e:
            log("APP", f"Failed to save messages: {e}", "warn")

    return JSONResponse({
        "answer":         result["answer"],
        "images":         result.get("images", []),
        "gemini_summary": result.get("gemini_summary", ""),
        "route":          result["route"],
        "tone":           result["tone"],
        "error":          result.get("error"),
    })

from fastapi.responses import StreamingResponse

@app.post("/query/stream")
async def query_stream(
    text:    str            = Form(""),
    tone:    str            = Form("normal"),
    chat_id: str            = Form(""),
    image:   UploadFile|None = File(None),
    audio:   UploadFile|None = File(None),
    video:   UploadFile|None = File(None),
    user:    dict           = Depends(require_auth),
):
    """Streaming version of /query."""
    from api.pipeline import run_pipeline_stream
    from api.router import InputPayload
    from db.queries import save_message

    log("APP", f"STREAM User: {user['email']} | tone={tone}", "info")

    image_bytes = await image.read() if image else None
    image_mime  = image.content_type if image else None
    audio_bytes = await audio.read() if audio else None
    audio_mime  = audio.content_type if audio else None
    video_bytes = await video.read() if video else None
    video_mime  = video.content_type if video else None

    payload = InputPayload(
        text=text, tone=tone,
        image_bytes=image_bytes, image_mime=image_mime or "",
        audio_bytes=audio_bytes, audio_mime=audio_mime or "",
        video_bytes=video_bytes, video_mime=video_mime or "",
        user_id=user["id"],
        chat_id=chat_id,
    )
    history = []
    if chat_id:
        try:
            from db.queries import get_recent_messages
            history = get_recent_messages(chat_id, limit=6)
        except Exception as e:
            log("APP", f"History load failed: {e}", "warn") 
    # Save user message before streaming
    if chat_id:
        try:
            # Build content with media placeholders + text
            lines = []
            if image_bytes: lines.append("[Image uploaded]")
            if audio_bytes: lines.append("[Audio uploaded]")
            if video_bytes: lines.append("[Video uploaded]")
            if text and text.strip(): lines.append(text)
            user_content = "\n".join(lines) if lines else ""

            # Detect input_type
            input_type = "text"
            if image_bytes and (audio_bytes or video_bytes): input_type = "mixed"
            elif image_bytes: input_type = "image"
            elif audio_bytes: input_type = "audio"
            elif video_bytes: input_type = "video"

            save_message(chat_id, user["id"], "user", user_content, "", input_type)
        except Exception as e:
            log("APP", f"Save user msg failed: {e}", "warn")

    full_answer = ""

    async def event_stream():
        nonlocal full_answer
        async for chunk in run_pipeline_stream(payload, user["email"], history=history):
            import json
            try:
                obj = json.loads(chunk.strip())
                if obj.get("type") == "text":
                    full_answer += obj["data"]
            except:
                pass
            yield chunk

        # Save AI message after stream complete
        if chat_id and full_answer:
            try:
                save_message(chat_id, user["id"], "assistant", full_answer, "text")
            except Exception as e:
                log("APP", f"Save AI msg failed: {e}", "warn")

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")
# ── POST /speak ───────────────────────────────────────────

class SpeakRequest(BaseModel):
    text:  str
    voice: str = "Aoede"


@app.post("/speak")
async def speak(req: SpeakRequest, user: dict = Depends(require_auth)):
    """On-demand TTS — called when user clicks Speak on a message."""
    log("APP", f"TTS: {len(req.text)} chars | Voice: {req.voice}", "info")

    if not req.text.strip():
        raise HTTPException(status_code=400, detail="No text provided")

    clean_text  = clean_for_tts(req.text)
    audio_bytes = await asyncio.to_thread(text_to_speech, clean_text, req.voice)

    if not audio_bytes:
        raise HTTPException(status_code=500, detail="TTS generation failed")

    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
    return JSONResponse({"audio_b64": audio_b64})


# ── GET /health ───────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "Ai Assistant", "version": "4.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


class UpdateMessageRequest(BaseModel):
    content: str

@app.patch("/messages/{message_id}")
async def update_message(
    message_id: str,
    req: UpdateMessageRequest,
    user: dict = Depends(require_auth),
):
    """Update message content — for edit and regenerate."""
    from db.queries import update_message_content
    update_message_content(message_id, req.content)
    return {"ok": True}