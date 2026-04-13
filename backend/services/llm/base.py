from abc import ABC, abstractmethod
from typing import Generator


class BaseLLM(ABC):
    @abstractmethod
    def chat_stream(self, system_prompt: str, user_message: str) -> Generator[str, None, None]:
        """스트리밍 방식으로 응답 생성"""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        pass
