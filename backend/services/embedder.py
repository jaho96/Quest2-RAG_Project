from openai import OpenAI
from config import OPENAI_API_KEY
from services.cache import get_embedding, set_embedding

_client = OpenAI(api_key=OPENAI_API_KEY)
EMBEDDING_MODEL = "text-embedding-3-small"


def embed_texts(texts: list[str]) -> list[list[float]]:
    response = _client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
    return [item.embedding for item in response.data]


def embed_query(text: str) -> list[float]:
    # 캐시 확인
    cached = get_embedding(text)
    if cached is not None:
        return cached

    # API 호출
    vector = embed_texts([text])[0]

    # 캐시 저장
    set_embedding(text, vector)
    return vector