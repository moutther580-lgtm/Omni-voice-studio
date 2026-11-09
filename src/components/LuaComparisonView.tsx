import React, { useState } from 'react';
import { Layers, ArrowRight, Check, Search } from 'lucide-react';

interface FunctionMapItem {
  luaName: string;
  luaSignature: string;
  luaPurpose: string;
  kotlinFile: string;
  kotlinFunction: string;
  javaFile: string;
  javaFunction: string;
  category: 'Pure Logic' | 'Audio Engine' | 'Network & Quota' | 'Background Service' | 'UI & Accessibility';
}

const FUNCTION_MAP: FunctionMapItem[] = [
  {
    luaName: 'P.trim',
    luaSignature: 'P.trim(s)',
    luaPurpose: 'Trims leading and trailing whitespace using Lua regex gsub',
    kotlinFile: 'TextProcessor.kt',
    kotlinFunction: 'fun trim(s: String?): String = s?.trim() ?: ""',
    javaFile: 'TextProcessor.java',
    javaFunction: 'public static String trim(String s) { return s != null ? s.trim() : ""; }',
    category: 'Pure Logic'
  },
  {
    luaName: 'P.ulen',
    luaSignature: 'P.ulen(s)',
    luaPurpose: 'UTF-8 aware character length ignoring continuation bytes [^\\128-\\191]',
    kotlinFile: 'TextProcessor.kt',
    kotlinFunction: 'fun ulen(s: String?): Int = s?.codePointCount(0, s.length) ?: 0',
    javaFile: 'TextProcessor.java',
    javaFunction: 'public static int ulen(String s) { return s != null ? s.codePointCount(0, s.length()) : 0; }',
    category: 'Pure Logic'
  },
  {
    luaName: 'P.byteIndexAfterChars',
    luaSignature: 'P.byteIndexAfterChars(s, n)',
    luaPurpose: 'Returns character substring boundary up to n Unicode characters',
    kotlinFile: 'TextProcessor.kt',
    kotlinFunction: 'fun takeChars(s: String, count: Int): String',
    javaFile: 'TextProcessor.java',
    javaFunction: 'public static String takeChars(String s, int count)',
    category: 'Pure Logic'
  },
  {
    luaName: 'P.hasContent',
    luaSignature: 'P.hasContent(s)',
    luaPurpose: 'Checks if text contains alphanumeric or non-ASCII letters',
    kotlinFile: 'TextProcessor.kt',
    kotlinFunction: 'fun hasContent(s: String?): Boolean = s?.any { Character.isLetterOrDigit(it) } ?: false',
    javaFile: 'TextProcessor.java',
    javaFunction: 'public static boolean hasContent(String s)',
    category: 'Pure Logic'
  },
  {
    luaName: 'P.cleanText',
    luaSignature: 'P.cleanText(s)',
    luaPurpose: 'Normalizes line breaks, removes URLs, markdown marks, lone page numbers',
    kotlinFile: 'TextProcessor.kt',
    kotlinFunction: 'fun cleanText(input: String?): String',
    javaFile: 'TextProcessor.java',
    javaFunction: 'public static String cleanText(String input)',
    category: 'Pure Logic'
  },
  {
    luaName: 'P.splitSentences',
    luaSignature: 'P.splitSentences(p)',
    luaPurpose: 'Splits at . ! ? plus Urdu full stop (\\u06D4) and Arabic question mark (\\u061F)',
    kotlinFile: 'TextProcessor.kt',
    kotlinFunction: 'fun splitSentences(paragraph: String): List<String>',
    javaFile: 'TextProcessor.java',
    javaFunction: 'public static List<String> splitSentences(String paragraph)',
    category: 'Pure Logic'
  },
  {
    luaName: 'P.splitLong',
    luaSignature: 'P.splitLong(p, maxChars, carry)',
    luaPurpose: 'Splits oversized paragraphs with dialogue prefix preservation (Speaker: ...)',
    kotlinFile: 'TextProcessor.kt',
    kotlinFunction: 'fun splitLong(p: String, maxChars: Int, carry: Boolean): List<String>',
    javaFile: 'TextProcessor.java',
    javaFunction: 'public static List<String> splitLong(String p, int maxChars, boolean carry)',
    category: 'Pure Logic'
  },
  {
    luaName: 'P.splitChunks',
    luaSignature: 'P.splitChunks(text, maxChars, carry)',
    luaPurpose: 'Hierarchical chunker respecting paragraph and sentence boundaries',
    kotlinFile: 'TextProcessor.kt',
    kotlinFunction: 'fun splitChunks(rawText: String, maxChars: Int, carry: Boolean): List<String>',
    javaFile: 'TextProcessor.java',
    javaFunction: 'public static List<String> splitChunks(String rawText, int maxChars, boolean carry)',
    category: 'Pure Logic'
  },
  {
    luaName: 'P.wavHeader',
    luaSignature: 'P.wavHeader(dataLen, rate, channels)',
    luaPurpose: 'Builds 44-byte standard RIFF WAVE linear PCM header',
    kotlinFile: 'WavAudioUtil.kt',
    kotlinFunction: 'fun buildWavHeader(dataLen: Long, sampleRate: Int, channels: Int): ByteArray',
    javaFile: 'WavAudioUtil.java',
    javaFunction: 'public static byte[] buildWavHeader(long dataLen, int sampleRate, int channels)',
    category: 'Audio Engine'
  },
  {
    luaName: 'P.parseRate',
    luaSignature: 'P.parseRate(mime)',
    luaPurpose: 'Extracts sample rate from MIME (e.g. rate=24000)',
    kotlinFile: 'WavAudioUtil.kt',
    kotlinFunction: 'fun parseRate(mime: String?): Int',
    javaFile: 'WavAudioUtil.java',
    javaFunction: 'public static int parseRate(String mime)',
    category: 'Audio Engine'
  },
  {
    luaName: 'encodeM4A',
    luaSignature: 'encodeM4A(srcPath, destPath, onProgress, onDone)',
    luaPurpose: 'Converts raw PCM WAV to AAC-compressed M4A container with progress reporting',
    kotlinFile: 'MediaCodecAudioConverter.kt',
    kotlinFunction: 'suspend fun convertWavToM4a(srcWav: File, destM4a: File, onProgress: (Int) -> Unit): Result<File>',
    javaFile: 'MediaCodecAudioConverter.java',
    javaFunction: 'public static void convertWavToM4a(File srcWav, File destM4a, ProgressCallback cb) throws IOException',
    category: 'Audio Engine'
  },
  {
    luaName: 'P.parseKeys',
    luaSignature: 'P.parseKeys(raw)',
    luaPurpose: 'Parses whitespace/comma/semicolon separated API keys (len >= 15)',
    kotlinFile: 'KeyRotationManager.kt',
    kotlinFunction: 'fun parseKeys(raw: String?): MutableList<ManagedKey>',
    javaFile: 'KeyRotationManager.java',
    javaFunction: 'public static List<KeyEntry> parseKeys(String raw)',
    category: 'Network & Quota'
  },
  {
    luaName: 'P.classifyResponse',
    luaSignature: 'P.classifyResponse(code, body)',
    luaPurpose: 'Classifies HTTP status & error body into OK, 429 minute/day, 401, 500, etc.',
    kotlinFile: 'KeyRotationManager.kt',
    kotlinFunction: 'fun classifyResponse(code: Int, body: String?): ResponseClassification',
    javaFile: 'KeyRotationManager.java',
    javaFunction: 'public static ClassificationResult classifyResponse(int code, String body)',
    category: 'Network & Quota'
  },
  {
    luaName: 'P.pickKey',
    luaSignature: 'P.pickKey(keys, start, now)',
    luaPurpose: 'Round-robin selection skipping dead keys and respecting cooldown timestamps',
    kotlinFile: 'KeyRotationManager.kt',
    kotlinFunction: 'fun pickKey(nowEpochSec: Long): Triple<ManagedKey, Int, Long>?',
    javaFile: 'KeyRotationManager.java',
    javaFunction: 'public synchronized PickResult pickKey(long nowEpochSec)',
    category: 'Network & Quota'
  },
  {
    luaName: 'P.buildRequest',
    luaSignature: 'P.buildRequest(cfg, text)',
    luaPurpose: 'Builds Gemini generateContent JSON payload (3.8 audio modality vs 2.5 prompt)',
    kotlinFile: 'GeminiRequestHelper.kt',
    kotlinFunction: 'fun buildRequestBody(...): String',
    javaFile: 'GeminiRequestHelper.java',
    javaFunction: 'public static String buildRequestBody(...): String',
    category: 'Network & Quota'
  },
  {
    luaName: 'acquireWake / releaseWake',
    luaSignature: 'pm.newWakeLock(PARTIAL_WAKE_LOCK, ...)',
    luaPurpose: 'Prevents CPU sleep while batch generating audio chunks in background',
    kotlinFile: 'TtsForegroundService.kt',
    kotlinFunction: 'private fun acquireWakeLock() / releaseWakeLock()',
    javaFile: 'TtsForegroundService.java',
    javaFunction: 'private void acquireWakeLock() / releaseWakeLock()',
    category: 'Background Service'
  },
  {
    luaName: 'E.run / E.process / E.send / E.append',
    luaSignature: 'Background synthesis loop with resume & checkpointing',
    luaPurpose: 'Manages request execution, PCM chunk appending, retry on network errors',
    kotlinFile: 'TtsForegroundService.kt',
    kotlinFunction: 'suspend fun executeGenerationLoop(...)',
    javaFile: 'TtsForegroundService.java',
    javaFunction: 'private void executeGenerationLoop(...)',
    category: 'Background Service'
  },
  {
    luaName: 'setStatus / announce',
    luaSignature: 'v_status.announceForAccessibility(...)',
    luaPurpose: 'TalkBack / screen-reader accessibility announcements for blind users',
    kotlinFile: 'MainActivity.kt',
    kotlinFunction: 'private fun setStatus(msg: String, speak: Boolean) { tvStatus.announceForAccessibility(...) }',
    javaFile: 'MainActivity.java',
    javaFunction: 'private void setStatus(String msg, boolean speak) { tvStatus.announceForAccessibility(...) }',
    category: 'UI & Accessibility'
  }
];

export const LuaComparisonView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Pure Logic', 'Audio Engine', 'Network & Quota', 'Background Service', 'UI & Accessibility'];

  const filteredItems = FUNCTION_MAP.filter((item) => {
    const matchesSearch =
      item.luaName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.luaPurpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.kotlinFunction.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.javaFunction.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            Function-by-Function Mapping (Lua → Kotlin &amp; Java)
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Complete trace of every function in <code className="text-amber-300 font-mono">gemini_tts_v20_9eb793ec.lua</code> to its native Android implementation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search functions..."
              className="pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 w-52"
            />
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Mapping Cards Table */}
      <div className="space-y-3">
        {filteredItems.map((item, idx) => (
          <div
            key={idx}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-colors"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/60 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold font-mono text-amber-300">{item.luaName}</span>
                <span className="text-[11px] font-mono text-slate-500">({item.luaSignature})</span>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400 self-start sm:self-auto">
                {item.category}
              </span>
            </div>

            <p className="text-xs text-slate-300 mb-3">{item.luaPurpose}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Kotlin Box */}
              <div className="bg-slate-950 p-2.5 rounded-lg border border-blue-900/30">
                <div className="flex items-center justify-between text-[11px] font-mono text-blue-400 mb-1">
                  <span>Kotlin: {item.kotlinFile}</span>
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <code className="text-xs font-mono text-slate-200 block overflow-x-auto whitespace-pre-wrap">
                  {item.kotlinFunction}
                </code>
              </div>

              {/* Java Box */}
              <div className="bg-slate-950 p-2.5 rounded-lg border border-indigo-900/30">
                <div className="flex items-center justify-between text-[11px] font-mono text-indigo-400 mb-1">
                  <span>Java: {item.javaFile}</span>
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <code className="text-xs font-mono text-slate-200 block overflow-x-auto whitespace-pre-wrap">
                  {item.javaFunction}
                </code>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
