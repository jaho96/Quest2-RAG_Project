import { useState, useEffect, useRef } from "react";
import { Send, Square } from "lucide-react";
import ChatWindow from "./components/ChatWindow";
import FileUpload from "./components/FileUpload";
import ModelSelector from "./components/ModelSelector";
import { Document, Message, ModelOption, MODEL_OPTIONS, Source } from "./types";

export default function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelOption>(() => {
    const saved = localStorage.getItem("selectedModel");
    if (saved) {
      const parsed = JSON.parse(saved);
      const found = MODEL_OPTIONS.find(
        (m) => m.provider === parsed.provider && m.model === parsed.model
      );
      if (found) return found;
    }
    return MODEL_OPTIONS[0]; // Groq Llama 기본값
  });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const assistantId = (Date.now() + 1).toString();
    let assistantContent = "";
    let sources: Source[] = [];

    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", sources: [] },
    ]);

    // AbortController 생성
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          provider: selectedModel.provider,
          model: selectedModel.model,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        let detail = "서버 오류";
        try {
          detail = JSON.parse(text).detail || detail;
        } catch {
          detail = text || `HTTP ${res.status}`;
        }
        throw new Error(detail);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const raw = line.replace("data: ", "").trim();
          if (raw === "[DONE]") break;

          const data = JSON.parse(raw);

          if (data.type === "sources") {
            sources = data.sources;
          } else if (data.type === "error") {
            assistantContent = `오류: ${data.content}`;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: assistantContent } : m
              )
            );
          } else if (data.type === "token") {
            assistantContent += data.content;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: assistantContent, sources } : m
              )
            );
          }
        }
      }
    } catch (e: unknown) {
      // 사용자가 중단한 경우 별도 처리
      if (e instanceof Error && e.name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: assistantContent || "답변이 중단됐습니다." }
              : m
          )
        );
      } else {
        const msg = e instanceof Error ? e.message : "오류가 발생했습니다.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: `오류: ${msg}` } : m
          )
        );
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* 사이드바 */}
      <aside className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col p-4 gap-4">
        <h1 className="text-lg font-bold text-gray-800">RAG Chat</h1>
        <ModelSelector
          selected={selectedModel}
          onChange={(m) => {
            setSelectedModel(m);
            localStorage.setItem("selectedModel", JSON.stringify({ provider: m.provider, model: m.model }));
          }}
        />
        <hr className="border-gray-200" />
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">문서</h2>
          <FileUpload documents={documents} onUpload={handleUpload} onDelete={handleDelete} />
        </div>
      </aside>

      {/* 채팅 영역 */}
      <main className="flex-1 flex flex-col">
        <ChatWindow messages={messages} loading={loading} />

        {/* 입력창 */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex gap-2 items-end max-w-3xl mx-auto">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="질문을 입력하세요... (Shift+Enter: 줄바꿈)"
              disabled={loading}
              className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-36 overflow-y-auto disabled:bg-gray-50 disabled:text-gray-400"
              style={{ height: "auto" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
            />
            {loading ? (
              <button
                onClick={handleStop}
                className="shrink-0 bg-red-500 hover:bg-red-600 text-white rounded-xl p-3 transition-colors"
                title="답변 중단"
              >
                <Square size={18} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="shrink-0 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl p-3 transition-colors"
              >
                <Send size={18} />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
