"""
utils/debug.py
==============
Centralised debug logger.
Set DEBUG_MODE=true in .env to see full pipeline logs.
Set DEBUG_MODE=false in production to silence them.
"""

import time
import functools
from datetime import datetime
from config.settings import DEBUG_MODE


COLORS = {
    "reset":   "\033[0m",
    "blue":    "\033[94m",
    "green":   "\033[92m",
    "yellow":  "\033[93m",
    "red":     "\033[91m",
    "cyan":    "\033[96m",
    "magenta": "\033[95m",
    "bold":    "\033[1m",
}


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S.%f")[:-3]


def log(tag: str, message: str, level: str = "info") -> None:
    """
    Central log function.
    level: info | success | warn | error | step
    """
    if not DEBUG_MODE:
        return

    color_map = {
        "info":    COLORS["blue"],
        "success": COLORS["green"],
        "warn":    COLORS["yellow"],
        "error":   COLORS["red"],
        "step":    COLORS["cyan"],
        "route":   COLORS["magenta"],
    }
    color = color_map.get(level, COLORS["blue"])
    tag_str = f"{COLORS['bold']}[{tag}]{COLORS['reset']}"
    print(f"{color}{_ts()} {tag_str} {message}{COLORS['reset']}")


def log_route(has_text, has_image, has_audio, has_video, wants_audio_out, route) -> None:
    """Log routing decision clearly."""
    if not DEBUG_MODE:
        return
    inputs = []
    if has_text:      inputs.append("TEXT")
    if has_image:     inputs.append("IMAGE")
    if has_audio:     inputs.append("AUDIO")
    if has_video:     inputs.append("VIDEO")
    inputs_str = " + ".join(inputs) if inputs else "NONE"
    audio_out  = "YES" if wants_audio_out else "NO"
    log("ROUTER", f"Inputs: [{inputs_str}] | Audio output: {audio_out} | → {route.upper()}", "route")


def log_separator(label: str = "") -> None:
    if not DEBUG_MODE:
        return
    line = "─" * 60
    if label:
        print(f"\n{COLORS['bold']}{line}{COLORS['reset']}")
        print(f"{COLORS['bold']}  {label}{COLORS['reset']}")
        print(f"{COLORS['bold']}{line}{COLORS['reset']}")
    else:
        print(f"{COLORS['bold']}{line}{COLORS['reset']}")


def timer(tag: str):
    """
    Decorator — logs how long a function took.
    Usage: @timer("CLAUDE")
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start = time.time()
            log(tag, f"Starting {func.__name__}...", "step")
            try:
                result = func(*args, **kwargs)
                elapsed = (time.time() - start) * 1000
                log(tag, f"{func.__name__} completed in {elapsed:.0f}ms", "success")
                return result
            except Exception as e:
                elapsed = (time.time() - start) * 1000
                log(tag, f"{func.__name__} FAILED after {elapsed:.0f}ms — {e}", "error")
                raise
        return wrapper
    return decorator


def log_api_call(model: str, input_summary: str, output_length: int) -> None:
    """Log every API call with model, input summary, output size."""
    if not DEBUG_MODE:
        return
    log("API", f"Model: {model} | Input: {input_summary} | Output: {output_length} chars", "info")
