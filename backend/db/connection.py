"""
db/connection.py
================
MySQL connection pool — shared across entire backend.
Uses PyMySQL with connection pooling via DBUtils.
All other files import get_db() from here.
"""

import pymysql
import pymysql.cursors
from config.settings import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
from utils.debug import log


def get_db():
    """
    Get a fresh MySQL connection.
    Always use as context manager:
        with get_db() as conn:
            with conn.cursor() as cursor:
                cursor.execute(...)
    """
    try:
        conn = pymysql.connect(
            host=DB_HOST,
            port=int(DB_PORT),
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=False,
        )
        return conn
    except Exception as e:
        log("DB", f"Connection failed: {e}", "error")
        raise


def test_connection() -> bool:
    """Test DB connection on startup. Returns True if successful."""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        log("DB", f"Connected to MySQL — {DB_NAME}@{DB_HOST}", "success")
        return True
    except Exception as e:
        log("DB", f"Connection test failed: {e}", "error")
        return False
