import QuizTab from "../components/evaluate/QuizTab";

export default function QuizPage() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <h2 className="text-xl font-bold text-gray-800">퀴즈</h2>
          <p className="text-sm text-gray-500 mt-0.5">문서를 기반으로 생성된 퀴즈를 풀어보세요.</p>
        </div>
        <QuizTab />
      </div>
    </div>
  );
}
