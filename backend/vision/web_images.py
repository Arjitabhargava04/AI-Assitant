"""
vision/web_images.py
====================
Google Custom Search — fetches real web images.
Gemini verifies each image is relevant before showing to user.

Flow:
  1. Google Custom Search returns image URLs
  2. Fetch actual image bytes from each URL
  3. Gemini visually checks each image — relevant or not
  4. Return only verified relevant images
"""

import asyncio
import aiohttp
import base64
from google import genai
from google.genai import types
from config.settings import (
    GOOGLE_SEARCH_KEY, GOOGLE_SEARCH_CX,
    GEMINI_API_KEY, GEMINI_MODEL, MAX_IMAGES_SHOWN
)
from utils.debug import log, log_separator, timer

_client = genai.Client(api_key=GEMINI_API_KEY)

SEARCH_URL = "https://www.googleapis.com/customsearch/v1"


async def fetch_and_verify_images(
    search_query: str,
    count:        int,
    context:      str = "",
) -> list:
    """
    Full pipeline:
    1. Search Google Images for search_query
    2. Fetch image bytes for each result
    3. Gemini verifies each image is relevant
    4. Return verified image URLs (max count)

    Args:
        search_query: what to search for
        count:        how many images user wants (1-5)
        context:      extra context for verification (e.g. "Chola dynasty temple")

    Returns:
        List of verified image URLs ready to display
    """
    log_separator("WEB IMAGES")
    log("IMAGES", f"Query: '{search_query}' | Count: {count}", "info")

    if not GOOGLE_SEARCH_KEY or not GOOGLE_SEARCH_CX:
        log("IMAGES", "Google Search keys not configured in .env", "error")
        return []

    # Fetch more than needed — some will fail verification
    fetch_count = min(count * 2, 10)

    # Step 1 — Google Image Search
    urls = await _google_image_search(search_query, fetch_count)
    if not urls:
        log("IMAGES", "No image URLs returned from Google", "warn")
        return []

    log("IMAGES", f"Got {len(urls)} URLs from Google", "success")

    # Step 2 — Fetch bytes + verify in parallel
    verified = await _fetch_and_verify_parallel(urls, search_query, context, count)

    log("IMAGES", f"Verified {len(verified)} images", "success")
    return verified


async def _google_image_search(query: str, count: int) -> list:
    """Call Google Custom Search API for images."""
    params = {
        "key":        GOOGLE_SEARCH_KEY,
        "cx":         GOOGLE_SEARCH_CX,
        "q":          query,
        "searchType": "image",
        "num":        min(count, 10),
        "safe":       "active",
        # Prefer high quality images
        "imgSize":    "large",
        "imgType":    "photo",
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(SEARCH_URL, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    log("IMAGES", f"Search API error: {resp.status}", "error")
                    return []
                data = await resp.json()
                items = data.get("items", [])
                urls  = [item["link"] for item in items if "link" in item]
                return urls
    except Exception as e:
        log("IMAGES", f"Search failed: {e}", "error")
        return []


async def _fetch_and_verify_parallel(
    urls:    list,
    query:   str,
    context: str,
    needed:  int,
) -> list:
    """
    Fetch image bytes and verify with Gemini in parallel.
    Stop once we have enough verified images.
    """
    verified = []

    # Run all fetches in parallel
    tasks = [_fetch_verify_one(url, query, context) for url in urls]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for url, result in zip(urls, results):
        if isinstance(result, Exception):
            continue
        if result:  # Gemini said relevant
            verified.append(url)
            if len(verified) >= needed:
                break

    return verified


async def _fetch_verify_one(url: str, query: str, context: str) -> bool:
    """
    Fetch one image and ask Gemini if it is relevant.
    Returns True if relevant, False if not or if fetch fails.
    """
    try:
        # Fetch image bytes
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                if resp.status != 200:
                    return False
                content_type = resp.headers.get("content-type", "image/jpeg")
                if "image" not in content_type:
                    return False
                image_bytes = await resp.read()

        if not image_bytes or len(image_bytes) < 1000:
            return False

        # Detect mime type
        mime = _detect_mime(image_bytes)

        # Ask Gemini — is this image relevant?
        is_relevant = await asyncio.to_thread(
            _gemini_verify, image_bytes, mime, query, context
        )

        log("IMAGES", f"URL verified: {is_relevant} — {url[:60]}", "info")
        return is_relevant

    except Exception as e:
        log("IMAGES", f"Fetch/verify failed: {e}", "warn")
        return False


def _gemini_verify(
    image_bytes: bytes,
    mime:        str,
    query:       str,
    context:     str,
) -> bool:
    """
    Gemini visually checks if image is relevant to the heritage query.
    Returns True or False only — no explanation needed.
    """
    prompt = f"""You are verifying if an image is relevant for a heritage query.

Heritage query: "{query}"
{f'Additional context: {context}' if context else ''}

Look at this image carefully.
Is this image genuinely relevant to the heritage query above?

Reply with only one word: YES or NO

Say YES if the image clearly shows the monument, sculpture, site, or subject being asked about.
Say NO if the image is unrelated, wrong subject, or generic stock photo."""

    try:
        response = _client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime),
                types.Part.from_text(text=prompt),
            ],
            config=types.GenerateContentConfig(
                temperature=0.0,
                max_output_tokens=5,
            ),
        )
        answer = (response.text or "").strip().upper()
        return answer.startswith("YES")
    except Exception as e:
        log("IMAGES", f"Gemini verify error: {e}", "warn")
        return False


def _detect_mime(data: bytes) -> str:
    if data[:4] == b'\x89PNG':       return "image/png"
    if data[:2] == b'\xff\xd8':      return "image/jpeg"
    if data[:4] == b'RIFF':          return "image/webp"
    if data[:6] in (b'GIF87a', b'GIF89a'): return "image/gif"
    return "image/jpeg"


def build_image_search_query(
    user_query:       str,
    gemini_context:   str = "",
    vision_context:   str = "",
) -> str:
    """
    Build the best possible image search query.
    Uses Gemini context if available for specificity.
    Falls back to user query.
    """
    # If we have rich context from Gemini — extract the subject
    if gemini_context and len(gemini_context) > 20:
        # Ask Gemini to extract a clean search query
        try:
            response = _client.models.generate_content(
                model=GEMINI_MODEL,
                contents=f"""Extract a specific Google Image search query (3-6 words) for this heritage subject.
Return ONLY the search query, nothing else.

User asked: {user_query}
Context: {gemini_context[:300]}

Search query:""",
                config=types.GenerateContentConfig(
                    temperature=0.0,
                    max_output_tokens=20,
                ),
            )
            query = (response.text or "").strip()
            if query:
                log("IMAGES", f"Generated search query: '{query}'", "success")
                return query
        except Exception:
            pass

    # Fallback — clean up user query
    import re
    query = re.sub(r'(show|image|photo|picture|dikhao|dekh|me|the|a|an)\s*', '', user_query.lower())
    query = query.strip() or user_query
    return query[:100]
