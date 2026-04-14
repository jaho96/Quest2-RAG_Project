import { useRef, useState } from "react";
import { Upload, Trash2, FileText, ChevronDown, ChevronRight, Globe } from "lucide-react";
import { Document } from "../types";

interface Props {
  documents: Document[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (docId: string) => Promise<void>;
}

// 파일 타입별 표시 설정
const FILE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  pdf:  { label: "PDF",       color: "text-red-500"    },
  docx: { label: "Word",      color: "text-blue-500"   },
  hwp:  { label: "한글(HWP)", color: "text-teal-500"   },
  hwpx: { label: "한글(HWP)", color: "text-teal-500"   },
  txt:  { label: "텍스트",    color: "text-gray-500"   },
  wiki: { label: "위키백과",  color: "text-green-500"  },
};

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

interface FolderProps {
  fileType: string;
  docs: Document[];
  onDelete: (docId: string) => Promise<void>;
}

const PAGE_SIZE = 20;

function Folder({ fileType, docs, onDelete }: FolderProps) {
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const config = getTypeConfig(fileType);

  const visible = showAll ? docs : docs.slice(0, PAGE_SIZE);
  const hasMore = docs.length > PAGE_SIZE;

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      {/* 폴더 헤더 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
          {fileType === "wiki"
            ? <Globe size={14} className={config.color} />
            : <FileText size={14} className={config.color} />
          }
          <span className="text-xs font-semibold text-gray-600">{config.label}</span>
        </div>
        <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
          {docs.length}
        </span>
      </button>

      {/* 폴더 내 파일 목록 */}
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
          {/* 더 보기 / 접기 */}
          {hasMore && (
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
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const grouped = groupByType(documents);
  // 파일 수 많은 타입이 위로 오도록 정렬
  const sortedTypes = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length);

  return (
    <div className="flex flex-col gap-3">
      {/* 업로드 영역 */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
          dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
        }`}
      >
        <Upload className="mx-auto mb-1 text-gray-400" size={20} />
        <p className="text-sm text-gray-500">
          {uploading ? "업로드 중..." : "PDF / TXT / DOCX / HWP"}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">드래그하거나 클릭</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.docx,.hwp,.hwpx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {/* 총 문서 수 */}
      {documents.length > 0 && (
        <p className="text-xs text-gray-400 text-right">
          총 {documents.length}개 문서
        </p>
      )}

      {/* 폴더 목록 */}
      <div className="flex flex-col gap-2">
        {sortedTypes.map((type) => (
          <Folder key={type} fileType={type} docs={grouped[type]} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}
