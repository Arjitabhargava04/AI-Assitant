"""
utils/language.py
=================
Language detector — English, Hindi, Hinglish.
Used to tell Claude which language to reply in.
NOT used for search triggering — Claude decides search itself.
"""

from config.settings import HINDI_UNICODE_START, HINDI_UNICODE_END, HINGLISH_MARKERS
from utils.debug import log


def detect_language(text: str) -> str:
    """
    Detect if text is English, Hindi, or Hinglish.

    Returns:
        "hindi"    — mostly Devanagari script
        "hinglish" — mix of English + Hindi words/style
        "english"  — standard English
    """
    if not text or not text.strip():
        return "english"

    text_clean = text.strip().lower()
    words      = text_clean.split()
    total_chars = len(text.replace(" ", ""))

    # Count Devanagari characters (Hindi script)
    hindi_chars = sum(
        1 for ch in text
        if HINDI_UNICODE_START <= ord(ch) <= HINDI_UNICODE_END
    )

    hindi_ratio = hindi_chars / total_chars if total_chars > 0 else 0

    # Pure Hindi — more than 40% Devanagari characters
    if hindi_ratio > 0.40:
        log("LANG", f"Detected: HINDI (Devanagari ratio: {hindi_ratio:.0%})", "info")
        return "hindi"

    # Hinglish — has some Devanagari OR contains Hinglish marker words
    hinglish_word_count = sum(1 for w in words if w in HINGLISH_MARKERS)
    hinglish_word_ratio = hinglish_word_count / len(words) if words else 0

    if hindi_ratio > 0 or hinglish_word_ratio >= 0.25:
        log("LANG", f"Detected: HINGLISH (markers: {hinglish_word_count}/{len(words)})", "info")
        return "hinglish"

    log("LANG", "Detected: ENGLISH", "info")
    return "english"


def get_language_instruction(language: str) -> str:
    """
    Returns the language instruction to include in Claude's system prompt.
    Tells Claude exactly which language and style to use for the reply.
    """
    instructions = {
        "english": (
            "Reply in clear English."
        ),
        "hindi": (
            "उपयोगकर्ता ने हिंदी में पूछा है। "
            "कृपया पूरा उत्तर हिंदी में दें। "
            "सरल और स्पष्ट हिंदी का उपयोग करें। "
            "तकनीकी शब्दों के लिए अंग्रेजी शब्द रख सकते हैं।"
        ),
        "hinglish": (
            "The user is writing in Hinglish (mix of Hindi and English). "
            "Reply naturally in Hinglish — the way a knowledgeable Indian friend would speak. "
            "Example style: 'Yeh temple Chola dynasty ne banaya tha, jo ki bahut powerful the 9th century mein.' "
            "Do not be too formal. Keep it conversational and natural."
        ),
    }
    return instructions.get(language, instructions["english"])