import { NavLink, Outlet, useLocation } from "react-router-dom";
import { MessageSquare, FlaskConical, BookOpen, Trash2, SquarePen } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import FileUpload from "./FileUpload";
import ModelSelector from "./ModelSelector";
import { Document, ModelOption, MODEL_OPTIONS, Conversation, Message } from "../types";

export default function Layout() {
  const location = useLocation();
  const isChatPage = location.pathname === "/";

  const [documents, setDocuments] = useState<Document[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const currentConvId = useRef<number | null>(null);
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
    const check = () => {
      fetch("/health")
        .then((r) => setServerOnline(r.ok))
        .catch(() => setServerOnline(false));
    };
    check();
    const id = setInterval(check, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { fetchDocuments(); }, []);
  useEffect(() => { fetchConversations(); }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch("/documents/");
      if (res.ok) setDocuments(await res.json());
    } catch { /* 서버 미연결 무시 */ }
  };

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/conversations/");
      setConversations(await res.json());
    } catch { /* 서버 미연결 무시 */ }
  }, []);

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/documents/upload", { method: "POST", body: formData });
    if (!res.ok) {
      const text = await res.text();
      let detail = "업로드 실패";
      try { detail = JSON.parse(text).detail || detail; } catch {}
      alert(detail);
      return;
    }
    const data = await res.json();
    if (data.warning) alert(`⚠️ ${data.warning}`);
    await fetchDocuments();
  };

  const handleDelete = async (docId: string) => {
    await fetch(`/documents/${docId}`, { method: "DELETE" });
    await fetchDocuments();
  };

  const handleDeleteAllDocs = async () => {
    if (!window.confirm("문서 전체가 삭제됩니다. 정말 삭제하시겠습니까?")) return;
    await fetch("/documents/", { method: "DELETE" });
    await fetchDocuments();
  };

  const handleDeleteConv = async (e: React.MouseEvent, convId: number) => {
    e.stopPropagation();
    await fetch(`/conversations/${convId}`, { method: "DELETE" });
    if (activeConvId === convId) setActiveConvId(null);
    await fetchConversations();
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("대화 목록 전체가 삭제됩니다. 정말 삭제하시겠습니까?")) return;
    await Promise.all(conversations.map((c) => fetch(`/conversations/${c.id}`, { method: "DELETE" })));
    setActiveConvId(null);
    setMessages([]);
    currentConvId.current = null;
    await fetchConversations();
  };

  const handleNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    currentConvId.current = null;
  };

  const handleConversationCreated = useCallback(async (convId: number) => {
    setActiveConvId(convId);
    await fetchConversations();
  }, [fetchConversations]);

  const navItem = "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors";
  const active  = "bg-blue-50 text-blue-600";
  const inactive = "text-gray-600 hover:bg-gray-100";

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* 사이드바 */}
      <aside className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-visible">

        {/* 로고 */}
        <div className="p-4 border-b border-gray-200 shrink-0 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-800">RAG Chat</h1>
          <span className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${
            serverOnline === null ? "bg-gray-100 text-gray-400"
            : serverOnline ? "bg-green-50 text-green-600"
            : "bg-red-50 text-red-500"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              serverOnline === null ? "bg-gray-300" : serverOnline ? "bg-green-500" : "bg-red-400"
            }`} />
            {serverOnline === null ? "확인 중" : serverOnline ? "연결됨" : "오프라인"}
          </span>
        </div>

        {/* 네비게이션 */}
        <nav className="p-3 flex flex-col gap-1 border-b border-gray-200 shrink-0">
          <NavLink to="/" end className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}>
            <MessageSquare size={16} /> 채팅
          </NavLink>
          <NavLink to="/evaluate" className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}>
            <FlaskConical size={16} /> 평가
          </NavLink>
          <NavLink to="/quiz" className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}>
            <BookOpen size={16} /> 퀴즈
          </NavLink>
        </nav>

        {/* 대화 목록 — 채팅 페이지일 때만 표시 */}
        {isChatPage && (
          <div className="flex flex-col min-h-0 border-b border-gray-200" style={{ maxHeight: "40%" }}>
            <div className="flex items-center justify-between px-4 py-2 shrink-0">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">대화 목록</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleNewChat}
                  title="새 채팅"
                  className="p-1 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <SquarePen size={15} />
                </button>
                {conversations.length > 0 && (
                  <button
                    onClick={handleDeleteAll}
                    title="전체 삭제"
                    className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-2 pb-2">
              {conversations.length === 0 ? (
                <p className="text-xs text-gray-400 px-2 py-1">대화 기록이 없습니다.</p>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group ${
                      activeConvId === conv.id
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <span className="truncate flex-1">{conv.title}</span>
                    <button
                      onClick={(e) => handleDeleteConv(e, conv.id)}
                      className="shrink-0 ml-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* 모델 선택 */}
        <div className="p-4 border-b border-gray-200 shrink-0">
          <ModelSelector
            selected={selectedModel}
            onChange={(m) => {
              setSelectedModel(m);
              localStorage.setItem("selectedModel", JSON.stringify({ provider: m.provider, model: m.model }));
            }}
          />
        </div>

        {/* 문서 목록 */}
        <div className="p-4 flex flex-col gap-2 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">문서</h2>
            {documents.length > 0 && (
              <button
                onClick={handleDeleteAllDocs}
                title="전체 삭제"
                className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
          <FileUpload documents={documents} onUpload={handleUpload} onDelete={handleDelete} />
        </div>
      </aside>

      {/* 페이지 영역 */}
      <main className="flex-1 flex flex-col min-h-0">
        <Outlet context={{
          selectedModel,
          documents,
          activeConvId,
          onConversationCreated: handleConversationCreated,
          onNewChat: handleNewChat,
          messages,
          setMessages,
          loading,
          setLoading,
          abortRef,
          currentConvId,
        }} />
      </main>
    </div>
  );
}