from google import genai
from google.genai import types
from typing import Generator
from config import GOOGLE_API_KEY
from services.llm.base import BaseLLM


class GeminiLLM(BaseLLM):
    AVAILABLE_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]

    def __init__(self, model: str = "gemini-2.0-flash"):
        self._model = model
        self._client = genai.Client(api_key=GOOGLE_API_KEY)

    @property
    def model_name(self) -> str:
        return self._model

    def chat_stream(self, system_prompt: str, user_message: str) -> Generator[str, None, None]:
        for chunk in self._client.models.generate_content_stream(
            model=self._model,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
            ),
        ):
            if chunk.text:
                yield chunk.text
