import { useRef, useState } from "react";
import { Upload, Trash2, FileText } from "lucide-react";
import { Document } from "../types";

interface Props {
  documents: Document[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (docId: string) => Promise<void>;
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
          {uploading ? "업로드 중..." : "PDF / TXT / DOCX / HWP 파일을 드래그하거나 클릭"}
        </p>
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

      {/* 업로드된 문서 목록 */}
      {documents.length > 0 && (
        <ul className="flex flex-col gap-1">
          {documents.map((doc) => (
            <li
              key={doc.doc_id}
              className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2 truncate">
                <FileText size={14} className="text-blue-500 shrink-0" />
                <span className="text-sm truncate">{doc.filename}</span>
              </div>
              <button
                onClick={() => onDelete(doc.doc_id)}
                className="text-gray-400 hover:text-red-500 transition-colors shrink-0 ml-2"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
