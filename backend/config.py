from dotenv import load_dotenv
import os

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

# LangSmith
LANGSMITH_API_KEY = os.getenv("LANGSMITH_API_KEY", "")
LANGSMITH_PROJECT = os.getenv("LANGSMITH_PROJECT", "RAG-Project-Quest2")
LANGSMITH_TRACING = os.getenv("LANGSMITH_TRACING", "false")

# LangSmith 환경변수 설정 (SDK가 자동으로 읽음)
os.environ["LANGSMITH_API_KEY"] = LANGSMITH_API_KEY
os.environ["LANGSMITH_PROJECT"] = LANGSMITH_PROJECT
os.environ["LANGCHAIN_TRACING_V2"] = LANGSMITH_TRACING

UPLOAD_DIR = "uploads"
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/ragdb")

os.makedirs(UPLOAD_DIR, exist_ok=True)
