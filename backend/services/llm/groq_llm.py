from groq import Groq
from typing import Generator
from config import GROQ_API_KEY
from services.llm.base import BaseLLM


class GroqLLM(BaseLLM):
    AVAILABLE_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]

    def __init__(self, model: str = "llama-3.3-70b-versatile"):
        self._model = model
        self._client = Groq(api_key=GROQ_API_KEY)

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
