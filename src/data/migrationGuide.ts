/**
 * In-depth technical migration guide detailing the architectural mapping
 * between AndroLua / Lua 5.3 patterns and Native Android (Java & Kotlin).
 */

export interface MigrationTopic {
  title: string;
  badge: string;
  summary: string;
  luaPattern: string;
  kotlinEquivalent: string;
  javaEquivalent: string;
  deepDive: string[];
}

export const MIGRATION_TOPICS: MigrationTopic[] = [
  {
    title: "1. Pure String & Unicode Manipulation",
    badge: "Core Logic",
    summary: "Mapping UTF-8 byte counting and Urdu/Arabic sentence boundary splitting without UI dependencies.",
    luaPattern: `-- UTF-8 character length
function P.ulen(s)
  local _, n = s:gsub("[^\\128-\\191]", "")
  return n
end

-- Urdu & Arabic full stop / question mark split
if b == 46 or b == 33 or b == 63 then endLen = 1
elseif b == 0xDB and p:byte(i + 1) == 0x94 then endLen = 2
elseif b == 0xD8 and p:byte(i + 1) == 0x9F then endLen = 2
end`,
    kotlinEquivalent: `// Unicode-aware character count using code points
fun ulen(s: String?): Int {
    if (s.isNullOrEmpty()) return 0
    return s.codePointCount(0, s.length)
}

// Urdu (\\u06D4 '۔') and Arabic (\\u061F '؟') sentence split
if (ch == '.' || ch == '!' || ch == '?' || ch == '\\u06D4' || ch == '\\u061F') {
    endLen = 1
}`,
    javaEquivalent: `// Java code points count
public static int ulen(String s) {
    if (s == null || s.isEmpty()) return 0;
    return s.codePointCount(0, s.length());
}

// Sentence splitting with Urdu/Arabic marks
if (ch == '.' || ch == '!' || ch == '?' || ch == '\\u06D4' || ch == '\\u061F') {
    endLen = 1;
}`,
    deepDive: [
      "In Lua, string indices are 1-based and multi-byte UTF-8 sequences required manual byte scanning or regex counting non-continuation bytes [^\\128-\\191]. In Kotlin and Java, String.codePointCount(0, length) natively computes the true Unicode character count.",
      "Urdu full stop is UTF-16 character '\\u06D4' (UTF-8 bytes 0xDB 0x94). Arabic question mark is '\\u061F' (UTF-8 bytes 0xD8 0x9F). In Java/Kotlin, character comparison with '\\u06D4' and '\\u061F' is clean, portable, and avoids multi-byte byte scanning bugs.",
      "Sentence splitting handles closing punctuation like quotes and brackets (\", ', ), ], }, ») following sentence terminators before evaluating whitespace or line boundaries."
    ]
  },
  {
    title: "2. WAV Header & Little-Endian Byte Order",
    badge: "Audio Architecture",
    summary: "Constructing 44-byte standard RIFF/WAVE linear PCM headers and appending audio data on disk.",
    luaPattern: `function P.le32(v)
  v = math.floor(v)
  return { v % 256, math.floor(v / 256) % 256, math.floor(v / 65536) % 256, math.floor(v / 16777216) % 256 }
end

function P.wavHeader(dataLen, rate, channels)
  -- Appends 44 bytes byte-by-byte into Lua table
end`,
    kotlinEquivalent: `fun buildWavHeader(dataLen: Long, sampleRate: Int = 24000, channels: Int = 1): ByteArray {
    val byteRate = sampleRate * channels * (16 / 8)
    val blockAlign = channels * (16 / 8)
    val buffer = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)

    buffer.put("RIFF".toByteArray(Charsets.US_ASCII))
    buffer.putInt((dataLen + 36).toInt())
    buffer.put("WAVE".toByteArray(Charsets.US_ASCII))
    buffer.put("fmt ".toByteArray(Charsets.US_ASCII))
    buffer.putInt(16) // Subchunk1Size
    buffer.putShort(1.toShort()) // PCM format
    buffer.putShort(channels.toShort())
    buffer.putInt(sampleRate)
    buffer.putInt(byteRate)
    buffer.putShort(blockAlign.toShort())
    buffer.putShort(16.toShort()) // BitsPerSample
    buffer.put("data".toByteArray(Charsets.US_ASCII))
    buffer.putInt(dataLen.toInt())

    return buffer.array()
}`,
    javaEquivalent: `public static byte[] buildWavHeader(long dataLen, int sampleRate, int channels) {
    int byteRate = sampleRate * channels * 2;
    int blockAlign = channels * 2;
    ByteBuffer buffer = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN);

    buffer.put("RIFF".getBytes(StandardCharsets.US_ASCII));
    buffer.putInt((int) (dataLen + 36));
    buffer.put("WAVE".getBytes(StandardCharsets.US_ASCII));
    buffer.put("fmt ".getBytes(StandardCharsets.US_ASCII));
    buffer.putInt(16);
    buffer.putShort((short) 1);
    buffer.putShort((short) channels);
    buffer.putInt(sampleRate);
    buffer.putInt(byteRate);
    buffer.putShort((short) blockAlign);
    buffer.putShort((short) 16);
    buffer.put("data".getBytes(StandardCharsets.US_ASCII));
    buffer.putInt((int) dataLen);

    return buffer.array();
}`,
    deepDive: [
      "Lua manually computed mod 256 and division for 32-bit integers. In Java/Kotlin, java.nio.ByteBuffer with ByteOrder.LITTLE_ENDIAN is hardware accelerated and immune to sign-extension bugs.",
      "The RandomAccessFile seek(0) technique allows in-place header updating without rewriting the entire audio payload as chunks arrive from the Gemini API.",
      "Silence injection: zero-filled PCM byte arrays (byte[sampleRate * durationMs / 1000 * 2]) are written between chunks to create natural pauses between paragraphs."
    ]
  },
  {
    title: "3. API Key Rotation & Rate Limit Handling",
    badge: "Concurrency & Networking",
    summary: "Multi-key pool with automated failover, per-minute cooldown tracking, and daily quota exhaustion detection.",
    luaPattern: `function P.classifyResponse(code, body)
  if code == 200 then return "ok", {} end
  if code == 429 then
    local wait = tonumber(body:match('retryDelay"%s*:%s*"(%d+)'))
    local lb = body:lower()
    local kind = "rate_minute"
    if lb:find("perday", 1, true) then kind = "rate_day" end
    return kind, { wait = wait and (wait + 2) or 40 }
  end
  if code == 401 or code == 403 then return "bad_key" end
end`,
    kotlinEquivalent: `// KeyRotationManager.kt
fun classifyResponse(code: Int, body: String?): ResponseClassification {
    if (code == 200) return ResponseClassification.Ok
    if (code == 429) {
        val lower = (body ?: "").lowercase()
        val isDaily = lower.contains("perday") || lower.contains("per day")
        val delay = extractRetryDelay(body) ?: 40L
        return if (isDaily) ResponseClassification.RateLimitDay 
               else ResponseClassification.RateLimitMinute(delay + 2L)
    }
    if (code == 401 || code == 403) return ResponseClassification.BadKey
    // ...
}`,
    javaEquivalent: `// KeyRotationManager.java
public static ClassificationResult classifyResponse(int code, String body) {
    if (code == 200) return new ClassificationResult(ResponseKind.OK, 0, null);
    if (code == 429) {
        String lower = body != null ? body.toLowerCase(Locale.US) : "";
        boolean isDaily = lower.contains("perday") || lower.contains("per day");
        long wait = extractWait(body, 40) + 2;
        return new ClassificationResult(isDaily ? ResponseKind.RATE_DAY : ResponseKind.RATE_MINUTE, wait, null);
    }
    // ...
}`,
    deepDive: [
      "Free Gemini API keys have rate limits (e.g. 15 RPM and 1,500 RPD). When 429 is encountered, KeyRotationManager inspects retryDelay in the error body.",
      "If the error specifies per-day exhaustion ('perday' / 'per day'), the key is flagged as dead for the session, preventing futile retries.",
      "If the error is per-minute throttling, the key enters a cooldown epoch timestamp (now + waitSeconds). The round-robin selector skips cooling keys and immediately picks the next healthy key in the pool."
    ]
  },
  {
    title: "4. Hardware M4A (AAC) Encoding via MediaCodec",
    badge: "Hardware Media",
    summary: "Replaced Lua's single-threaded timer polling with asynchronous background MediaCodec & MediaMuxer pipeline.",
    luaPattern: `-- Lua used small step timer callbacks with os.clock()
local function pump()
  local t0 = os.clock()
  while os.clock() - t0 < 0.04 do
    -- dequeueInputBuffer, read file, dequeueOutputBuffer, muxer write
  end
  later(1, pump)
end`,
    kotlinEquivalent: `// MediaCodecAudioConverter.kt (Kotlin Coroutines)
suspend fun convertWavToM4a(srcWav: File, destM4a: File, onProgress: (Int) -> Unit) = withContext(Dispatchers.IO) {
    val codec = MediaCodec.createEncoderByType("audio/mp4a-latm")
    codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    codec.start()
    val muxer = MediaMuxer(destM4a.path, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    // Non-blocking buffer loop with continuous progress emission
}`,
    javaEquivalent: `// MediaCodecAudioConverter.java
public static void convertWavToM4a(File srcWav, File destM4a, ProgressCallback callback) throws IOException {
    MediaCodec codec = MediaCodec.createEncoderByType("audio/mp4a-latm");
    codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
    codec.start();
    MediaMuxer muxer = new MediaMuxer(destM4a.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
    // Standard input/output buffer synchronization loop
}`,
    deepDive: [
      "In AndroLua, MediaCodec had to be manually stepped in 40ms timer slices ('later(1, pump)') to prevent ANR dialogs. In native Android, we run the encoding loop inside Kotlin Coroutines Dispatchers.IO or an ExecutorService thread.",
      "Buffer timing: Presentation timestamps (presentationTimeUs) are accurately calculated from byte offset / (channels * 2) * 1_000_000 / sampleRate.",
      "MediaMuxer start sequencing: MediaMuxer.start() MUST be called strictly after MediaCodec.dequeueOutputBuffer returns INFO_OUTPUT_FORMAT_CHANGED, passing codec.outputFormat."
    ]
  },
  {
    title: "5. Background Services & WakeLocks",
    badge: "Android Lifecycle",
    summary: "Ensuring TTS generation completes uninterrupted when the user switches apps or the phone screen turns off.",
    luaPattern: `local function acquireWake()
  local pm = service.getSystemService(Context.POWER_SERVICE)
  S.wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "GeminiTTS:job")
  S.wake.acquire(6 * 60 * 60 * 1000)
end`,
    kotlinEquivalent: `// TtsForegroundService.kt
class TtsForegroundService : Service() {
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        wakeLock = (getSystemService(Context.POWER_SERVICE) as PowerManager)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "GeminiTTS:ForegroundJob")
        wakeLock?.acquire(6 * 3600 * 1000L)
        startForeground(NOTIFICATION_ID, buildProgressNotification())
    }
}`,
    javaEquivalent: `// TtsForegroundService.java
public class TtsForegroundService extends Service {
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "GeminiTTS:ForegroundJob");
        wakeLock.acquire(6 * 3600 * 1000L);
        startForeground(NOTIFICATION_ID, buildProgressNotification());
    }
}`,
    deepDive: [
      "In Android 8.0+ (API 26+) and Android 14+ (API 34+), long-running background tasks cannot survive without a Foreground Service with foregroundServiceType='dataSync' declared in AndroidManifest.xml.",
      "WakeLocks keep the CPU awake while the screen is off. Partial wake locks must be reference-counted false and released safely in onDestroy or when the job completes or fails.",
      "Notifications show live progress percentage and chunk count with PendingIntent linking back to MainActivity."
    ]
  },
  {
    title: "6. TalkBack Screen Reader Accessibility",
    badge: "Accessibility",
    summary: "Faithfully recreating the accessibility UX developed by Moutter Rasool for the visually impaired community.",
    luaPattern: `local function setStatus(msg, speak)
  S.status = msg
  v_status.setText(String(msg))
  if speak then v_status.announceForAccessibility(String(msg)) end
end

pcall(function() v_msg_title.setAccessibilityHeading(true) end)`,
    kotlinEquivalent: `fun setStatus(msg: String, speak: Boolean) {
    tvStatus.text = msg
    if (speak) {
        tvStatus.announceForAccessibility(msg)
    }
}

// In XML layout or code:
ViewCompat.setAccessibilityHeading(tvTitle, true)
btnSpeed.contentDescription = "Playback speed. Double tap to cycle speed."`,
    javaEquivalent: `public void setStatus(String msg, boolean speak) {
    tvStatus.setText(msg);
    if (speak) {
        tvStatus.announceForAccessibility(msg);
    }
}

ViewCompat.setAccessibilityHeading(tvTitle, true);
btnSpeed.setContentDescription("Playback speed. Double tap to cycle speed.");`,
    deepDive: [
      "Screen readers (TalkBack, Jieshuo, Commentary) rely on View.announceForAccessibility for dynamic status updates. High-frequency updates are throttled so only key milestones (first chunk, every 5th chunk, completion, or error) are spoken.",
      "Accessibility headings (setAccessibilityHeading(true) / android:accessibilityHeading='true') allow blind users to quickly navigate screen sections using swipe gestures.",
      "Touch target sizes are maintained at >= 48dp with high contrast text colors (#1565C0, #1B5E20, #C62828) for low-vision usability."
    ]
  }
];
