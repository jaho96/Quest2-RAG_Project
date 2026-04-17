"""
Redis 캐시 서비스

Redis가 없거나 연결 실패해도 시스템은 정상 동작합니다.
캐시 미스 시 그냥 RAG 파이프라인을 실행합니다.
"""

import json
import hashlib
import os
import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# TTL 설정
TTL_EMBEDDING = 60 * 60 * 24   # 임베딩: 24시간
TTL_RESPONSE  = 60 * 60         # 응답:   1시간

_client: redis.Redis | None = None


def get_client() -> redis.Redis | None:
    global _client
    if _client is not None:
        try:
            _client.ping()
            return _client
        except Exception:
            _client = None

    try:
        client = redis.from_url(REDIS_URL, decode_responses=False, socket_connect_timeout=1)
        client.ping()
        _client = client
        return _client
    except Exception:
        return None


def _key(prefix: str, text: str) -> str:
    h = hashlib.sha256(text.encode()).hexdigest()[:24]
    return f"rag:{prefix}:{h}"


# ── 임베딩 캐시 ────────────────────────────────────────────────────

def get_embedding(text: str) -> list[float] | None:
    client = get_client()
    if not client:
        return None
    try:
        val = client.get(_key("emb", text))
        return json.loads(val) if val else None
    except Exception:
        return None


def set_embedding(text: str, vector: list[float]):
    client = get_client()
    if not client:
        return
    try:
        client.setex(_key("emb", text), TTL_EMBEDDING, json.dumps(vector))
    except Exception:
        pass


# ── 응답 캐시 ──────────────────────────────────────────────────────

def get_response(question: str) -> dict | None:
    """캐시된 응답 반환. {"answer": str, "sources": list}"""
    client = get_client()
    if not client:
        return None
    try:
        val = client.get(_key("resp", question.strip().lower()))
        return json.loads(val) if val else None
    except Exception:
        return None


def set_response(question: str, answer: str, sources: list):
    client = get_client()
    if not client:
        return
    try:
        payload = json.dumps({"answer": answer, "sources": sources}, ensure_ascii=False)
        client.setex(_key("resp", question.strip().lower()), TTL_RESPONSE, payload.encode())
    except Exception:
        pass


def invalidate_responses():
    """문서 변경 시 응답 캐시 전체 삭제"""
    client = get_client()
    if not client:
        return
    try:
        keys = client.keys("rag:resp:*")
        if keys:
            client.delete(*keys)
    except Exception:
        pass


# ── 캐시 통계 ──────────────────────────────────────────────────────

def get_stats() -> dict:
    client = get_client()
    if not client:
        return {"connected": False, "embedding_cached": 0, "response_cached": 0, "hit_rate": None}
    try:
        info = client.info("stats")
        hits   = info.get("keyspace_hits", 0)
        misses = info.get("keyspace_misses", 0)
        total  = hits + misses
        return {
            "connected": True,
            "embedding_cached": len(client.keys("rag:emb:*")),
            "response_cached":  len(client.keys("rag:resp:*")),
            "hits":    hits,
            "misses":  misses,
            "hit_rate": round(hits / total * 100, 1) if total > 0 else None,
        }
    except Exception:
        return {"connected": False, "embedding_cached": 0, "response_cached": 0, "hit_rate": None}