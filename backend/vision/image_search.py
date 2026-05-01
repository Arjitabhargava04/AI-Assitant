"""
vision/image_search.py
======================
Google Vision API — reverse image search.
Fetches actual page content from matching URLs for rich context.
"""

import base64
import requests
from config.settings import GOOGLE_VISION_KEY
from utils.debug import log, log_separator, timer

_VISION_URL = "https://vision.googleapis.com/v1/images:annotate"


@timer("VISION")
def reverse_image_search(image_bytes: bytes) -> str:
    """
    Send image to Google Vision — returns rich text context.
    Fetches actual page content from top matching URLs.
    Empty string if nothing useful found.
    """
    log_separator("GOOGLE VISION")
    log("VISION", f"Image: {len(image_bytes)} bytes", "info")

    if not GOOGLE_VISION_KEY:
        log("VISION", "GOOGLE_VISION_KEY not set — skipping", "warn")
        return ""

    b64 = base64.b64encode(image_bytes).decode("utf-8")
    payload = {
        "requests": [{
            "image": {"content": b64},
            "features": [
                {"type": "WEB_DETECTION",       "maxResults": 10},
                {"type": "LABEL_DETECTION",     "maxResults": 8},
                {"type": "OBJECT_LOCALIZATION", "maxResults": 5},
            ],
        }]
    }

    try:
        resp = requests.post(
            _VISION_URL,
            params={"key": GOOGLE_VISION_KEY},
            json=payload,
            timeout=15,
        )
        if resp.status_code == 403:
            log("VISION", "403 — Vision API not enabled or wrong key", "error")
            return ""
        if resp.status_code != 200:
            log("VISION", f"Error: {resp.status_code}", "error")
            return ""

        result = resp.json().get("responses", [{}])[0]
        if "error" in result:
            log("VISION", f"Vision error: {result['error']}", "error")
            return ""

        return _extract_rich_context(result)

    except requests.Timeout:
        log("VISION", "Timed out", "warn")
        return ""
    except Exception as e:
        log("VISION", f"Error: {e}", "error")
        return ""


def _extract_rich_context(result: dict) -> str:
    """
    Extract rich context from Vision response.
    Fetches actual page content from top matching URLs.
    """
    parts = []
    web   = result.get("webDetection", {})

    # Best guess label
    guesses = [g.get("label", "") for g in web.get("bestGuessLabels", []) if g.get("label")]
    if guesses:
        parts.append(f"Visual identification: {', '.join(guesses)}")
        log("VISION", f"Best guess: {guesses}", "success")

    # Web entities with good confidence
    entities = [
        e.get("description", "")
        for e in web.get("webEntities", [])
        if e.get("score", 0) > 0.5 and e.get("description")
    ]
    if entities:
        parts.append(f"Recognised as: {', '.join(entities[:6])}")

    # Pages with matching images — fetch content
    pages = web.get("pagesWithMatchingImages", [])
    if pages:
        page_titles = [p.get("pageTitle", "") for p in pages[:3] if p.get("pageTitle")]
        if page_titles:
            parts.append(f"Found on: {' | '.join(page_titles)}")
        # Fetch content from top pages
        for page in pages[:2]:
            url = page.get("url", "")
            if url:
                content = _fetch_page_summary(url)
                if content:
                    parts.append(f"Page content: {content}")

    # Visually similar images — fetch their page titles
    similar = web.get("visuallySimilarImages", [])
    if similar:
        for img_url in similar[:3]:
            url = img_url.get("url", "")
            if url:
                content = _fetch_page_summary(url)
                if content:
                    parts.append(f"Similar image context: {content}")
                    break  # Just one extra context from similar images

    # Image labels
    labels = [
        l.get("description", "")
        for l in result.get("labelAnnotations", [])
        if l.get("score", 0) > 0.7 and l.get("description")
    ]
    if labels:
        parts.append(f"Image contains: {', '.join(labels[:5])}")

    if not parts:
        log("VISION", "No useful context", "warn")
        return ""

    context = "\n".join(parts)
    log("VISION", f"Context ready: {len(context)} chars", "success")
    return context


def _fetch_page_summary(url: str) -> str:
    """
    Fetch a web page and extract a brief summary.
    Gets title and meta description — fast and lightweight.
    """
    try:
        resp = requests.get(
            url,
            timeout=5,
            headers={"User-Agent": "Mozilla/5.0"},
            stream=True,
        )
        # Read only first 8KB — enough for title and meta
        content = b""
        for chunk in resp.iter_content(chunk_size=1024):
            content += chunk
            if len(content) > 8192:
                break

        html = content.decode("utf-8", errors="ignore")

        # Extract title
        import re
        title_match = re.search(r'<title[^>]*>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
        title = title_match.group(1).strip() if title_match else ""

        # Extract meta description
        desc_match = re.search(
            r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',
            html, re.IGNORECASE
        )
        desc = desc_match.group(1).strip() if desc_match else ""

        summary = f"{title}. {desc}".strip(". ")
        if summary and len(summary) > 10:
            log("VISION", f"Fetched: {summary[:80]}", "info")
            return summary[:300]
        return ""

    except Exception:
        return ""
