"""
Arize Phoenix — RAG 파이프라인 디버깅 및 추적

Phoenix UI: http://localhost:6006
"""

import os


def setup_phoenix():
    """Phoenix OpenTelemetry 계측 초기화"""
    try:
        from phoenix.otel import register
        from openinference.instrumentation.openai import OpenAIInstrumentor
        from openinference.instrumentation.anthropic import AnthropicInstrumentor
        from openinference.instrumentation.groq import GroqInstrumentor

        # Phoenix 서버에 트레이스 전송 (로컬 기본 포트 6006)
        PHOENIX_ENDPOINT = os.getenv(
            "PHOENIX_COLLECTOR_ENDPOINT",
            "http://localhost:6006/v1/traces"
        )

        tracer_provider = register(
            project_name=os.getenv("PHOENIX_PROJECT", "rag-chat"),
            endpoint=PHOENIX_ENDPOINT,
        )

        # LLM 제공자별 자동 계측
        OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
        AnthropicInstrumentor().instrument(tracer_provider=tracer_provider)
        GroqInstrumentor().instrument(tracer_provider=tracer_provider)

        # Gemini는 패키지가 없을 수 있으므로 선택적으로 계측
        try:
            from openinference.instrumentation.google_genai import GoogleGenAIInstrumentor
            GoogleGenAIInstrumentor().instrument(tracer_provider=tracer_provider)
        except ImportError:
            pass

        print(f"[Phoenix] 트레이싱 시작 → http://localhost:6006")

    except Exception as e:
        # Phoenix 미실행 시 서버 시작에 영향 없음
        print(f"[Phoenix] 연결 실패 (무시됨): {e}")