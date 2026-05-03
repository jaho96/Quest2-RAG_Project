import { useState } from "react";
import DashboardTab from "../components/evaluate/DashboardTab";
import EmbeddingTab from "../components/evaluate/EmbeddingTab";
import UploadTab from "../components/evaluate/UploadTab";

const TABS = [
  { id: "dashboard", label: "응답 품질" },
  { id: "embedding", label: "임베딩 품질" },
  { id: "upload",    label: "업로드 성능" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function EvaluatePage() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div>
          <h2 className="text-xl font-bold text-gray-800">RAG 평가 대시보드</h2>
          <p className="text-sm text-gray-500 mt-0.5">응답 품질 · 임베딩 품질 분석</p>
        </div>

        {/* 탭 헤더 */}
        <div className="flex gap-1 border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "embedding" && <EmbeddingTab />}
        {activeTab === "upload"    && <UploadTab />}
      </div>
    </div>
  );
}