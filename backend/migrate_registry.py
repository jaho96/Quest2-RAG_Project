"""
기존 ChromaDB 데이터를 document_registry.json 으로 마이그레이션

실행: python migrate_registry.py
"""
import json
import os
from services.vector_store import get_collection, _REGISTRY_PATH

print("기존 ChromaDB에서 문서 목록을 읽어 레지스트리를 생성합니다...")

collection = get_collection()
results = collection.get(include=["metadatas"])

seen = {}
for meta in results["metadatas"]:
    doc_id = meta["doc_id"]
    if doc_id not in seen:
        seen[doc_id] = {
            "doc_id": doc_id,
            "filename": meta.get("filename", ""),
            "file_type": meta.get("file_type", ""),
            "uploaded_at": meta.get("uploaded_at", ""),
            "file_size": meta.get("file_size", 0),
            "file_hash": meta.get("file_hash", ""),
            "total_chunks": meta.get("total_chunks", 0),
        }

with open(_REGISTRY_PATH, "w", encoding="utf-8") as f:
    json.dump(seen, f, ensure_ascii=False, indent=2)

print(f"완료! {len(seen)}개 문서를 레지스트리에 저장했습니다.")
print(f"파일 위치: {_REGISTRY_PATH}")
