"""
api/router.py
=============
Input type detector and route decision engine.
All 16 T/I/V/A combinations → 3 routes.
"""

from utils.debug import log, log_route, log_separator

IMAGE_TYPES = {"image/jpeg","image/png","image/webp","image/gif"}
AUDIO_TYPES = {"audio/mpeg","audio/mp3","audio/wav","audio/ogg","audio/webm","audio/m4a","audio/aac"}
VIDEO_TYPES = {"video/mp4","video/webm","video/quicktime","video/avi","video/mov","video/mkv"}

ROUTES = {
    "route_a": "Gemini direct — text/image",
    "route_b": "Gemini direct — audio/video",
    "route_c": "Gemini AV extract → final model",
    "empty":   "No input",
}


class InputPayload:
    def __init__(
        self,
        text="", image_bytes=None, image_mime="",
        audio_bytes=None, audio_mime="",
        video_bytes=None, video_mime="",
        tone="normal", user_id="", chat_id="",
    ):
        self.text        = text.strip() if text else ""
        self.image_bytes = image_bytes
        self.image_mime  = image_mime
        self.audio_bytes = audio_bytes
        self.audio_mime  = audio_mime
        self.video_bytes = video_bytes
        self.video_mime  = video_mime
        self.tone        = tone
        self.user_id     = user_id
        self.chat_id     = chat_id

        self.has_text  = bool(self.text)
        self.has_image = bool(self.image_bytes)
        self.has_audio = bool(self.audio_bytes)
        self.has_video = bool(self.video_bytes)

    def summary(self):
        parts = []
        if self.has_text:  parts.append(f"TEXT({len(self.text)}chars)")
        if self.has_image: parts.append(f"IMAGE({len(self.image_bytes)}bytes)")
        if self.has_audio: parts.append(f"AUDIO({len(self.audio_bytes)}bytes)")
        if self.has_video: parts.append(f"VIDEO({len(self.video_bytes)}bytes)")
        return " + ".join(parts) if parts else "EMPTY"


def detect_route(payload: InputPayload) -> dict:
    log_separator("ROUTING")
    log("ROUTER", f"Payload: {payload.summary()}", "info")

    has_av = payload.has_audio or payload.has_video
    has_ti = payload.has_text  or payload.has_image

    if not has_av and not has_ti:
        route = "empty"
    elif has_av and has_ti:
        route = "route_c"
    elif has_av:
        route = "route_b"
    else:
        route = "route_a"

    log_route(payload.has_text, payload.has_image, payload.has_audio, payload.has_video, False, route)
    log("ROUTER", ROUTES[route], "success")
    return {"route": route, "description": ROUTES[route]}


def validate_payload(payload: InputPayload) -> tuple:
    from config.settings import MAX_IMAGE_SIZE_MB, MAX_AUDIO_SIZE_MB, MAX_VIDEO_SIZE_MB
    log("VALIDATOR", "Validating payload...", "step")

    if payload.has_image:
        mb = len(payload.image_bytes) / (1024*1024)
        if mb > MAX_IMAGE_SIZE_MB:
            return False, f"Image too large ({mb:.1f}MB). Max {MAX_IMAGE_SIZE_MB}MB."
        if payload.image_mime not in IMAGE_TYPES:
            return False, f"Unsupported image type: {payload.image_mime}"

    if payload.has_audio:
        mb = len(payload.audio_bytes) / (1024*1024)
        if mb > MAX_AUDIO_SIZE_MB:
            return False, f"Audio too large ({mb:.1f}MB). Max {MAX_AUDIO_SIZE_MB}MB."

    if payload.has_video:
        mb = len(payload.video_bytes) / (1024*1024)
        if mb > MAX_VIDEO_SIZE_MB:
            return False, f"Video too large ({mb:.1f}MB). Max {MAX_VIDEO_SIZE_MB}MB."

    log("VALIDATOR", "Payload valid.", "success")
    return True, ""
