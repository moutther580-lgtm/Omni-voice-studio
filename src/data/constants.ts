/**
 * Data structures and constants matching the original Lua Gemini TTS script.
 */

export interface ModelPreset {
  id: string;
  label: string;
  isNewSchema: boolean;
}

export const MODEL_PRESETS: ModelPreset[] = [
  { id: "gemini-3.8-flash-tts", label: "Gemini 3.8 Flash TTS (best quality)", isNewSchema: true },
  { id: "gemini-3.8-flash-lite-tts", label: "Gemini 3.8 Flash-Lite TTS (fast)", isNewSchema: true },
  { id: "gemini-3.1-flash-tts-preview", label: "Gemini 3.1 Flash TTS Preview", isNewSchema: false },
  { id: "gemini-2.5-pro-preview-tts", label: "Gemini 2.5 Pro Preview TTS", isNewSchema: false },
  { id: "gemini-2.5-flash-preview-tts", label: "Gemini 2.5 Flash Preview TTS (old)", isNewSchema: false }
];

export const VOICES = [
  "Zephyr (Bright)", "Puck (Upbeat)", "Charon (Informative)", "Kore (Firm)", "Fenrir (Excitable)",
  "Leda (Youthful)", "Orus (Firm)", "Aoede (Breezy)", "Callirrhoe (Easy-going)", "Autonoe (Bright)",
  "Enceladus (Breathy)", "Iapetus (Clear)", "Umbriel (Easy-going)", "Algieba (Smooth)", "Despina (Smooth)",
  "Erinome (Clear)", "Algenib (Gravelly)", "Rasalgethi (Informative)", "Laomedeia (Upbeat)", "Achernar (Soft)",
  "Alnilam (Firm)", "Schedar (Even)", "Gacrux (Mature)", "Pulcherrima (Forward)", "Achird (Friendly)",
  "Zubenelgenubi (Casual)", "Vindemiatrix (Gentle)", "Sadachbia (Lively)", "Sadaltager (Knowledgeable)", "Sulafat (Warm)"
];

export const LANGUAGES = [
  "Auto Detect", "Urdu (اردو)", "English", "Arabic (العربية)", "Hindi (हिन्दी)", "Punjabi (پنجابی)",
  "Sindhi (سنڌي)", "Pashto (پښتو)", "Bengali (বাংলা)", "Persian (فارسی)", "Chinese (中文)",
  "Spanish (Español)", "French (Français)", "German (Deutsch)", "Russian (Русский)",
  "Portuguese (Português)", "Japanese (日本語)", "Korean (한국어)", "Turkish (Türkçe)",
  "Indonesian (Bahasa Indonesia)", "Italian (Italiano)", "Dutch (Nederlands)", "Polish (Polski)",
  "Tamil (தமிழ்)", "Telugu (తెలుగు)", "Marathi (मराठी)", "Gujarati (ગુજરાતી)"
];

export interface AppConfig {
  apiKeys: string;
  language: string;
  voice: string;
  model: string;
  customModel: string;
  style: string;
  chunkSize: number;
  pauseSec: number;
  silenceMs: number;
  cleanText: boolean;
  clipboardPrefill: boolean;
  autoSave: boolean;
  autoSaveFormat: "WAV" | "M4A";
  autoPlay: boolean;
  multi: boolean;
  sp1Name: string;
  sp1Voice: string;
  sp2Name: string;
  sp2Voice: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  apiKeys: "",
  language: "Auto Detect",
  voice: "Kore",
  model: MODEL_PRESETS[0].id,
  customModel: "",
  style: "",
  chunkSize: 1800,
  pauseSec: 2,
  silenceMs: 250,
  cleanText: false,
  clipboardPrefill: true,
  autoSave: false,
  autoSaveFormat: "WAV",
  autoPlay: true,
  multi: false,
  sp1Name: "Joe",
  sp1Voice: "Puck",
  sp2Name: "Jane",
  sp2Voice: "Kore"
};
