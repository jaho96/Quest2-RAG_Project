# RAG Chat

문서를 업로드하고 AI와 대화할 수 있는 RAG(Retrieval-Augmented Generation) 기반 챗봇 시스템입니다.

---

## 주요 기능

- **문서 업로드 및 임베딩** — PDF, DOCX, TXT, HWP 파일 업로드 후 자동 청킹 및 벡터 임베딩
- **RAG 채팅** — 업로드된 문서를 기반으로 질문에 답변, 스트리밍 응답
- **다중 LLM 지원** — Groq(무료), Google Gemini(무료), OpenAI GPT-4o, Claude 선택 가능
- **대화 히스토리** — 대화 저장·불러오기, 참고 출처 복원
- **응답 피드백** — 답변에 👍 / 👎 평가
- **응답 캐시** — Redis를 통한 동일 질문 즉시 응답
- **평가 대시보드** — 응답시간·검색 관련도 추이, 만족도 통계
- **임베딩 품질 분석** — 청크 크기 분포, 짧은 청크 비율 확인
- **퀴즈 생성** — 업로드된 문서 내용으로 단답형·객관식 퀴즈 자동 생성

---

## 기술 스택

### Backend
| 항목 | 내용 |
|------|------|
| 프레임워크 | FastAPI |
| 벡터 DB | PostgreSQL + pgvector |
| 임베딩 | OpenAI text-embedding-3-small |
| LLM | Groq / Google Gemini / OpenAI / Anthropic Claude |
| 캐시 | Redis (선택) |
| 문서 파싱 | PyMuPDF, python-docx, olefile |
| 모니터링 | LangSmith |

### Frontend
| 항목 | 내용 |
|------|------|
| 프레임워크 | React 18 + TypeScript |
| 번들러 | Vite |
| 스타일 | Tailwind CSS |
| 차트 | Recharts |

---

## 시작하기

### 사전 요구사항

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+ (pgvector 확장 포함)
- Redis (캐시 기능 사용 시, 선택)
- WSL2 (Windows 환경)

### 1. PostgreSQL + pgvector 설치 (Docker)

```bash
docker run -d \
  --name pgvector \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=ragdb \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

### 2. Redis 설치 (WSL, 선택)

```bash
sudo apt-get install -y redis-server
sudo service redis-server start
```

### 3. 백엔드 설정

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

`.env` 파일 생성:

```env
OPENAI_API_KEY=your_openai_key
GROQ_API_KEY=your_groq_key
GOOGLE_API_KEY=your_google_key
ANTHROPIC_API_KEY=your_anthropic_key

DATABASE_URL=postgresql://postgres:password@localhost:5432/ragdb
REDIS_URL=redis://localhost:6379

LANGSMITH_API_KEY=your_langsmith_key   # 선택
LANGSMITH_PROJECT=rag-project          # 선택
```

백엔드 실행:

```bash
uvicorn main:app --reload
```

### 4. 프론트엔드 설정

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속 (WSL 환경이면 Vite가 출력하는 Network URL 사용)

---

## 프로젝트 구조

```
RAG_Project/
├── backend/
│   ├── main.py                  # FastAPI 앱 진입점
│   ├── config.py                # 환경변수 설정
│   ├── requirements.txt
│   ├── routers/
│   │   ├── chat.py              # 채팅 스트리밍, 피드백
│   │   ├── documents.py         # 문서 업로드·삭제
│   │   ├── conversations.py     # 대화 히스토리 CRUD
│   │   ├── evaluate.py          # 평가 통계 API
│   │   └── quiz.py              # 퀴즈 생성·채점
│   └── services/
│       ├── db.py                # PostgreSQL 연결 풀, 테이블 초기화
│       ├── vector_store.py      # pgvector 청크 저장·검색
│       ├── embedder.py          # OpenAI 임베딩
│       ├── document_parser.py   # PDF·DOCX·TXT·HWP 파싱
│       ├── conversation_store.py# 대화 저장소
│       ├── trace_store.py       # 트레이스 저장소
│       ├── history_manager.py   # 대화 히스토리 토큰 관리
│       ├── cache.py             # Redis 캐시
│       ├── llm.py               # LLM 공통 인터페이스
│       └── langsmith_tracer.py  # LangSmith 연동
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── ChatPage.tsx     # 채팅 페이지
    │   │   ├── EvaluatePage.tsx # 평가 페이지
    │   │   └── QuizPage.tsx     # 퀴즈 페이지
    │   ├── components/
    │   │   ├── Layout.tsx       # 사이드바, 네비게이션
    │   │   ├── ChatWindow.tsx   # 메시지 목록
    │   │   ├── FileUpload.tsx   # 문서 업로드
    │   │   ├── ModelSelector.tsx# LLM 모델 선택
    │   │   ├── SourceViewer.tsx # 참고 출처 표시
    │   │   └── evaluate/        # 평가 탭 컴포넌트
    │   └── types/index.ts       # 공통 타입 정의
    └── vite.config.ts
```

---

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| POST | `/documents/upload` | 문서 업로드 |
| GET | `/documents/` | 문서 목록 |
| DELETE | `/documents/{id}` | 문서 삭제 |
| POST | `/chat/stream` | RAG 채팅 (SSE 스트리밍) |
| POST | `/chat/feedback` | 답변 피드백 |
| GET | `/conversations/` | 대화 목록 |
| POST | `/conversations/` | 대화 생성 |
| GET | `/conversations/{id}/messages` | 메시지 불러오기 |
| POST | `/conversations/{id}/messages` | 메시지 저장 |
| DELETE | `/conversations/{id}` | 대화 삭제 |
| GET | `/evaluate/stats` | 응답 품질 통계 |
| GET | `/evaluate/traces` | 트레이스 목록 |
| GET | `/evaluate/embedding-stats` | 임베딩 품질 통계 |
| POST | `/quiz/generate` | 퀴즈 생성 |
| POST | `/quiz/grade` | 퀴즈 채점 |
