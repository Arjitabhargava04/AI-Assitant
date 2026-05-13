"""
config/settings.py
==================
Central configuration — all keys, models, limits.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── API Keys ──────────────────────────────────────────────
ANTHROPIC_API_KEY   = os.getenv("ANTHROPIC_API_KEY", "")
GEMINI_API_KEY      = os.getenv("GEMINI_API_KEY", "")
GOOGLE_VISION_KEY   = os.getenv("GOOGLE_VISION_KEY", "")
GOOGLE_SEARCH_KEY   = os.getenv("GOOGLE_SEARCH_KEY", "")   # Custom Search API key
GOOGLE_SEARCH_CX    = os.getenv("GOOGLE_SEARCH_CX", "")    # Custom Search Engine ID

# ── Models ────────────────────────────────────────────────
CLAUDE_MODEL  = os.getenv("CLAUDE_MODEL",  "claude-sonnet-4-6")
# for testing 
# CLAUDE_MODEL = os.getenv("CLAUDE_MODEL",  "claude-haiku-4-5-20251001")
GEMINI_MODEL  = os.getenv("GEMINI_MODEL",  "gemini-3.1-flash-lite-preview")
TTS_MODEL     = "gemini-2.5-flash-preview-tts"

# ── Limits ────────────────────────────────────────────────
MAX_IMAGE_SIZE_MB  = 20
MAX_AUDIO_SIZE_MB  = 100
MAX_VIDEO_SIZE_MB  = 500
MAX_OUTPUT_TOKENS  = 4096
MAX_IMAGES_SHOWN   = 5    # hard cap on image results

# ── Debug ─────────────────────────────────────────────────
DEBUG_MODE = os.getenv("DEBUG_MODE", "true").lower() == "true"

# ── Tone presets ──────────────────────────────────────────
TONE_PRESETS = {
    "normal":      "Explain clearly and engagingly for a general audience.",
    "researcher":  "Provide scholarly, citation-aware analysis with technical depth, academic terminology, iconographic detail, and cross-references to related monuments or texts.",
    "concise":     "Answer in brief, factual bullet points. No elaboration.",
    "explanatory": "Explain step by step as if teaching a curious student visiting the site for the first time.",
    "formal":      "Use formal academic language appropriate for official heritage documentation.",
}

# ── Researcher tones — always route to Claude ─────────────
DEEP_TONES = {"researcher", "formal"}

# ── Trusted heritage domains for Claude search ────────────
TRUSTED_HERITAGE_DOMAINS = [
    "asi.nic.in", "indiaculture.gov.in", "nmaindia.gov.in",
    "incredibleindia.org", "whc.unesco.org", "icomos.org",
    "britishmuseum.org", "metmuseum.org", "louvre.fr",
    "vam.ac.uk", "clevelandart.org", "asia.si.edu",
    "britannica.com", "wikipedia.org", "worldhistory.org",
    "ancient.eu", "jstor.org",
]

# ── Image intent keywords ─────────────────────────────────
# Detected from raw user query BEFORE any API call
IMAGE_INTENT_KEYWORDS = [
    # English
    "image", "images", "photo", "photos", "picture", "pictures",
    "show me", "show image", "show photo", "show picture",
    "how does it look", "what does it look like", "visual",
    "see it", "see the", "display", "illustration",
    # Hindi
    "दिखाओ", "तस्वीर", "फोटो", "इमेज", "चित्र",
    # Hinglish
    "dikhao", "dikha", "photo dikhao", "image dikhao",
    "dekhna", "dekh", "kaise dikhta", "kaisi dikhti",
]

# ── Hindi/Hinglish detection ──────────────────────────────
HINDI_UNICODE_START = 0x0900
HINDI_UNICODE_END   = 0x097F

HINGLISH_MARKERS = [
    "kya", "kaise", "kahan", "kaun", "kitna", "kyun", "kab",
    "batao", "bolo", "btao", "chahiye", "dijiye", "dikhao", "dikha",
    "hai", "hain", "nahi", "nahin", "haan", "bilkul",
    "tha", "thi",
    "aur", "lekin", "toh", "magar",
    "mein", "wala", "wali",
    "yeh", "woh", "unka", "uska", "iska",
    "abhi", "phir", "bahut", "thoda", "zyada",
    "matlab", "samjhe", "pata", "lagta",
]

# ── Database ──────────────────────────────────────────────
DB_HOST     = os.getenv("DB_HOST",     "127.0.0.1")
DB_PORT     = os.getenv("DB_PORT",     "3306")
DB_USER     = os.getenv("DB_USER",     "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME     = os.getenv("DB_NAME",     "vikramaditya")

# ── Auth ──────────────────────────────────────────────────
JWT_SECRET       = os.getenv("JWT_SECRET",       "change_this_to_a_long_random_string")
JWT_EXPIRE_HOURS = os.getenv("JWT_EXPIRE_HOURS", "8760")   # 1 year = permanent login
ADMIN_EMAIL      = os.getenv("ADMIN_EMAIL",      "")
