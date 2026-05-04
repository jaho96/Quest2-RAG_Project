import { useRef, useState, useEffect, useCallback } from "react";
import {
  Upload, Trash2, FileText, ChevronDown, ChevronRight,
  Loader2, Clock, CheckCircle, XCircle,
} from "lucide-react";
import { Document } from "../types";

interface Props {
  documents: Document[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (docId: string) => Promise<void>;
}

interface QueueItem {
  id: string;
  file: File;
  status: "waiting" | "uploading" | "done" | "error";
  errorMsg?: string;
}

const FILE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  pdf:  { label: "PDF",       color: "text-red-500"  },
  docx: { label: "Word",      color: "text-blue-500" },
  hwp:  { label: "한글(HWP)", color: "text-teal-500" },
  hwpx: { label: "한글(HWP)", color: "text-teal-500" },
  txt:  { label: "텍스트",    color: "text-gray-500" },
};

const ACCEPTED_EXTS = [".pdf", ".txt", ".docx", ".hwp", ".hwpx"];
const PAGE_SIZE = 20;

function getTypeConfig(fileType: string) {
  return FILE_TYPE_CONFIG[fileType?.toLowerCase()] ?? { label: fileType?.toUpperCase() || "기타", color: "text-gray-400" };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function groupByType(documents: Document[]): Record<string, Document[]> {
  return documents.reduce<Record<string, Document[]>>((acc, doc) => {
    const key = doc.file_type?.toLowerCase() || "기타";
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});
}

function Folder({ fileType, docs, onDelete }: { fileType: string; docs: Document[]; onDelete: (id: string) => Promise<void> }) {
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const config = getTypeConfig(fileType);
  const visible = showAll ? docs : docs.slice(0, PAGE_SIZE);

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
          <FileText size={14} className={config.color} />
          <span className="text-xs font-semibold text-gray-600">{config.label}</span>
        </div>
        <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">{docs.length}</span>
      </button>

      {open && (
        <>
          <ul className="divide-y divide-gray-100">
            {visible.map((doc) => (
              <li key={doc.doc_id} className="flex items-start justify-between px-3 py-2 hover:bg-gray-50 group">
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-xs text-gray-700 truncate" title={doc.filename}>
                    {doc.filename.replace(/\.wiki$/, "")}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {doc.total_chunks}청크 · {formatSize(doc.file_size)}
                  </span>
                </div>
                <button
                  onClick={() => onDelete(doc.doc_id)}
                  className="text-gray-300 hover:text-red-500 transition-colors shrink-0 ml-2 mt-0.5 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
          {docs.length > PAGE_SIZE && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="w-full text-[11px] text-blue-500 hover:text-blue-700 py-1.5 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              {showAll ? "▲ 접기" : `▼ ${docs.length - PAGE_SIZE}개 더 보기`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function FileUpload({ documents, onUpload, onDelete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const isUploading = queue.some((item) => item.status === "uploading");

  // 큐에서 대기 중인 항목을 하나씩 순서대로 처리
  useEffect(() => {
    const waiting = queue.find((item) => item.status === "waiting");
    if (!waiting || isUploading) return;

    setQueue((prev) =>
      prev.map((item) => item.id === waiting.id ? { ...item, status: "uploading" } : item)
    );

    onUpload(waiting.file)
      .then(() => {
        setQueue((prev) =>
          prev.map((item) => item.id === waiting.id ? { ...item, status: "done" } : item)
        );
      })
      .catch((e: Error) => {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === waiting.id ? { ...item, status: "error", errorMsg: e.message } : item
          )
        );
      });
  }, [queue, isUploading, onUpload]);

  // 완료 항목 3초 후 자동 제거
  useEffect(() => {
    const hasDone = queue.some((item) => item.status === "done");
    if (!hasDone) return;
    const timer = setTimeout(() => {
      setQueue((prev) => prev.filter((item) => item.status !== "done"));
    }, 3000);
    return () => clearTimeout(timer);
  }, [queue]);

  const handleFiles = useCallback((files: File[]) => {
    const valid = files.filter((f) =>
      ACCEPTED_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    if (valid.length === 0) {
      alert("지원하지 않는 파일 형식입니다. PDF, TXT, DOCX, HWP, HWPX만 가능합니다.");
      return;
    }
    setQueue((prev) => [
      ...prev,
      ...valid.map((f) => ({
        id: Math.random().toString(36).slice(2),
        file: f,
        status: "waiting" as const,
      })),
    ]);
  }, []);

  const grouped = groupByType(documents);
  const sortedTypes = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length);
  const pendingCount = queue.filter((i) => i.status === "waiting" || i.status === "uploading").length;

  return (
    <div className="flex flex-col gap-3">
      {/* 업로드 영역 — 업로드 중에도 항상 클릭 가능 */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(Array.from(e.dataTransfer.files)); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
          dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
        }`}
      >
        {isUploading
          ? <Loader2 className="mx-auto mb-1 text-blue-400 animate-spin" size={20} />
          : <Upload className="mx-auto mb-1 text-gray-400" size={20} />
        }
        <p className="text-sm text-gray-500">
          {isUploading
            ? pendingCount > 0 ? `임베딩 중... (대기 ${pendingCount}개)` : "임베딩 중..."
            : "PDF / TXT / DOCX / HWP"}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {isUploading ? "새 파일을 추가하면 순서대로 처리됩니다" : "드래그하거나 클릭 (다중 선택 가능)"}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.docx,.hwp,.hwpx"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {/* 업로드 큐 상태 목록 */}
      {queue.length > 0 && (
        <div className="flex flex-col gap-1">
          {queue.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border bg-white"
              style={{
                borderColor:
                  item.status === "done" ? "#bbf7d0"
                  : item.status === "error" ? "#fecaca"
                  : item.status === "uploading" ? "#bfdbfe"
                  : "#e5e7eb",
              }}
            >
              {item.status === "waiting"   && <Clock       size={12} className="text-gray-400 shrink-0" />}
              {item.status === "uploading" && <Loader2     size={12} className="text-blue-400 animate-spin shrink-0" />}
              {item.status === "done"      && <CheckCircle size={12} className="text-green-400 shrink-0" />}
              {item.status === "error"     && <XCircle     size={12} className="text-red-400 shrink-0" />}
              <span className="truncate flex-1 text-gray-600" title={item.file.name}>
                {item.file.name}
              </span>
              <span className="shrink-0 text-gray-400">
                {item.status === "waiting"   && "대기"}
                {item.status === "uploading" && "처리 중"}
                {item.status === "done"      && <span className="text-green-500">완료</span>}
                {item.status === "error"     && <span className="text-red-400" title={item.errorMsg}>실패</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      {documents.length > 0 && (
        <p className="text-xs text-gray-400 text-right">총 {documents.length}개 문서</p>
      )}

      <div className="flex flex-col gap-2">
        {sortedTypes.map((type) => (
          <Folder key={type} fileType={type} docs={grouped[type]} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}
