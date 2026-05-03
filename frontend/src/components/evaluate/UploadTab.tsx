import { useEffect, useState, useCallback } from "react";
import { RefreshCw, FileText, Trash2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

interface UploadTrace {
  id: number;
  filename: string;
  file_type: string;
  file_size: number;
  total_chunks: number;
  parse_ms: number;
  chunk_ms: number;
  embed_ms: number;
  db_ms: number;
  total_ms: number;
  created_at: string;
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const STAGE_COLORS = {
  parse_ms:  "#fb923c",
  chunk_ms:  "#4ade80",
  embed_ms:  "#c084fc",
  db_ms:     "#38bdf8",
};

export default function UploadTab() {
  const [traces, setTraces] = useState<UploadTrace[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTraces = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/evaluate/upload-traces");
      if (res.ok) setTraces(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReset = useCallback(async () => {
    if (!window.confirm("업로드 성능 데이터 전체가 삭제됩니다. 정말 삭제하시겠습니까?")) return;
    await fetch("/evaluate/upload-traces", { method: "DELETE" });
    await fetchTraces();
  }, [fetchTraces]);

  useEffect(() => { fetchTraces(); }, [fetchTraces]);

  const chartData = [...traces].reverse().map((t) => ({
    name: t.filename.length > 12 ? t.filename.slice(0, 12) + "…" : t.filename,
    파싱:     t.parse_ms,
    청킹:     t.chunk_ms,
    임베딩:   t.embed_ms,
    "DB 저장": t.db_ms,
  }));

  return (
    <div className="space-y-5">
      <div className="flex justify-end gap-2">
        <button
          onClick={fetchTraces}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          새로고침
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
        >
          <Trash2 size={13} />
          데이터 초기화
        </button>
      </div>

      {traces.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          아직 업로드 기록이 없습니다.
        </div>
      ) : (
        <>
          {/* 스택 바 차트 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">단계별 소요 시간 (ms)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}ms`} />
                <Tooltip formatter={(v) => formatMs(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="파싱"     stackId="a" fill={STAGE_COLORS.parse_ms} />
                <Bar dataKey="청킹"     stackId="a" fill={STAGE_COLORS.chunk_ms} />
                <Bar dataKey="임베딩"   stackId="a" fill={STAGE_COLORS.embed_ms} />
                <Bar dataKey="DB 저장"  stackId="a" fill={STAGE_COLORS.db_ms} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 상세 테이블 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">파일명</th>
                  <th className="px-3 py-2 text-right">크기</th>
                  <th className="px-3 py-2 text-right">청크</th>
                  <th className="px-3 py-2 text-right text-orange-400">파싱</th>
                  <th className="px-3 py-2 text-right text-green-400">청킹</th>
                  <th className="px-3 py-2 text-right text-purple-400">임베딩</th>
                  <th className="px-3 py-2 text-right text-sky-400">DB</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">총계</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {traces.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <FileText size={13} className="text-gray-400 shrink-0" />
                        <span className="truncate max-w-[160px] text-gray-700" title={t.filename}>
                          {t.filename}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">{formatSize(t.file_size)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{t.total_chunks}</td>
                    <td className="px-3 py-2 text-right text-orange-500">{formatMs(t.parse_ms)}</td>
                    <td className="px-3 py-2 text-right text-green-500">{formatMs(t.chunk_ms)}</td>
                    <td className="px-3 py-2 text-right text-purple-500">{formatMs(t.embed_ms)}</td>
                    <td className="px-3 py-2 text-right text-sky-500">{formatMs(t.db_ms)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-700">{formatMs(t.total_ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}