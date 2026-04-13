from mistralai import Mistral
from typing import Generator
from config import MISTRAL_API_KEY
from services.llm.base import BaseLLM


class MistralLLM(BaseLLM):
    AVAILABLE_MODELS = ["mistral-small-latest", "open-mistral-7b"]

    def __init__(self, model: str = "mistral-small-latest"):
        self._model = model
        self._client = Mistral(api_key=MISTRAL_API_KEY)

    @property
    def model_name(self) -> str:
        return self._model

    def chat_stream(self, system_prompt: str, user_message: str) -> Generator[str, None, None]:
        stream = self._client.chat.stream(
            model=self._model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
        for event in stream:
            delta = event.data.choices[0].delta.content
            if delta:
                yield delta
