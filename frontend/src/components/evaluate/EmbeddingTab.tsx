import { useEffect, useState, useCallback } from "react";
import { RefreshCw, FileText, Layers, AlignLeft, AlertTriangle } from "lucide-react";

interface DocStat {
  doc_id: string;
  filename: string;
  uploaded_at: string;
  total_chunks: number;
  avg_chunk_size: number;
  min_chunk_size: number;
  max_chunk_size: number;
  short_chunks: number;
  short_ratio: number;
}

interface Overall {
  total_documents: number;
  total_chunks: number;
  avg_chunk_size: number;
  short_chunks: number;
  short_ratio: number;
}

function StatCard({ icon, label, value, sub }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
      <div className="p-3 bg-gray-50 rounded-lg text-gray-500">{icon}</div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ShortRatioBadge({ ratio }: { ratio: number }) {
  if (ratio === 0) return <span className="text-green-500 font-medium">0%</span>;
  if (ratio < 10) return <span className="text-yellow-500 font-medium">{ratio}%</span>;
  return <span className="text-red-500 font-medium">{ratio}%</span>;
}

export default function EmbeddingTab() {
  const [overall, setOverall] = useState<Overall | null>(null);
  const [docs, setDocs] = useState<DocStat[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch("/evaluate/embedding-stats").then((r) => r.json());
      setOverall(data.overall);
      setDocs(data.documents);
    } catch { /* 무시 */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 bg-white rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          새로고침
        </button>
      </div>

      {/* 전체 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<FileText size={20} />}
          label="총 문서 수"
          value={overall ? String(overall.total_documents) : "-"}
        />
        <StatCard
          icon={<Layers size={20} />}
          label="총 청크 수"
          value={overall ? String(overall.total_chunks) : "-"}
        />
        <StatCard
          icon={<AlignLeft size={20} />}
          label="평균 청크 크기"
          value={overall ? `${overall.avg_chunk_size}자` : "-"}
          sub="문서 유형에 따라 다름"
        />
        <StatCard
          icon={<AlertTriangle size={20} />}
          label="짧은 청크 비율"
          value={overall ? `${overall.short_ratio}%` : "-"}
          sub="100자 미만"
        />
      </div>

      {/* 청크 크기 기준 안내 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 text-xs text-blue-700 space-y-0.5">
        <p className="font-semibold mb-1">청크 품질 기준</p>
        <p>· 최적 청크 크기는 <span className="font-medium">문서 유형과 언어에 따라 다름</span> — 일반적인 300~500자 기준은 영어 단문 문서 기준</p>
        <p>· 한국어 기술 문서(교과서·논문 등)는 <span className="font-medium">700~1000자</span>가 문맥 유지에 더 적합함 (현재 설정: 900자)</p>
        <p>· 짧은 청크 비율 <span className="font-medium">10% 이하</span> → 정상 / 이상이면 문서 파싱 오류 가능성</p>
        <p>· 짧은 청크가 많으면 검색 시 관련도 점수가 낮게 나올 수 있음</p>
      </div>

      {/* 문서별 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">문서별 청크 현황</p>
        </div>
        {docs.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            업로드된 문서가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">파일명</th>
                  <th className="text-right px-4 py-3 font-medium">청크 수</th>
                  <th className="text-right px-4 py-3 font-medium">평균 크기</th>
                  <th className="text-right px-4 py-3 font-medium">최소 / 최대</th>
                  <th className="text-right px-4 py-3 font-medium">짧은 청크</th>
                  <th className="text-left px-4 py-3 font-medium">업로드</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {docs.map((d) => (
                  <tr key={d.doc_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 max-w-[220px] truncate text-gray-800 font-medium" title={d.filename}>
                      {d.filename}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{d.total_chunks}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{d.avg_chunk_size}자</td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {d.min_chunk_size} / {d.max_chunk_size}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ShortRatioBadge ratio={d.short_ratio} />
                      <span className="text-gray-400 ml-1">({d.short_chunks}개)</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {d.uploaded_at ? d.uploaded_at.slice(0, 10) : "-"}
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