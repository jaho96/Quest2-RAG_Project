from fastapi import APIRouter
from services.trace_store import get_traces, get_stats
from services.cache import get_stats as get_cache_stats
from services.db import get_conn

router = APIRouter(prefix="/evaluate", tags=["evaluate"])


@router.get("/stats")
def stats():
    return {**get_stats(), "cache": get_cache_stats()}


@router.get("/traces")
def traces(limit: int = 50):
    return get_traces(limit)


@router.get("/embedding-stats")
def embedding_stats():
    with get_conn() as conn:
        cur = conn.cursor()

        # 문서별 청크 통계
        cur.execute("""
            SELECT
                d.doc_id,
                d.filename,
                d.uploaded_at,
                COUNT(c.id)                                          AS total_chunks,
                ROUND(AVG(c.chunk_size))                             AS avg_chunk_size,
                MIN(c.chunk_size)                                    AS min_chunk_size,
                MAX(c.chunk_size)                                    AS max_chunk_size,
                COUNT(CASE WHEN c.chunk_size < 100 THEN 1 END)       AS short_chunks
            FROM documents d
            LEFT JOIN document_chunks c ON c.doc_id = d.doc_id
            GROUP BY d.doc_id, d.filename, d.uploaded_at
            ORDER BY d.uploaded_at DESC
        """)
        docs = []
        for r in cur.fetchall():
            d = dict(r)
            total = d["total_chunks"] or 0
            short = d["short_chunks"] or 0
            d["short_ratio"] = round(short / total * 100, 1) if total > 0 else 0
            d["avg_chunk_size"] = int(d["avg_chunk_size"]) if d["avg_chunk_size"] else 0
            docs.append(d)

        # 전체 요약
        cur.execute("""
            SELECT
                COUNT(*)                                        AS total_chunks,
                ROUND(AVG(chunk_size))                          AS avg_chunk_size,
                COUNT(CASE WHEN chunk_size < 100 THEN 1 END)    AS short_chunks
            FROM document_chunks
        """)
        ov = dict(cur.fetchone())
        total = ov["total_chunks"] or 0
        short = ov["short_chunks"] or 0

    return {
        "documents": docs,
        "overall": {
            "total_documents": len(docs),
            "total_chunks":    total,
            "avg_chunk_size":  int(ov["avg_chunk_size"]) if ov["avg_chunk_size"] else 0,
            "short_chunks":    short,
            "short_ratio":     round(short / total * 100, 1) if total > 0 else 0,
        },
    }
