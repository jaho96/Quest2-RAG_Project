"""
대화 히스토리 관리

1. 토큰 수 기반 동적 제한  — 토큰 초과 방지
2. 긴 대화 요약            — 오래된 대화는 요약본으로 압축
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from services.llm.base import BaseLLM

# 설정
MAX_HISTORY_TOKENS  = 4000   # 히스토리에 허용할 최대 토큰 수
SUMMARY_THRESHOLD   = 20     # 이 메시지 수 초과 시 요약 시작 (10턴)
MESSAGES_TO_KEEP    = 10     # 요약 후 최근 유지할 메시지 수


def _estimate_tokens(text: str) -> int:
    """토큰 수 추정 (한국어 기준 약 2~3자 = 1토큰)"""
    return max(1, len(text) // 3)


def _total_tokens(messages: list[dict]) -> int:
    return sum(_estimate_tokens(m["content"]) for m in messages)


# ── 1단계: 토큰 기반 제한 ──────────────────────────────────────────

def truncate_by_tokens(messages: list[dict], max_tokens: int = MAX_HISTORY_TOKENS) -> list[dict]:
    """
    토큰 예산을 초과하면 오래된 메시지부터 제거
    마지막 메시지(현재 질문)는 항상 유지
    """
    if _total_tokens(messages) <= max_tokens:
        return messages

    result = [messages[-1]]  # 현재 질문은 항상 포함
    budget = max_tokens - _estimate_tokens(messages[-1]["content"])

    for msg in reversed(messages[:-1]):
        tokens = _estimate_tokens(msg["content"])
        if budget - tokens < 0:
            break
        result.insert(0, msg)
        budget -= tokens

    return result


# ── 2단계: 긴 대화 요약 ───────────────────────────────────────────

def _summarize(messages: list[dict], llm: BaseLLM) -> str:
    """이전 대화 내용을 LLM으로 요약"""
    conv_text = "\n".join(
        f"{'사용자' if m['role'] == 'user' else 'AI'}: {m['content']}"
        for m in messages
    )
    system = "대화 내용을 3~5문장으로 간결하게 요약하세요. 핵심 주제와 결론만 포함하세요."
    summary_msg = [{"role": "user", "content": f"다음 대화를 요약해주세요:\n\n{conv_text}"}]

    return "".join(llm.chat_stream(system, summary_msg))


def compress_history(messages: list[dict], llm: BaseLLM) -> list[dict]:
    """
    메시지 수가 SUMMARY_THRESHOLD 초과 시:
    - 앞부분(오래된 대화)을 요약
    - 요약본 + 최근 MESSAGES_TO_KEEP개 메시지로 재구성
    """
    if len(messages) <= SUMMARY_THRESHOLD:
        return messages

    split = len(messages) - MESSAGES_TO_KEEP
    older   = messages[:split]
    recent  = messages[split:]

    summary_text = _summarize(older, llm)

    summary_message = {
        "role": "assistant",
        "content": f"[이전 대화 요약]\n{summary_text}",
    }

    return [summary_message] + recent


# ── 메인 진입점 ───────────────────────────────────────────────────

def prepare(
    messages: list[dict],
    llm: BaseLLM,
    enable_summary: bool = True,
) -> list[dict]:
    """
    히스토리를 LLM 전달 전에 전처리

    1. 긴 대화 → 요약 압축 (enable_summary=True 시)
    2. 토큰 예산 초과 → 오래된 것부터 제거
    """
    if not messages:
        return messages

    # 1. 요약 압축
    if enable_summary and len(messages) > SUMMARY_THRESHOLD + 1:
        messages = compress_history(messages[:-1], llm) + [messages[-1]]

    # 2. 토큰 제한
    messages = truncate_by_tokens(messages)

    return messages