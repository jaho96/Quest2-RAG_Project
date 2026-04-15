"""
RAG 파이프라인 평가 스크립트 (LangSmith 연동)

실행 위치: backend/
실행 방법:
    python evaluate_rag.py                     # 기본 (groq / llama-3.3-70b)
    python evaluate_rag.py openai gpt-4o-mini  # provider model 지정
"""

import sys
import os
import json
from langsmith import Client, evaluate
from langsmith.schemas import Example, Run
from openai import OpenAI

from config import OPENAI_API_KEY, LANGSMITH_API_KEY, LANGSMITH_PROJECT
from services.embedder import embed_query
import services.vector_store as vs
from services.llm import get_llm

# ── 설정 ──────────────────────────────────────────────────────────────
PROVIDER = sys.argv[1] if len(sys.argv) > 1 else "groq"
MODEL    = sys.argv[2] if len(sys.argv) > 2 else "llama-3.3-70b-versatile"
DATASET_NAME = "한국사-퀴즈-20문제"
QUIZ_FILE = "quiz_data.json"
TOP_K = 5
# ──────────────────────────────────────────────────────────────────────


def load_quiz() -> list[dict]:
    with open(QUIZ_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def rag_answer(question: str) -> str:
    """RAG 파이프라인 직접 호출 → 전체 답변 텍스트 반환"""
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

    llm = get_llm(PROVIDER, MODEL)
    return "".join(llm.chat_stream(system_prompt, question))


# ── LangSmith target 함수 ──────────────────────────────────────────────
def rag_target(inputs: dict) -> dict:
    """LangSmith evaluate()가 호출하는 함수"""
    question     = inputs["question"]
    choices      = inputs["choices"]
    correct_key  = inputs["answer"]
    correct_text = choices[correct_key]

    answer = rag_answer(question)

    return {
        "answer":       answer,
        "correct_key":  correct_key,
        "correct_text": correct_text,
    }


# ── LLM-as-Judge 평가자 ────────────────────────────────────────────────
_judge = OpenAI(api_key=OPENAI_API_KEY)

def correctness_evaluator(run: Run, example: Example) -> dict:
    """RAG 답변이 정답 선택지 내용을 포함하는지 LLM이 채점"""
    outputs      = run.outputs or {}
    answer       = outputs.get("answer", "")
    correct_key  = outputs.get("correct_key", "")
    correct_text = outputs.get("correct_text", "")
    question     = example.inputs.get("question", "")

    prompt = f"""다음은 한국사 퀴즈 문제와 정답, 그리고 RAG 시스템의 답변입니다.

[문제]
{question}

[정답 선택지 ({correct_key})]
{correct_text}

[RAG 답변]
{answer}

RAG 답변이 정답 선택지의 핵심 내용을 포함하거나 올바르게 설명하고 있으면 "correct",
그렇지 않으면 "incorrect"라고만 답하세요."""

    resp = _judge.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    verdict = resp.choices[0].message.content.strip().lower()
    score = 1 if "correct" in verdict else 0

    return {"key": "correctness", "score": score}


# ── 메인 ──────────────────────────────────────────────────────────────
def main():
    ls_client = Client(api_key=LANGSMITH_API_KEY)
    quiz = load_quiz()

    # ── 1. LangSmith Dataset 생성 (이미 있으면 재사용) ─────────────────
    existing = [d for d in ls_client.list_datasets() if d.name == DATASET_NAME]
    if existing:
        dataset = existing[0]
        print(f"기존 Dataset 재사용: {DATASET_NAME}")
    else:
        dataset = ls_client.create_dataset(
            dataset_name=DATASET_NAME,
            description="NotebookLM으로 생성한 한국사 퀴즈 20문제",
        )
        examples = [
            {
                "inputs": {
                    "question": q["question"],
                    "choices":  q["choices"],
                    "answer":   q["answer"],
                },
                "outputs": {"answer": q["choices"][q["answer"]]},
            }
            for q in quiz
        ]
        ls_client.create_examples(
            inputs=[e["inputs"] for e in examples],
            outputs=[e["outputs"] for e in examples],
            dataset_id=dataset.id,
        )
        print(f"Dataset 생성 완료: {DATASET_NAME} ({len(quiz)}문제)")

    # ── 2. 평가 실행 ────────────────────────────────────────────────────
    experiment_name = f"RAG-{PROVIDER}-{MODEL}"
    print(f"\n평가 시작: {experiment_name}")
    print(f"모델: {PROVIDER} / {MODEL}\n")

    results = evaluate(
        rag_target,
        data=DATASET_NAME,
        evaluators=[correctness_evaluator],
        experiment_prefix=experiment_name,
        client=ls_client,
        metadata={"provider": PROVIDER, "model": MODEL, "top_k": TOP_K},
    )

    # ── 3. 결과 출력 ────────────────────────────────────────────────────
    scores = []
    print(f"\n{'='*60}")
    print(f"{'문제':<4} {'정답':<4} {'결과'}")
    print(f"{'='*60}")

    for i, r in enumerate(results._results):
        score = r["evaluation_results"]["results"][0].score
        correct_key = quiz[i]["answer"]
        mark = "✅" if score == 1 else "❌"
        question_short = quiz[i]["question"][:30] + "..."
        print(f"Q{quiz[i]['id']:<3} ({correct_key})  {mark}  {question_short}")
        scores.append(score)

    total = len(scores)
    correct = sum(scores)
    print(f"{'='*60}")
    print(f"최종 점수: {correct}/{total}  ({correct/total*100:.1f}%)")
    print(f"\nLangSmith에서 상세 결과 확인:")
    print(f"https://smith.langchain.com/o/~/projects/p/{LANGSMITH_PROJECT}")


if __name__ == "__main__":
    main()
