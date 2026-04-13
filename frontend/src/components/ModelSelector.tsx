import { useState, useRef, useEffect } from "react";
import { ChevronDown, Zap } from "lucide-react";
import { MODEL_OPTIONS, ModelOption } from "../types";

interface Props {
  selected: ModelOption;
  onChange: (option: ModelOption) => void;
}

// 그룹별로 모델 묶기
const groupedModels = MODEL_OPTIONS.reduce<Record<string, ModelOption[]>>((acc, m) => {
  if (!acc[m.group]) acc[m.group] = [];
  acc[m.group].push(m);
  return acc;
}, {});

const FREE_GROUPS = ["Groq", "Google Gemini"];
const PAID_GROUPS = ["OpenAI", "Claude"];

export default function ModelSelector({ selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* 선택된 모델 버튼 */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {selected.free && (
            <span className="shrink-0 inline-flex items-center gap-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0.5 font-medium">
              <Zap size={10} />
              무료
            </span>
          )}
          <span className="truncate text-gray-800">{selected.label}</span>
          <span className="shrink-0 text-xs text-gray-400">{selected.group}</span>
        </div>
        <ChevronDown size={14} className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* 드롭다운 패널 */}
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {/* 무료 섹션 */}
          <div className="px-3 pt-2 pb-1">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
              <Zap size={10} /> 무료
            </p>
          </div>
          {FREE_GROUPS.map((group) =>
            groupedModels[group] ? (
              <div key={group}>
                <p className="px-3 pt-1 text-xs text-gray-400 font-medium">{group}</p>
                {groupedModels[group].map((m) => (
                  <ModelItem key={`${m.provider}::${m.model}`} m={m} selected={selected} onChange={(opt) => { onChange(opt); setOpen(false); }} />
                ))}
              </div>
            ) : null
          )}

          {/* 구분선 */}
          <div className="mx-3 my-1.5 border-t border-gray-100" />

          {/* 유료 섹션 */}
          <div className="px-3 pt-1 pb-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">유료</p>
          </div>
          {PAID_GROUPS.map((group) =>
            groupedModels[group] ? (
              <div key={group}>
                <p className="px-3 pt-1 text-xs text-gray-400 font-medium">{group}</p>
                {groupedModels[group].map((m) => (
                  <ModelItem key={`${m.provider}::${m.model}`} m={m} selected={selected} onChange={(opt) => { onChange(opt); setOpen(false); }} />
                ))}
              </div>
            ) : null
          )}
          <div className="h-2" />
        </div>
      )}
    </div>
  );
}

function ModelItem({
  m,
  selected,
  onChange,
}: {
  m: ModelOption;
  selected: ModelOption;
  onChange: (m: ModelOption) => void;
}) {
  const isSelected = m.provider === selected.provider && m.model === selected.model;
  return (
    <button
      onClick={() => onChange(m)}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
        isSelected ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"
      }`}
    >
      {m.free && (
        <span className="shrink-0 inline-flex items-center gap-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0.5 font-medium">
          <Zap size={9} />
          무료
        </span>
      )}
      <span>{m.label}</span>
      {isSelected && <span className="ml-auto text-blue-500 text-xs">선택됨</span>}
    </button>
  );
}
