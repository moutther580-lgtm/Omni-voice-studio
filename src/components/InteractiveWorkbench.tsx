import React, { useState, useMemo } from 'react';
import { PureLogic } from '../data/pureLogic';
import { MODEL_PRESETS, VOICES, LANGUAGES } from '../data/constants';
import { Play, RotateCw, Copy, Check, Sparkles, AlertCircle, RefreshCw, Sliders, Volume2, Key, SplitSquareVertical } from 'lucide-react';

export const InteractiveWorkbench: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'chunker' | 'keyRotation' | 'requestBuilder' | 'wavHeader'>('chunker');

  // Chunker State
  const [inputText, setInputText] = useState<string>(
    `خوش آمدید! یہ جیمنی ٹی ٹی ایس کنورٹر کا نیا ورژن ہے۔\nیہ اردو جملوں کے اختتام پر لگے ہوئے ختمہ (۔) اور سوالیہ نشان (؟) کو باآسانی پہچانتا ہے۔\n\nJoe: Hello Jane, how is the new Android migration progressing?\nJane: It is going great! The Kotlin Coroutines and Java ExecutorService manage background streaming effortlessly.`
  );
  const [chunkSize, setChunkSize] = useState<number>(1800);
  const [cleanTextEnabled, setCleanTextEnabled] = useState<boolean>(true);
  const [dialogueCarry, setDialogueCarry] = useState<boolean>(true);

  // Key Rotation Simulator State
  const [simKeys, setSimKeys] = useState<{ id: string; key: string; coolUntil: number; isDead: boolean }[]>([
    { id: '1', key: 'AIzaSyA_alpha_key_sample12345', coolUntil: 0, isDead: false },
    { id: '2', key: 'AIzaSyB_beta_key_sample67890', coolUntil: 0, isDead: false },
    { id: '3', key: 'AIzaSyC_gamma_key_sample54321', coolUntil: 0, isDead: false }
  ]);
  const [activeKeyIndex, setActiveKeyIndex] = useState<number>(0);
  const [simLogs, setSimLogs] = useState<string[]>(['Key pool initialized with 3 keys.']);

  // Request Builder State
  const [reqModel, setReqModel] = useState<string>(MODEL_PRESETS[0].id);
  const [reqVoice, setReqVoice] = useState<string>('Kore');
  const [reqLang, setReqLang] = useState<string>('Auto Detect');
  const [reqStyle, setReqStyle] = useState<string>('slowly and calmly with warm articulation');
  const [reqMulti, setReqMulti] = useState<boolean>(true);
  const [sp1Name, setSp1Name] = useState<string>('Joe');
  const [sp1Voice, setSp1Voice] = useState<string>('Puck');
  const [sp2Name, setSp2Name] = useState<string>('Jane');
  const [sp2Voice, setSp2Voice] = useState<string>('Kore');

  // WAV Header State
  const [wavRate, setWavRate] = useState<number>(24000);
  const [wavChannels, setWavChannels] = useState<number>(1);
  const [wavDataLen, setWavDataLen] = useState<number>(96000); // 2 seconds @ 24kHz 16-bit mono

  const [copied, setCopied] = useState(false);

  // Computed Chunks
  const processedText = useMemo(() => {
    return cleanTextEnabled ? PureLogic.cleanText(inputText) : inputText;
  }, [inputText, cleanTextEnabled]);

  const chunks = useMemo(() => {
    return PureLogic.splitChunks(processedText, chunkSize, dialogueCarry);
  }, [processedText, chunkSize, dialogueCarry]);

  const totalChars = useMemo(() => {
    return PureLogic.ulen(processedText);
  }, [processedText]);

  // Generated Request JSON
  const generatedRequestJson = useMemo(() => {
    const payload = PureLogic.buildRequest(
      {
        model: reqModel,
        voice: PureLogic.voiceName(reqVoice),
        lang: reqLang,
        style: reqStyle,
        multi: reqMulti,
        sp1Name,
        sp1Voice: PureLogic.voiceName(sp1Voice),
        sp2Name,
        sp2Voice: PureLogic.voiceName(sp2Voice)
      },
      processedText || 'Hello world'
    );
    return JSON.stringify(payload, null, 2);
  }, [reqModel, reqVoice, reqLang, reqStyle, reqMulti, sp1Name, sp1Voice, sp2Name, sp2Voice, processedText]);

  // WAV Header Bytes
  const wavBytes = useMemo(() => {
    return PureLogic.wavHeader(wavDataLen, wavRate, wavChannels);
  }, [wavDataLen, wavRate, wavChannels]);

  // Key rotation simulation step
  const simulateApiCall = (status: '200' | '429_minute' | '429_day' | '401' | '500') => {
    const now = Math.floor(Date.now() / 1000);
    // Find active key
    let selectedIdx = -1;
    let minWait = 999999;

    for (let offset = 0; offset < simKeys.length; offset++) {
      const idx = (activeKeyIndex + offset) % simKeys.length;
      const k = simKeys[idx];
      if (!k.isDead) {
        if (k.coolUntil <= now) {
          selectedIdx = idx;
          break;
        } else {
          const wait = k.coolUntil - now;
          if (wait < minWait) minWait = wait;
        }
      }
    }

    if (selectedIdx === -1) {
      setSimLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] ❌ All keys exhausted or cooling! Wait ${minWait === 999999 ? 0 : minWait}s.`,
        ...prev.slice(0, 7)
      ]);
      return;
    }

    const currentKey = simKeys[selectedIdx];
    const tail = PureLogic.keyTail(currentKey.key);

    if (status === '200') {
      setSimLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] ✅ Chunk synthesized successfully with Key #${selectedIdx + 1} (...${tail}).`,
        ...prev.slice(0, 7)
      ]);
      setActiveKeyIndex(selectedIdx);
    } else if (status === '429_minute') {
      const cooldownSec = 40;
      setSimKeys((prev) =>
        prev.map((k, i) => (i === selectedIdx ? { ...k, coolUntil: now + cooldownSec } : k))
      );
      setSimLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] ⚠️ Key #${selectedIdx + 1} hit 429 rate limit (per-minute). Put on cooldown for ${cooldownSec}s. Switching key...`,
        ...prev.slice(0, 7)
      ]);
      setActiveKeyIndex((selectedIdx + 1) % simKeys.length);
    } else if (status === '429_day') {
      setSimKeys((prev) =>
        prev.map((k, i) => (i === selectedIdx ? { ...k, isDead: true } : k))
      );
      setSimLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] 🛑 Key #${selectedIdx + 1} daily quota reached! Marked DEAD for today. Switching key...`,
        ...prev.slice(0, 7)
      ]);
      setActiveKeyIndex((selectedIdx + 1) % simKeys.length);
    } else if (status === '401') {
      setSimKeys((prev) =>
        prev.map((k, i) => (i === selectedIdx ? { ...k, isDead: true } : k))
      );
      setSimLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] 🚫 Key #${selectedIdx + 1} invalid (401/403). Permanently disabled.`,
        ...prev.slice(0, 7)
      ]);
      setActiveKeyIndex((selectedIdx + 1) % simKeys.length);
    } else if (status === '500') {
      setSimLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] 🔄 Server 500 error on Key #${selectedIdx + 1}. Retrying same chunk in 3s (attempt 1/4)...`,
        ...prev.slice(0, 7)
      ]);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Sub-tab Navigation */}
      <div className="flex border-b border-slate-800 space-x-2 sm:space-x-4 mb-6 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveSubTab('chunker')}
          className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'chunker'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <SplitSquareVertical className="w-4 h-4" />
          Text Chunker &amp; Urdu/Arabic Splitter
        </button>

        <button
          onClick={() => setActiveSubTab('keyRotation')}
          className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'keyRotation'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Key className="w-4 h-4" />
          Key Rotation &amp; 429 Simulator
        </button>

        <button
          onClick={() => setActiveSubTab('requestBuilder')}
          className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'requestBuilder'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Volume2 className="w-4 h-4" />
          Gemini 3.8 Audio Request Builder
        </button>

        <button
          onClick={() => setActiveSubTab('wavHeader')}
          className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'wavHeader'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          WAV Header Inspector (44-Byte RIFF)
        </button>
      </div>

      {/* 1. CHUNKER TAB */}
      {activeSubTab === 'chunker' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-white">Input Text (Any Language / Dialogue)</label>
                <button
                  onClick={() =>
                    setInputText(
                      `خوش آمدید! یہ جیمنی ٹی ٹی ایس کنورٹر کا نیا ورژن ہے۔\nیہ اردو جملوں کے اختتام پر لگے ہوئے ختمہ (۔) اور سوالیہ نشان (؟) کو باآسانی پہچانتا ہے۔\n\nJoe: Hello Jane, how is the new Android migration progressing?\nJane: It is going great! The Kotlin Coroutines and Java ExecutorService manage background streaming effortlessly.`
                    )
                  }
                  className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
                >
                  Reset Sample Text
                </button>
              </div>

              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={8}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
                placeholder="Type or paste text..."
              />

              {/* Chunker Controls */}
              <div className="mt-4 space-y-3 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">
                    Chunk Size Limit: <span className="font-mono text-blue-400">{chunkSize} chars</span>
                  </label>
                  <span className="text-[11px] text-slate-500">(Recommended: 1800)</span>
                </div>
                <input
                  type="range"
                  min="300"
                  max="3000"
                  step="100"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(parseInt(e.target.value, 10))}
                  className="w-full accent-blue-500 cursor-pointer"
                />

                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cleanTextEnabled}
                      onChange={(e) => setCleanTextEnabled(e.target.checked)}
                      className="rounded accent-blue-500"
                    />
                    <span>Clean Markdown &amp; URLs</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dialogueCarry}
                      onChange={(e) => setDialogueCarry(e.target.checked)}
                      className="rounded accent-blue-500"
                    />
                    <span>Carry Speaker Dialogue Prefix</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-center">
                <div className="text-[11px] font-medium text-slate-400">Total Code Points</div>
                <div className="text-xl font-bold text-white font-mono mt-1">{PureLogic.commas(totalChars)}</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-center">
                <div className="text-[11px] font-medium text-slate-400">Chunks Generated</div>
                <div className="text-xl font-bold text-blue-400 font-mono mt-1">{chunks.length}</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-center">
                <div className="text-[11px] font-medium text-slate-400">Audio Estimate</div>
                <div className="text-sm font-semibold text-emerald-400 font-mono mt-2 truncate">
                  {PureLogic.fmtDuration(totalChars / 14)}
                </div>
              </div>
            </div>
          </div>

          {/* Resulting Chunks Preview */}
          <div className="lg:col-span-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Resulting Chunks for Gemini API</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                  {chunks.length} total
                </span>
              </h3>
            </div>

            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {chunks.map((chunk, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/60 pb-2">
                    <span className="font-semibold text-blue-300 font-mono">Chunk #{i + 1}</span>
                    <span className="font-mono text-slate-400">{PureLogic.ulen(chunk)} characters</span>
                  </div>
                  <p className="text-xs text-slate-200 font-sans whitespace-pre-wrap leading-relaxed">{chunk}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. KEY ROTATION TAB */}
      {activeSubTab === 'keyRotation' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Active Gemini API Key Pool</h3>
                <button
                  onClick={() => {
                    setSimKeys([
                      { id: '1', key: 'AIzaSyA_alpha_key_sample12345', coolUntil: 0, isDead: false },
                      { id: '2', key: 'AIzaSyB_beta_key_sample67890', coolUntil: 0, isDead: false },
                      { id: '3', key: 'AIzaSyC_gamma_key_sample54321', coolUntil: 0, isDead: false }
                    ]);
                    setSimLogs(['Key pool reset to initial states.']);
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset Pool
                </button>
              </div>

              <div className="space-y-2">
                {simKeys.map((k, idx) => {
                  const now = Math.floor(Date.now() / 1000);
                  const isCooling = k.coolUntil > now;
                  const isActive = activeKeyIndex === idx && !k.isDead && !isCooling;

                  return (
                    <div
                      key={k.id}
                      className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                        k.isDead
                          ? 'bg-rose-950/20 border-rose-900/40 text-rose-300 opacity-60'
                          : isCooling
                          ? 'bg-amber-950/20 border-amber-900/40 text-amber-300'
                          : isActive
                          ? 'bg-blue-600/15 border-blue-500/50 text-blue-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full font-bold">
                          {k.isDead ? '🛑' : isCooling ? '⏳' : isActive ? '🟢' : '⚪'}
                        </span>
                        <div>
                          <div className="font-mono font-medium">Key #{idx + 1} (...{PureLogic.keyTail(k.key)})</div>
                          <div className="text-[10px] text-slate-400">
                            {k.isDead
                              ? 'Status: DEAD (Quota exhausted or 401)'
                              : isCooling
                              ? `Cooling down (${k.coolUntil - now}s remaining)`
                              : isActive
                              ? 'Active Key for next chunk'
                              : 'Healthy / Standby'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Simulation Controls */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-slate-300">Simulate Response Event:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => simulateApiCall('200')}
                    className="p-2 text-xs font-medium rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer text-left"
                  >
                    200 OK (Success)
                  </button>
                  <button
                    onClick={() => simulateApiCall('429_minute')}
                    className="p-2 text-xs font-medium rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer text-left"
                  >
                    429 Rate Limit (1 Min Wait)
                  </button>
                  <button
                    onClick={() => simulateApiCall('429_day')}
                    className="p-2 text-xs font-medium rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer text-left"
                  >
                    429 Daily Quota Finished
                  </button>
                  <button
                    onClick={() => simulateApiCall('401')}
                    className="p-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer text-left"
                  >
                    401 / 400 Bad Key
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-white">Rotation Engine Activity Log</h3>
              <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg font-mono text-xs text-slate-300 space-y-2 min-h-[220px]">
                {simLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed">{log}</div>
                ))}
              </div>
              <div className="p-3 bg-blue-950/20 border border-blue-800/30 rounded-lg text-xs text-blue-300">
                <span className="font-semibold">How Key Rotation Works in Android: </span>
                When a 429 occurs, <code className="text-blue-200 font-mono">KeyRotationManager.pickKey()</code> evaluates 
                retryDelay, marks the key with an epoch timestamp, and seamlessly advances to the next key without dropping audio chunks or failing the job.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. REQUEST BUILDER TAB */}
      {activeSubTab === 'requestBuilder' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-white">Synthesis Parameters</h3>

              <div>
                <label className="text-xs font-medium text-slate-300">Model Selection</label>
                <select
                  value={reqModel}
                  onChange={(e) => setReqModel(e.target.value)}
                  className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {MODEL_PRESETS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {PureLogic.isNewSchema(reqModel)
                    ? 'Uses modern Gemini 3.8 speech_metadata schema'
                    : 'Uses Gemini 2.5 prompt instruction schema'}
                </span>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Voice Selection</label>
                <select
                  value={reqVoice}
                  onChange={(e) => setReqVoice(e.target.value)}
                  className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {VOICES.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Style Instruction (speech_metadata.style)</label>
                <input
                  type="text"
                  value={reqStyle}
                  onChange={(e) => setReqStyle(e.target.value)}
                  className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  placeholder="e.g. slowly and calmly"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-3">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reqMulti}
                    onChange={(e) => setReqMulti(e.target.checked)}
                    className="rounded accent-blue-500"
                  />
                  <span>Enable Multi-Speaker Dialogue Mode</span>
                </label>

                {reqMulti && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <div>
                      <label className="text-[11px] text-slate-400">Speaker 1</label>
                      <input
                        type="text"
                        value={sp1Name}
                        onChange={(e) => setSp1Name(e.target.value)}
                        className="mt-1 w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200"
                      />
                      <select
                        value={sp1Voice}
                        onChange={(e) => setSp1Voice(e.target.value)}
                        className="mt-1.5 w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-[11px] text-slate-200"
                      >
                        {VOICES.map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400">Speaker 2</label>
                      <input
                        type="text"
                        value={sp2Name}
                        onChange={(e) => setSp2Name(e.target.value)}
                        className="mt-1 w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200"
                      />
                      <select
                        value={sp2Voice}
                        onChange={(e) => setSp2Voice(e.target.value)}
                        className="mt-1.5 w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-[11px] text-slate-200"
                      >
                        {VOICES.map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Generated Google Generative Language Request Body</span>
              <button
                onClick={() => handleCopy(generatedRequestJson)}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto max-h-[500px] overflow-y-auto font-mono text-xs text-emerald-300">
              <pre>{generatedRequestJson}</pre>
            </div>
          </div>
        </div>
      )}

      {/* 4. WAV HEADER TAB */}
      {activeSubTab === 'wavHeader' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-white">RIFF WAVE PCM Parameters</h3>

              <div>
                <label className="text-xs font-medium text-slate-300">Sampling Rate (Hz)</label>
                <select
                  value={wavRate}
                  onChange={(e) => setWavRate(parseInt(e.target.value, 10))}
                  className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value={16000}>16,000 Hz (Voice optimized)</option>
                  <option value={24000}>24,000 Hz (Gemini standard default)</option>
                  <option value={44100}>44,100 Hz (CD Audio)</option>
                  <option value={48000}>48,000 Hz (Studio quality)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Audio Channels</label>
                <div className="flex gap-4 mt-1.5">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="channels"
                      checked={wavChannels === 1}
                      onChange={() => setWavChannels(1)}
                      className="accent-blue-500"
                    />
                    <span>Mono (1 Channel)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="channels"
                      checked={wavChannels === 2}
                      onChange={() => setWavChannels(2)}
                      className="accent-blue-500"
                    />
                    <span>Stereo (2 Channels)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Simulated Raw PCM Data Length</label>
                <input
                  type="number"
                  value={wavDataLen}
                  onChange={(e) => setWavDataLen(parseInt(e.target.value, 10) || 0)}
                  className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Total File Size: {wavDataLen + 44} bytes • Duration: {(wavDataLen / (wavRate * wavChannels * 2)).toFixed(2)}s
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-3">
            <h3 className="text-sm font-semibold text-white">44-Byte Little-Endian Header Structure</h3>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto">
              <table className="w-full text-xs font-mono text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-2">Offset</th>
                    <th className="py-2 px-2">Field</th>
                    <th className="py-2 px-2">Value</th>
                    <th className="py-2 px-2">Hex / Bytes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  <tr>
                    <td className="py-1.5 px-2 text-slate-500">0 - 3</td>
                    <td className="py-1.5 px-2">ChunkID</td>
                    <td className="py-1.5 px-2 font-bold text-blue-400">"RIFF"</td>
                    <td className="py-1.5 px-2 text-slate-400">52 49 46 46</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 text-slate-500">4 - 7</td>
                    <td className="py-1.5 px-2">ChunkSize</td>
                    <td className="py-1.5 px-2">{wavDataLen + 36}</td>
                    <td className="py-1.5 px-2 font-bold text-emerald-400">
                      {PureLogic.le32(wavDataLen + 36).map((b) => b.toString(16).padStart(2, '0')).join(' ')}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 text-slate-500">8 - 11</td>
                    <td className="py-1.5 px-2">Format</td>
                    <td className="py-1.5 px-2 font-bold text-blue-400">"WAVE"</td>
                    <td className="py-1.5 px-2 text-slate-400">57 41 56 45</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 text-slate-500">12 - 15</td>
                    <td className="py-1.5 px-2">Subchunk1ID</td>
                    <td className="py-1.5 px-2 font-bold text-blue-400">"fmt "</td>
                    <td className="py-1.5 px-2 text-slate-400">66 6D 74 20</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 text-slate-500">16 - 19</td>
                    <td className="py-1.5 px-2">Subchunk1Size</td>
                    <td className="py-1.5 px-2">16 (PCM)</td>
                    <td className="py-1.5 px-2 text-slate-400">10 00 00 00</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 text-slate-500">20 - 21</td>
                    <td className="py-1.5 px-2">AudioFormat</td>
                    <td className="py-1.5 px-2">1 (Linear PCM)</td>
                    <td className="py-1.5 px-2 text-slate-400">01 00</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 text-slate-500">22 - 23</td>
                    <td className="py-1.5 px-2">NumChannels</td>
                    <td className="py-1.5 px-2">{wavChannels}</td>
                    <td className="py-1.5 px-2 text-slate-400">{wavChannels.toString(16).padStart(2, '0')} 00</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 text-slate-500">24 - 27</td>
                    <td className="py-1.5 px-2">SampleRate</td>
                    <td className="py-1.5 px-2">{wavRate} Hz</td>
                    <td className="py-1.5 px-2 font-bold text-emerald-400">
                      {PureLogic.le32(wavRate).map((b) => b.toString(16).padStart(2, '0')).join(' ')}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 text-slate-500">28 - 31</td>
                    <td className="py-1.5 px-2">ByteRate</td>
                    <td className="py-1.5 px-2">{wavRate * wavChannels * 2} B/s</td>
                    <td className="py-1.5 px-2 text-slate-400">
                      {PureLogic.le32(wavRate * wavChannels * 2).map((b) => b.toString(16).padStart(2, '0')).join(' ')}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 text-slate-500">32 - 33</td>
                    <td className="py-1.5 px-2">BlockAlign</td>
                    <td className="py-1.5 px-2">{wavChannels * 2}</td>
                    <td className="py-1.5 px-2 text-slate-400">{(wavChannels * 2).toString(16).padStart(2, '0')} 00</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 text-slate-500">34 - 35</td>
                    <td className="py-1.5 px-2">BitsPerSample</td>
                    <td className="py-1.5 px-2">16 bits</td>
                    <td className="py-1.5 px-2 text-slate-400">10 00</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 text-slate-500">36 - 39</td>
                    <td className="py-1.5 px-2">Subchunk2ID</td>
                    <td className="py-1.5 px-2 font-bold text-blue-400">"data"</td>
                    <td className="py-1.5 px-2 text-slate-400">64 61 74 61</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 text-slate-500">40 - 43</td>
                    <td className="py-1.5 px-2">Subchunk2Size</td>
                    <td className="py-1.5 px-2">{wavDataLen}</td>
                    <td className="py-1.5 px-2 font-bold text-emerald-400">
                      {PureLogic.le32(wavDataLen).map((b) => b.toString(16).padStart(2, '0')).join(' ')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
