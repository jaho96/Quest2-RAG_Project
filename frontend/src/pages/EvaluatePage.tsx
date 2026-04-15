import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { FlaskConical, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { ModelOption } from "../types";

interface OutletContext {
  selectedModel: ModelOption;
}

interface EvalResult {
  id: number;
  question: string;
  correct_key: string;
  correct_text: string;
  rag_answer: string;
  is_correct: boolean;
  current: number;
  total: number;
}

export default function EvaluatePage() {
  const { selectedModel } = useOutletContext<OutletContext>();
  const [running, setRunning]   = useState(false);
  const [results, setResults]   = useState<EvalResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [total, setTotal]       = useState(0);
  const [done, setDone]         = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setResults([]);
    setProgress(0);
    setTotal(0);
    setDone(false);
    setError(null);
    setExpanded(null);

    try {
      const res = await fetch("/evaluate/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedModel.provider, model: selectedModel.model }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        const lines = decoder.decode(value).split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const data = JSON.parse(line.replace("data: ", "").trim());
          if (data.type === "start")  { setTotal(data.total); }
          if (data.type === "result") { setResults((prev) => [...prev, data]); setProgress(data.current); }
          if (data.type === "done")   { setDone(true); }
          if (data.type === "error")  { setError(data.message); }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류 발생");
    } finally {
      setRunning(false);
    }
  };

  const correctCount = results.filter((r) => r.is_correct).length;
  const scorePercent = progress > 0 ? Math.round((correctCount / progress) * 100) : 0;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">RAG 평가</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              한국사 퀴즈 20문제로 RAG 정확도를 측정합니다
            </p>
          </div>
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-300 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            {running
              ? <><Loader2 size={15} className="animate-spin" /> 평가 중...</>
              : <><FlaskConical size={15} /> 평가 시작</>
            }
          </button>
        </div>

        {/* 진행률 */}
        {(running || progress > 0) && total > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{progress} / {total} 문제 완료</span>
              <span className="font-bold text-indigo-600">{scorePercent}%</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${(progress / total) * 100}%` }}
              />
            </div>
            <div className="flex gap-4 text-sm">
              <span className="text-green-600 font-medium">✅ 정답 {correctCount}개</span>
              <span className="text-red-500 font-medium">❌ 오답 {progress - correctCount}개</span>
            </div>
          </div>
        )}

        {/* 최종 점수 */}
        {done && (
          <div className={`rounded-xl border p-6 text-center ${
            scorePercent >= 70
              ? "bg-green-50 border-green-200"
              : "bg-orange-50 border-orange-200"
          }`}>
            <div className="text-4xl font-bold text-gray-800">{correctCount} / {total}</div>
            <div className="text-lg text-gray-500 mt-1">정답률 {scorePercent}%</div>
            <div className="text-sm text-gray-400 mt-2">
              모델: {selectedModel.label}
            </div>
          </div>
        )}

        {/* 오류 */}
        {error && (
          <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            오류: {error}
          </div>
        )}

        {/* 문제별 결과 */}
        {results.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-gray-600">문제별 결과</h3>
            {results.map((r) => (
              <div
                key={r.id}
                className={`rounded-xl border bg-white overflow-hidden transition-colors ${
                  r.is_correct ? "border-green-200" : "border-red-200"
                }`}
              >
                {/* 문제 행 */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  {r.is_correct
                    ? <CheckCircle size={16} className="text-green-500 shrink-0" />
                    : <XCircle size={16} className="text-red-500 shrink-0" />
                  }
                  <span className="text-xs text-gray-400 shrink-0">Q{r.id}</span>
                  <span className="text-sm text-gray-700 flex-1 truncate">{r.question}</span>
                  <span className={`text-xs font-bold shrink-0 ${r.is_correct ? "text-green-600" : "text-red-500"}`}>
                    정답 {r.correct_key}
                  </span>
                  {expanded === r.id
                    ? <ChevronUp size={14} className="text-gray-400 shrink-0" />
                    : <ChevronDown size={14} className="text-gray-400 shrink-0" />
                  }
                </button>

                {/* 상세 답변 */}
                {expanded === r.id && (
                  <div className="border-t border-gray-100 px-4 py-3 flex flex-col gap-3 text-sm bg-gray-50">
                    <div>
                      <span className="font-semibold text-gray-600">정답: </span>
                      <span className="text-gray-700">{r.correct_key}. {r.correct_text}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-600">RAG 답변: </span>
                      <span className="text-gray-700 whitespace-pre-wrap">{r.rag_answer}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
