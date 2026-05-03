"""
쿼리 재작성 — 대화체 질문을 검색 최적화 키워드로 변환

"머신러닝에 대해 알려줘" → "머신러닝 개념 원리 정의"
"""

from services.llm import get_llm

_SYSTEM_PROMPT = (
    "사용자의 질문을 문서 검색에 최적화된 핵심 키워드/구문으로 변환하세요.\n"
    "규칙:\n"
    "- '알려줘', '설명해줘', '~에 대해', '~란 무엇인가', '~는 뭐야' 같은 표현 제거\n"
    "- 핵심 명사, 개념, 기술 용어 중심으로 정리\n"
    "- 한 줄로만 답하고 변환된 쿼리만 출력 (다른 설명 금지)\n"
    "예시:\n"
    "  '머신러닝에 대해 알려줘' → '머신러닝 개념 원리 정의'\n"
    "  '경사하강법이 뭐야?' → '경사하강법 알고리즘 원리'\n"
    "  '오버피팅은 왜 발생해?' → '오버피팅 발생 원인'"
)


def rewrite_query(question: str, provider: str, model: str) -> str:
    try:
        llm = get_llm(provider, model)
        messages = [{"role": "user", "content": f"질문: {question}"}]
        result = "".join(llm.chat_stream(_SYSTEM_PROMPT, messages)).strip()
        if 2 <= len(result) <= 150:
            return result
        return question
    except Exception:
        return question
