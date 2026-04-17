from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import documents, chat, evaluate, quiz, conversations
from services.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()   # 서버 시작 시 테이블 생성
    yield


app = FastAPI(title="RAG API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite 개발 서버
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(evaluate.router)
app.include_router(quiz.router)
app.include_router(conversations.router)


@app.get("/health")
def health():
    return {"status": "ok"}