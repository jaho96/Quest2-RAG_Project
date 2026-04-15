import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ChatPage from "./pages/ChatPage";
import EvaluatePage from "./pages/EvaluatePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ChatPage />} />
          <Route path="evaluate" element={<EvaluatePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
