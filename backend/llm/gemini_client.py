"""
llm/gemini_client.py
====================
Gemini client — perception and answer layer.

For Normal/Concise/Explanatory: answers directly.
For Researcher/Formal: returns structured findings for Claude.
For AV extraction (Route C): transcribes and describes.
"""

from google import genai
from google.genai import types
from config.settings import GEMINI_API_KEY, GEMINI_MODEL
from llm.prompts import (
    get_gemini_system_prompt,
    get_gemini_perception_prompt,
    get_gemini_av_extraction_prompt,
)
from utils.language import detect_language
from utils.debug import log, log_api_call, timer, log_separator

_client = genai.Client(api_key=GEMINI_API_KEY)

_SEARCH_TOOL = types.Tool(google_search=types.GoogleSearch())

_SAFETY_OFF = [
    types.SafetySetting(category="HARM_CATEGORY_HARASSMENT",        threshold="BLOCK_NONE"),
    types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH",       threshold="BLOCK_NONE"),
    types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_NONE"),
    types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_NONE"),
]


def _build_parts(
    text:        str   = "",
    image_bytes: bytes = None,
    image_mime:  str   = "",
    audio_bytes: bytes = None,
    audio_mime:  str   = "",
    video_bytes: bytes = None,
    video_mime:  str   = "",
) -> list:
    """Build Gemini content parts from available inputs."""
    parts = []
    if image_bytes and image_mime:
        parts.append(types.Part.from_bytes(data=image_bytes, mime_type=image_mime))
        log("GEMINI", f"Image: {len(image_bytes)} bytes | {image_mime}", "info")
    if audio_bytes and audio_mime:
        parts.append(types.Part.from_bytes(data=audio_bytes, mime_type=audio_mime))
        log("GEMINI", f"Audio: {len(audio_bytes)} bytes | {audio_mime}", "info")
    if video_bytes and video_mime:
        parts.append(types.Part.from_bytes(data=video_bytes, mime_type=video_mime))
        log("GEMINI", f"Video: {len(video_bytes)} bytes | {video_mime}", "info")
    if text:
        parts.append(types.Part.from_text(text=text))
    return parts


@timer("GEMINI")
def call_gemini_direct(
    text:        str   = "",
    image_bytes: bytes = None,
    image_mime:  str   = "",
    audio_bytes: bytes = None,
    audio_mime:  str   = "",
    video_bytes: bytes = None,
    video_mime:  str   = "",
    tone:        str   = "normal",
) -> str:
    """
    Gemini answers directly — for Normal/Concise/Explanatory tones.
    Google Search grounding always ON.
    Returns complete answer string.
    """
    log_separator("GEMINI DIRECT")
    language      = detect_language(text) if text else "english"
    system_prompt = get_gemini_system_prompt(tone, language)
    parts         = _build_parts(text, image_bytes, image_mime, audio_bytes, audio_mime, video_bytes, video_mime)

    if not parts:
        return ""

    log("GEMINI", f"Tone: {tone} | Lang: {language} | Parts: {len(parts)}", "info")

    response = _client.models.generate_content(
        model=GEMINI_MODEL,
        contents=parts,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.3,
            max_output_tokens=4096,
            tools=[_SEARCH_TOOL],
            safety_settings=_SAFETY_OFF,
        ),
    )

    result = (response.text or "").strip()
    log_api_call(GEMINI_MODEL, f"direct lang={language}", len(result))
    return result


@timer("GEMINI-PERCEPTION")
def call_gemini_perception(
    text:        str   = "",
    image_bytes: bytes = None,
    image_mime:  str   = "",
    audio_bytes: bytes = None,
    audio_mime:  str   = "",
    video_bytes: bytes = None,
    video_mime:  str   = "",
) -> str:
    """
    Gemini as perception layer — for Researcher/Formal tones.
    Returns structured findings for Claude to analyse deeply.
    Google Search grounding ON for identification.
    """
    log_separator("GEMINI PERCEPTION")
    language      = detect_language(text) if text else "english"
    system_prompt = get_gemini_perception_prompt(language)
    parts         = _build_parts(text, image_bytes, image_mime, audio_bytes, audio_mime, video_bytes, video_mime)

    if not parts:
        return ""

    log("GEMINI", f"Perception mode | Lang: {language} | Parts: {len(parts)}", "info")

    response = _client.models.generate_content(
        model=GEMINI_MODEL,
        contents=parts,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.1,
            max_output_tokens=2048,
            tools=[_SEARCH_TOOL],
            safety_settings=_SAFETY_OFF,
        ),
    )

    result = (response.text or "").strip()
    log("GEMINI", f"Perception findings: {len(result)} chars", "success")
    return result


@timer("GEMINI-AV")
def extract_av_context(
    audio_bytes: bytes = None,
    audio_mime:  str   = "",
    video_bytes: bytes = None,
    video_mime:  str   = "",
    text:        str   = "",
) -> str:
    """
    AV extraction for Route C — transcribes and describes AV content.
    Returns structured text context for Claude.
    """
    log_separator("GEMINI AV EXTRACTION")
    parts = _build_parts(
        text=get_gemini_av_extraction_prompt(),
        audio_bytes=audio_bytes, audio_mime=audio_mime,
        video_bytes=video_bytes, video_mime=video_mime,
    )
    if text:
        parts.append(types.Part.from_text(text=f"User question: {text}"))

    if not parts:
        return ""

    response = _client.models.generate_content(
        model=GEMINI_MODEL,
        contents=parts,
        config=types.GenerateContentConfig(
            temperature=0.1,
            max_output_tokens=2048,
            safety_settings=_SAFETY_OFF,
        ),
    )

    result = (response.text or "").strip()
    log("GEMINI-AV", f"Extracted {len(result)} chars", "success")
    return result

