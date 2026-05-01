"""
audio/tts.py
============
Text-to-Speech pipeline.
Step 1 — Strip all markdown from Claude's answer.
Step 2 — Convert clean text to audio using Gemini TTS.
Step 3 — Return audio bytes (WAV).

Uses gemini-2.5-flash-preview-tts — the dedicated TTS model.
"""

import re
import wave
import struct
from google import genai
from google.genai import types
from config.settings import GEMINI_API_KEY
from utils.debug import log, timer, log_separator

_client = genai.Client(api_key=GEMINI_API_KEY)

# Dedicated TTS model — not the chat model
TTS_MODEL = "gemini-2.5-flash-preview-tts"


# ─────────────────────────────────────────────────────────
# STEP 1 — Markdown Cleaner
# ─────────────────────────────────────────────────────────

def clean_for_tts(markdown_text: str) -> str:
    """Strip all markdown so TTS never reads ## or ** literally."""
    log("TTS-CLEAN", f"Input length: {len(markdown_text)} chars", "info")
    text = markdown_text
    text = re.sub(r'#{1,6}\s*', '', text)
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\*(.*?)\*',     r'\1', text)
    text = re.sub(r'__(.*?)__',     r'\1', text)
    text = re.sub(r'_(.*?)_',       r'\1', text)
    text = re.sub(r'^\s*[-\*\+]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*\d+\.\s+',   '', text, flags=re.MULTILINE)
    text = re.sub(r'→|=>|->',  ',', text)
    text = re.sub(r'—|–',      ',', text)
    text = re.sub(r'\|',       ',', text)
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'`([^`]+)`',      r'\1', text)
    text = re.sub(r'^\s*>\s*',  '', text, flags=re.MULTILINE)
    text = re.sub(r'^[-\*_]{3,}$', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n{2,}', '. ', text)
    text = re.sub(r'\n', ' ', text)
    text = re.sub(r'\.\s*\.+', '.', text)
    text = re.sub(r',\s*,+',   ',', text)
    text = re.sub(r'\s{2,}', ' ', text)
    text = re.sub(r'[#\*\_\[\]\(\)\{\}\\]', '', text)
    result = text.strip()
    log("TTS-CLEAN", f"Output length: {len(result)} chars", "success")
    return result


# ─────────────────────────────────────────────────────────
# STEP 2 — Convert PCM bytes to WAV bytes
# ─────────────────────────────────────────────────────────

def _pcm_to_wav(pcm_data: bytes, sample_rate: int = 24000, channels: int = 1, bits: int = 16) -> bytes:
    """Wrap raw PCM bytes in a proper WAV container so browsers can play it."""
    import io
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(bits // 8)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_data)
    return buf.getvalue()


# ─────────────────────────────────────────────────────────
# STEP 3 — Gemini TTS
# ─────────────────────────────────────────────────────────

@timer("TTS")
def text_to_speech(text: str, voice: str = "Aoede") -> bytes:
    """
    Convert clean plain text to WAV audio using Gemini TTS model.
    Returns WAV bytes. Returns empty bytes if TTS fails.
    """
    log_separator("TTS")
    log("TTS", f"Converting {len(text)} chars | Voice: {voice}", "info")

    if not text.strip():
        log("TTS", "Empty text — skipping", "warn")
        return b""

    # Gemini TTS has a character limit — truncate if needed
    if len(text) > 4500:
        text = text[:4500].rsplit('.', 1)[0] + '.'
        log("TTS", f"Truncated to {len(text)} chars", "warn")

    try:
        response = _client.models.generate_content(
            model=TTS_MODEL,
            contents=text,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice
                        )
                    )
                ),
            ),
        )

        # Response contains raw PCM data — wrap in WAV
        if (response.candidates and
            response.candidates[0].content and
            response.candidates[0].content.parts):

            part = response.candidates[0].content.parts[0]

            if hasattr(part, 'inline_data') and part.inline_data is not None:
                pcm_data = part.inline_data.data
                if pcm_data:
                    wav_data = _pcm_to_wav(pcm_data)
                    log("TTS", f"Audio generated — {len(wav_data)} bytes WAV", "success")
                    return wav_data

        log("TTS", "Response had no audio data", "warn")
        return b""

    except Exception as e:
        log("TTS", f"TTS failed: {e}", "error")
        return b""


# ─────────────────────────────────────────────────────────
# COMBINED — markdown answer → (clean_text, wav_bytes)
# ─────────────────────────────────────────────────────────

def answer_to_audio(
    markdown_answer: str,
    language: str = "en-IN",
    voice: str = "Aoede",
) -> tuple:
    """
    Full pipeline: markdown → clean text → WAV audio bytes.
    Returns (clean_text, audio_bytes).
    audio_bytes is empty if TTS fails — user still sees text.
    """
    log_separator("ANSWER → AUDIO PIPELINE")
    clean_text  = clean_for_tts(markdown_answer)
    audio_bytes = text_to_speech(clean_text, voice)
    return clean_text, audio_bytes