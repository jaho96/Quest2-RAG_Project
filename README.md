# RAG Chat

문서를 업로드하고 AI와 대화할 수 있는 RAG(Retrieval-Augmented Generation) 기반 챗봇 시스템입니다.

---

## 주요 기능

- **문서 업로드 및 임베딩** — PDF, DOCX, TXT, HWP 파일 다중 업로드 후 자동 청킹 및 벡터 임베딩
- **문서 관리** — 파일 타입별 폴더 구조로 표시, 개별·전체 삭제 지원
- **RAG 채팅** — 업로드된 문서를 기반으로 질문에 답변, 스트리밍 응답
- **하이브리드 검색** — 벡터 유사도 검색과 키워드 검색(tsvector)을 RRF(Reciprocal Rank Fusion)로 결합
- **다중 LLM 지원** — Groq(무료), Google Gemini(무료), OpenAI GPT-4o, Claude 선택 가능
- **메타 쿼리 처리** — "어떤 문서가 있나요?", "주제를 알려줘", "요약해줘" 등 문서 관련 질문 자동 처리
- **예시 질문 카드** — 첫 질문을 돕는 클릭 가능한 예시 카드 제공
- **대화 히스토리** — 대화 저장·불러오기, 참고 출처 복원, 새 채팅·전체 삭제
- **대화 맥락 관리** — 토큰 기반 히스토리 트리밍으로 긴 대화도 맥락 유지
- **응답 피드백** — 답변에 👍 / 👎 평가
- **응답 캐시** — Redis를 통한 동일 질문 즉시 응답
- **서버 상태 표시** — 사이드바에서 백엔드 연결 상태 실시간 확인
- **자체 평가 대시보드** — LangSmith에서 영감을 받아 직접 구현한 모니터링 시스템
  - 응답 품질: 질문마다 트레이스를 저장하고 응답시간·검색 관련도 추이 차트, 만족도 통계, 캐시 히트율 시각화 / 데이터 초기화 지원
  - 임베딩 품질: 청크 크기 분포, 짧은 청크 비율 확인
  - 업로드 성능: 파싱·청킹·임베딩·DB 저장 단계별 소요 시간 측정 및 차트 시각화 / 데이터 초기화 지원
- **퀴즈 생성** — 업로드된 문서 내용으로 단답형·객관식 퀴즈 자동 생성
- **RAG 디버깅** — Arize Phoenix를 통한 파이프라인 스팬 추적 및 품질 분석

---

## 기술 스택

### Backend
| 항목 | 내용 |
|------|------|
| 프레임워크 | FastAPI |
| 벡터 DB | PostgreSQL + pgvector |
| 연결 관리 | psycopg2 ThreadedConnectionPool |
| 임베딩 | OpenAI text-embedding-3-small |
| LLM | Groq / Google Gemini / OpenAI / Anthropic Claude |
| 캐시 | Redis (선택) |
| 문서 파싱 | PyMuPDF, python-docx, olefile |
| 모니터링 | LangSmith, Arize Phoenix |

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
- Docker Desktop (PostgreSQL 컨테이너용)
- Redis (캐시 기능 사용 시, 선택)
- WSL2 (Windows 환경)

### 1. Docker Desktop 실행 후 PostgreSQL + pgvector 컨테이너 시작

```bash
docker run -d --name pgvector -e POSTGRES_PASSWORD=password -e POSTGRES_DB=ragdb -p 5432:5432 pgvector/pgvector:pg16
```

이후 실행 시에는 Docker Desktop에서 컨테이너 시작 또는:
```bash
docker start pgvector
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

LANGSMITH_API_KEY=your_langsmith_key    # 선택
LANGSMITH_PROJECT=rag-project           # 선택

PHOENIX_PROJECT=rag-chat                # 선택 (기본값: rag-chat)
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006/v1/traces  # 선택
```

백엔드 실행:

```bash
fuser -k 8000/tcp; uvicorn main:app --reload
```

### 4. Arize Phoenix 서버 실행 (선택, 별도 터미널)

```bash
source venv/bin/activate
python -m phoenix.server.main serve
```

Phoenix UI: `http://localhost:6006`

### 5. 프론트엔드 설정

```bash
cd frontend
npm install
fuser -k 5173/tcp; npm run dev
```

브라우저에서 `http://localhost:5173` 접속  
WSL 환경이면 Vite가 출력하는 Network URL(`172.x.x.x:5173`) 사용

> **주의:** 서버 종료 시 반드시 **Ctrl+C** 사용. Ctrl+Z는 프로세스를 백그라운드로 보내 포트를 계속 점유한다.

---

## 프로젝트 구조

```
RAG_Project/
├── backend/
│   ├── main.py                    # FastAPI 앱 진입점, 라이프사이클 관리
│   ├── config.py                  # 환경변수 설정
│   ├── requirements.txt
│   ├── routers/
│   │   ├── chat.py                # 채팅 스트리밍, 메타 쿼리, 피드백
│   │   ├── documents.py           # 문서 업로드·삭제(개별·전체), 업로드 성능 기록
│   │   ├── conversations.py       # 대화 히스토리 CRUD
│   │   ├── evaluate.py            # 응답 품질·임베딩 품질·업로드 성능 통계 API
│   │   └── quiz.py                # 퀴즈 생성·채점
│   └── services/
│       ├── db.py                  # PostgreSQL 연결 풀, 테이블 초기화
│       ├── vector_store.py        # pgvector 청크 저장·하이브리드 검색(RRF)
│       ├── embedder.py            # OpenAI 임베딩 (캐시 연동)
│       ├── document_parser.py     # PDF·DOCX·TXT·HWP 파싱
│       ├── conversation_store.py  # 대화·메시지 저장소 (sources 포함)
│       ├── trace_store.py         # 트레이스 저장소
│       ├── history_manager.py     # 대화 히스토리 토큰 관리·요약
│       ├── cache.py               # Redis 캐시 (임베딩·응답)
│       ├── phoenix_tracer.py      # Arize Phoenix OpenTelemetry 계측
│       ├── langsmith_tracer.py    # LangSmith 연동
│       └── llm/
│           ├── __init__.py        # LLM 팩토리 (get_llm)
│           ├── base.py            # BaseLLM 인터페이스
│           ├── openai_llm.py      # OpenAI GPT-4o
│           ├── groq_llm.py        # Groq Llama
│           ├── claude_llm.py      # Anthropic Claude
│           └── gemini_llm.py      # Google Gemini
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── ChatPage.tsx       # 채팅 페이지, 예시 질문 카드
    │   │   ├── EvaluatePage.tsx   # 평가 페이지 (응답 품질·임베딩 품질·업로드 성능 탭)
    │   │   └── QuizPage.tsx       # 퀴즈 페이지
    │   ├── components/
    │   │   ├── Layout.tsx         # 사이드바, 네비게이션, 서버 상태 표시
    │   │   ├── ChatWindow.tsx     # 메시지 목록, 피드백 버튼
    │   │   ├── FileUpload.tsx     # 문서 업로드 (드래그·다중 선택·진행 표시)
    │   │   ├── ModelSelector.tsx  # LLM 모델 선택 (Portal 드롭다운)
    │   │   ├── SourceViewer.tsx   # 참고 출처 표시
    │   │   └── evaluate/
    │   │       ├── DashboardTab.tsx   # 응답 품질 대시보드 (초기화 포함)
    │   │       ├── EmbeddingTab.tsx   # 임베딩 품질 분석
    │   │       └── UploadTab.tsx      # 업로드 성능 분석 (초기화 포함)
    │   └── types/index.ts         # 공통 타입 정의
    └── vite.config.ts             # Vite 설정 (프록시, strictPort)
```

---

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| POST | `/documents/upload` | 문서 업로드 (성능 자동 기록) |
| GET | `/documents/` | 문서 목록 |
| DELETE | `/documents/` | 문서 전체 삭제 |
| DELETE | `/documents/{id}` | 문서 개별 삭제 |
| GET | `/chat/models` | 사용 가능한 모델 목록 |
| POST | `/chat/stream` | RAG 채팅 (SSE 스트리밍) |
| POST | `/chat/feedback` | 답변 피드백 |
| GET | `/conversations/` | 대화 목록 |
| POST | `/conversations/` | 대화 생성 |
| GET | `/conversations/{id}/messages` | 메시지 불러오기 |
| POST | `/conversations/{id}/messages` | 메시지 저장 (sources 포함) |
| DELETE | `/conversations/{id}` | 대화 삭제 |
| GET | `/evaluate/stats` | 응답 품질 통계 |
| GET | `/evaluate/traces` | 트레이스 목록 |
| DELETE | `/evaluate/traces` | 트레이스 전체 삭제 |
| GET | `/evaluate/embedding-stats` | 임베딩 품질 통계 |
| GET | `/evaluate/upload-traces` | 업로드 성능 기록 |
| DELETE | `/evaluate/upload-traces` | 업로드 성능 기록 전체 삭제 |
| POST | `/quiz/generate` | 퀴즈 생성 |
| POST | `/quiz/grade` | 퀴즈 채점 |

---

## 서버 시작 방법

1. **Docker Desktop 실행** (pgvector 컨테이너 시작)
   ```bash
   docker start pgvector
   ```
2. **백엔드 실행** (WSL 터미널 1)
   ```bash
   cd "/mnt/c/Users/.../backend"
   source venv/bin/activate
   fuser -k 8000/tcp; uvicorn main:app --reload
   ```
3. **Phoenix 실행** (WSL 터미널 2, 선택)
   ```bash
   source venv/bin/activate
   python -m phoenix.server.main serve
   ```
4. **프론트엔드 실행** (WSL 터미널 3)
   ```bash
   cd "/mnt/c/Users/.../frontend"
   fuser -k 5173/tcp; npm run dev
   ```