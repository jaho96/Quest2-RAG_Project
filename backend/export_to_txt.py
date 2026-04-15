"""
ChromaDB에 저장된 문서를 TXT 파일로 내보내는 스크립트

실행 위치: backend/
실행 방법:
    python export_to_txt.py           # 전체 문서 개별 TXT
    python export_to_txt.py 10        # 최근 10개만 개별 TXT
    python export_to_txt.py --merge   # 전체 문서 하나의 TXT로 합치기
"""

import sys
import os
import chromadb
from chromadb.config import Settings
from collections import defaultdict

CHROMA_DIR = "chroma_db"
OUTPUT_DIR = "exported_txt"

def export():
    merge = "--merge" in sys.argv
    limit = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else None

    # ── ChromaDB 연결 ──────────────────────────────────────────────
    client = chromadb.PersistentClient(
        path=CHROMA_DIR,
        settings=Settings(anonymized_telemetry=False),
    )
    collection = client.get_or_create_collection("documents")

    total = collection.count()
    if total == 0:
        print("저장된 청크가 없습니다.")
        return

    print(f"전체 청크 수: {total}개 로딩 중...")

    # ── 전체 청크 가져오기 ─────────────────────────────────────────
    results = collection.get(include=["documents", "metadatas"])

    # ── doc_id 기준으로 청크 묶기 ──────────────────────────────────
    doc_chunks = defaultdict(list)
    doc_meta = {}

    for text, meta in zip(results["documents"], results["metadatas"]):
        doc_id = meta["doc_id"]
        doc_chunks[doc_id].append({
            "chunk_index": meta.get("chunk_index", 0),
            "text": text,
        })
        if doc_id not in doc_meta:
            doc_meta[doc_id] = meta

    print(f"총 {len(doc_chunks)}개 문서 발견\n")

    # ── 출력 폴더 생성 ─────────────────────────────────────────────
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    doc_ids = list(doc_chunks.keys())
    if limit:
        doc_ids = doc_ids[:limit]

    # ── 하나의 파일로 합치기 (500,000자 초과 시 자동 분할) ───────────
    if merge:
        MAX_CHARS = 490_000
        file_index = 1
        current_chars = 0
        current_file = None

        def open_next_file():
            nonlocal current_file, file_index, current_chars
            if current_file:
                current_file.close()
                print(f"  → 파일 저장 완료 ({current_chars:,}자)\n")
            path = os.path.join(OUTPUT_DIR, f"korean_history_part{file_index}.txt")
            current_file = open(path, "w", encoding="utf-8")
            print(f"[파일 {file_index}] {path} 작성 중...")
            file_index += 1
            current_chars = 0
            return current_file

        open_next_file()

        for i, doc_id in enumerate(doc_ids, 1):
            chunks = sorted(doc_chunks[doc_id], key=lambda x: x["chunk_index"])
            meta = doc_meta[doc_id]
            base_name = os.path.splitext(meta.get("filename", doc_id))[0]
            full_text = "\n\n".join(c["text"] for c in chunks)
            block = f"{'='*60}\n# {base_name}\n{'='*60}\n\n{full_text}\n\n"

            if current_chars + len(block) > MAX_CHARS:
                open_next_file()

            current_file.write(block)
            current_chars += len(block)
            print(f"  [{i}/{len(doc_ids)}] {base_name} ({len(chunks)}청크)")

        current_file.close()
        print(f"  → 파일 저장 완료 ({current_chars:,}자)")
        print(f"\n완료! {file_index - 1}개 파일로 분할 저장됨 → '{OUTPUT_DIR}/'")
        return

    # ── 문서별 개별 TXT 저장 ───────────────────────────────────────
    for i, doc_id in enumerate(doc_ids, 1):
        chunks = sorted(doc_chunks[doc_id], key=lambda x: x["chunk_index"])
        meta = doc_meta[doc_id]

        filename = meta.get("filename", doc_id)
        base_name = os.path.splitext(filename)[0]
        output_path = os.path.join(OUTPUT_DIR, f"{base_name}.txt")
        output_path = output_path.replace(":", "_").replace("?", "_").replace("*", "_")

        full_text = "\n\n".join(c["text"] for c in chunks)

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(f"# {base_name}\n\n")
            f.write(full_text)

        print(f"  [{i}/{len(doc_ids)}] {base_name}.txt ({len(chunks)}청크, {len(full_text):,}자)")

    print(f"\n완료! '{OUTPUT_DIR}/' 폴더에 {len(doc_ids)}개 파일 저장됨")

if __name__ == "__main__":
    export()
