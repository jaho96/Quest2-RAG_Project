import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "../types";
import SourceViewer from "./SourceViewer";
import { Bot, User, ThumbsUp, ThumbsDown } from "lucide-react";

interface Props {
  messages: Message[];
  loading: boolean;
  onFeedback: (traceId: string, value: 1 | -1) => void;
  suggestions?: string[];
  onSuggestionClick?: (text: string) => void;
}

export default function ChatWindow({ messages, loading, onFeedback, suggestions, onSuggestionClick }: Props) {
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

            {/* 말풍선 + 피드백 */}
            <div className="flex flex-col gap-1 max-w-[75%]">
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white rounded-tr-sm whitespace-pre-wrap"
                    : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"
                }`}
              >
                {msg.role === "user" ? (
                  msg.content
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-sm font-bold mt-3 mb-1">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
                      ul: ({ children }) => <ul className="list-disc list-outside pl-4 mb-2 space-y-0.5">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-outside pl-4 mb-2 space-y-0.5">{children}</ol>,
                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      code: ({ children, className }) => {
                        const isBlock = Boolean(className);
                        return isBlock
                          ? <code className={`${className} text-xs`}>{children}</code>
                          : <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>;
                      },
                      pre: ({ children }) => (
                        <pre className="bg-gray-800 text-gray-100 rounded-lg p-3 overflow-x-auto text-xs font-mono mb-2 mt-1">
                          {children}
                        </pre>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-gray-300 pl-3 text-gray-500 italic mb-2">
                          {children}
                        </blockquote>
                      ),
                      table: ({ children }) => (
                        <div className="overflow-x-auto mb-2">
                          <table className="border-collapse w-full text-xs">{children}</table>
                        </div>
                      ),
                      th: ({ children }) => <th className="border border-gray-200 bg-gray-50 px-2 py-1.5 text-left font-medium">{children}</th>,
                      td: ({ children }) => <td className="border border-gray-200 px-2 py-1.5">{children}</td>,
                      hr: () => <hr className="border-gray-200 my-2" />,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
                {msg.role === "assistant" && msg.sources && (
                  <SourceViewer sources={msg.sources} />
                )}

                {/* 👍👎 피드백 버튼 — 말풍선 안 하단 오른쪽 */}
                {msg.role === "assistant" && msg.trace_id && !loading && (
                  <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => onFeedback(msg.trace_id!, 1)}
                      title="도움이 됐어요"
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
                        msg.feedback === 1
                          ? "bg-blue-50 text-blue-500"
                          : "text-gray-400 hover:bg-gray-100 hover:text-blue-500"
                      }`}
                    >
                      <ThumbsUp size={13} />
                      {msg.feedback === 1 && <span>도움됐어요</span>}
                    </button>
                    <button
                      onClick={() => onFeedback(msg.trace_id!, -1)}
                      title="도움이 안 됐어요"
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
                        msg.feedback === -1
                          ? "bg-red-50 text-red-500"
                          : "text-gray-400 hover:bg-gray-100 hover:text-red-500"
                      }`}
                    >
                      <ThumbsDown size={13} />
                      {msg.feedback === -1 && <span>별로예요</span>}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* 예시 질문 카드 — 마지막 답변 바로 아래 */}
        {!loading && suggestions && suggestions.length > 0 && (
          <div className="flex gap-3 flex-row-reverse">
            <div className="shrink-0 w-8" /> {/* 유저 아이콘 자리 맞춤 */}
            <div className="flex flex-col gap-2 w-[30%]">
              <p className="text-xs text-gray-400">이런 질문을 해보세요</p>
              {suggestions.map((text, i) => (
                <button
                  key={i}
                  onClick={() => onSuggestionClick?.(text)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors text-left"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}

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
