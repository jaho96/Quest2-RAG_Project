import httpx
from typing import Generator
import json
from config import OLLAMA_BASE_URL
from services.llm.base import BaseLLM


class OllamaLLM(BaseLLM):
    AVAILABLE_MODELS = ["llama3.2", "mistral", "gemma2"]

    def __init__(self, model: str = "llama3.2"):
        self._model = model

    @property
    def model_name(self) -> str:
        return self._model

    def chat_stream(self, system_prompt: str, user_message: str) -> Generator[str, None, None]:
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "stream": True,
        }
        with httpx.stream("POST", f"{OLLAMA_BASE_URL}/api/chat", json=payload, timeout=120) as response:
            for line in response.iter_lines():
                if line:
                    data = json.loads(line)
                    content = data.get("message", {}).get("content", "")
                    if content:
                        yield content
