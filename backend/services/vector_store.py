import json
import os
import chromadb
from chromadb.config import Settings
from config import CHROMA_DIR

_client = chromadb.PersistentClient(
    path=CHROMA_DIR,
    settings=Settings(anonymized_telemetry=False),
)

# 문서 목록을 빠르게 읽기 위한 레지스트리 파일 (ChromaDB 대신 사용)
_REGISTRY_PATH = os.path.join(CHROMA_DIR, "document_registry.json")


# ── 레지스트리 관리 ────────────────────────────────────────────────

def _load_registry() -> dict:
    if os.path.exists(_REGISTRY_PATH):
        with open(_REGISTRY_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_registry(registry: dict):
    with open(_REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(registry, f, ensure_ascii=False, indent=2)


def _registry_add(doc_id: str, entry: dict):
    registry = _load_registry()
    registry[doc_id] = entry
    _save_registry(registry)


def _registry_remove(doc_id: str):
    registry = _load_registry()
    registry.pop(doc_id, None)
    _save_registry(registry)


# ── ChromaDB 컬렉션 ───────────────────────────────────────────────

def get_collection(name: str = "documents"):
    return _client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )


def add_chunks(doc_id: str, filename: str, file_type: str, uploaded_at: str,
               file_size: int, file_hash: str, chunks: list[dict],
               embeddings: list[list[float]], total_chunks: int):
    collection = get_collection()
    ids = [f"{doc_id}_{c['chunk_index']}" for c in chunks]
    metadatas = [
        {
            "doc_id": doc_id,
            "filename": filename,
            "file_type": file_type,
            "uploaded_at": uploaded_at,
            "file_size": file_size,
            "file_hash": file_hash,
            "page": c["page"] if c["page"] is not None else -1,
            "chunk_index": c["chunk_index"],
            "chunk_size": len(c["text"]),
            "total_chunks": total_chunks,
        }
        for c in chunks
    ]
    texts = [c["text"] for c in chunks]
    collection.add(ids=ids, documents=texts, embeddings=embeddings, metadatas=metadatas)

    # 레지스트리에 문서 정보 저장 (목록 조회용)
    _registry_add(doc_id, {
        "doc_id": doc_id,
        "filename": filename,
        "file_type": file_type,
        "uploaded_at": uploaded_at,
        "file_size": file_size,
        "file_hash": file_hash,
        "total_chunks": total_chunks,
    })


def search(query_embedding: list[float], top_k: int = 5) -> list[dict]:
    collection = get_collection()
    if collection.count() == 0:
        return []

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, collection.count()),
        include=["documents", "metadatas", "distances"],
    )

    output = []
    for i in range(len(results["documents"][0])):
        similarity = round(1 - results["distances"][0][i] / 2, 3)
        output.append({
            "text": results["documents"][0][i],
            "metadata": results["metadatas"][0][i],
            "score": similarity,
        })
    return output


def get_document_by_hash(file_hash: str) -> dict | None:
    """동일한 파일이 이미 있는지 해시로 확인 (레지스트리에서 빠르게 조회)"""
    registry = _load_registry()
    for entry in registry.values():
        if entry.get("file_hash") == file_hash:
            return {"doc_id": entry["doc_id"], "filename": entry["filename"]}
    return None


def delete_document(doc_id: str):
    collection = get_collection()
    existing = collection.get(where={"doc_id": doc_id})
    if existing["ids"]:
        collection.delete(ids=existing["ids"])
    _registry_remove(doc_id)


def list_documents() -> list[dict]:
    """레지스트리에서 바로 읽어 반환 (ChromaDB 전체 스캔 없음)"""
    registry = _load_registry()
    docs = list(registry.values())
    return sorted(docs, key=lambda x: x.get("uploaded_at", ""), reverse=True)
