import { useState, useRef } from "react";
import { Send, Square } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import ChatWindow from "../components/ChatWindow";
import { Message, ModelOption, Source } from "../types";

interface OutletContext {
  selectedModel: ModelOption;
}

export default function ChatPage() {
  const { selectedModel } = useOutletContext<OutletContext>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleStop = () => abortRef.current?.abort();

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
        try { detail = JSON.parse(text).detail || detail; } catch { detail = text || `HTTP ${res.status}`; }
        throw new Error(detail);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const raw = line.replace("data: ", "").trim();
          if (raw === "[DONE]") break;
          const data = JSON.parse(raw);

          if (data.type === "sources") {
            sources = data.sources;
          } else if (data.type === "error") {
            assistantContent = `오류: ${data.content}`;
            setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: assistantContent } : m));
          } else if (data.type === "token") {
            assistantContent += data.content;
            setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: assistantContent, sources } : m));
          }
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") {
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: assistantContent || "답변이 중단됐습니다." } : m));
      } else {
        const msg = e instanceof Error ? e.message : "오류가 발생했습니다.";
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: `오류: ${msg}` } : m));
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
      inputRef.current?.focus({ preventScroll: true });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <ChatWindow messages={messages} loading={loading} />
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
            <button onClick={handleStop} className="shrink-0 bg-red-500 hover:bg-red-600 text-white rounded-xl p-3 transition-colors">
              <Square size={18} />
            </button>
          ) : (
            <button onClick={handleSend} disabled={!input.trim()} className="shrink-0 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl p-3 transition-colors">
              <Send size={18} />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
