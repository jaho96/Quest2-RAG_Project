import { useEffect, useState } from "react";
import { CheckCircle, XCircle, RotateCcw, Loader2 } from "lucide-react";
import { Document, MODEL_OPTIONS, ModelOption } from "../../types";

interface Question {
  id: number;
  type: "short" | "multiple";
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
}

interface GradeResult {
  correct: boolean;
  feedback: string;
}

type Phase = "setup" | "loading" | "quiz" | "result";

export default function QuizTab() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [count, setCount] = useState(10);
  const [model, setModel] = useState<ModelOption>(MODEL_OPTIONS[0]);
  const [phase, setPhase] = useState<Phase>("setup");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [grades, setGrades] = useState<Record<number, GradeResult>>({});
  const [gradingId, setGradingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/documents/").then((r) => r.json()).then(setDocs).catch(() => {});
  }, []);

  const toggleDoc = (id: string) => {
    setSelectedDocs((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    setError("");
    setPhase("loading");
    try {
      const res = await fetch("/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_ids: selectedDocs,
          count,
          provider: model.provider,
          model: model.model,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || "생성 실패");
      }
      const data = await res.json();
      setQuestions(data.questions);
      setAnswers({});
      setGrades({});
      setPhase("quiz");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      setPhase("setup");
    }
  };

  const handleGrade = async (q: Question) => {
    const userAnswer = answers[q.id] ?? "";
    if (!userAnswer.trim()) return;

    if (q.type === "multiple") {
      setGrades((prev) => ({
        ...prev,
        [q.id]: {
          correct: userAnswer === q.answer,
          feedback: userAnswer === q.answer ? "정답입니다!" : `오답. 정답: ${q.answer}`,
        },
      }));
      return;
    }

    setGradingId(q.id);
    try {
      const res = await fetch("/quiz/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q.question,
          correct_answer: q.answer,
          user_answer: userAnswer,
          provider: model.provider,
          model: model.model,
        }),
      });
      const data = await res.json();
      setGrades((prev) => ({ ...prev, [q.id]: data }));
    } catch {
      setGrades((prev) => ({
        ...prev,
        [q.id]: { correct: false, feedback: "채점 오류" },
      }));
    } finally {
      setGradingId(null);
    }
  };

  const handleSubmitAll = async () => {
    for (const q of questions) {
      if (!grades[q.id] && answers[q.id]?.trim()) {
        await handleGrade(q);
      }
    }
    setPhase("result");
  };

  const score = Object.values(grades).filter((g) => g.correct).length;
  const total = questions.length;

  // ── 설정 화면 ──────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* 문서 선택 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">
            문서 선택 <span className="text-gray-400 font-normal">(선택 안 하면 전체 사용)</span>
          </p>
          {docs.length === 0 ? (
            <p className="text-sm text-gray-400">업로드된 문서가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
              {docs.map((d) => (
                <label key={d.doc_id} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedDocs.includes(d.doc_id)}
                    onChange={() => toggleDoc(d.doc_id)}
                    className="rounded text-blue-500"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-blue-600 transition-colors truncate">
                    {d.filename}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">{d.total_chunks}청크</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 설정 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-wrap gap-6">
          <div>
            <p className="text-xs text-gray-500 mb-1.5">문제 수</p>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    count === n
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {n}개
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1.5">모델</p>
            <select
              value={`${model.provider}/${model.model}`}
              onChange={(e) => {
                const found = MODEL_OPTIONS.find(
                  (m) => `${m.provider}/${m.model}` === e.target.value
                );
                if (found) setModel(found);
              }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={`${m.provider}/${m.model}`} value={`${m.provider}/${m.model}`}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={docs.length === 0}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-medium rounded-xl py-3 transition-colors"
        >
          퀴즈 생성
        </button>
      </div>
    );
  }

  // ── 로딩 ──────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-500">
        <Loader2 size={32} className="animate-spin text-blue-500" />
        <p className="text-sm">문서를 분석해서 퀴즈를 만드는 중입니다...</p>
        <p className="text-xs text-gray-400">보통 10~30초 정도 걸립니다.</p>
      </div>
    );
  }

  // ── 퀴즈 화면 ──────────────────────────────────────────────────
  if (phase === "quiz") {
    const allAnswered = questions.every((q) => answers[q.id]?.trim());

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            총 {total}문제 · 단답형 {questions.filter((q) => q.type === "short").length}개 + 객관식 {questions.filter((q) => q.type === "multiple").length}개
          </p>
          <button
            onClick={() => setPhase("setup")}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
          >
            <RotateCcw size={12} /> 다시 설정
          </button>
        </div>

        {questions.map((q, idx) => {
          const grade = grades[q.id];
          const isGrading = gradingId === q.id;

          return (
            <div key={q.id} className={`bg-white rounded-xl border shadow-sm p-5 transition-colors ${
              grade ? (grade.correct ? "border-green-200" : "border-red-200") : "border-gray-200"
            }`}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className="text-sm font-medium text-gray-800">
                  <span className="text-blue-500 mr-1.5">Q{idx + 1}.</span>
                  {q.question}
                </p>
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                  q.type === "short"
                    ? "bg-purple-50 text-purple-600"
                    : "bg-blue-50 text-blue-600"
                }`}>
                  {q.type === "short" ? "단답형" : "객관식"}
                </span>
              </div>

              {/* 객관식 */}
              {q.type === "multiple" && q.options && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {q.options.map((opt) => (
                    <button
                      key={opt}
                      disabled={!!grade}
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                      className={`text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                        grade
                          ? opt === q.answer
                            ? "bg-green-50 border-green-300 text-green-700"
                            : opt === answers[q.id]
                            ? "bg-red-50 border-red-300 text-red-700"
                            : "bg-gray-50 border-gray-200 text-gray-400"
                          : answers[q.id] === opt
                          ? "bg-blue-50 border-blue-400 text-blue-700"
                          : "bg-gray-50 border-gray-200 text-gray-700 hover:border-blue-300"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* 단답형 */}
              {q.type === "short" && (
                <input
                  type="text"
                  disabled={!!grade}
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && !grade && handleGrade(q)}
                  placeholder="답변을 입력하세요"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 mb-3"
                />
              )}

              {/* 채점 버튼 */}
              {!grade && (
                <button
                  onClick={() => handleGrade(q)}
                  disabled={!answers[q.id]?.trim() || isGrading}
                  className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-600 rounded-lg transition-colors"
                >
                  {isGrading ? "채점 중..." : "확인"}
                </button>
              )}

              {/* 채점 결과 */}
              {grade && (
                <div className={`flex items-start gap-2 text-sm mt-1 ${
                  grade.correct ? "text-green-700" : "text-red-700"
                }`}>
                  {grade.correct
                    ? <CheckCircle size={16} className="shrink-0 mt-0.5" />
                    : <XCircle size={16} className="shrink-0 mt-0.5" />}
                  <div>
                    <span className="font-medium">{grade.correct ? "정답" : "오답"}</span>
                    <span className="text-gray-500 ml-2">{grade.feedback}</span>
                    {q.explanation && (
                      <p className="text-xs text-gray-400 mt-1">{q.explanation}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={handleSubmitAll}
          disabled={!allAnswered}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-medium rounded-xl py-3 transition-colors"
        >
          최종 제출
        </button>
      </div>
    );
  }

  // ── 결과 화면 ──────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <p className="text-4xl font-bold text-blue-500 mb-1">{score} / {total}</p>
        <p className="text-lg text-gray-600 mb-1">
          {Math.round((score / total) * 100)}점
        </p>
        <p className="text-sm text-gray-400">
          {score === total ? "완벽합니다!" :
           score >= total * 0.8 ? "아주 잘했어요!" :
           score >= total * 0.6 ? "좋습니다!" : "더 공부해봐요!"}
        </p>
      </div>

      {/* 틀린 문제 복습 */}
      {questions.filter((q) => grades[q.id] && !grades[q.id].correct).length > 0 && (
        <div className="bg-white rounded-xl border border-red-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-red-600 mb-3">틀린 문제 복습</p>
          <div className="space-y-3">
            {questions
              .filter((q) => grades[q.id] && !grades[q.id].correct)
              .map((q) => (
                <div key={q.id} className="text-sm">
                  <p className="text-gray-700 font-medium">Q{q.id}. {q.question}</p>
                  <p className="text-red-500 mt-0.5">내 답: {answers[q.id]}</p>
                  <p className="text-green-600">정답: {q.answer}</p>
                  {q.explanation && <p className="text-gray-400 text-xs mt-0.5">{q.explanation}</p>}
                </div>
              ))}
          </div>
        </div>
      )}

      <button
        onClick={() => { setPhase("setup"); setQuestions([]); setGrades({}); setAnswers({}); }}
        className="w-full flex items-center justify-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 font-medium rounded-xl py-3 transition-colors"
      >
        <RotateCcw size={16} /> 다시 풀기
      </button>
    </div>
  );
}
