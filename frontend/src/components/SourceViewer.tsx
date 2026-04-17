import { BookOpen } from "lucide-react";
import { Source } from "../types";

interface Props {
  sources: Source[];
}

export default function SourceViewer({ sources }: Props) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-gray-100">
      <div className="flex items-center gap-1 mb-1 text-xs text-gray-400">
        <BookOpen size={12} />
        <span>참고 출처</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {sources.map((s, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5"
          >
            {s.filename}
            {s.page != null && ` · ${s.page}p`}
          </span>
        ))}
      </div>
    </div>
  );
}
