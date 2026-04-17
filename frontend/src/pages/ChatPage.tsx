import { useState, useRef, useEffect } from "react";
import { Send, Square, FileText, HelpCircle } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import ChatWindow from "../components/ChatWindow";
import { Message, ModelOption, Source, Document } from "../types";

interface OutletContext {
  selectedModel: ModelOption;
  documents: Document[];
  activeConvId: number | null;
  onConversationCreated: (convId: number) => void;
  onNewChat: () => void;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  abortRef: React.MutableRefObject<AbortController | null>;
  currentConvId: React.MutableRefObject<number | null>;
}

const SUGGESTED_WITH_DOCS = [
  { icon: <FileText size={14} />, text: "어떤 문서가 업로드되어 있나요?" },
  { icon: <HelpCircle size={14} />, text: "업로드된 자료로 어떤 주제를 알 수 있어?" },
  { icon: <FileText size={14} />, text: "문서 내용을 요약해줘" },
];

export default function ChatPage() {
  const {
    selectedModel, documents, activeConvId, onConversationCreated,
    messages, setMessages, loading, setLoading, abortRef, currentConvId,
  } = useOutletContext<OutletContext>();
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 대화 선택 시 메시지 불러오기
  useEffect(() => {
    if (activeConvId === null) {
      setMessages([]);
      setShowSuggestions(false);
      currentConvId.current = null;
      return;
    }
    if (activeConvId === currentConvId.current) return;

    currentConvId.current = activeConvId;
    fetch(`/conversations/${activeConvId}/messages`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(
          data.map((m: { id: number; role: string; content: string; trace_id?: string; sources?: Source[] }) => ({
            id: String(m.id),
            role: m.role as "user" | "assistant",
            content: m.content,
            trace_id: m.trace_id,
            sources: m.sources ?? [],
          }))
        );
      })
      .catch(() => {});
  }, [activeConvId]);

  const saveMessage = async (convId: number, role: string, content: string, traceId?: string, sources?: Source[]) => {
    await fetch(`/conversations/${convId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, content, trace_id: traceId, sources: sources ?? null }),
    });
  };

  const handleStop = () => abortRef.current?.abort();

  const handleFeedback = async (traceId: string, value: 1 | -1) => {
    setMessages((prev) =>
      prev.map((m) => (m.trace_id === traceId ? { ...m, feedback: value } : m))
    );
    try {
      await fetch("/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trace_id: traceId, feedback: value }),
      });
    } catch { /* 피드백 실패 무시 */ }
  };

  const handleSend = async (overrideText?: string) => {
    const question = (overrideText ?? input).trim();
    if (!question || loading) return;
    setShowSuggestions(overrideText !== undefined);

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const assistantId = (Date.now() + 1).toString();
    let assistantContent = "";
    let sources: Source[] = [];
    let traceId = "";

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
          history: messages
            .filter((m) => m.content)
            .map((m) => ({ role: m.role, content: m.content })),
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

          if (data.type === "trace_id") {
            traceId = data.trace_id;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, trace_id: traceId } : m))
            );
          } else if (data.type === "sources") {
            sources = data.sources;
          } else if (data.type === "error") {
            assistantContent = `오류: ${data.content}`;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m))
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
          prev.map((m) => (m.id === assistantId ? { ...m, content: `오류: ${msg}` } : m))
        );
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
      inputRef.current?.focus({ preventScroll: true });

      // 대화 저장
      if (assistantContent) {
        try {
          let convId = currentConvId.current;

          // 첫 메시지면 새 대화 생성
          if (!convId) {
            const res = await fetch("/conversations/", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: question.slice(0, 40) }),
            });
            const conv = await res.json();
            convId = conv.id;
            currentConvId.current = convId;
            onConversationCreated(convId!);
          }

          await saveMessage(convId!, "user", question);
          await saveMessage(convId!, "assistant", assistantContent, traceId, sources);
        } catch { /* 저장 실패 무시 */ }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0 && !loading;

  return (
    <>
      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 text-center">
          {documents.length === 0 ? (
            <div className="space-y-2">
              <p className="text-gray-500 text-sm font-medium">아직 문서가 없습니다</p>
              <p className="text-gray-400 text-xs">왼쪽 사이드바에서 파일을 업로드하면 질문할 수 있어요.</p>
            </div>
          ) : (
            <div className="space-y-3 w-full max-w-md">
              <p className="text-gray-400 text-xs">이런 질문을 해보세요</p>
              <div className="flex flex-col gap-2">
                {SUGGESTED_WITH_DOCS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s.text)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors text-left"
                  >
                    <span className="text-gray-400">{s.icon}</span>
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <ChatWindow
          messages={messages}
          loading={loading}
          onFeedback={handleFeedback}
          suggestions={showSuggestions && documents.length > 0 ? SUGGESTED_WITH_DOCS.map(s => s.text) : undefined}
          onSuggestionClick={(text) => handleSend(text)}
        />
      )}
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
            <button onClick={() => handleSend()} disabled={!input.trim()} className="shrink-0 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl p-3 transition-colors">
              <Send size={18} />
            </button>
          )}
        </div>
      </div>
    </>
  );
}