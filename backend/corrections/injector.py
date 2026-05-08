# """
# corrections/injector.py
# ========================
# Correction matching and injection.

# Flow:
# 1. Get all active corrections from DB
# 2. Send to Claude with current query summary
# 3. Claude decides which correction is relevant (or none)
# 4. Return the correct answer to inject into prompt
# """

# import anthropic
# from db.queries import get_approved_corrections
# from config.settings import ANTHROPIC_API_KEY, CLAUDE_MODEL
# from utils.debug import log, log_separator, timer

# _client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


# async def find_relevant_correction(
#     gemini_summary: str,
#     question_text:  str = "",
# ) -> dict | None:
#     """
#     Find a relevant correction for the current query.

#     Steps:
#     1. Fetch all active corrections
#     2. If none — return None immediately (no overhead)
#     3. Send to Claude — ask which correction is relevant
#     4. Return matching correction or None

#     Args:
#         gemini_summary: what Gemini understood from the current input
#         question_text:  original user question text

#     Returns:
#         Correction dict with correct_answer, or None
#     """
#     import asyncio

#     corrections = get_approved_corrections()

#     if not corrections:
#         log("INJECT", "No corrections in database — skipping", "info")
#         return None

#     log_separator("CORRECTION CHECK")
#     log("INJECT", f"Checking {len(corrections)} corrections for relevance", "info")

#     result = await asyncio.to_thread(
#         _claude_relevance_check,
#         gemini_summary,
#         question_text,
#         corrections,
#     )

#     return result


# @timer("INJECT")
# def _claude_relevance_check(
#     gemini_summary: str,
#     question_text:  str,
#     corrections:    list,
# ) -> dict | None:
#     """
#     Ask Claude which stored correction is relevant to the current query.
#     Claude returns a number (1, 2, 3...) or NONE.
#     Fast call — Claude just reads and picks, no reasoning needed.
#     """
#     if not corrections:
#         return None

#     # Build corrections list for Claude
#     corrections_text = ""
#     for i, c in enumerate(corrections, 1):
#         corrections_text += f"[{i}] Context: {c['gemini_summary'][:300]}\n"
#         corrections_text += f"    Correct answer: {c['correct_answer'][:200]}\n\n"

#     prompt = f"""You are a relevance checker for a heritage knowledge system.

# CURRENT QUERY:
# Question: {question_text[:300] if question_text else 'No text question'}
# Content identified: {gemini_summary[:400] if gemini_summary else 'No content identified'}

# STORED VERIFIED CORRECTIONS:
# {corrections_text}

# Task: Is any stored correction relevant to the current query?
# - Return ONLY a number (1, 2, 3...) if a correction is relevant
# - Return ONLY the word NONE if no correction is relevant
# - Do not explain. Do not add any other text.

# Answer:"""

#     try:
#         response = _client.messages.create(
#             model=CLAUDE_MODEL,
#             max_tokens=10,
#             messages=[{"role": "user", "content": prompt}],
#         )

#         answer = ""
#         for block in response.content:
#             if getattr(block, "type", "") == "text":
#                 answer = (block.text or "").strip().upper()
#                 break

#         log("INJECT", f"Claude relevance answer: '{answer}'", "info")

#         if answer == "NONE" or not answer:
#             log("INJECT", "No relevant correction found", "info")
#             return None

#         # Parse number
#         try:
#             idx = int(answer) - 1
#             if 0 <= idx < len(corrections):
#                 chosen = corrections[idx]
#                 log("INJECT", f"Correction matched: {chosen['id']}", "success")
#                 return chosen
#         except ValueError:
#             log("INJECT", f"Could not parse answer: '{answer}'", "warn")
#             return None

#     except Exception as e:
#         log("INJECT", f"Relevance check failed: {e}", "error")
#         return None


# def build_correction_prompt_prefix(correction: dict) -> str:
#     """
#     Build the text to inject at the top of the system prompt.
#     Called when a relevant correction is found.
#     """
#     return f"""VERIFIED FACT — confirmed correct by a heritage expert. Treat as absolute ground truth:

# {correction['correct_answer']}

# Use this verified information as the foundation of your answer.
# Do not contradict it. Do not say it is unverified.
# ---
# """


"""
corrections/injector.py
========================
New keyword-based correction matching system.

Flow:
1. Get all approved corrections from DB
2. Split user query + image summary into words
3. Remove common words
4. Match against correction search_words
5. 95%+ → inject directly
6. 80-94% → Claude verify → inject or skip
7. Below 80% → skip
"""

import re
import anthropic
from db.queries import get_approved_corrections
from config.settings import ANTHROPIC_API_KEY, CLAUDE_MODEL
from utils.debug import log, log_separator, timer

_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

COMMON_WORDS = {
    "the", "a", "an", "is", "are", "was", "were", "who", "what",
    "when", "where", "tell", "about", "how", "why", "me", "this",
    "that", "it", "in", "of", "and", "or", "but", "for", "with",
    "to", "by", "from", "on", "at", "be", "do", "did", "have",
    "has", "had", "will", "would", "could", "should", "which",
    "than", "then", "there", "their", "its", "not", "also",
    "into", "after", "before", "between", "during", "through",
    "over", "under", "again", "further", "once", "built", "build",
    "know", "give", "information", "history", "ancient", "made",
    "known", "called", "located", "found", "used", "i", "you",
    "he", "she", "we", "they", "my", "your", "his", "her", "our",
    "them", "him", "us", "can", "may", "might", "shall", "been", "being"
}

HIGH_THRESHOLD   = 95
MEDIUM_THRESHOLD = 80


def split_words(text: str) -> set:
    """Split text into meaningful words — remove common words."""
    if not text:
        return set()
    words = re.findall(r'\b[a-z0-9]+\b', text.lower())
    return {w for w in words if w not in COMMON_WORDS and len(w) > 2}


def match_percentage(user_words: set, correction_words: set) -> float:
    """
    Calculate match percentage.
    = matching words / total user words * 100
    """
    if not user_words:
        return 0.0
    matching = user_words & correction_words
    return (len(matching) / len(user_words)) * 100


async def find_relevant_correction(
    question_text:  str = "",
    gemini_summary: str = "",
    image_summary:  str = "",
    input_type:     str = "text",
) -> dict | None:
    """
    Find relevant correction using keyword matching.
    
    Args:
        question_text:  user typed question
        gemini_summary: gemini findings (for researcher tone)
        image_summary:  short gemini summary of image (new)
        input_type:     text | image | audio | video
    
    Returns:
        Correction dict or None
    """
    import asyncio

    # Audio and video — skip correction check completely
    if input_type in ("audio", "video"):
        log("INJECT", "Audio/Video query — skipping correction check", "info")
        return None

    corrections = get_approved_corrections()
    if not corrections:
        log("INJECT", "No approved corrections — skipping", "info")
        return None

    log_separator("CORRECTION CHECK")
    log("INJECT", f"Checking {len(corrections)} corrections", "info")

    # Build user words from query + image summary
    combined_user_text = f"{question_text} {image_summary}".strip()
    user_words = split_words(combined_user_text)

    if not user_words:
        log("INJECT", "No meaningful words in query — skipping", "info")
        return None

    log("INJECT", f"User words: {user_words}", "info")

    best_correction = None
    best_score      = 0.0

    for correction in corrections:
        stored_words_str = correction.get("search_words", "") or ""
        if not stored_words_str:
            continue

        stored_words = set(stored_words_str.split(","))
        score = match_percentage(user_words, stored_words)

        log("INJECT", f"Correction {correction['id'][:8]}... score: {score:.1f}%", "info")

        if score > best_score:
            best_score      = score
            best_correction = correction

    if best_score >= HIGH_THRESHOLD:
        log("INJECT", f"HIGH match {best_score:.1f}% — injecting directly", "success")
        return best_correction

    elif best_score >= MEDIUM_THRESHOLD:
        log("INJECT", f"MEDIUM match {best_score:.1f}% — Claude verifying", "info")
        result = await asyncio.to_thread(
            _claude_verify,
            question_text,
            image_summary,
            best_correction,
        )
        return result

    else:
        log("INJECT", f"LOW match {best_score:.1f}% — skipping", "info")
        return None


@timer("INJECT-VERIFY")
def _claude_verify(
    question_text:  str,
    image_summary:  str,
    correction:     dict,
) -> dict | None:
    """
    Claude verification for 80-94% matches.
    Returns correction if relevant, None if not.
    """
    prompt = f"""You are a relevance checker for a heritage knowledge system.

CURRENT QUERY:
Question: {question_text[:300] if question_text else 'No text question'}
Image summary: {image_summary[:300] if image_summary else 'No image'}

CANDIDATE CORRECTION:
Question this correction is for: {correction.get('question_text', '')[:300]}
Verified correct answer: {correction.get('correct_answer', '')[:300]}

Task: Is this correction relevant to the current query?
- Return ONLY: 1 (if relevant)
- Return ONLY: NONE (if not relevant)
- Do not explain. Do not add any other text.

Answer:"""

    try:
        response = _client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=10,
            messages=[{"role": "user", "content": prompt}],
        )
        answer = ""
        for block in response.content:
            if getattr(block, "type", "") == "text":
                answer = (block.text or "").strip().upper()
                break

        log("INJECT", f"Claude verify answer: '{answer}'", "info")

        if answer == "1":
            log("INJECT", "Claude confirmed relevant", "success")
            return correction
        else:
            log("INJECT", "Claude said not relevant", "info")
            return None

    except Exception as e:
        log("INJECT", f"Claude verify failed: {e}", "error")
        return None


def build_correction_prompt_prefix(correction: dict) -> str:
    """
    Build injection text for system prompt.
    Only correct answer — never wrong answer.
    """
    return f"""VERIFIED HERITAGE CORRECTION — confirmed by expert:

Question context: {correction.get('question_text', '')}
Verified correct answer: {correction.get('correct_answer', '')}

Treat as absolute ground truth.
Do not contradict it.
Build your answer using this as foundation.
---
"""
