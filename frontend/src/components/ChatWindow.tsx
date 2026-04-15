import { useEffect, useRef } from "react";
import { Message } from "../types";
import SourceViewer from "./SourceViewer";
import { Bot, User } from "lucide-react";

interface Props {
  messages: Message[];
  loading: boolean;
}

export default function ChatWindow({ messages, loading }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  return (
    <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-4 py-4 flex flex-col gap-4">
      {messages.length === 0 && (
        <div className="flex items-center justify-center text-gray-400 text-sm py-20">
          문서를 업로드하고 질문해보세요.
        </div>
      )}

      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
        >
          {/* 아이콘 */}
          <div
            className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              msg.role === "user" ? "bg-blue-500" : "bg-gray-200"
            }`}
          >
            {msg.role === "user" ? (
              <User size={16} className="text-white" />
            ) : (
              <Bot size={16} className="text-gray-600" />
            )}
          </div>

          {/* 말풍선 */}
          <div
            className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === "user"
                ? "bg-blue-500 text-white rounded-tr-sm"
                : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"
            }`}
          >
            {msg.content}
            {msg.role === "assistant" && msg.sources && (
              <SourceViewer sources={msg.sources} />
            )}
          </div>
        </div>
      ))}

      {loading && (
        <div className="flex gap-3">
          <div className="shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
            <Bot size={16} className="text-gray-600" />
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
            <div className="flex gap-1 items-center h-4">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
