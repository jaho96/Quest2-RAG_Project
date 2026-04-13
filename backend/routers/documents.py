import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from config import UPLOAD_DIR
from services.document_parser import parse_file, split_into_chunks
from services.embedder import embed_texts
import services.vector_store as vs

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".pdf", ".txt", ".docx", ".hwp", ".hwpx"]:
        raise HTTPException(status_code=400, detail="PDF, TXT, DOCX, HWP, HWPX 파일만 업로드 가능합니다.")

    doc_id = str(uuid.uuid4())
    save_path = os.path.join(UPLOAD_DIR, f"{doc_id}{ext}")

    with open(save_path, "wb") as f:
        f.write(await file.read())

    try:
        text = parse_file(save_path)
        if not text.strip():
            raise HTTPException(status_code=400, detail="문서에서 텍스트를 추출할 수 없습니다.")

        chunks = split_into_chunks(text)
        embeddings = embed_texts(chunks)
        vs.add_chunks(doc_id, file.filename, chunks, embeddings)

    except Exception as e:
        os.remove(save_path)
        raise HTTPException(status_code=500, detail=str(e))

    return {"doc_id": doc_id, "filename": file.filename, "chunks": len(chunks)}


@router.get("/")
def list_documents():
    return vs.list_documents()


@router.delete("/{doc_id}")
def delete_document(doc_id: str):
    vs.delete_document(doc_id)
    return {"message": "삭제 완료"}
