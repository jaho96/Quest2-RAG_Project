"""
PostgreSQL 연결 및 테이블 초기화

- 모든 테이블을 여기서 한 번에 관리
- get_conn() : 컨텍스트 매니저로 커넥션 사용 후 자동 반환
"""

import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool
from contextlib import contextmanager
from pgvector.psycopg2 import register_vector
from config import DATABASE_URL

_pool: ThreadedConnectionPool | None = None


def _get_pool() -> ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = ThreadedConnectionPool(2, 10, DATABASE_URL)
    return _pool


@contextmanager
def _raw_conn():
    """register_vector 없이 순수 연결 — init_db 1단계 전용"""
    conn = psycopg2.connect(DATABASE_URL)
    conn.cursor_factory = psycopg2.extras.RealDictCursor
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@contextmanager
def get_conn():
    pool = _get_pool()
    conn = pool.getconn()
    register_vector(conn)
    conn.cursor_factory = psycopg2.extras.RealDictCursor
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def init_db():
    """서버 시작 시 한 번 실행 — 테이블이 없으면 생성"""
    # 1단계: vector 확장 먼저 생성 (register_vector 호출 전)
    with _raw_conn() as conn:
        cur = conn.cursor()
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # 2단계: 나머지 테이블 생성 (이제 vector 타입 사용 가능)
    with get_conn() as conn:
        cur = conn.cursor()

        # ── 문서 메타데이터 ───────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                doc_id       TEXT PRIMARY KEY,
                filename     TEXT NOT NULL,
                file_type    TEXT,
                uploaded_at  TEXT,
                file_size    INTEGER,
                file_hash    TEXT UNIQUE,
                total_chunks INTEGER
            )
        """)

        # ── 청크 + 임베딩 (pgvector) ─────────────────────────────
        # text-embedding-3-small → 1536차원
        cur.execute("""
            CREATE TABLE IF NOT EXISTS document_chunks (
                id           SERIAL PRIMARY KEY,
                chunk_id     TEXT NOT NULL UNIQUE,
                doc_id       TEXT NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
                filename     TEXT NOT NULL,
                file_type    TEXT,
                uploaded_at  TEXT,
                page         INTEGER DEFAULT -1,
                chunk_index  INTEGER NOT NULL,
                chunk_size   INTEGER,
                total_chunks INTEGER,
                content      TEXT NOT NULL,
                embedding    vector(1536)
            )
        """)
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON document_chunks(doc_id)"
        )

        # ── 트레이스 ─────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS traces (
                id                   SERIAL PRIMARY KEY,
                trace_id             TEXT NOT NULL UNIQUE,
                question             TEXT NOT NULL,
                answer               TEXT,
                provider             TEXT,
                model                TEXT,
                response_time_ms     INTEGER,
                retrieval_scores     JSONB,
                avg_retrieval_score  REAL,
                feedback             INTEGER,
                error                TEXT,
                created_at           TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        # ── 대화 목록 ─────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id         SERIAL PRIMARY KEY,
                title      TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        # ── 대화 메시지 ───────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS conv_messages (
                id              SERIAL PRIMARY KEY,
                conversation_id INTEGER NOT NULL
                                REFERENCES conversations(id) ON DELETE CASCADE,
                role            TEXT NOT NULL,
                content         TEXT NOT NULL,
                trace_id        TEXT,
                sources         JSONB,
                created_at      TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        # 기존 테이블에 컬럼이 없으면 추가 (마이그레이션)
        cur.execute("""
            ALTER TABLE conv_messages
            ADD COLUMN IF NOT EXISTS sources JSONB
        """)