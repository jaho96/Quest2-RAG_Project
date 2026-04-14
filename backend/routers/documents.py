import os
import uuid
import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from config import UPLOAD_DIR
from services.document_parser import parse_file, split_into_chunks
from services.embedder import embed_texts
import services.vector_store as vs

router = APIRouter(prefix="/documents", tags=["documents"])


def _calc_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


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

    try:
        full_text, pages = parse_file(save_path)
        if not full_text.strip():
            raise HTTPException(status_code=400, detail="문서에서 텍스트를 추출할 수 없습니다.")

        chunks = split_into_chunks(pages)
        texts = [c["text"] for c in chunks]
        embeddings = embed_texts(texts)

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

    except HTTPException:
        os.remove(save_path)
        raise
    except Exception as e:
        os.remove(save_path)
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "doc_id": doc_id,
        "filename": file.filename,
        "chunks": len(chunks),
        "duplicate": False,
    }


@router.get("/")
def list_documents():
    return vs.list_documents()


@router.delete("/{doc_id}")
def delete_document(doc_id: str):
    vs.delete_document(doc_id)
    return {"message": "삭제 완료"}
