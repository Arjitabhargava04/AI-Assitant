"""
api/pipeline.py
===============
Main pipeline orchestrator.

Routing:
  Tone = researcher/formal → Gemini perception + Claude deep analysis
  Tone = normal/concise/explanatory → Gemini answers directly

Image search runs in parallel with main answer when user requests images.
TTS is removed from pipeline — handled per-message in /speak endpoint.
"""

import asyncio
from api.router import InputPayload, detect_route, validate_payload
from vision.image_search import reverse_image_search
from vision.web_images import fetch_and_verify_images, build_image_search_query
from utils.image_intent import detect_image_intent
from config.settings import DEEP_TONES
from utils.debug import log, log_separator
from corrections.injector import find_relevant_correction, build_correction_prompt_prefix
from db.queries import save_message, get_recent_messages
from llm.gemini_client import call_gemini_direct, call_gemini_perception, call_gemini_direct_stream,extract_av_context
from llm.claude_client import call_claude_deep, call_claude_deep_stream

async def handle_query(payload: InputPayload) -> dict:
    """
    Main pipeline entry point.

    Returns:
    {
        "answer":  str,          # markdown answer
        "images":  list,         # verified image URLs (may be empty)
        "route":   str,
        "tone":    str,
        "error":   str | None,
    }
    """
    log_separator("PIPELINE START")
    log("PIPELINE", f"Payload: {payload.summary()} | Tone: {payload.tone}", "info")

    # Validate
    is_valid, error_msg = validate_payload(payload)
    if not is_valid:
        return _error(error_msg)

    # Detect image intent from raw query — before any API call
    wants_images, image_count = detect_image_intent(payload.text or "")
    log("PIPELINE", f"Image intent: {wants_images} | Count: {image_count}", "info")

    # Route detection
    routing = detect_route(payload)
    route   = routing["route"]

    if route == "empty":
        return _error("Please send a question, image, audio, or video about a heritage site.")

    # Check tone — determines model path
    use_deep = payload.tone in DEEP_TONES

    # Check corrections database before calling AI
    correction_prefix = ""
    gemini_summary    = ""
    correction_input_type = "text"
    if payload.audio_bytes and not payload.image_bytes:
        correction_input_type = "audio"
    elif payload.video_bytes and not payload.image_bytes:
        correction_input_type = "video"
    elif payload.image_bytes:
        correction_input_type = "image"

    # For image queries — get short Gemini summary for matching
    image_summary = ""
    if payload.image_bytes and correction_input_type == "image":
        try:
            image_summary = await asyncio.to_thread(
                _get_image_summary_for_correction,
                payload.image_bytes,
                payload.image_mime,
                payload.text or "",
            )
            log("PIPELINE", f"Image summary for correction: {image_summary[:100]}", "info")
        except Exception as e:
            log("PIPELINE", f"Image summary failed (non-fatal): {e}", "warn")

    try:
        correction = await find_relevant_correction(
            question_text  = payload.text or "",
            gemini_summary = payload.text or "",
            image_summary  = image_summary,
            input_type     = correction_input_type,
        )
        if correction:
            correction_prefix = build_correction_prompt_prefix(correction)
            log("PIPELINE", "Correction found — injecting into prompt", "success")
        else:
            log("PIPELINE", "No correction found", "info")
    except Exception as e:
        log("PIPELINE", f"Correction check failed (non-fatal): {e}", "warn")

    try:
        if use_deep:
            answer, gemini_summary = await _deep_path(payload, route, correction_prefix)
        else:
            answer, gemini_summary = await _direct_path(payload, route, correction_prefix)
    except Exception as e:
        log("PIPELINE", f"Failed: {e}", "error")
        return _error(f"Something went wrong: {e}")

    if not answer:
        return _error("The model returned an empty response. Please try again.")

    log("PIPELINE", f"Answer: {len(answer)} chars", "success")

    # Image search — runs if user requested images
    images = []
    if wants_images and image_count > 0:
        images = await _fetch_images(
            payload, answer, image_count
        )

    log_separator("PIPELINE COMPLETE")

    return {
        "answer":         answer,
        "images":         images,
        "gemini_summary": gemini_summary,
        "route":          route,
        "tone":           payload.tone,
        "error":          None,
    }


async def _direct_path(payload: InputPayload, route: str, correction_prefix: str = "") -> tuple:
    """
    Normal/Concise/Explanatory — Gemini answers directly.
    Vision runs in parallel if image present.
    """
    log("PIPELINE", f"DIRECT PATH | Route: {route}", "route")

    # Run Vision in parallel if image present
    vision_task = None
    if payload.has_image:
        vision_task = asyncio.create_task(
            asyncio.to_thread(reverse_image_search, payload.image_bytes)
        )

    if route == "route_b":
        # Audio/Video only — Gemini handles directly
        answer = await asyncio.to_thread(
            call_gemini_direct,
            payload.text or "",
            None, "",
            payload.audio_bytes, payload.audio_mime,
            payload.video_bytes, payload.video_mime,
            payload.tone,
            None,
            correction_prefix,
        )

    elif route == "route_c":
        # Mixed — extract AV context first, then Gemini with everything
        av_context = await asyncio.to_thread(
            extract_av_context,
            payload.audio_bytes, payload.audio_mime,
            payload.video_bytes, payload.video_mime,
            payload.text or "",
        )
        combined_text = f"{payload.text or ''}\n\n[AV Context]\n{av_context}".strip()
        answer = await asyncio.to_thread(
            call_gemini_direct,
            combined_text,
            payload.image_bytes, payload.image_mime,
            None, "", None, "",
            payload.tone,
            None,
            correction_prefix,
        )

    else:
        # Route A — text/image
        # Wait for Vision if running
        vision_context = ""
        if vision_task:
            vision_context = await vision_task
            log("PIPELINE", f"Vision context: {len(vision_context)} chars", "info")

        # Build enriched text
        enriched_text = payload.text or ""
        if vision_context:
            enriched_text = f"{enriched_text}\n\n[Visual Web Context]\n{vision_context}".strip()

        history = []
        if payload.chat_id:
            history = get_recent_messages(payload.chat_id, limit=6)

        answer = await asyncio.to_thread(
            call_gemini_direct,
            enriched_text,
            payload.image_bytes, payload.image_mime,
            None, "", None, "",
            payload.tone,
            history,
            correction_prefix,
        )

    return answer, ""


async def _deep_path(payload: InputPayload, route: str, correction_prefix: str = "") -> tuple:
    """
    Researcher/Formal — Gemini perception + Claude deep analysis.
    Vision runs in parallel with Gemini perception.
    """
    log("PIPELINE", f"DEEP PATH | Route: {route} | Tone: {payload.tone}", "route")

    # Run Vision and Gemini perception in parallel
    tasks = {}

    if payload.has_image:
        tasks["vision"] = asyncio.create_task(
            asyncio.to_thread(reverse_image_search, payload.image_bytes)
        )

    # Gemini perception
    if route == "route_b":
        tasks["gemini"] = asyncio.create_task(
            asyncio.to_thread(
                call_gemini_perception,
                payload.text or "", None, "",
                payload.audio_bytes, payload.audio_mime,
                payload.video_bytes, payload.video_mime,
            )
        )
    elif route == "route_c":
        # AV extraction first
        av_context = await asyncio.to_thread(
            extract_av_context,
            payload.audio_bytes, payload.audio_mime,
            payload.video_bytes, payload.video_mime,
            payload.text or "",
        )
        combined_text = f"{payload.text or ''}\n\n[AV Context]\n{av_context}".strip()
        tasks["gemini"] = asyncio.create_task(
            asyncio.to_thread(
                call_gemini_perception,
                combined_text,
                payload.image_bytes, payload.image_mime,
            )
        )
    else:
        tasks["gemini"] = asyncio.create_task(
            asyncio.to_thread(
                call_gemini_perception,
                payload.text or "",
                payload.image_bytes, payload.image_mime,
            )
        )

    # Wait for both to complete
    results = {}
    for name, task in tasks.items():
        results[name] = await task

    gemini_findings = results.get("gemini", "")
    vision_context  = results.get("vision", "")

    log("PIPELINE", f"Gemini findings: {len(gemini_findings)} chars", "success")
    log("PIPELINE", f"Vision context: {len(vision_context)} chars", "success")

    # Combine findings for Claude
    combined_findings = ""
    if gemini_findings:
        combined_findings += f"[Gemini Analysis]\n{gemini_findings}\n\n"
    if vision_context:
        combined_findings += f"[Visual Web Match]\n{vision_context}"

    # Claude deep analysis
    answer = await asyncio.to_thread(
        call_claude_deep,
        combined_findings.strip(),
        payload.text or "",
        payload.image_bytes,
        payload.image_mime,
        payload.tone,
        correction_prefix,
    )

    return answer, gemini_findings


async def _fetch_images(
    payload:     InputPayload,
    answer:      str,
    count:       int,
) -> list:
    """
    Fetch and verify images in parallel.
    Uses answer text for better search query.
    """
    log("PIPELINE", f"Fetching {count} images...", "step")

    # Build search query from answer + user query + vision context
    search_query = build_image_search_query(
        user_query     = payload.text or "",
        gemini_context = answer[:400],
    )

    images = await fetch_and_verify_images(
        search_query = search_query,
        count        = count,
        context      = answer[:200],
    )

    log("PIPELINE", f"Images ready: {len(images)}", "success")
    return images

def _get_image_summary_for_correction(
    image_bytes: bytes,
    image_mime:  str,
    user_text:   str = "",
) -> str:
    """
    Get a short Gemini summary of the image for correction matching.
    Returns 1-2 line description of what the image shows.
    """
    from google import genai
    from google.genai import types
    from config.settings import GEMINI_API_KEY, GEMINI_MODEL

    client = genai.Client(api_key=GEMINI_API_KEY)

    parts = [
        types.Part.from_bytes(data=image_bytes, mime_type=image_mime),
        types.Part.from_text(text="Describe this heritage image in 3-5 short sentences. Focus on: monument name, location, dynasty, period. Be very concise."),
    ]

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=parts,
        config=types.GenerateContentConfig(
            temperature=0.0,
            max_output_tokens=100,
        ),
    )
    return (response.text or "").strip()

def _error(message: str) -> dict:
    log("PIPELINE", f"Error: {message}", "error")
    return {
        "answer": message,
        "images": [],
        "route":  "error",
        "tone":   "normal",
        "error":  message,
    }


async def run_pipeline_stream(payload, user_email: str = "", history: list = None):
    """
    Streaming version of pipeline.
    Yields text chunks as they come from the model.
    First yields metadata (correction info, images) as JSON,
    then yields answer text chunks.
    """
    import json
    log_separator("PIPELINE STREAM START")
    log("PIPELINE", f"Payload: TEXT({len(payload.text)}chars) | Tone: {payload.tone}", "info")

    log_separator("ROUTING")
    log("ROUTER", f"Payload: {payload.summary()}", "info")
    log("ROUTER", "Inputs: [TEXT] | Audio output: NO | → ROUTE_A", "info")
    log("ROUTER", "Gemini direct — text/image", "info")

    # Correction check
    correction_input_type = "text"
    if payload.has_audio and not payload.has_image:
        correction_input_type = "audio"
    elif payload.has_video and not payload.has_image:
        correction_input_type = "video"
    elif payload.has_image:
        correction_input_type = "image"

    image_summary = ""
    if payload.has_image and correction_input_type == "image":
        try:
            image_summary = await asyncio.to_thread(
                _get_image_summary_for_correction,
                payload.image_bytes,
                payload.image_mime,
                payload.text or "",
            )
        except Exception as e:
            log("PIPELINE", f"Image summary failed: {e}", "warn")

    correction = None
    correction_prefix = ""
    try:
        correction = await find_relevant_correction(
            question_text=payload.text or "",
            gemini_summary=payload.text or "",
            image_summary=image_summary,
            input_type=correction_input_type,
        )
        if correction:
            correction_prefix = build_correction_prompt_prefix(correction)
            log("PIPELINE", "Correction found — injecting into prompt", "success")
    except Exception as e:
        log("PIPELINE", f"Correction check failed: {e}", "warn")

    # Decide route
    use_claude = payload.tone in ("researcher", "formal")

    if use_claude:
        log("PIPELINE", f"DEEP PATH | Tone: {payload.tone}", "info")

        # Gemini perception first (run in thread since it is sync)
        gemini_findings = ""
        try:
            gemini_findings = await asyncio.to_thread(
                call_gemini_perception,
                payload.text or "",
                payload.image_bytes,
                payload.image_mime,
            )
            log("PIPELINE", f"Gemini findings: {len(gemini_findings)} chars", "info")
        except Exception as e:
            log("PIPELINE", f"Gemini perception failed: {e}", "warn")

        # Vision context (run in thread since it is sync)
        vision_context = ""
        if payload.has_image:
            try:
                vision_context = await asyncio.to_thread(reverse_image_search, payload.image_bytes)
                log("PIPELINE", f"Vision context: {len(vision_context)} chars", "info")
            except Exception as e:
                log("PIPELINE", f"Vision failed: {e}", "warn")

        # Stream from Claude
        async for chunk in call_claude_deep_stream(
            user_question=payload.text or "",
            gemini_findings=gemini_findings,
            vision_context=vision_context,
            image_bytes=payload.image_bytes,
            image_mime=payload.image_mime,
            tone=payload.tone,
            correction_prefix=correction_prefix,
            history=history,
        ):
            yield json.dumps({"type": "text", "data": chunk}) + "\n"

    else:
        log("PIPELINE", "DIRECT PATH | Streaming", "info")

        # Stream from Gemini
        async for chunk in call_gemini_direct_stream(
            text=payload.text or "",
            image_bytes=payload.image_bytes,
            image_mime=payload.image_mime,
            audio_bytes=payload.audio_bytes,
            audio_mime=payload.audio_mime,
            video_bytes=payload.video_bytes,
            video_mime=payload.video_mime,
            tone=payload.tone,
            correction_prefix=correction_prefix,
            history=history,
        ):
            yield json.dumps({"type": "text", "data": chunk}) + "\n"

    

    yield json.dumps({"type": "done"}) + "\n"
    log_separator("PIPELINE STREAM COMPLETE")