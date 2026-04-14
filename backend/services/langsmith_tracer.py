import uuid
from datetime import datetime, timezone
from langsmith import Client
from config import LANGSMITH_API_KEY, LANGSMITH_PROJECT, LANGSMITH_TRACING

# 트레이싱 활성화 여부
_enabled = LANGSMITH_TRACING.lower() == "true" and bool(LANGSMITH_API_KEY)
_client = Client(api_key=LANGSMITH_API_KEY) if _enabled else None


class RAGTrace:
    """RAG 파이프라인 전체를 하나의 트레이스로 기록"""

    def __init__(self, question: str, provider: str, model: str):
        self.question = question
        self.provider = provider
        self.model = model
        self.run_id = uuid.uuid4()
        self.retrieval_run_id = uuid.uuid4()
        self.llm_run_id = uuid.uuid4()
        self.start_time = datetime.now(timezone.utc)
        self.sources = []
        self.full_response = []

    def start(self):
        if not _enabled:
            return
        _client.create_run(
            id=self.run_id,
            name="RAG Pipeline",
            run_type="chain",
            project_name=LANGSMITH_PROJECT,
            inputs={"question": self.question, "provider": self.provider, "model": self.model},
            start_time=self.start_time,
        )

    def log_retrieval(self, sources: list[dict]):
        """문서 검색 결과 기록"""
        self.sources = sources
        if not _enabled:
            return
        now = datetime.now(timezone.utc)
        _client.create_run(
            id=self.retrieval_run_id,
            parent_run_id=self.run_id,
            name="Document Retrieval",
            run_type="retriever",
            project_name=LANGSMITH_PROJECT,
            inputs={"query": self.question},
            outputs={
                "documents": [
                    {"content": s["text"], "metadata": s["metadata"], "score": s["score"]}
                    for s in sources
                ]
            },
            start_time=now,
            end_time=now,
        )

    def log_llm_start(self, system_prompt: str):
        """LLM 호출 시작 기록"""
        if not _enabled:
            return
        self._llm_start_time = datetime.now(timezone.utc)
        _client.create_run(
            id=self.llm_run_id,
            parent_run_id=self.run_id,
            name=f"{self.provider}/{self.model}",
            run_type="llm",
            project_name=LANGSMITH_PROJECT,
            inputs={
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": self.question},
                ]
            },
            start_time=self._llm_start_time,
        )

    def add_token(self, token: str):
        self.full_response.append(token)

    def finish(self, error: str = None):
        """트레이스 종료 및 최종 결과 기록"""
        if not _enabled:
            return
        now = datetime.now(timezone.utc)
        answer = "".join(self.full_response)

        # LLM 런 종료
        _client.update_run(
            run_id=self.llm_run_id,
            outputs={"generation": answer},
            end_time=now,
            error=error,
        )

        # 전체 파이프라인 런 종료
        _client.update_run(
            run_id=self.run_id,
            outputs={"answer": answer, "sources_count": len(self.sources)},
            end_time=now,
            error=error,
        )
