export interface Document {
  doc_id: string;
  filename: string;
}

export interface Source {
  filename: string;
  chunk_index: number;
  score: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

export interface ModelOption {
  provider: string;
  model: string;
  label: string;
  free: boolean;
  group: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  // 무료 모델
  { provider: "groq",   model: "llama-3.3-70b-versatile", label: "Llama 3.3 70B",       free: true,  group: "Groq" },
  { provider: "groq",   model: "llama-3.1-8b-instant",    label: "Llama 3.1 8B (빠름)", free: true,  group: "Groq" },
  { provider: "gemini", model: "gemini-2.0-flash",         label: "Gemini 2.0 Flash",    free: true,  group: "Google Gemini" },
  { provider: "gemini", model: "gemini-1.5-flash",         label: "Gemini 1.5 Flash",    free: true,  group: "Google Gemini" },
  { provider: "gemini", model: "gemini-1.5-pro",           label: "Gemini 1.5 Pro",      free: true,  group: "Google Gemini" },
  // 유료 모델
  { provider: "openai", model: "gpt-4o",                   label: "GPT-4o",              free: false, group: "OpenAI" },
  { provider: "openai", model: "gpt-4o-mini",              label: "GPT-4o Mini",         free: false, group: "OpenAI" },
  { provider: "claude", model: "claude-sonnet-4-6",        label: "Claude Sonnet 4.6",   free: false, group: "Claude" },
  { provider: "claude", model: "claude-haiku-4-5-20251001",label: "Claude Haiku 4.5",    free: false, group: "Claude" },
];
