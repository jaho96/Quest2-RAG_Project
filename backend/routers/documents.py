import os
import uuid
import hashlib
import time
from datetime import datetime, timezone
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from config import UPLOAD_DIR
from services.document_parser import parse_file, split_into_chunks
from services.embedder import embed_texts
import services.vector_store as vs
from services.cache import invalidate_responses
from services.db import get_conn

router = APIRouter(prefix="/documents", tags=["documents"])


def _calc_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _cjk_ratio(text: str) -> float:
    """텍스트 중 한자(CJK) 비율 반환"""
    if not text:
        return 0.0
    cjk = sum(1 for c in text if "\u4e00" <= c <= "\u9fff")
    return cjk / len(text)


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".pdf", ".txt", ".docx", ".hwp", ".hwpx"]:
        raise HTTPException(status_code=400, detail="PDF, TXT, DOCX, HWP, HWPX 파일만 업로드 가능합니다.")

    file_data = await file.read()
    file_hash = _calc_hash(file_data)
    file_size = len(file_data)

    # 중복 파일 체크
    existing = vs.get_document_by_hash(file_hash)
    if existing:
        return {
            "doc_id": existing["doc_id"],
            "filename": existing["filename"],
            "duplicate": True,
            "message": "이미 업로드된 파일입니다.",
        }

    doc_id = str(uuid.uuid4())
    uploaded_at = datetime.now(timezone.utc).isoformat()
    file_type = ext.lstrip(".")
    save_path = os.path.join(UPLOAD_DIR, f"{doc_id}{ext}")

    with open(save_path, "wb") as f:
        f.write(file_data)

    success = False
    parse_ms = chunk_ms = embed_ms = db_ms = 0
    try:
        t = time.perf_counter()
        full_text, pages = parse_file(save_path)
        parse_ms = int((time.perf_counter() - t) * 1000)
        if not full_text.strip():
            raise HTTPException(status_code=400, detail="문서에서 텍스트를 추출할 수 없습니다.")

        t = time.perf_counter()
        chunks = split_into_chunks(pages)
        chunk_ms = int((time.perf_counter() - t) * 1000)

        t = time.perf_counter()
        texts = [c["text"] for c in chunks]
        embeddings = embed_texts(texts)
        embed_ms = int((time.perf_counter() - t) * 1000)

        t = time.perf_counter()
        vs.add_chunks(
            doc_id=doc_id,
            filename=file.filename,
            file_type=file_type,
            uploaded_at=uploaded_at,
            file_size=file_size,
            file_hash=file_hash,
            chunks=chunks,
            embeddings=embeddings,
            total_chunks=len(chunks),
        )
        db_ms = int((time.perf_counter() - t) * 1000)
        success = True

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if not success and os.path.exists(save_path):
            os.remove(save_path)

    total_ms = parse_ms + chunk_ms + embed_ms + db_ms
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO upload_traces
                (doc_id, filename, file_type, file_size, total_chunks,
                 parse_ms, chunk_ms, embed_ms, db_ms, total_ms)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (doc_id, file.filename, file_type, file_size, len(chunks),
              parse_ms, chunk_ms, embed_ms, db_ms, total_ms))

    invalidate_responses()  # 문서 추가 시 응답 캐시 초기화

    # 한자 비율이 3% 초과면 경고
    cjk = _cjk_ratio(full_text)
    warning = (
        "PDF 폰트 인코딩 문제로 일부 한글이 한자로 표시될 수 있습니다. "
        "검색 품질에 영향을 줄 수 있으니 다른 PDF 파일 사용을 권장합니다."
        if cjk > 0.03 else None
    )

    return {
        "doc_id": doc_id,
        "filename": file.filename,
        "chunks": len(chunks),
        "duplicate": False,
        "warning": warning,
    }


@router.get("/")
def list_documents():
    return vs.list_documents()


@router.delete("/")
def delete_all_documents():
    doc_ids = [d["doc_id"] for d in vs.list_documents()]
    for doc_id in doc_ids:
        vs.delete_document(doc_id)
    invalidate_responses()
    return {"deleted": len(doc_ids)}


@router.delete("/{doc_id}")
def delete_document(doc_id: str):
    vs.delete_document(doc_id)
    invalidate_responses()  # 문서 삭제 시 응답 캐시 초기화
    return {"message": "삭제 완료"}
