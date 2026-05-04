"""
db/queries.py
=============
All database operations in one place.
No other file writes SQL directly — they call functions here.
"""

import uuid
from datetime import datetime
from db.connection import get_db
from utils.debug import log


def _new_id() -> str:
    return str(uuid.uuid4())


# ── USERS ─────────────────────────────────────────────────

def create_user(email: str, password_hash: str, display_name: str) -> dict:
    """Create new user. Returns created user dict."""
    uid = _new_id()
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (id, email, password_hash, display_name) VALUES (%s, %s, %s, %s)",
                (uid, email.lower().strip(), password_hash, display_name)
            )
        conn.commit()
    log("DB", f"User created: {email}", "success")
    return get_user_by_email(email)


def get_user_by_email(email: str) -> dict | None:
    """Get user by email. Returns dict or None."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, password_hash, display_name, created_at FROM users WHERE email = %s",
                (email.lower().strip(),)
            )
            return cur.fetchone()


def get_user_by_id(user_id: str) -> dict | None:
    """Get user by ID. Returns dict or None."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, display_name, created_at FROM users WHERE id = %s",
                (user_id,)
            )
            return cur.fetchone()


def get_all_users() -> list:
    """Get all users — admin only."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, display_name, created_at FROM users ORDER BY created_at DESC"
            )
            return cur.fetchall()


# ── CHATS ─────────────────────────────────────────────────

def create_chat(user_id: str, title: str = "New conversation") -> dict:
    """Create new chat session."""
    cid = _new_id()
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO chats (id, user_id, title) VALUES (%s, %s, %s)",
                (cid, user_id, title)
            )
        conn.commit()
    return {"id": cid, "user_id": user_id, "title": title}


def get_user_chats(user_id: str) -> list:
    """Get all chats for a user, newest first."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, title, created_at, updated_at FROM chats WHERE user_id = %s ORDER BY updated_at DESC",
                (user_id,)
            )
            return cur.fetchall()


def get_all_chats() -> list:
    """Get all chats from all users — admin only."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT c.id, c.title, c.created_at, c.updated_at,
                       u.email, u.display_name
                FROM chats c
                JOIN users u ON c.user_id = u.id
                ORDER BY c.updated_at DESC
            """)
            return cur.fetchall()


def update_chat_title(chat_id: str, title: str) -> None:
    """Update chat title — set from first message."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE chats SET title = %s WHERE id = %s",
                (title[:200], chat_id)
            )
        conn.commit()


def touch_chat(chat_id: str) -> None:
    """Update chat updated_at timestamp."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE chats SET updated_at = NOW() WHERE id = %s",
                (chat_id,)
            )
        conn.commit()


# ── MESSAGES ──────────────────────────────────────────────

def save_message(
    chat_id:        str,
    user_id:        str,
    role:           str,
    content:        str,
    gemini_summary: str = "",
    input_type:     str = "text",
) -> dict:
    """Save a message to the database."""
    mid = _new_id()
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO messages
                   (id, chat_id, user_id, role, content, gemini_summary, input_type)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (mid, chat_id, user_id, role, content, gemini_summary, input_type)
            )
        conn.commit()
    touch_chat(chat_id)
    return {"id": mid, "role": role, "content": content}


def get_chat_messages(chat_id: str) -> list:
    """Get all messages in a chat, oldest first."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, role, content, input_type, gemini_summary, created_at
                   FROM messages WHERE chat_id = %s ORDER BY created_at ASC""",
                (chat_id,)
            )
            return cur.fetchall()


# ── CORRECTIONS ───────────────────────────────────────────

def save_correction(
    gemini_summary: str,
    correct_answer: str,
    input_type:     str = "text",
) -> dict:
    """Save a new correction."""
    cid = _new_id()
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO corrections (id, gemini_summary, correct_answer, input_type)
                   VALUES (%s, %s, %s, %s)""",
                (cid, gemini_summary, correct_answer, input_type)
            )
        conn.commit()
    log("DB", f"Correction saved: {cid}", "success")
    return {"id": cid, "gemini_summary": gemini_summary, "correct_answer": correct_answer}


def get_all_corrections() -> list:
    """Get all active corrections."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, gemini_summary, correct_answer, input_type, created_at
                   FROM corrections WHERE is_active = TRUE ORDER BY created_at DESC"""
            )
            return cur.fetchall()


def deactivate_correction(correction_id: str) -> None:
    """Deactivate a correction — stops it being injected."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE corrections SET is_active = FALSE WHERE id = %s",
                (correction_id,)
            )
        conn.commit()
    log("DB", f"Correction deactivated: {correction_id}", "warn")

# for chat history
def get_recent_messages(chat_id: str, limit: int = 6) -> list:
    """Get last N messages for conversation history context."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT role, content FROM messages
                   WHERE chat_id = %s
                   ORDER BY created_at DESC
                   LIMIT %s""",
                (chat_id, limit)
            )
            rows = cur.fetchall()
            # Reverse so oldest is first
            return list(reversed(rows))


def create_project(user_id: str, name: str) -> dict:
    pid = _new_id()
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO projects (id, user_id, name) VALUES (%s, %s, %s)",
                (pid, user_id, name)
            )
        conn.commit()
    return {"id": pid, "user_id": user_id, "name": name}


def get_user_projects(user_id: str) -> list:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, created_at FROM projects WHERE user_id = %s ORDER BY created_at DESC",
                (user_id,)
            )
            return cur.fetchall()


def delete_project(project_id: str, user_id: str) -> None:
    with get_db() as conn:
        with conn.cursor() as cur:
            # Remove project from chats first
            cur.execute(
                "UPDATE chats SET project_id = NULL WHERE project_id = %s",
                (project_id,)
            )
            cur.execute(
                "DELETE FROM projects WHERE id = %s AND user_id = %s",
                (project_id, user_id)
            )
        conn.commit()


def assign_chat_to_project(chat_id: str, project_id: str) -> None:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE chats SET project_id = %s WHERE id = %s",
                (project_id, chat_id)
            )
        conn.commit()


def get_project_chats(project_id: str, user_id: str) -> list:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, title, created_at, updated_at
                   FROM chats WHERE project_id = %s AND user_id = %s
                   ORDER BY updated_at DESC""",
                (project_id, user_id)
            )
            return cur.fetchall()   
