"""
벡터 저장소 — PostgreSQL + pgvector
"""

import numpy as np
import psycopg2.extras
from services.db import get_conn


def add_chunks(doc_id: str, filename: str, file_type: str, uploaded_at: str,
               file_size: int, file_hash: str, chunks: list[dict],
               embeddings: list[list[float]], total_chunks: int):
    with get_conn() as conn:
        cur = conn.cursor()

        # 문서 메타데이터 저장
        cur.execute("""
            INSERT INTO documents
              (doc_id, filename, file_type, uploaded_at, file_size, file_hash, total_chunks)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (doc_id) DO NOTHING
        """, (doc_id, filename, file_type, uploaded_at, file_size, file_hash, total_chunks))

        # 청크 + 임베딩 배치 INSERT (개별 INSERT 대비 대폭 빠름)
        rows = [
            (
                f"{doc_id}_{chunk['chunk_index']}",
                doc_id, filename, file_type, uploaded_at,
                chunk.get("page") if chunk.get("page") is not None else -1,
                chunk["chunk_index"], len(chunk["text"]),
                total_chunks, chunk["text"],
                np.array(embedding, dtype=np.float32),
            )
            for chunk, embedding in zip(chunks, embeddings)
        ]
        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO document_chunks
              (chunk_id, doc_id, filename, file_type, uploaded_at,
               page, chunk_index, chunk_size, total_chunks, content, embedding)
            VALUES %s
            ON CONFLICT (chunk_id) DO NOTHING
            """,
            rows,
            page_size=100,
        )


def search(query_embedding: list[float], query_text: str = "", top_k: int = 5) -> list[dict]:
    """Hybrid Search: 벡터 유사도 + 키워드 검색 결합 (RRF 방식)"""
    vec = np.array(query_embedding, dtype=np.float32)
    fetch = top_k * 3  # 각 방법에서 더 많이 뽑아서 합산

    with get_conn() as conn:
        cur = conn.cursor()

        # ── 벡터 검색 ──────────────────────────────────────────────
        cur.execute("""
            SELECT chunk_id, doc_id, filename, file_type, uploaded_at,
                   page, chunk_index, total_chunks, content,
                   1 - (embedding <=> %s) AS score
            FROM document_chunks
            ORDER BY embedding <=> %s
            LIMIT %s
        """, (vec, vec, fetch))
        vector_rows = {r["chunk_id"]: (dict(r), i + 1) for i, r in enumerate(cur.fetchall())}

        # ── 키워드 검색 (tsvector) ─────────────────────────────────
        keyword_rows = {}
        if query_text.strip():
            # 단어 분리 후 OR 검색
            words = " | ".join(query_text.strip().split())
            try:
                cur.execute("""
                    SELECT chunk_id, doc_id, filename, file_type, uploaded_at,
                           page, chunk_index, total_chunks, content,
                           ts_rank(content_tsv, to_tsquery('simple', %s)) AS score
                    FROM document_chunks
                    WHERE content_tsv @@ to_tsquery('simple', %s)
                    ORDER BY score DESC
                    LIMIT %s
                """, (words, words, fetch))
                keyword_rows = {r["chunk_id"]: (dict(r), i + 1) for i, r in enumerate(cur.fetchall())}
            except Exception:
                pass  # 키워드 파싱 실패 시 벡터만 사용

    # ── RRF (Reciprocal Rank Fusion) 점수 합산 ─────────────────────
    k = 60  # RRF 상수
    all_ids = set(vector_rows) | set(keyword_rows)
    scored = []
    for cid in all_ids:
        rrf = 0.0
        row_data = None
        if cid in vector_rows:
            row_data, rank = vector_rows[cid]
            rrf += 1 / (k + rank)
        if cid in keyword_rows:
            row_data, rank = keyword_rows[cid]
            rrf += 1 / (k + rank)
        if row_data:
            scored.append((rrf, row_data))

    scored.sort(key=lambda x: x[0], reverse=True)

    return [
        {
            "text": r["content"],
            "metadata": {
                "doc_id":       r["doc_id"],
                "filename":     r["filename"],
                "file_type":    r["file_type"],
                "uploaded_at":  r["uploaded_at"],
                "page":         r["page"],
                "chunk_index":  r["chunk_index"],
                "total_chunks": r["total_chunks"],
            },
            "score": round(float(vector_rows[r["chunk_id"]][0]["score"]) if r["chunk_id"] in vector_rows else 0.0, 3),
        }
        for _, r in scored[:top_k]
    ]


def get_document_by_hash(file_hash: str) -> dict | None:
    """중복 파일 확인"""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT doc_id, filename FROM documents WHERE file_hash = %s",
            (file_hash,)
        )
        row = cur.fetchone()
    return dict(row) if row else None


def delete_document(doc_id: str):
    """문서 삭제 — ON DELETE CASCADE 로 청크도 자동 삭제"""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM documents WHERE doc_id = %s", (doc_id,))


def list_documents() -> list[dict]:
    """문서 목록 (최신순)"""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM documents ORDER BY uploaded_at DESC")
        return [dict(r) for r in cur.fetchall()]


def get_chunks_text(doc_ids: list[str]) -> list[str]:
    """퀴즈 생성용 — 특정 문서들의 청크 텍스트만 반환"""
    with get_conn() as conn:
        cur = conn.cursor()
        if doc_ids:
            cur.execute(
                "SELECT content FROM document_chunks WHERE doc_id = ANY(%s)",
                (doc_ids,)
            )
        else:
            cur.execute("SELECT content FROM document_chunks")
        return [r["content"] for r in cur.fetchall()]