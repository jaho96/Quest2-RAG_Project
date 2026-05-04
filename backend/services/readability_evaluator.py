"""
LLM-as-judge 가독성 평가 — 답변 완료 후 백그라운드에서 실행
"""

import threading
from services.llm import get_llm

_EVAL_PROMPT = (
    "아래 AI 답변의 가독성을 평가하세요.\n\n"
    "평가 기준:\n"
    "5점 - 소제목·목록·강조 등 구조가 명확하고 매우 읽기 쉬움\n"
    "4점 - 구조화가 잘 되어 있고 읽기 편함\n"
    "3점 - 보통 수준, 읽을 수 있지만 구조 개선 여지 있음\n"
    "2점 - 구조 부족 또는 너무 길어 읽기 불편함\n"
    "1점 - 가독성 매우 낮음\n\n"
    "숫자 하나만 답하세요 (1, 2, 3, 4, 5 중 하나):"
)


def _run(answer: str, provider: str, model: str, trace_id: str):
    try:
        from services.trace_store import save_readability_score
        llm = get_llm(provider, model)
        messages = [{"role": "user", "content": f"[평가할 답변]\n{answer}"}]
        result = "".join(llm.chat_stream(_EVAL_PROMPT, messages)).strip()
        for ch in result:
            if ch.isdigit() and 1 <= int(ch) <= 5:
                save_readability_score(trace_id, float(ch))
                break
    except Exception:
        pass


def evaluate_async(answer: str, provider: str, model: str, trace_id: str):
    """백그라운드 스레드로 가독성 평가 실행 — 스트리밍 응답과 무관하게 처리"""
    threading.Thread(
        target=_run,
        args=(answer, provider, model, trace_id),
        daemon=True,
    ).start()
