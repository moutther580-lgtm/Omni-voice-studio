import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Square, RotateCcw, RotateCw, Download, Share2, 
  Volume2, Sliders, Music, FileUp, Check, 
  Users, Layers, ArrowUpRight, Gauge, Radio
} from 'lucide-react';
import { PureLogic } from '../data/pureLogic';
import { VOICES, LANGUAGES, AppConfig } from '../data/constants';

interface CommercialAppViewProps {
  config: AppConfig;
  onUpdateConfig: (newConfig: AppConfig) => void;
  onOpenAccount: () => void;
  userCredits: number;
  onDeductCredits: (chars: number) => void;
  isLoggedIn: boolean;
}

interface HistoryItem {
  id: string;
  title: string;
  textSnippet: string;
  date: string;
  durationSec: number;
  chars: number;
  format: 'WAV' | 'M4A';
  voice: string;
}

const VOICE_TIERS = [
  { id: "gemini-3.8-flash-tts", label: "Ultra Vocal Engine (Studio Master)" },
  { id: "gemini-3.8-flash-lite-tts", label: "Fast Vocal Engine (Podcast & Books)" },
  { id: "gemini-2.5-pro-preview-tts", label: "Narrative Depth Engine (Stories)" }
];

const MASTER_SAMPLES = {
  englishStudio: `Host: Welcome to OmniVoice Studio. Demonstrating high-fidelity human phonetics, emotion-driven cadence, and pristine narrative continuity for creators worldwide.`,
  spanishGlobal: `Bienvenidos a OmniVoice Studio. Tecnología acústica de última generación para audiolibros, doblaje y accesibilidad universal sin límites.`,
  arabicGlobal: `مرحباً بكم في أومني فويس ستوديو. هندسة صوتية دقيقة تمنح النصوص نبضاً وحياة بأعلى معايير النقاء الصوتي والتعبير الإنساني.`,
  urduStory: `ایک پُرسکون شام تھی جب لائبریری میں صدیوں پرانی کتاب کھولی گئی۔ اس کے ہر صفحے پر انسانی دانائی، محبت اور استقامت کے ایسے سبق درج تھے جو وقت کی گردش کے باوجود دلوں کو گرماتے ہیں۔`,
  urduPoetry: `ستاروں سے آگے جہاں اور بھی ہیں\nابھی عشق کے امتحان اور بھی ہیں\nقناعت نہ کر عالمِ رنگ و بو پر\nچمن اور بھی، آشیاں اور بھی ہیں`
};

export const CommercialAppView: React.FC<CommercialAppViewProps> = ({
  config,
  onUpdateConfig,
  onOpenAccount,
  userCredits,
  onDeductCredits,
  isLoggedIn
}) => {
  // Studio Inputs
  const [inputText, setInputText] = useState<string>(MASTER_SAMPLES.urduStory);
  const [selectedVoice, setSelectedVoice] = useState<string>(config.voice);
  const [selectedModel, setSelectedModel] = useState<string>(VOICE_TIERS[0].id);
  const [selectedLang, setSelectedLang] = useState<string>(config.language);
  const [stylePrompt, setStylePrompt] = useState<string>(config.style || 'slowly, warm resonance, thoughtful pause');
  const [isMultiSpeaker, setIsMultiSpeaker] = useState<boolean>(config.multi);

  // Conversion State
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [currentChunk, setCurrentChunk] = useState<number>(0);
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const [consoleStatus, setConsoleStatus] = useState<string>('Console ready. Load script to synthesize master audio.');

  // Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [playbackPos, setPlaybackPos] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(12);

  // Conversion History
  const [history, setHistory] = useState<HistoryItem[]>([
    {
      id: 'h1',
      title: 'OmniVoice_Master_Take_01.wav',
      textSnippet: 'Welcome to OmniVoice Studio. High-fidelity audio...',
      date: 'Recorded 2m ago',
      durationSec: 12,
      chars: 148,
      format: 'WAV',
      voice: 'Kore'
    }
  ]);

  const [activeItem, setActiveItem] = useState<HistoryItem | null>(history[0]);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<any>(null);

  // Calculated properties
  const sanitizedText = config.cleanText ? PureLogic.cleanText(inputText) : inputText;
  const charLength = PureLogic.ulen(sanitizedText);
  const chunkList = PureLogic.splitChunks(sanitizedText, config.chunkSize, isMultiSpeaker);
  const estimatedSeconds = Math.max(2, Math.round(charLength / 14));

  const showNotice = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // File Upload (.txt)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setInputText(text);
        showNotice(`Imported "${file.name}" (${PureLogic.commas(PureLogic.ulen(text))} chars)`);
      }
    };
    reader.readAsText(file);
  };

  // Conversion Simulation
  const handleSynthesize = () => {
    if (!sanitizedText.trim()) {
      showNotice('Please provide text to synthesize.');
      return;
    }

    if (userCredits < charLength && !config.apiKeys) {
      showNotice('Credit reserve depleted. Add custom API key or top up.');
      onOpenAccount();
      return;
    }

    setIsSynthesizing(true);
    setProgressPct(0);
    setCurrentChunk(1);
    setTotalChunks(chunkList.length);
    setConsoleStatus(`Synthesizing: chunk 1 of ${chunkList.length}`);

    let current = 0;
    const total = chunkList.length;

    const interval = setInterval(() => {
      current++;
      const pct = Math.round((current / total) * 100);
      setProgressPct(pct);
      setCurrentChunk(current);
      setConsoleStatus(`Rendering voice audio: chunk ${current} of ${total} (${pct}%)`);

      if (current >= total) {
        clearInterval(interval);
        setIsSynthesizing(false);
        setConsoleStatus(`Master track ready. Generated ${PureLogic.fmtDuration(estimatedSeconds)} of audio.`);
        onDeductCredits(charLength);

        const newItem: HistoryItem = {
          id: Date.now().toString(),
          title: `Master_${new Date().toLocaleTimeString().replace(/:/g, '')}.${config.autoSaveFormat.toLowerCase()}`,
          textSnippet: sanitizedText.slice(0, 65) + '...',
          date: 'Just now',
          durationSec: estimatedSeconds,
          chars: charLength,
          format: config.autoSaveFormat,
          voice: selectedVoice
        };

        setHistory((prev) => [newItem, ...prev]);
        setActiveItem(newItem);
        setAudioDuration(estimatedSeconds);
        setPlaybackPos(0);
        showNotice('OmniVoice Master audio ready! Tap play to listen.');

        if (config.autoPlay) {
          setIsPlaying(true);
          setIsPaused(false);
        }
      }
    }, 750);
  };

  // Playback timer
  useEffect(() => {
    if (isPlaying && !isPaused) {
      timerRef.current = setInterval(() => {
        setPlaybackPos((prev) => {
          if (prev >= audioDuration) {
            setIsPlaying(false);
            setIsPaused(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, isPaused, audioDuration, playbackSpeed]);

  const handleTogglePlay = () => {
    if (!isPlaying) {
      setIsPlaying(true);
      setIsPaused(false);
    } else if (isPaused) {
      setIsPaused(false);
    } else {
      setIsPaused(true);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Toast Notice */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-slate-900 border border-amber-500/40 text-amber-200 text-xs font-mono rounded-lg shadow-2xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>{toast}</span>
        </div>
      )}

      {/* Main Studio Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: SOUND EDITOR & INPUT CONSOLE */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-[#121418] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            
            {/* Header & Quick Text Presets */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div>
                <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-amber-400" aria-hidden="true" />
                  <span>OmniVoice Synthesizer Deck</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">Master DSP</span>
                </h2>
                <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>Universal Phonetics</span>
                  <span aria-hidden="true">·</span>
                  <span>40+ Global Languages &amp; Dialects</span>
                </div>
              </div>

              {/* Presets */}
              <div className="flex items-center gap-1.5 flex-wrap" role="toolbar" aria-label="Quick Script Presets">
                <span className="text-[11px] text-slate-500 uppercase font-mono tracking-wider">Presets:</span>
                <button
                  onClick={() => setInputText(MASTER_SAMPLES.englishStudio)}
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer font-mono"
                  aria-label="Load English Studio script sample"
                >
                  English
                </button>
                <button
                  onClick={() => setInputText(MASTER_SAMPLES.spanishGlobal)}
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
                  aria-label="Load Spanish Global script sample"
                >
                  Español
                </button>
                <button
                  onClick={() => setInputText(MASTER_SAMPLES.arabicGlobal)}
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer font-serif"
                  aria-label="Load Arabic Classical script sample"
                >
                  العربية
                </button>
                <button
                  onClick={() => setInputText(MASTER_SAMPLES.urduStory)}
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
                  aria-label="Load Urdu Story script sample"
                >
                  اردو کہانی
                </button>
                <button
                  onClick={() => setInputText(MASTER_SAMPLES.urduPoetry)}
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer font-serif"
                  aria-label="Load Iqbal poetry script sample"
                >
                  اقبالؒ
                </button>
                
                {/* File Upload Trigger */}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".txt,.md" 
                  className="hidden" 
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-amber-300 border border-amber-500/20 transition-colors cursor-pointer flex items-center gap-1"
                  title="Load TXT file from device"
                >
                  <FileUp className="w-3 h-3" />
                  <span>Import File</span>
                </button>
              </div>
            </div>

            {/* Input Workspace */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Script &amp; Dialogue Editor</span>
                <button
                  onClick={() => setInputText('')}
                  className="text-slate-500 hover:text-slate-300 cursor-pointer transition-colors"
                >
                  Clear Buffer
                </button>
              </div>

              <textarea
                rows={7}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Enter speech script..."
                className="w-full bg-[#0A0C0E] border border-slate-800 rounded-lg p-3.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500/60 font-sans leading-relaxed resize-y selection:bg-amber-500/30"
              />

              {/* Metrics Strip */}
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 font-mono pt-1">
                <div className="flex items-center gap-3">
                  <span className="text-white font-medium">{PureLogic.commas(charLength)} characters</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-amber-400">{chunkList.length} audio chunks</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-emerald-400 font-semibold">~{PureLogic.fmtDuration(estimatedSeconds)} spoken duration</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Segmented by Urdu (۔), Arabic (؟), and sentence boundaries
                </div>
              </div>
            </div>

            {/* Hardware Controls Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800/80">
              {/* Voice Model */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Voice Character</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full bg-[#0A0C0E] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/60"
                >
                  {VOICES.map((v) => (
                    <option key={v} value={PureLogic.voiceName(v)}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Language */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Language Guidance</label>
                <select
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                  className="w-full bg-[#0A0C0E] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/60"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              {/* Acoustic Voice Engine */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Acoustic Engine</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-[#0A0C0E] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/60"
                >
                  {VOICE_TIERS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Expression Prompt */}
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Tone &amp; Emotional Expression
              </label>
              <input
                type="text"
                value={stylePrompt}
                onChange={(e) => setStylePrompt(e.target.value)}
                placeholder="e.g. slowly and calmly, news broadcaster, gentle story"
                className="w-full bg-[#0A0C0E] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/60 font-mono"
              />
            </div>

            {/* Dialogue & Hardware Fine Tuning Toggle */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-[#0A0C0E] rounded-lg border border-slate-800/80">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={isMultiSpeaker}
                  onChange={(e) => setIsMultiSpeaker(e.target.checked)}
                  className="rounded accent-amber-500"
                />
                <span>Multi-Speaker Dialogue (e.g. Joe: Hello / Jane: Hi)</span>
              </label>

              <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                <span>Format: <strong className="text-white">{config.autoSaveFormat}</strong></span>
                <span>Pause: <strong className="text-white">{config.silenceMs}ms</strong></span>
              </div>
            </div>

            {/* Progress Telemetry */}
            {isSynthesizing && (
              <div className="space-y-1.5 p-3 bg-amber-950/15 border border-amber-500/30 rounded-lg animate-in fade-in">
                <div className="flex items-center justify-between text-xs text-amber-300 font-mono">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                    {consoleStatus}
                  </span>
                  <span>{progressPct}%</span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-amber-300 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Action Render Trigger */}
            <button
              onClick={handleSynthesize}
              disabled={isSynthesizing}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-sm rounded-lg shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Music className="w-4 h-4 text-slate-950" />
              <span>{isSynthesizing ? 'Synthesizing Audio Stream...' : 'Synthesize Master Audio'}</span>
            </button>

          </div>
        </div>

        {/* RIGHT COLUMN: ACOUSTIC MASTER PLAYER & LOG */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Master Deck Hardware Player */}
          <div className="bg-[#121418] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase font-mono tracking-wider">Master Output</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300">
                {playbackSpeed}x Velocity
              </span>
            </div>

            {/* Tactile VU Meter Bars */}
            <div className="h-24 bg-[#0A0C0E] border border-slate-800/80 rounded-lg p-3 flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>L -24dB</span>
                <span>0dB PEAK</span>
                <span>R -24dB</span>
              </div>

              <div className="flex items-end gap-1 w-full justify-between h-12 px-1">
                {Array.from({ length: 28 }).map((_, i) => {
                  const pattern = [25, 40, 75, 90, 60, 45, 80, 95, 30, 55, 70, 85, 40, 65, 80, 95, 35, 50, 70, 90, 45, 60, 80, 95, 30, 50, 75, 85];
                  const height = isPlaying && !isPaused ? pattern[i] : 10;
                  const active = i <= (playbackPos / audioDuration) * 28;
                  return (
                    <div
                      key={i}
                      className={`w-1 rounded-sm transition-all duration-150 ${
                        active 
                          ? height > 80 ? 'bg-rose-500' : height > 60 ? 'bg-amber-400' : 'bg-emerald-400' 
                          : 'bg-slate-800'
                      }`}
                      style={{ height: `${height}%` }}
                    ></div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>PCM 16-Bit</span>
                <span>24,000 Hz</span>
              </div>
            </div>

            {/* Scrub Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>{PureLogic.fmtDuration(playbackPos)}</span>
                <span>{PureLogic.fmtDuration(audioDuration)}</span>
              </div>
              <input
                type="range"
                min="0"
                max={audioDuration}
                value={playbackPos}
                onChange={(e) => setPlaybackPos(parseInt(e.target.value, 10))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            {/* Transport Buttons */}
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={() => setPlaybackPos((p) => Math.max(0, p - 10))}
                className="p-2 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg cursor-pointer"
                title="Rewind 10 seconds"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={handleTogglePlay}
                className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 hover:from-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/25 cursor-pointer font-bold"
              >
                {isPlaying && !isPaused ? <Pause className="w-5 h-5 fill-slate-950" /> : <Play className="w-5 h-5 fill-slate-950 ml-0.5" />}
              </button>

              <button
                onClick={() => { setIsPlaying(false); setIsPaused(false); setPlaybackPos(0); }}
                className="p-2 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg cursor-pointer"
                title="Stop audio"
              >
                <Square className="w-4 h-4" />
              </button>

              <button
                onClick={() => setPlaybackPos((p) => Math.min(audioDuration, p + 10))}
                className="p-2 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg cursor-pointer"
                title="Fast forward 10 seconds"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {/* Speed Knob */}
            <div className="flex items-center justify-between text-xs border-t border-slate-800 pt-3">
              <span className="text-slate-400 font-mono">Velocity:</span>
              <div className="flex gap-1 font-mono">
                {[0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setPlaybackSpeed(s); showNotice(`Speed: ${s}x`); }}
                    className={`px-2 py-0.5 rounded text-[11px] cursor-pointer transition-colors ${
                      playbackSpeed === s
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Master Export Actions */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => showNotice(`Exporting "${activeItem?.title || 'Master'}.wav" (Studio uncompressed)`)}
                className="py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-mono font-medium rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Export WAV</span>
              </button>

              <button
                onClick={() => showNotice(`Exporting "${activeItem?.title || 'Master'}.m4a" (MediaCodec AAC compressed)`)}
                className="py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-mono font-medium rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export M4A</span>
              </button>
            </div>

            <button
              onClick={() => showNotice('Audio dispatched to Android System Share')}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Share via WhatsApp / Android</span>
            </button>
          </div>

          {/* Session History Reel */}
          <div className="bg-[#121418] border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold uppercase font-mono tracking-wider text-white">Session Takes ({history.length})</span>
              <span className="text-[11px] text-slate-500">Auto-saved</span>
            </div>

            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setActiveItem(item);
                    setAudioDuration(item.durationSec);
                    setPlaybackPos(0);
                    showNotice(`Loaded "${item.title}"`);
                  }}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    activeItem?.id === item.id
                      ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                      : 'bg-[#0A0C0E] border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono font-medium">
                    <span className="truncate">{item.title}</span>
                    <span className="text-[10px] text-amber-400">{item.format}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{item.textSnippet}</div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
