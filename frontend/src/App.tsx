import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ChatPage from "./pages/ChatPage";
import EvaluatePage from "./pages/EvaluatePage";
import QuizPage from "./pages/QuizPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ChatPage />} />
          <Route path="evaluate" element={<EvaluatePage />} />
          <Route path="quiz" element={<QuizPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
