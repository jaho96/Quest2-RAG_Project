import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.embedder import embed_query
import services.vector_store as vs
from services.llm import get_llm, get_available_models

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    question: str
    provider: str = "groq"
    model: str = "llama-3.3-70b-versatile"
    top_k: int = 5


@router.get("/models")
def list_models():
    return get_available_models()


@router.post("/stream")
def chat_stream(req: ChatRequest):
    # 문서가 없으면 바로 오류 반환
    if not vs.list_documents():
        raise HTTPException(status_code=404, detail="문서를 먼저 업로드해주세요.")

    # 관련 문서 검색
    query_embedding = embed_query(req.question)
    sources = vs.search(query_embedding, top_k=req.top_k)

    if not sources:
        raise HTTPException(status_code=404, detail="관련 내용을 문서에서 찾지 못했습니다.")

    context = "\n\n---\n\n".join(
        f"[출처: {s['metadata']['filename']} / 청크 #{s['metadata']['chunk_index']}]\n{s['text']}"
        for s in sources
    )

    system_prompt = (
        "당신은 업로드된 문서를 기반으로 질문에 답변하는 AI 어시스턴트입니다.\n"
        "반드시 아래 제공된 문서 내용만을 근거로 답변하세요.\n"
        "문서에 없는 내용은 '문서에서 찾을 수 없습니다.'라고 답하세요.\n\n"
        f"[참고 문서]\n{context}"
    )

    llm = get_llm(req.provider, req.model)

    def generate():
        try:
            sources_data = [
                {
                    "filename": s["metadata"]["filename"],
                    "chunk_index": s["metadata"]["chunk_index"],
                    "score": round(s["score"], 3),
                }
                for s in sources
            ]
            yield f"data: {json.dumps({'type': 'sources', 'sources': sources_data}, ensure_ascii=False)}\n\n"

            for token in llm.chat_stream(system_prompt, req.question):
                yield f"data: {json.dumps({'type': 'token', 'content': token}, ensure_ascii=False)}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
