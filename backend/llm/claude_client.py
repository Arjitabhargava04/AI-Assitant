"""
llm/claude_client.py
====================
Claude client — deep scholarly analysis layer.
Only used for Researcher and Formal tones.
Receives Gemini perception findings as context.
Searches authoritative heritage sources.
"""

import anthropic
import base64
from config.settings import ANTHROPIC_API_KEY, CLAUDE_MODEL, MAX_OUTPUT_TOKENS, TRUSTED_HERITAGE_DOMAINS
from llm.prompts import get_claude_system_prompt
from utils.language import detect_language
from utils.debug import log, log_api_call, timer, log_separator

_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

_TOOL_TRUSTED = {
    "type":            "web_search_20260209",
    "name":            "web_search",
    "allowed_domains": TRUSTED_HERITAGE_DOMAINS,
}

_TOOL_OPEN = {
    "type": "web_search_20260209",
    "name": "web_search",
}


def _encode_image(image_bytes: bytes, mime_type: str) -> dict:
    b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": mime_type, "data": b64},
    }


def _extract_text(response) -> str:
    text = ""
    for block in response.content:
        if getattr(block, "type", "") == "text":
            t = getattr(block, "text", None)
            if t:
                text += t
    return text


def _run_search_pass(system_prompt, messages, tool, pass_name, max_rounds=4):
    """Run one agentic search pass — handles multi-round tool use."""
    log("CLAUDE", f"Starting {pass_name}...", "step")
    msgs = list(messages)

    for round_num in range(1, max_rounds + 1):
        log("CLAUDE", f"{pass_name} round {round_num}", "info")
        response = _client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=MAX_OUTPUT_TOKENS,
            system=system_prompt,
            tools=[tool],
            messages=msgs,
        )

        if response.stop_reason == "end_turn":
            result = _extract_text(response)
            log("CLAUDE", f"{pass_name} done — {len(result)} chars", "success")
            return result

        if response.stop_reason == "tool_use":
            for block in response.content:
                if getattr(block, "type", "") == "tool_use":
                    q = getattr(block, "input", {}).get("query", "")
                    log("CLAUDE", f"{pass_name} searched: '{q}'", "warn")

            msgs.append({"role": "assistant", "content": response.content})
            tool_results = [
                {"type": "tool_result", "tool_use_id": b.id, "content": ""}
                for b in response.content
                if getattr(b, "type", "") == "tool_use"
            ]
            if tool_results:
                msgs.append({"role": "user", "content": tool_results})
            continue

        return _extract_text(response)

    return ""


@timer("CLAUDE")
def call_claude_deep(
    gemini_findings:   str,
    user_question:     str,
    image_bytes:       bytes = None,
    image_mime:        str   = "",
    tone:              str   = "researcher",
    correction_prefix: str   = "",
) -> str:
    """
    Claude deep analysis — only for Researcher/Formal tones.

    Args:
        gemini_findings: structured output from Gemini perception
        user_question:   original user question
        image_bytes:     original image (Claude sees it too for independent verification)
        image_mime:      image mime type
        tone:            researcher or formal
        correction_prefix: prefix for correcting the answer
    Returns:
        Deep scholarly answer string
    """
    log_separator("CLAUDE DEEP ANALYSIS")
    language      = detect_language(user_question) if user_question else "english"
    system_prompt = get_claude_system_prompt(tone, language)
    if correction_prefix:
        system_prompt = correction_prefix + "\n\n" + system_prompt
        log("CLAUDE", "Correction prefix injected into system prompt", "success")

    log("CLAUDE", f"Tone: {tone} | Lang: {language} | Has image: {bool(image_bytes)}", "info")

    # Build user content
    content = []

    # Pass Gemini findings + original question only
    full_text = ""
    if gemini_findings:
        full_text += f"[Perception Findings]\n{gemini_findings}\n\n"
    full_text += f"[User Question]\n{user_question}"
    content.append({"type": "text", "text": full_text})
    log("CLAUDE", "Image not — Gemini findings used instead", "info")

    base_messages = [{"role": "user", "content": content}]

    try:
        # Pass 1 — trusted heritage sources
        trusted_result = _run_search_pass(
            system_prompt, base_messages, _TOOL_TRUSTED, "TRUSTED"
        )

        # Pass 2 — open web for any gaps
        open_result = _run_search_pass(
            system_prompt, base_messages, _TOOL_OPEN, "OPEN"
        )

        # Final synthesis
        combined = ""
        if trusted_result:
            combined += f"[Authoritative Sources]\n{trusted_result}\n\n"
        if open_result:
            combined += f"[Additional Research]\n{open_result}\n\n"

        if not combined.strip():
            final_messages = base_messages
        else:
            final_messages = [
                {"role": "user",      "content": content},
                {"role": "assistant", "content": [{"type": "text", "text": combined}]},
                {"role": "user",      "content": [{"type": "text", "text":
                    "Using all the above research and your expertise, write a complete scholarly answer. "
                    "Never mention where information came from."
                }]},
            ]

        final = _client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=MAX_OUTPUT_TOKENS,
            system=system_prompt,
            messages=final_messages,
        )

        answer = _extract_text(final).strip()
        log_api_call(CLAUDE_MODEL, f"lang={language} tone={tone}", len(answer))
        return answer

    except anthropic.APIError as e:
        log("CLAUDE", f"API Error: {e}", "error")
        raise
    except Exception as e:
        log("CLAUDE", f"Error: {e}", "error")
        raise
