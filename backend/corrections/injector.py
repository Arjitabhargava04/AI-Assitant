"""
corrections/injector.py
========================
Correction matching and injection.

Flow:
1. Get all active corrections from DB
2. Send to Claude with current query summary
3. Claude decides which correction is relevant (or none)
4. Return the correct answer to inject into prompt
"""

import anthropic
from db.queries import get_approved_corrections
from config.settings import ANTHROPIC_API_KEY, CLAUDE_MODEL
from utils.debug import log, log_separator, timer

_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


async def find_relevant_correction(
    gemini_summary: str,
    question_text:  str = "",
) -> dict | None:
    """
    Find a relevant correction for the current query.

    Steps:
    1. Fetch all active corrections
    2. If none — return None immediately (no overhead)
    3. Send to Claude — ask which correction is relevant
    4. Return matching correction or None

    Args:
        gemini_summary: what Gemini understood from the current input
        question_text:  original user question text

    Returns:
        Correction dict with correct_answer, or None
    """
    import asyncio

    corrections = get_approved_corrections()

    if not corrections:
        log("INJECT", "No corrections in database — skipping", "info")
        return None

    log_separator("CORRECTION CHECK")
    log("INJECT", f"Checking {len(corrections)} corrections for relevance", "info")

    result = await asyncio.to_thread(
        _claude_relevance_check,
        gemini_summary,
        question_text,
        corrections,
    )

    return result


@timer("INJECT")
def _claude_relevance_check(
    gemini_summary: str,
    question_text:  str,
    corrections:    list,
) -> dict | None:
    """
    Ask Claude which stored correction is relevant to the current query.
    Claude returns a number (1, 2, 3...) or NONE.
    Fast call — Claude just reads and picks, no reasoning needed.
    """
    if not corrections:
        return None

    # Build corrections list for Claude
    corrections_text = ""
    for i, c in enumerate(corrections, 1):
        corrections_text += f"[{i}] Context: {c['gemini_summary'][:300]}\n"
        corrections_text += f"    Correct answer: {c['correct_answer'][:200]}\n\n"

    prompt = f"""You are a relevance checker for a heritage knowledge system.

CURRENT QUERY:
Question: {question_text[:300] if question_text else 'No text question'}
Content identified: {gemini_summary[:400] if gemini_summary else 'No content identified'}

STORED VERIFIED CORRECTIONS:
{corrections_text}

Task: Is any stored correction relevant to the current query?
- Return ONLY a number (1, 2, 3...) if a correction is relevant
- Return ONLY the word NONE if no correction is relevant
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

        log("INJECT", f"Claude relevance answer: '{answer}'", "info")

        if answer == "NONE" or not answer:
            log("INJECT", "No relevant correction found", "info")
            return None

        # Parse number
        try:
            idx = int(answer) - 1
            if 0 <= idx < len(corrections):
                chosen = corrections[idx]
                log("INJECT", f"Correction matched: {chosen['id']}", "success")
                return chosen
        except ValueError:
            log("INJECT", f"Could not parse answer: '{answer}'", "warn")
            return None

    except Exception as e:
        log("INJECT", f"Relevance check failed: {e}", "error")
        return None


def build_correction_prompt_prefix(correction: dict) -> str:
    """
    Build the text to inject at the top of the system prompt.
    Called when a relevant correction is found.
    """
    return f"""VERIFIED FACT — confirmed correct by a heritage expert. Treat as absolute ground truth:

{correction['correct_answer']}

Use this verified information as the foundation of your answer.
Do not contradict it. Do not say it is unverified.
---
"""
