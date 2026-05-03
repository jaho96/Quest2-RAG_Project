import { useEffect, useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { RefreshCw, ThumbsUp, ThumbsDown, Clock, Search, MessageSquare, Zap, Trash2 } from "lucide-react";

interface CacheStats {
  connected: boolean;
  embedding_cached: number;
  response_cached: number;
  hit_rate: number | null;
}

interface Stats {
  total: number;
  avg_response_time_ms: number | null;
  avg_retrieval_score: number | null;
  thumbs_up: number;
  thumbs_down: number;
  cache?: CacheStats;
}

interface Trace {
  id: number;
  trace_id: string;
  question: string;
  provider: string;
  model: string;
  response_time_ms: number | null;
  avg_retrieval_score: number | null;
  feedback: number | null;
  error: string | null;
  created_at: string;
}

function StatCard({ icon, label, value, sub, color = "text-gray-800" }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
      <div className="p-3 bg-gray-50 rounded-lg text-gray-500 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([
        fetch("/evaluate/stats").then((r) => r.json()),
        fetch("/evaluate/traces?limit=30").then((r) => r.json()),
      ]);
      setStats(s);
      setTraces(t);
    } catch { /* 서버 미연결 시 무시 */ }
    finally { setLoading(false); }
  }, []);

  const handleReset = useCallback(async () => {
    if (!window.confirm("응답 트레이스 데이터 전체가 삭제됩니다. 정말 삭제하시겠습니까?")) return;
    await fetch("/evaluate/traces", { method: "DELETE" });
    await load();
  }, [load]);

  useEffect(() => { load(); }, [load]);

  const chartData = [...traces].reverse().map((t, i) => ({
    idx: i + 1,
    rt: t.response_time_ms ?? null,
    score: t.avg_retrieval_score != null ? Math.round(t.avg_retrieval_score * 1000) / 10 : null,
  }));

  const feedbackTotal = (stats?.thumbs_up ?? 0) + (stats?.thumbs_down ?? 0);
  const satisfactionRate = feedbackTotal > 0
    ? Math.round(((stats?.thumbs_up ?? 0) / feedbackTotal) * 100) : null;

  return (
    <div className="space-y-5">
      <div className="flex justify-end gap-2">
        <button
          onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 bg-white rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          새로고침
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-sm text-red-500 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={14} />
          데이터 초기화
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={<MessageSquare size={20} />} label="총 질문 수" value={stats ? String(stats.total) : "-"} />
        <StatCard icon={<Clock size={20} />} label="평균 응답시간" value={stats?.avg_response_time_ms != null ? `${stats.avg_response_time_ms}ms` : "-"} />
        <StatCard icon={<Search size={20} />} label="평균 검색 관련도"
          value={stats?.avg_retrieval_score != null ? `${Math.round(stats.avg_retrieval_score * 1000) / 10}%` : "-"} />
        <StatCard icon={<ThumbsUp size={20} />} label="만족도"
          value={satisfactionRate != null ? `${satisfactionRate}%` : "-"}
          sub={feedbackTotal > 0 ? `👍 ${stats!.thumbs_up}  👎 ${stats!.thumbs_down}` : undefined}
          color="text-green-600" />
        <StatCard icon={<Zap size={20} />} label="캐시 히트율"
          value={stats?.cache?.connected
            ? (stats.cache.hit_rate != null ? `${stats.cache.hit_rate}%` : "0%")
            : "미연결"}
          color={stats?.cache?.connected ? "text-yellow-500" : "text-gray-400"} />
      </div>

      {chartData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-700 mb-4">응답시간 추이 (ms)</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="idx" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}ms`, "응답시간"]} />
                {stats?.avg_response_time_ms && (
                  <ReferenceLine y={stats.avg_response_time_ms} stroke="#94a3b8" strokeDasharray="4 4"
                    label={{ value: "평균", fontSize: 11, fill: "#94a3b8" }} />
                )}
                <Line type="monotone" dataKey="rt" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-700 mb-4">검색 관련도 추이 (%)</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="idx" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}%`, "관련도"]} />
                <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">최근 질문 트레이스</p>
        </div>
        {traces.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            아직 질문 기록이 없습니다. 채팅 탭에서 질문해보세요.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">시각</th>
                  <th className="text-left px-4 py-3 font-medium">질문</th>
                  <th className="text-left px-4 py-3 font-medium">모델</th>
                  <th className="text-right px-4 py-3 font-medium">응답시간</th>
                  <th className="text-right px-4 py-3 font-medium">관련도</th>
                  <th className="text-center px-4 py-3 font-medium">피드백</th>
                  <th className="text-center px-4 py-3 font-medium">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {traces.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{t.created_at.slice(5, 16)}</td>
                    <td className="px-4 py-3 max-w-[240px] truncate text-gray-800" title={t.question}>{t.question}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {t.provider}/{t.model.split("-").slice(0, 2).join("-")}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                      {t.response_time_ms != null ? `${t.response_time_ms}ms` : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                      {t.avg_retrieval_score != null ? `${Math.round(t.avg_retrieval_score * 1000) / 10}%` : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {t.feedback === 1 ? <ThumbsUp size={13} className="inline text-blue-500" /> :
                       t.feedback === -1 ? <ThumbsDown size={13} className="inline text-red-500" /> :
                       <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {t.error ? <span className="text-red-400" title={t.error}>!</span> :
                       <span className="text-green-400">✓</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
