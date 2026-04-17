"""
대화 저장소 — PostgreSQL
"""

from services.db import get_conn


def _fmt(row) -> dict:
    """TIMESTAMPTZ 필드를 문자열로 변환"""
    d = dict(row)
    for k, v in d.items():
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat()
    return d


def create_conversation(title: str) -> dict:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO conversations (title) VALUES (%s) RETURNING *",
            (title,)
        )
        return _fmt(cur.fetchone())


def list_conversations(limit: int = 50) -> list[dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM conversations ORDER BY updated_at DESC LIMIT %s",
            (limit,)
        )
        return [_fmt(r) for r in cur.fetchall()]


def get_messages(conv_id: int) -> list[dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM conv_messages WHERE conversation_id = %s ORDER BY created_at ASC",
            (conv_id,)
        )
        return [_fmt(r) for r in cur.fetchall()]


def add_message(conv_id: int, role: str, content: str, trace_id: str | None = None, sources: list | None = None) -> dict:
    import json as _json
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO conv_messages (conversation_id, role, content, trace_id, sources)
            VALUES (%s, %s, %s, %s, %s) RETURNING *
        """, (conv_id, role, content, trace_id, _json.dumps(sources) if sources else None))
        msg = _fmt(cur.fetchone())
        cur.execute(
            "UPDATE conversations SET updated_at = NOW() WHERE id = %s",
            (conv_id,)
        )
        return msg


def rename_conversation(conv_id: int, title: str):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE conversations SET title = %s WHERE id = %s",
            (title, conv_id)
        )


def delete_conversation(conv_id: int):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM conversations WHERE id = %s", (conv_id,))