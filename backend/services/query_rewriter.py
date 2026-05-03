"""
쿼리 전처리 — 두 가지 전략을 병렬 실행

1. rewrite_query : 대화체 질문 → 검색 최적화 키워드 (키워드 검색용)
2. hyde_query    : 질문 → 가상 답변 단락 (벡터 검색용, HyDE)
"""

from concurrent.futures import ThreadPoolExecutor
from services.llm import get_llm

_REWRITE_PROMPT = (
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

_HYDE_PROMPT = (
    "사용자의 질문에 대해 교과서나 기술 문서에서 발췌한 것 같은 설명 단락을 작성하세요.\n"
    "규칙:\n"
    "- 실제 문서 단락처럼 전문 용어와 구체적인 개념을 포함하세요\n"
    "- 3~5문장 이내로 핵심 내용만 작성하세요\n"
    "- 단락만 출력하고 다른 설명은 붙이지 마세요"
)


def rewrite_query(question: str, provider: str, model: str) -> str:
    try:
        llm = get_llm(provider, model)
        messages = [{"role": "user", "content": f"질문: {question}"}]
        result = "".join(llm.chat_stream(_REWRITE_PROMPT, messages)).strip()
        if 2 <= len(result) <= 150:
            return result
        return question
    except Exception:
        return question


def hyde_query(question: str, provider: str, model: str) -> str:
    """HyDE: 가상 답변 단락을 생성해 벡터 검색 임베딩에 사용"""
    try:
        llm = get_llm(provider, model)
        messages = [{"role": "user", "content": question}]
        result = "".join(llm.chat_stream(_HYDE_PROMPT, messages)).strip()
        if len(result) > 20:
            return result
        return question
    except Exception:
        return question


def prepare_queries(question: str, provider: str, model: str) -> tuple[str, str]:
    """rewrite + HyDE 를 병렬 실행 → (keyword_query, hyde_text)"""
    with ThreadPoolExecutor(max_workers=2) as pool:
        f_rewrite = pool.submit(rewrite_query, question, provider, model)
        f_hyde    = pool.submit(hyde_query,    question, provider, model)
        return f_rewrite.result(), f_hyde.result()
