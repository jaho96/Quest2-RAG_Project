"""
키워드 기준에 맞지 않는 문서를 ChromaDB와 레지스트리에서 삭제

실행: python cleanup_docs.py
      python cleanup_docs.py --dry-run   # 실제 삭제 없이 대상 목록만 확인
"""

import sys
from services.vector_store import _load_registry, delete_document

HISTORY_KEYWORDS = [
    "조선", "고려", "신라", "백제", "고구려", "가야",
    "삼국", "통일신라", "발해", "고조선",
    "임진왜란", "병자호란", "일제강점기", "독립운동",
    "한국의 역사", "대한민국의 역사", "근현대사",
    "왕조", "왕건", "이성계", "세종", "광개토",
    "동학농민", "3·1 운동", "갑오개혁", "을사늑약",
]

def is_history(title: str) -> bool:
    return any(kw in title for kw in HISTORY_KEYWORDS)


def cleanup(dry_run: bool = False):
    registry = _load_registry()
    total = len(registry)

    to_delete = [
        entry for entry in registry.values()
        if not is_history(entry["filename"].replace(".wiki", ""))
    ]

    print(f"전체 문서: {total}개")
    print(f"삭제 대상: {len(to_delete)}개")
    print(f"유지 대상: {total - len(to_delete)}개\n")

    if dry_run:
        print("[ 삭제될 문서 목록 (--dry-run) ]")
        for e in to_delete:
            print(f"  - {e['filename'].replace('.wiki', '')}")
        print("\n실제 삭제하려면 --dry-run 없이 실행하세요.")
        return

    confirm = input(f"{len(to_delete)}개 문서를 삭제합니다. 계속할까요? (y/n): ")
    if confirm.lower() != "y":
        print("취소됐습니다.")
        return

    for i, entry in enumerate(to_delete, 1):
        title = entry["filename"].replace(".wiki", "")
        delete_document(entry["doc_id"])
        print(f"  [{i}/{len(to_delete)}] 삭제: {title}")

    print(f"\n완료! {len(to_delete)}개 문서가 삭제됐습니다.")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    cleanup(dry_run=dry_run)
