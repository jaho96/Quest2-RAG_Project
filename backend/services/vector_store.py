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


def search(query_embedding: list[float], top_k: int = 5) -> list[dict]:
    """코사인 유사도 기반 벡터 검색"""
    vec = np.array(query_embedding, dtype=np.float32)
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT chunk_id, doc_id, filename, file_type, uploaded_at,
                   page, chunk_index, total_chunks, content,
                   1 - (embedding <=> %s) AS score
            FROM document_chunks
            ORDER BY embedding <=> %s
            LIMIT %s
        """, (vec, vec, top_k))
        rows = cur.fetchall()

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
            "score": round(float(r["score"]), 3),
        }
        for r in rows
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