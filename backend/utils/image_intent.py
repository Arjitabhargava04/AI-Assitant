"""
utils/image_intent.py
=====================
Detects image intent and count from raw user query.
Runs BEFORE any API call — pure Python, instant, zero cost.
"""

import re
from config.settings import IMAGE_INTENT_KEYWORDS, MAX_IMAGES_SHOWN
from utils.debug import log


def detect_image_intent(text: str) -> tuple:
    """
    Detect if user wants images and how many.

    Returns:
        (wants_images: bool, count: int)

    Rules:
        - No mention of images → False, 0
        - Mentions images, no count → True, 1
        - Mentions count → True, min(count, MAX_IMAGES_SHOWN)
        - Count > MAX_IMAGES_SHOWN → capped at MAX_IMAGES_SHOWN
    """
    if not text:
        return False, 0

    query_lower = text.lower()

    # Check if any image intent keyword present
    wants_images = any(kw in query_lower for kw in IMAGE_INTENT_KEYWORDS)

    if not wants_images:
        log("INTENT", "No image intent detected", "info")
        return False, 0

    # Extract number from query
    count = _extract_count(query_lower)
    log("INTENT", f"Image intent detected — count: {count}", "warn")
    return True, count


def _extract_count(text: str) -> int:
    """
    Extract how many images user wants.
    Default is 1 if no number mentioned.
    Cap at MAX_IMAGES_SHOWN.
    """
    # Word numbers
    word_map = {
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
        # Hindi numbers
        "ek": 1, "do": 2, "teen": 3, "char": 4, "paanch": 5,
        # Signals for many
        "many": MAX_IMAGES_SHOWN, "several": MAX_IMAGES_SHOWN,
        "multiple": MAX_IMAGES_SHOWN, "some": 3,
        "bahut": MAX_IMAGES_SHOWN, "kuch": 3,
        "saari": MAX_IMAGES_SHOWN, "sab": MAX_IMAGES_SHOWN,
    }

    for word, num in word_map.items():
        if word in text:
            return min(num, MAX_IMAGES_SHOWN)

    # Digit numbers
    digits = re.findall(r'\b(\d+)\b', text)
    if digits:
        return min(int(digits[0]), MAX_IMAGES_SHOWN)

    # Default — user asked for images but no count specified
    return 1
