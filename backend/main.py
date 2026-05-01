"""
main.py
=======
FastAPI application.
New endpoints:
  POST /query  — main query (no TTS, returns images if requested)
  POST /speak  — TTS for a specific answer text (on demand)
  GET  /health — health check
  GET  /tones  — available tones
"""

import base64
import asyncio
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager

from api.pipeline import handle_query
from api.router import InputPayload
from audio.tts import clean_for_tts, text_to_speech
from config.settings import DEBUG_MODE, TONE_PRESETS
from utils.debug import log, log_separator


@asynccontextmanager
async def lifespan(app: FastAPI):
    log_separator("VIKRAMADITYA AI STARTING")
    log("APP", f"Debug mode: {DEBUG_MODE}", "info")
    log("APP", f"Available tones: {list(TONE_PRESETS.keys())}", "info")
    log("APP", "Server ready.", "success")
    yield
    log("APP", "Server shutting down.", "warn")


app = FastAPI(
    title="Vikramaditya AI",
    description="Heritage and Archaeology AI — multimodal, two-model pipeline.",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── POST /query ───────────────────────────────────────────

@app.post("/query")
async def query(
    text:  str        = Form(default=""),
    tone:  str        = Form(default="normal"),
    image: UploadFile = File(default=None),
    audio: UploadFile = File(default=None),
    video: UploadFile = File(default=None),
):
    """
    Main query endpoint.
    Accepts text, image, audio, video — any combination.
    Returns answer + optional image URLs.
    TTS is NOT included — use /speak for on-demand audio.
    """
    log_separator("INCOMING REQUEST")
    log("APP", f"text={bool(text)} image={bool(image)} audio={bool(audio)} video={bool(video)} tone={tone}", "info")

    if tone not in TONE_PRESETS:
        tone = "normal"

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
    )

    result = await handle_query(payload)

    return JSONResponse({
        "answer": result["answer"],
        "images": result.get("images", []),
        "route":  result["route"],
        "tone":   result["tone"],
        "error":  result.get("error"),
    })


# ── POST /speak ───────────────────────────────────────────

class SpeakRequest(BaseModel):
    text:  str
    voice: str = "Aoede"


@app.post("/speak")
async def speak(req: SpeakRequest):
    """
    On-demand TTS — converts answer text to audio.
    Called when user clicks Speak button on a specific message.
    Returns base64 WAV audio.
    """
    log("APP", f"TTS request — {len(req.text)} chars | Voice: {req.voice}", "info")

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
    return {"status": "ok", "service": "Vikramaditya AI", "version": "3.0.0"}


# ── GET /tones ────────────────────────────────────────────

@app.get("/tones")
async def get_tones():
    return {"tones": list(TONE_PRESETS.keys())}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
