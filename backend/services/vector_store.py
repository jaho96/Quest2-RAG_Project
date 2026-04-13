import chromadb
from chromadb.config import Settings
from config import CHROMA_DIR

_client = chromadb.PersistentClient(
    path=CHROMA_DIR,
    settings=Settings(anonymized_telemetry=False),
)


def get_collection(name: str = "documents"):
    # cosine 거리 사용 (0=동일, 2=반대) → 유사도 = 1 - distance/2 로 0~1 범위
    return _client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )


def add_chunks(doc_id: str, filename: str, chunks: list[str], embeddings: list[list[float]]):
    collection = get_collection()
    ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
    metadatas = [{"doc_id": doc_id, "filename": filename, "chunk_index": i} for i in range(len(chunks))]
    collection.add(ids=ids, documents=chunks, embeddings=embeddings, metadatas=metadatas)


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
        # cosine distance: 0=완전일치, 2=완전반대 → 유사도 = 1 - distance/2
        similarity = round(1 - results["distances"][0][i] / 2, 3)
        output.append({
            "text": results["documents"][0][i],
            "metadata": results["metadatas"][0][i],
            "score": similarity,
        })
    return output


def delete_document(doc_id: str):
    collection = get_collection()
    existing = collection.get(where={"doc_id": doc_id})
    if existing["ids"]:
        collection.delete(ids=existing["ids"])


def reset_collection():
    """컬렉션 초기화 (거리 방식 변경 시 필요)"""
    try:
        _client.delete_collection("documents")
    except Exception:
        pass


def list_documents() -> list[dict]:
    collection = get_collection()
    results = collection.get(include=["metadatas"])

    seen = {}
    for meta in results["metadatas"]:
        doc_id = meta["doc_id"]
        if doc_id not in seen:
            seen[doc_id] = {"doc_id": doc_id, "filename": meta["filename"]}

    return list(seen.values())
