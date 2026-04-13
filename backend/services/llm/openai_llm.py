from openai import OpenAI
from typing import Generator
from config import OPENAI_API_KEY
from services.llm.base import BaseLLM


class OpenAILLM(BaseLLM):
    AVAILABLE_MODELS = ["gpt-4o", "gpt-4o-mini"]

    def __init__(self, model: str = "gpt-4o-mini"):
        self._model = model
        self._client = OpenAI(api_key=OPENAI_API_KEY)

    @property
    def model_name(self) -> str:
        return self._model

    def chat_stream(self, system_prompt: str, user_message: str) -> Generator[str, None, None]:
        stream = self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
