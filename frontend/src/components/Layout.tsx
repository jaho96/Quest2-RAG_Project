import { NavLink, Outlet } from "react-router-dom";
import { MessageSquare, FlaskConical } from "lucide-react";
import { useState, useEffect } from "react";
import FileUpload from "./FileUpload";
import ModelSelector from "./ModelSelector";
import { Document, ModelOption, MODEL_OPTIONS } from "../types";

export default function Layout() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelOption>(() => {
    const saved = localStorage.getItem("selectedModel");
    if (saved) {
      const parsed = JSON.parse(saved);
      const found = MODEL_OPTIONS.find(
        (m) => m.provider === parsed.provider && m.model === parsed.model
      );
      if (found) return found;
    }
    return MODEL_OPTIONS[0];
  });

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    const res = await fetch("/documents/");
    const data = await res.json();
    setDocuments(data);
  };

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/documents/upload", { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json();
      alert(err.detail || "업로드 실패");
      return;
    }
    await fetchDocuments();
  };

  const handleDelete = async (docId: string) => {
    await fetch(`/documents/${docId}`, { method: "DELETE" });
    await fetchDocuments();
  };

  const navItem = "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors";
  const active   = "bg-blue-50 text-blue-600";
  const inactive = "text-gray-600 hover:bg-gray-100";

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* 사이드바 */}
      <aside className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">

        {/* 로고 */}
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-800">RAG Chat</h1>
        </div>

        {/* 네비게이션 */}
        <nav className="p-3 flex flex-col gap-1 border-b border-gray-200">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}
          >
            <MessageSquare size={16} />
            채팅
          </NavLink>
          <NavLink
            to="/evaluate"
            className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}
          >
            <FlaskConical size={16} />
            RAG 평가
          </NavLink>
        </nav>

        {/* 모델 선택 */}
        <div className="p-4 border-b border-gray-200">
          <ModelSelector
            selected={selectedModel}
            onChange={(m) => {
              setSelectedModel(m);
              localStorage.setItem("selectedModel", JSON.stringify({ provider: m.provider, model: m.model }));
            }}
          />
        </div>

        {/* 문서 목록 */}
        <div className="p-4 flex flex-col gap-2 flex-1">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">문서</h2>
          <FileUpload documents={documents} onUpload={handleUpload} onDelete={handleDelete} />
        </div>
      </aside>

      {/* 페이지 영역 */}
      <main className="flex-1 flex flex-col min-h-0">
        <Outlet context={{ selectedModel, documents }} />
      </main>
    </div>
  );
}
