from abc import ABC, abstractmethod
from typing import Generator


class BaseLLM(ABC):
    @abstractmethod
    def chat_stream(
        self,
        system_prompt: str,
        messages: list[dict],
    ) -> Generator[str, None, None]:
        """
        스트리밍 방식으로 응답 생성

        messages: [
            {"role": "user",      "content": "세종대왕은?"},
            {"role": "assistant", "content": "조선 4대 왕..."},
            {"role": "user",      "content": "그럼 훈민정음은?"},  ← 마지막이 현재 질문
        ]
        """
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        pass