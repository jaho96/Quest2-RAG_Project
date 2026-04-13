from services.llm.base import BaseLLM
from services.llm.openai_llm import OpenAILLM
from services.llm.claude_llm import ClaudeLLM
from services.llm.groq_llm import GroqLLM
from services.llm.gemini_llm import GeminiLLM


def get_llm(provider: str, model: str) -> BaseLLM:
    if provider == "openai":
        return OpenAILLM(model=model)
    elif provider == "claude":
        return ClaudeLLM(model=model)
    elif provider == "groq":
        return GroqLLM(model=model)
    elif provider == "gemini":
        return GeminiLLM(model=model)
    else:
        raise ValueError(f"지원하지 않는 LLM provider: {provider}")


def get_available_models() -> dict:
    return {
        "groq": GroqLLM.AVAILABLE_MODELS,
        "gemini": GeminiLLM.AVAILABLE_MODELS,
        "openai": OpenAILLM.AVAILABLE_MODELS,
        "claude": ClaudeLLM.AVAILABLE_MODELS,
    }
