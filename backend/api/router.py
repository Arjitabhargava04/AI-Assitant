"""
api/router.py
=============
Input type detector and route decision engine.
Handles all 16 combinations of T, I, V, A inputs.
Reduces to 3 clean routes + audio output flag.
"""

from utils.debug import log, log_route, log_separator

# ── Supported MIME types ──────────────────────────────────
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
AUDIO_TYPES = {"audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg",
               "audio/webm", "audio/m4a", "audio/aac"}
VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime",
               "video/avi", "video/mov", "video/mkv"}

ROUTES = {
    "route_a": "Claude only       (text / image)",
    "route_b": "Gemini only       (audio / video)",
    "route_c": "Gemini → Claude   (mixed inputs)",
    "empty":   "No input          (ask user)",
}


class InputPayload:
    """
    Structured container for a single user request.
    Built from the raw FastAPI request fields.
    """
    def __init__(
        self,
        text:            str   = "",
        image_bytes:     bytes = None,
        image_mime:      str   = "",
        audio_bytes:     bytes = None,
        audio_mime:      str   = "",
        video_bytes:     bytes = None,
        video_mime:      str   = "",
        wants_audio_out: bool  = False,
        tone:            str   = "normal",
    ):
        self.text            = text.strip() if text else ""
        self.image_bytes     = image_bytes
        self.image_mime      = image_mime
        self.audio_bytes     = audio_bytes
        self.audio_mime      = audio_mime
        self.video_bytes     = video_bytes
        self.video_mime      = video_mime
        self.wants_audio_out = wants_audio_out
        self.tone            = tone

        # ── Derived flags ──────────────────────────────────
        self.has_text  = bool(self.text)
        self.has_image = bool(self.image_bytes)
        self.has_audio = bool(self.audio_bytes)
        self.has_video = bool(self.video_bytes)

    def summary(self) -> str:
        parts = []
        if self.has_text:  parts.append(f"TEXT({len(self.text)}chars)")
        if self.has_image: parts.append(f"IMAGE({len(self.image_bytes)}bytes)")
        if self.has_audio: parts.append(f"AUDIO({len(self.audio_bytes)}bytes)")
        if self.has_video: parts.append(f"VIDEO({len(self.video_bytes)}bytes)")
        return " + ".join(parts) if parts else "EMPTY"


def detect_route(payload: InputPayload) -> dict:
    """
    Core routing function.
    All 16 T/I/V/A combinations reduce to 3 routes.

    Route A — Claude only       (only text/image present)
    Route B — Gemini only       (only audio/video present)
    Route C — Gemini → Claude   (mixed: AV + TI both present)
    Empty   — No input at all

    Returns:
        {
          "route":       "route_a" | "route_b" | "route_c" | "empty",
          "audio_out":   bool,
          "description": str,
        }
    """
    log_separator("ROUTING")
    log("ROUTER", f"Payload: {payload.summary()}", "info")

    has_av = payload.has_audio or payload.has_video    # needs Gemini
    has_ti = payload.has_text  or payload.has_image    # needs Claude

    # Auto audio output — if user sent voice, reply with voice
    audio_out = payload.wants_audio_out or payload.has_audio

    if not has_av and not has_ti:
        route = "empty"

    elif has_av and has_ti:
        # Mixed — both model types needed
        route = "route_c"

    elif has_av:
        # Only audio/video — Gemini handles alone
        route = "route_b"

    else:
        # Only text/image — Claude handles alone
        route = "route_a"

    log_route(
        payload.has_text, payload.has_image,
        payload.has_audio, payload.has_video,
        audio_out, route
    )
    log("ROUTER", ROUTES[route], "success")

    return {
        "route":       route,
        "audio_out":   audio_out,
        "description": ROUTES[route],
    }


def validate_payload(payload: InputPayload) -> tuple[bool, str]:
    """
    Validate input before routing.
    Returns (is_valid, error_message).
    """
    from config.settings import (
        MAX_IMAGE_SIZE_MB, MAX_AUDIO_SIZE_MB, MAX_VIDEO_SIZE_MB
    )

    log("VALIDATOR", "Validating payload...", "step")

    if payload.has_image:
        size_mb = len(payload.image_bytes) / (1024 * 1024)
        if size_mb > MAX_IMAGE_SIZE_MB:
            return False, f"Image too large ({size_mb:.1f}MB). Max {MAX_IMAGE_SIZE_MB}MB."
        if payload.image_mime not in IMAGE_TYPES:
            return False, f"Unsupported image type: {payload.image_mime}"

    if payload.has_audio:
        size_mb = len(payload.audio_bytes) / (1024 * 1024)
        if size_mb > MAX_AUDIO_SIZE_MB:
            return False, f"Audio too large ({size_mb:.1f}MB). Max {MAX_AUDIO_SIZE_MB}MB."
        if payload.audio_mime not in AUDIO_TYPES:
            return False, f"Unsupported audio type: {payload.audio_mime}"

    if payload.has_video:
        size_mb = len(payload.video_bytes) / (1024 * 1024)
        if size_mb > MAX_VIDEO_SIZE_MB:
            return False, f"Video too large ({size_mb:.1f}MB). Max {MAX_VIDEO_SIZE_MB}MB."
        if payload.video_mime not in VIDEO_TYPES:
            return False, f"Unsupported video type: {payload.video_mime}"

    log("VALIDATOR", "Payload valid.", "success")
    return True, ""
