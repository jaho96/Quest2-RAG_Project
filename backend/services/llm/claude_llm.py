import anthropic
from typing import Generator
from config import ANTHROPIC_API_KEY
from services.llm.base import BaseLLM


class ClaudeLLM(BaseLLM):
    AVAILABLE_MODELS = ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"]

    def __init__(self, model: str = "claude-sonnet-4-6"):
        self._model = model
        self._client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    @property
    def model_name(self) -> str:
        return self._model

    def chat_stream(self, system_prompt: str, user_message: str) -> Generator[str, None, None]:
        with self._client.messages.stream(
            model=self._model,
            max_tokens=2048,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        ) as stream:
            for text in stream.text_stream:
                yield text
