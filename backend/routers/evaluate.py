import json
import os
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import OpenAI

from config import OPENAI_API_KEY
from services.embedder import embed_query
import services.vector_store as vs
from services.llm import get_llm

router = APIRouter(prefix="/evaluate", tags=["evaluate"])

QUIZ_FILE = "quiz_data.json"
TOP_K = 5


class EvalRequest(BaseModel):
    provider: str = "groq"
    model: str = "llama-3.3-70b-versatile"


def rag_answer(question: str, provider: str, model: str) -> str:
    query_embedding = embed_query(question)
    sources = vs.search(query_embedding, top_k=TOP_K)

    if not sources:
        return "관련 문서를 찾지 못했습니다."

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
    llm = get_llm(provider, model)
    return "".join(llm.chat_stream(system_prompt, question))


def judge_answer(question: str, correct_key: str, correct_text: str, rag_response: str) -> bool:
    client = OpenAI(api_key=OPENAI_API_KEY)
    prompt = f"""다음은 한국사 퀴즈 문제와 정답, 그리고 RAG 시스템의 답변입니다.

[문제]
{question}

[정답 선택지 ({correct_key})]
{correct_text}

[RAG 답변]
{rag_response}

RAG 답변이 정답 선택지의 핵심 내용을 포함하거나 올바르게 설명하고 있으면 "correct",
그렇지 않으면 "incorrect"라고만 답하세요."""

    client_oai = OpenAI(api_key=OPENAI_API_KEY)
    resp = client_oai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    verdict = resp.choices[0].message.content.strip().lower()
    return "correct" in verdict


@router.get("/status")
def get_status():
    return {"ready": os.path.exists(QUIZ_FILE)}


@router.post("/run")
def run_evaluation(req: EvalRequest):
    def generate():
        try:
            with open(QUIZ_FILE, "r", encoding="utf-8") as f:
                quiz = json.load(f)

            total = len(quiz)
            yield f"data: {json.dumps({'type': 'start', 'total': total}, ensure_ascii=False)}\n\n"

            for i, q in enumerate(quiz):
                question     = q["question"]
                choices      = q["choices"]
                correct_key  = q["answer"]
                correct_text = choices[correct_key]

                rag_response = rag_answer(question, req.provider, req.model)
                is_correct   = judge_answer(question, correct_key, correct_text, rag_response)

                result = {
                    "type":         "result",
                    "id":           q["id"],
                    "question":     question,
                    "correct_key":  correct_key,
                    "correct_text": correct_text,
                    "rag_answer":   rag_response,
                    "is_correct":   is_correct,
                    "current":      i + 1,
                    "total":        total,
                }
                yield f"data: {json.dumps(result, ensure_ascii=False)}\n\n"

            correct_count = 0  # 프론트에서 집계
            yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
