"""
트레이스 저장소 — PostgreSQL
"""

import json
from services.db import get_conn


def save_trace(trace_id: str, question: str, answer: str | None,
               provider: str, model: str, response_time_ms: int,
               sources: list, error: str | None = None):
    scores = [s["score"] for s in sources] if sources else []
    avg_score = round(sum(scores) / len(scores), 4) if scores else None
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO traces
              (trace_id, question, answer, provider, model,
               response_time_ms, retrieval_scores, avg_retrieval_score, error)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (trace_id) DO UPDATE SET
              answer               = EXCLUDED.answer,
              response_time_ms     = EXCLUDED.response_time_ms,
              retrieval_scores     = EXCLUDED.retrieval_scores,
              avg_retrieval_score  = EXCLUDED.avg_retrieval_score,
              error                = EXCLUDED.error
        """, (
            trace_id, question, answer, provider, model,
            response_time_ms, json.dumps(scores), avg_score, error,
        ))


def update_feedback(trace_id: str, feedback: int):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE traces SET feedback = %s WHERE trace_id = %s",
            (feedback, trace_id)
        )


def get_traces(limit: int = 50) -> list[dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM traces ORDER BY created_at DESC LIMIT %s", (limit,)
        )
        result = []
        for r in cur.fetchall():
            d = dict(r)
            # JSONB는 psycopg2가 자동으로 Python 객체로 변환
            d["retrieval_scores"] = d.get("retrieval_scores") or []
            # TIMESTAMPTZ → 문자열
            if d.get("created_at"):
                d["created_at"] = str(d["created_at"])
            result.append(d)
        return result


def get_stats() -> dict:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) AS c FROM traces")
        total = cur.fetchone()["c"]
        cur.execute(
            "SELECT AVG(response_time_ms) AS a FROM traces WHERE error IS NULL"
        )
        avg_rt = cur.fetchone()["a"]
        cur.execute(
            "SELECT AVG(avg_retrieval_score) AS a FROM traces WHERE avg_retrieval_score IS NOT NULL"
        )
        avg_score = cur.fetchone()["a"]
        cur.execute("SELECT COUNT(*) AS c FROM traces WHERE feedback = 1")
        thumbs_up = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(*) AS c FROM traces WHERE feedback = -1")
        thumbs_down = cur.fetchone()["c"]

    return {
        "total": total,
        "avg_response_time_ms":  round(avg_rt) if avg_rt else None,
        "avg_retrieval_score":   round(float(avg_score), 3) if avg_score else None,
        "thumbs_up":   thumbs_up,
        "thumbs_down": thumbs_down,
    }