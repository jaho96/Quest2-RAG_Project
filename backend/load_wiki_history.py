"""
위키백과 카테고리 기반으로 한국사 문서를 RAG 파이프라인에 적재하는 스크립트

키워드 방식 대신 위키백과 카테고리 API를 사용해 정확한 문서만 수집합니다.

실행 위치: backend/
실행 방법:
    python load_wiki_history.py          # 기본 500개 추가
    python load_wiki_history.py 200      # 200개 추가
    python load_wiki_history.py --reset  # 체크포인트 초기화
"""

import sys
import os
import uuid
import hashlib
import json
import time
import requests
from datetime import datetime, timezone

from services.document_parser import split_into_chunks
from services.embedder import embed_texts
import services.vector_store as vs


# ────────────────────────────── 설정 ──────────────────────────────
LIMIT = 500
BATCH_SIZE = 20
CHUNK_SIZE = 500
OVERLAP = 50
CHECKPOINT_FILE = "wiki_checkpoint.json"
PREVIEW_FILE = "wiki_history_preview.jsonl"

# 수집할 위키백과 카테고리 목록 (한국사 관련)
TARGET_CATEGORIES = [
    # ── 시대별 ────────────────────────────────────────────
    "한국의 역사",
    "고조선",
    "고구려",
    "백제",
    "신라",
    "가야",
    "삼국 시대",
    "통일신라",
    "발해",
    "고려의 역사",
    "조선의 역사",
    "대한제국",
    "일제강점기",
    "대한민국의 역사",

    # ── 사건/전쟁 ──────────────────────────────────────────
    "한국의 독립운동",
    "임진왜란",
    "병자호란",
    "동학 농민 운동",
    "3·1 운동",
    "6·25 전쟁",           # "한국 전쟁" → 1개, 정확한 이름으로 수정
    "을사조약",
    "경술국치",             # "한일 병합 조약" → 0개, 수정
    "갑오경장",             # "갑오개혁" → 0개, 수정

    # ── 인물 ──────────────────────────────────────────────
    "조선의 역대 국왕",     # "조선의 군주" → 0개, 수정
    "고려의 역대 국왕",     # "고려의 군주" → 0개, 수정
    "한국의 독립운동가",
    "대한민국의 대통령",
    "대한제국 황제",        # "대한제국의 황제" → 0개, 수정

    # ── 조선 주요 왕 ───────────────────────────────────────
    "태조 (조선)",          # 조선 건국
    "태종 (조선)",          # 왕권 강화, 6조직계제
    "세종 (조선)",          # 훈민정음, 과학·문화 전성기
    "세조 (조선)",          # 계유정난, 왕위 찬탈
    "성종 (조선)",          # 경국대전 완성
    "연산군",               # 무오·갑자사화, 폭정
    "중종 (조선)",          # 중종반정, 조광조 개혁
    "선조 (조선)",          # 임진왜란 시기 국왕
    "광해군",               # 중립외교, 인조반정
    "인조 (조선)",          # 병자호란, 삼전도의 굴욕
    "효종 (조선)",          # 북벌 정책
    "숙종 (조선)",          # 환국정치, 장희빈
    "영조 (조선)",          # 탕평책, 사도세자
    "정조 (조선)",          # 수원화성, 규장각, 개혁정치
    "순조 (조선)",          # 세도정치 시작
    "고종 (조선)",          # 대한제국 선포

    # ── 문화/유산 ──────────────────────────────────────────
    "대한민국의 유네스코 세계유산",  # "한국의 유네스코 세계유산" → 0개, 수정
    "조선의 문화",
    "한국의 불교",
    "한국의 유교",
]

WIKI_API = "https://ko.wikipedia.org/w/api.php"
# ──────────────────────────────────────────────────────────────────


def calc_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def batch(lst: list, size: int):
    for i in range(0, len(lst), size):
        yield lst[i : i + size]


# ── 체크포인트 관리 ────────────────────────────────────────────────

def load_checkpoint() -> dict:
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
            ckpt = json.load(f)
        print(f"📌 체크포인트 발견 — 누적 저장: {ckpt['total_stored']}개")
        return ckpt
    return {"total_stored": 0, "processed_titles": []}


def save_checkpoint(total_stored: int, processed_titles: list):
    with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
        json.dump(
            {"total_stored": total_stored, "processed_titles": processed_titles},
            f, ensure_ascii=False, indent=2,
        )


def reset_checkpoint():
    if os.path.exists(CHECKPOINT_FILE):
        os.remove(CHECKPOINT_FILE)
        print("🗑️  체크포인트 초기화 완료.")
    else:
        print("체크포인트 파일이 없습니다.")


# ── 위키백과 API ───────────────────────────────────────────────────

def get_category_members(category: str) -> list[str]:
    """카테고리에 속한 문서 제목 목록 반환"""
    titles = []
    params = {
        "action": "query",
        "list": "categorymembers",
        "cmtitle": f"Category:{category}",
        "cmlimit": 500,
        "cmtype": "page",   # 하위 카테고리 제외, 문서만
        "format": "json",
    }

    headers = {"User-Agent": "RAGProject/1.0 (educational purpose)"}

    while True:
        try:
            res = requests.get(WIKI_API, params=params, headers=headers, timeout=15)
            if not res.text.strip():
                print(f"    ⚠️  빈 응답 (category={category}), 건너뜀")
                break
            data = res.json()
        except Exception as e:
            print(f"    ⚠️  API 오류 ({e}), 건너뜀")
            break

        members = data.get("query", {}).get("categorymembers", [])
        titles.extend(m["title"] for m in members)

        # 다음 페이지가 있으면 계속
        cont = data.get("continue", {})
        if not cont:
            break
        params["cmcontinue"] = cont["cmcontinue"]
        time.sleep(0.3)

    return titles


def get_page_content(title: str) -> dict | None:
    """문서 제목으로 본문 텍스트와 URL 반환"""
    headers = {"User-Agent": "RAGProject/1.0 (educational purpose)"}
    params = {
        "action": "query",
        "titles": title,
        "prop": "extracts|info",
        "explaintext": "1",      # HTML 태그 제거, 순수 텍스트
        "exlimit": "1",
        "inprop": "url",
        "format": "json",
        "utf8": "1",
    }
    try:
        res = requests.get(WIKI_API, params=params, headers=headers, timeout=15)
        if not res.text.strip():
            return None
        data = res.json()
        pages = data["query"]["pages"]
        page = next(iter(pages.values()))

        if "missing" in page:
            return None

        text = page.get("extract", "")
        if not text:
            return None

        return {
            "title": page.get("title", title),
            "text": text,
            "url": page.get("fullurl", f"https://ko.wikipedia.org/wiki/{title}"),
        }
    except Exception:
        return None


# ── 메인 적재 함수 ─────────────────────────────────────────────────

def load_and_store(limit: int = LIMIT):
    checkpoint = load_checkpoint()
    total_stored = checkpoint["total_stored"]
    processed_titles = set(checkpoint["processed_titles"])

    # ── 1. 카테고리별 문서 제목 수집 ────────────────────────────────
    print("📂 카테고리에서 문서 목록 수집 중...")
    all_titles = []
    seen_titles = set()

    for category in TARGET_CATEGORIES:
        print(f"  → {category} ...", end=" ")
        titles = get_category_members(category)
        new = [t for t in titles if t not in seen_titles]
        seen_titles.update(new)
        all_titles.extend(new)
        print(f"{len(new)}개")
        time.sleep(0.3)

    # 이미 처리한 제목 제외
    remaining = [t for t in all_titles if t not in processed_titles]
    print(f"\n총 {len(all_titles)}개 문서 (미처리: {len(remaining)}개)\n")

    stored_this_run = 0
    skipped_dup = 0
    skipped_empty = 0

    with open(PREVIEW_FILE, "a", encoding="utf-8") as preview_f:
        try:
            for title in remaining:
                if stored_this_run >= limit:
                    break

                # ── 2. 문서 본문 가져오기 ────────────────────────────
                page = get_page_content(title)
                processed_titles.add(title)

                if not page or len(page["text"].strip()) < 100:
                    skipped_empty += 1
                    continue

                text = page["text"]
                url  = page["url"]

                # ── 3. 중복 체크 ─────────────────────────────────────
                file_hash = calc_hash(text)
                existing = vs.get_document_by_hash(file_hash)
                if existing:
                    skipped_dup += 1
                    continue

                # ── 4. 청크 분할 ─────────────────────────────────────
                pages_data = [{"text": text, "page": None}]
                chunks = split_into_chunks(pages_data, chunk_size=CHUNK_SIZE, overlap=OVERLAP)
                if not chunks:
                    continue

                # ── 5. 임베딩 ────────────────────────────────────────
                chunk_texts = [c["text"] for c in chunks]
                embeddings: list[list[float]] = []
                for b in batch(chunk_texts, BATCH_SIZE):
                    embeddings.extend(embed_texts(b))

                # ── 6. 메타데이터 구성 및 저장 ───────────────────────
                doc_id      = str(uuid.uuid4())
                uploaded_at = datetime.now(timezone.utc).isoformat()
                file_size   = len(text.encode("utf-8"))
                filename    = f"{title}.wiki"

                vs.add_chunks(
                    doc_id=doc_id,
                    filename=filename,
                    file_type="wiki",
                    uploaded_at=uploaded_at,
                    file_size=file_size,
                    file_hash=file_hash,
                    chunks=chunks,
                    embeddings=embeddings,
                    total_chunks=len(chunks),
                )

                # ── 7. 미리보기 저장 ─────────────────────────────────
                preview_f.write(json.dumps({
                    "doc_id": doc_id,
                    "title": title,
                    "url": url,
                    "summary": text[:200].replace("\n", " ") + "...",
                    "chunks": len(chunks),
                    "file_hash": file_hash,
                    "uploaded_at": uploaded_at,
                }, ensure_ascii=False) + "\n")

                stored_this_run += 1
                total_stored    += 1

                # ── 8. 체크포인트 저장 (10개마다) ────────────────────
                if stored_this_run % 10 == 0:
                    save_checkpoint(total_stored, list(processed_titles))

                if stored_this_run % 50 == 0 or stored_this_run == 1:
                    print(f"  ✅ {stored_this_run}개 저장 (누적: {total_stored}개 | 중복: {skipped_dup}개)")

                time.sleep(0.1)   # API 부하 조절

        except KeyboardInterrupt:
            print("\n⚠️  중단됨. 체크포인트 저장 중...")

    save_checkpoint(total_stored, list(processed_titles))

    print(f"\n{'='*50}")
    print(f"🎉 완료!")
    print(f"   이번 저장  : {stored_this_run}개")
    print(f"   누적 저장  : {total_stored}개")
    print(f"   중복 건너뜀: {skipped_dup}개")
    print(f"   내용 없음  : {skipped_empty}개")
    print(f"{'='*50}")


if __name__ == "__main__":
    if "--reset" in sys.argv:
        reset_checkpoint()
        sys.exit(0)

    limit = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else LIMIT
    load_and_store(limit=limit)
