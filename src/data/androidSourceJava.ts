/**
 * Complete, production-ready Java source code files for Android Studio.
 * Clean architecture, ExecutorService concurrency, robust try-catch exception handling,
 * OkHttp3 client, Android MediaCodec hardware M4A/AAC encoder, and TalkBack accessibility.
 */

import { SourceFile } from './androidSourceKotlin';

export const JAVA_SOURCE_FILES: SourceFile[] = [
  {
    name: "TextProcessor.java",
    path: "app/src/main/java/com/gemini/tts/core/TextProcessor.java",
    package: "com.gemini.tts.core",
    language: "java",
    description: "Pure text parsing, UTF-8 unicode code-point counting, Urdu/Arabic sentence boundary splitting, and hierarchical paragraph/sentence/word chunking in standard Java.",
    luaMapping: "P.trim, P.ulen, P.byteIndexAfterChars, P.hasContent, P.commas, P.fmtDuration, P.cleanText, P.splitSentences, P.splitWords, P.splitLong, P.splitChunks",
    code: `package com.gemini.tts.core;

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * TextProcessor handles all text manipulations, unicode measurements,
 * sentence segmentation with Urdu/Arabic support, and chunk assembly in pure Java.
 */
public final class TextProcessor {

    private TextProcessor() {
        // Utility class
    }

    /**
     * Trims leading and trailing whitespace.
     * Lua: P.trim(s)
     */
    public static String trim(String s) {
        if (s == null) return "";
        return s.trim();
    }

    /**
     * Checks if string has readable alphanumeric characters in any script.
     * Lua: P.hasContent(s)
     */
    public static boolean hasContent(String s) {
        if (s == null || s.isEmpty()) return false;
        for (int i = 0; i < s.length(); i++) {
            if (Character.isLetterOrDigit(s.charAt(i))) {
                return true;
            }
        }
        return false;
    }

    /**
     * Unicode-aware character count using code points.
     * Lua: P.ulen(s)
     */
    public static int ulen(String s) {
        if (s == null || s.isEmpty()) return 0;
        return s.codePointCount(0, s.length());
    }

    /**
     * Returns substring holding exactly [count] unicode characters.
     * Lua: P.byteIndexAfterChars(s, n)
     */
    public static String takeChars(String s, int count) {
        if (s == null) return "";
        int charCount = 0;
        int i = 0;
        int len = s.length();
        while (i < len && charCount < count) {
            int cp = s.codePointAt(i);
            i += Character.charCount(cp);
            charCount++;
        }
        return s.substring(0, i);
    }

    /**
     * Formats integer with commas.
     * Lua: P.commas(n)
     */
    public static String commas(long n) {
        return NumberFormat.getIntegerInstance(Locale.US).format(n);
    }

    /**
     * Formats seconds into human-readable duration.
     * Lua: P.fmtDuration(sec)
     */
    public static String fmtDuration(double seconds) {
        long totalSec = Math.round(seconds);
        long h = totalSec / 3600;
        long m = (totalSec % 3600) / 60;
        long s = totalSec % 60;

        if (h > 0) {
            return String.format(Locale.US, "%d hours %d minutes", h, m);
        } else if (m > 0) {
            return String.format(Locale.US, "%d minutes %d seconds", m, s);
        } else {
            return String.format(Locale.US, "%d seconds", s);
        }
    }

    /**
     * Cleans text: strips URLs, markdown headers, blockquotes, bold/italic,
     * lone page numbers, and extra blank lines.
     * Lua: P.cleanText(s)
     */
    public static String cleanText(String input) {
        if (input == null || input.isEmpty()) return "";
        String normalized = input.replace("\\r\\n", "\\n").replace("\\r", "\\n");
        String noLinks = normalized
                .replaceAll("https?://\\\\S+", "")
                .replaceAll("www\\\\.\\\\S+", "");

        String[] rawLines = noLinks.split("\\n");
        List<String> out = new ArrayList<>();

        for (String rawLine : rawLines) {
            String line = rawLine
                    .replaceAll("^\\\\s*#+\\\\s*", "")
                    .replaceAll("^\\\\s*>+\\\\s?", "")
                    .replaceAll("[*\\u0060~]", "")
                    .replaceAll("__+", "")
                    .replaceAll("[ \\\\t]+", " ")
                    .trim();

            if (!line.matches("^\\\\d+$") && !line.isEmpty()) {
                out.add(line);
            }
        }

        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < out.size(); i++) {
            sb.append(out.get(i));
            if (i < out.size() - 1) sb.append("\\n");
        }

        String result = sb.toString().replaceAll("\\\\n\\\\n\\\\n+", "\\n\\n");
        return result.trim();
    }

    /**
     * Splits paragraph into sentences: English (. ! ?), Urdu full stop (\\u06D4),
     * and Arabic question mark (\\u061F), including trailing quotes and brackets.
     * Lua: P.splitSentences(p)
     */
    public static List<String> splitSentences(String paragraph) {
        if (paragraph == null) return Collections.emptyList();
        String p = paragraph.trim();
        if (p.isEmpty()) return Collections.emptyList();

        List<String> out = new ArrayList<>();
        int len = p.length();
        int startI = 0;
        int i = 0;

        while (i < len) {
            char ch = p.charAt(i);
            int endLen = 0;

            if (ch == '.' || ch == '!' || ch == '?' || ch == '\\u06D4' || ch == '\\u061F') {
                endLen = 1;
            }

            if (endLen > 0) {
                int j = i + endLen;
                while (j < len) {
                    char nextChar = p.charAt(j);
                    if (nextChar == '.' || nextChar == '!' || nextChar == '?' ||
                        nextChar == '\"' || nextChar == '\\'' || nextChar == ')' ||
                        nextChar == ']' || nextChar == '}' || nextChar == '»') {
                        j++;
                    } else {
                        break;
                    }
                }

                if (j >= len || Character.isWhitespace(p.charAt(j))) {
                    String piece = p.substring(startI, j).trim();
                    if (!piece.isEmpty()) {
                        out.add(piece);
                    }
                    startI = j;
                }
                i = j;
            } else {
                i++;
            }
        }

        if (startI < len) {
            String piece = p.substring(startI).trim();
            if (!piece.isEmpty()) {
                out.add(piece);
            }
        }

        return out.isEmpty() ? Collections.singletonList(p) : out;
    }

    /**
     * Splits a sentence into word chunks respecting unicode effective length limit.
     * Lua: P.splitWords(s, eff)
     */
    public static List<String> splitWords(String s, int effectiveMax) {
        List<String> out = new ArrayList<>();
        String cur = "";
        String[] words = s.split("\\\\s+");

        for (String w : words) {
            if (w.isEmpty()) continue;
            int wl = ulen(w);
            if (wl > effectiveMax) {
                if (!cur.isEmpty()) {
                    out.add(cur);
                    cur = "";
                }
                String rest = w;
                while (ulen(rest) > effectiveMax) {
                    String prefix = takeChars(rest, effectiveMax);
                    out.add(prefix);
                    rest = rest.substring(prefix.length());
                }
                cur = rest;
            } else if (!cur.isEmpty() && ulen(cur) + 1 + wl <= effectiveMax) {
                cur = cur + " " + w;
            } else {
                if (!cur.isEmpty()) {
                    out.add(cur);
                }
                cur = w;
            }
        }

        if (!cur.isEmpty()) {
            out.add(cur);
        }
        return out;
    }

    /**
     * Splits oversized paragraph. Handles dialogue prefixes when carry=true.
     * Lua: P.splitLong(p, maxChars, carry)
     */
    public static List<String> splitLong(String p, int maxChars, boolean carry) {
        String prefix = null;
        int effectiveMax = maxChars;

        if (carry) {
            Pattern pattern = Pattern.compile("^([^:\\\\n]+):\\\\s");
            Matcher matcher = pattern.matcher(p);
            if (matcher.find()) {
                String foundPrefix = matcher.group(1);
                if (foundPrefix != null && ulen(foundPrefix) <= 40) {
                    prefix = foundPrefix;
                    effectiveMax = maxChars - (ulen(prefix) + 2);
                    if (effectiveMax < 50) effectiveMax = 50;
                }
            }
        }

        List<String> sentences = splitSentences(p);
        List<String> pieces = new ArrayList<>();
        String cur = "";

        for (String s : sentences) {
            int sl = ulen(s);
            if (sl > effectiveMax) {
                if (!cur.isEmpty()) {
                    pieces.add(cur);
                    cur = "";
                }
                List<String> words = splitWords(s, effectiveMax);
                for (int k = 0; k < words.size() - 1; k++) {
                    pieces.add(words.get(k));
                }
                cur = !words.isEmpty() ? words.get(words.size() - 1) : "";
            } else if (!cur.isEmpty() && ulen(cur) + 1 + sl <= effectiveMax) {
                cur = cur + " " + s;
            } else {
                if (!cur.isEmpty()) {
                    pieces.add(cur);
                }
                cur = s;
            }
        }

        if (!cur.isEmpty()) {
            pieces.add(cur);
        }

        if (prefix != null && pieces.size() > 1) {
            for (int idx = 1; idx < pieces.size(); idx++) {
                pieces.set(idx, prefix + ": " + pieces.get(idx));
            }
        }

        return pieces;
    }

    /**
     * Main chunk splitter.
     * Lua: P.splitChunks(text, maxChars, carry)
     */
    public static List<String> splitChunks(String rawText, int maxCharsParam, boolean carry) {
        String text = rawText.replace("\\r\\n", "\\n").replace("\\r", "\\n");
        int maxChars = Math.max(50, maxCharsParam);
        List<String> chunks = new ArrayList<>();
        StringBuilder cur = new StringBuilder();

        Runnable flush = () -> {
            String c = trim(cur.toString());
            if (!c.isEmpty() && hasContent(c)) {
                chunks.add(c);
            }
            cur.setLength(0);
        };

        String[] paragraphs = text.split("\\n");
        for (String para : paragraphs) {
            String p = trim(para);
            if (!p.isEmpty()) {
                int pl = ulen(p);
                if (pl > maxChars) {
                    flush.run();
                    List<String> pieces = splitLong(p, maxChars, carry);
                    for (int k = 0; k < pieces.size() - 1; k++) {
                        chunks.add(pieces.get(k));
                    }
                    if (!pieces.isEmpty()) {
                        cur.append(pieces.get(pieces.size() - 1));
                    }
                } else if (cur.length() > 0 && ulen(cur.toString()) + 1 + pl <= maxChars) {
                    cur.append("\\n").append(p);
                } else {
                    flush.run();
                    cur.append(p);
                }
            }
        }

        flush.run();
        return chunks;
    }
}
`
  },
  {
    name: "WavAudioUtil.java",
    path: "app/src/main/java/com/gemini/tts/core/WavAudioUtil.java",
    package: "com.gemini.tts.core",
    language: "java",
    description: "Constructs standard 44-byte RIFF/WAVE PCM headers in Little-Endian byte order, parses sample rates, injects silence bytes, and writes chunks safely.",
    luaMapping: "P.le32, P.wavHeader, P.parseRate, P.shouldStripWav, writeHeader, createEmptyWav, silenceBytes",
    code: `package com.gemini.tts.core;

import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * WavAudioUtil manages 16-bit linear PCM RIFF WAVE header generation and file streaming in Java.
 */
public final class WavAudioUtil {

    public static final int DEFAULT_SAMPLE_RATE = 24000;
    public static final int DEFAULT_CHANNELS = 1;
    public static final int BITS_PER_SAMPLE = 16;
    public static final int WAV_HEADER_SIZE = 44;

    private WavAudioUtil() {}

    /**
     * Constructs a 44-byte Little-Endian RIFF WAVE header.
     * Lua: P.wavHeader(dataLen, rate, channels)
     */
    public static byte[] buildWavHeader(long dataLen, int sampleRate, int channels) {
        int byteRate = sampleRate * channels * (BITS_PER_SAMPLE / 8);
        int blockAlign = channels * (BITS_PER_SAMPLE / 8);

        ByteBuffer buffer = ByteBuffer.allocate(WAV_HEADER_SIZE).order(ByteOrder.LITTLE_ENDIAN);

        // RIFF chunk
        buffer.put("RIFF".getBytes(StandardCharsets.US_ASCII));
        buffer.putInt((int) (dataLen + 36)); // File length minus 8
        buffer.put("WAVE".getBytes(StandardCharsets.US_ASCII));

        // fmt subchunk
        buffer.put("fmt ".getBytes(StandardCharsets.US_ASCII));
        buffer.putInt(16); // PCM header size
        buffer.putShort((short) 1); // Audio format 1 = linear PCM
        buffer.putShort((short) channels);
        buffer.putInt(sampleRate);
        buffer.putInt(byteRate);
        buffer.putShort((short) blockAlign);
        buffer.putShort((short) BITS_PER_SAMPLE);

        // data subchunk
        buffer.put("data".getBytes(StandardCharsets.US_ASCII));
        buffer.putInt((int) dataLen);

        return buffer.array();
    }

    /**
     * Extracts sample rate integer from MIME string (e.g. "audio/pcm;rate=24000").
     * Lua: P.parseRate(mime)
     */
    public static int parseRate(String mime) {
        if (mime == null) return DEFAULT_SAMPLE_RATE;
        Pattern pattern = Pattern.compile("rate=(\\\\d+)");
        Matcher matcher = pattern.matcher(mime);
        if (matcher.find()) {
            try {
                int rate = Integer.parseInt(matcher.group(1));
                if (rate >= 8000 && rate <= 48000) {
                    return rate;
                }
            } catch (NumberFormatException ignored) {}
        }
        return DEFAULT_SAMPLE_RATE;
    }

    /**
     * Determines whether Gemini audio response contains a 44-byte WAV header that must be skipped.
     * Lua: P.shouldStripWav(mime, model)
     */
    public static boolean shouldStripWav(String mime, boolean isNewSchema) {
        if (mime != null && mime.toLowerCase(Locale.US).contains("wav")) {
            return true;
        }
        return isNewSchema;
    }

    /**
     * Initializes an empty WAV file with a valid 44-byte header and 0 payload bytes.
     * Lua: createEmptyWav(path, rate)
     */
    public static void createEmptyWav(File file, int sampleRate, int channels) throws IOException {
        File parent = file.getParentFile();
        if (parent != null && !parent.exists()) {
            parent.mkdirs();
        }
        try (RandomAccessFile raf = new RandomAccessFile(file, "rw")) {
            raf.setLength(0);
            byte[] header = buildWavHeader(0, sampleRate, channels);
            raf.write(header);
        }
    }

    /**
     * Generates silent zero-filled PCM byte buffer for the specified duration in ms.
     * Lua: silenceBytes(rate, ms)
     */
    public static byte[] createSilenceBytes(int sampleRate, int durationMs, int channels) {
        long total = ((long) sampleRate * durationMs / 1000L) * channels * (BITS_PER_SAMPLE / 8);
        int even = (int) (total - (total % 2));
        if (even <= 0) return new byte[0];
        return new byte[even];
    }

    /**
     * Reads the sample rate from an existing WAV file header.
     * Lua: readWavRate(path)
     */
    public static int readWavRate(File file) {
        if (!file.exists() || file.length() < WAV_HEADER_SIZE) return DEFAULT_SAMPLE_RATE;
        try (RandomAccessFile raf = new RandomAccessFile(file, "r")) {
            raf.seek(24);
            byte[] b = new byte[4];
            raf.readFully(b);
            int rate = ByteBuffer.wrap(b).order(ByteOrder.LITTLE_ENDIAN).getInt();
            if (rate >= 8000 && rate <= 48000) return rate;
        } catch (Exception ignored) {}
        return DEFAULT_SAMPLE_RATE;
    }

    /**
     * Appends PCM bytes to an ongoing WAV file and updates the 44-byte header.
     */
    public static synchronized long appendPcmData(
            File wavFile,
            long currentDataBytes,
            byte[] pcmBytes,
            int offset,
            int length,
            int sampleRate,
            int channels,
            byte[] silenceBytes
    ) throws IOException {
        File parent = wavFile.getParentFile();
        if (parent != null && !parent.exists()) {
            parent.mkdirs();
        }

        long newBytes = currentDataBytes;
        try (RandomAccessFile raf = new RandomAccessFile(wavFile, "rw")) {
            raf.seek(WAV_HEADER_SIZE + currentDataBytes);

            if (silenceBytes != null && silenceBytes.length > 0 && currentDataBytes > 0) {
                raf.write(silenceBytes);
                newBytes += silenceBytes.length;
            }

            raf.write(pcmBytes, offset, length);
            newBytes += length;

            // Seek to 0 and rewrite updated 44-byte header
            byte[] updatedHeader = buildWavHeader(newBytes, sampleRate, channels);
            raf.seek(0);
            raf.write(updatedHeader);
        }
        return newBytes;
    }
}
`
  },
  {
    name: "KeyRotationManager.java",
    path: "app/src/main/java/com/gemini/tts/core/KeyRotationManager.java",
    package: "com.gemini.tts.core",
    language: "java",
    description: "Thread-safe multi-key management with round-robin rotation, automatic cooldown for 429 rate limits, and quota exhaustion filtering.",
    luaMapping: "P.parseKeys, P.keyTail, P.classifyResponse, P.pickKey",
    code: `package com.gemini.tts.core;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * KeyRotationManager manages a pool of Gemini API keys,
 * handling automatic failover when 429 rate-limiting occurs.
 */
public class KeyRotationManager {

    public static class KeyEntry {
        public final String key;
        public long coolUntilEpochSec;
        public boolean isDead;

        public KeyEntry(String key) {
            this.key = key;
            this.coolUntilEpochSec = 0;
            this.isDead = false;
        }

        public String getTail() {
            if (key != null && key.length() >= 4) {
                return key.substring(key.length() - 4);
            }
            return key != null ? key : "";
        }
    }

    public enum ResponseKind {
        OK,
        NETWORK,
        RATE_MINUTE,
        RATE_DAY,
        BAD_KEY,
        BAD_MODEL,
        BAD_REQUEST,
        SERVER,
        OTHER
    }

    public static class ClassificationResult {
        public final ResponseKind kind;
        public final long waitSeconds;
        public final String message;

        public ClassificationResult(ResponseKind kind, long waitSeconds, String message) {
            this.kind = kind;
            this.waitSeconds = waitSeconds;
            this.message = message;
        }
    }

    private final List<KeyEntry> keys;
    private int currentIndex = 0;

    public KeyRotationManager(String rawKeys) {
        this.keys = parseKeys(rawKeys);
    }

    public synchronized int getTotalKeys() {
        return keys.size();
    }

    /**
     * Parses and deduplicates keys with length >= 15.
     * Lua: P.parseKeys(raw)
     */
    public static List<KeyEntry> parseKeys(String raw) {
        List<KeyEntry> result = new ArrayList<>();
        if (raw == null || raw.trim().isEmpty()) return result;

        Set<String> seen = new HashSet<>();
        String[] tokens = raw.split("[\\\\s,;]+");

        for (String token : tokens) {
            String clean = token.trim();
            if (clean.length() >= 15 && seen.add(clean)) {
                result.add(new KeyEntry(clean));
            }
        }
        return result;
    }

    /**
     * Classifies HTTP status code and response body.
     * Lua: P.classifyResponse(code, body)
     */
    public static ClassificationResult classifyResponse(int code, String body) {
        String responseBody = body != null ? body : "";
        String parsedMsg = null;

        try {
            if (!responseBody.isEmpty()) {
                JSONObject json = new JSONObject(responseBody);
                if (json.has("error")) {
                    JSONObject errorObj = json.getJSONObject("error");
                    parsedMsg = errorObj.optString("message", null);
                } else if (json.has("message")) {
                    parsedMsg = json.optString("message", null);
                }
            }
        } catch (Exception ignored) {}

        if (parsedMsg == null) {
            Matcher m = Pattern.compile("\"message\"\\\\s*:\\\\s*\"([^\"]+)\"").matcher(responseBody);
            if (m.find()) {
                parsedMsg = m.group(1);
            }
        }

        if (code == 200) {
            return new ClassificationResult(ResponseKind.OK, 0, null);
        }
        if (code <= 0) {
            return new ClassificationResult(ResponseKind.NETWORK, 0, responseBody);
        }

        if (code == 429) {
            String lower = responseBody.toLowerCase(Locale.US);
            boolean isDaily = lower.contains("perday") || lower.contains("per day");

            Matcher waitMatcher = Pattern.compile("retryDelay\"\\\\s*:\\\\s*\"(\\\\d+)").matcher(responseBody);
            long wait = 40;
            if (waitMatcher.find()) {
                try {
                    wait = Long.parseLong(waitMatcher.group(1)) + 2;
                } catch (NumberFormatException ignored) {}
            }

            return new ClassificationResult(isDaily ? ResponseKind.RATE_DAY : ResponseKind.RATE_MINUTE, wait, parsedMsg);
        }

        if (code == 401 || code == 403) {
            return new ClassificationResult(ResponseKind.BAD_KEY, 0, parsedMsg);
        }

        if (code == 400) {
            if (responseBody.contains("API_KEY_INVALID") ||
                responseBody.contains("API key not valid") ||
                responseBody.contains("API key expired")) {
                return new ClassificationResult(ResponseKind.BAD_KEY, 0, parsedMsg);
            }
            return new ClassificationResult(ResponseKind.BAD_REQUEST, 0, parsedMsg);
        }

        if (code == 404) {
            return new ClassificationResult(ResponseKind.BAD_MODEL, 0, parsedMsg);
        }

        if (code >= 500) {
            return new ClassificationResult(ResponseKind.SERVER, 0, parsedMsg);
        }

        return new ClassificationResult(ResponseKind.OTHER, 0, parsedMsg);
    }

    public static class PickResult {
        public final KeyEntry key;
        public final int index;
        public final long waitSeconds;

        public PickResult(KeyEntry key, int index, long waitSeconds) {
            this.key = key;
            this.index = index;
            this.waitSeconds = waitSeconds;
        }
    }

    /**
     * Chooses the next available key respecting cooldown timestamps.
     * Lua: P.pickKey(keys, start, now)
     */
    public synchronized PickResult pickKey(long nowEpochSec) {
        if (keys.isEmpty()) return null;

        Long minCool = null;
        int n = keys.size();

        for (int off = 0; off < n; off++) {
            int i = (currentIndex + off) % n;
            KeyEntry candidate = keys.get(i);

            if (!candidate.isDead) {
                if (candidate.coolUntilEpochSec <= nowEpochSec) {
                    currentIndex = i;
                    return new PickResult(candidate, i, 0);
                }
                long remaining = candidate.coolUntilEpochSec - nowEpochSec;
                if (minCool == null || remaining < minCool) {
                    minCool = remaining;
                }
            }
        }

        if (minCool != null && minCool > 0) {
            return new PickResult(keys.get(currentIndex), currentIndex, minCool);
        }

        return null;
    }

    public synchronized void markCooldown(int index, long waitSeconds, long nowEpochSec) {
        if (index >= 0 && index < keys.size()) {
            keys.get(index).coolUntilEpochSec = nowEpochSec + waitSeconds;
            advance();
        }
    }

    public synchronized void markDead(int index) {
        if (index >= 0 && index < keys.size()) {
            keys.get(index).isDead = true;
            advance();
        }
    }

    private void advance() {
        if (!keys.isEmpty()) {
            currentIndex = (currentIndex + 1) % keys.size();
        }
    }
}
`
  },
  {
    name: "GeminiRequestHelper.java",
    path: "app/src/main/java/com/gemini/tts/core/GeminiRequestHelper.java",
    package: "com.gemini.tts.core",
    language: "java",
    description: "Builds standard Gemini generateContent request JSON and extracts base64 audio byte arrays for Gemini 3.8+ audio and Gemini 2.5 schemas in Java.",
    luaMapping: "P.isNewSchema, P.voiceName, P.langEnglish, P.matchSpeaker, P.buildRequest, P.extractAudio",
    code: `package com.gemini.tts.core;

import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * GeminiRequestHelper constructs Google Generative Language API request bodies
 * and extracts inline PCM audio buffers.
 */
public final class GeminiRequestHelper {

    private GeminiRequestHelper() {}

    public static class ExtractedAudio {
        public final byte[] pcmBytes;
        public final String mimeType;
        public final int sampleRate;

        public ExtractedAudio(byte[] pcmBytes, String mimeType, int sampleRate) {
            this.pcmBytes = pcmBytes;
            this.mimeType = mimeType;
            this.sampleRate = sampleRate;
        }
    }

    public static boolean isNewSchema(String model) {
        if (model == null) return false;
        Matcher m = Pattern.compile("gemini-(\\\\d+)\\\\.(\\\\d+)").matcher(model);
        if (!m.find()) return false;
        try {
            int major = Integer.parseInt(m.group(1));
            int minor = Integer.parseInt(m.group(2));
            return major > 3 || (major == 3 && minor >= 8);
        } catch (NumberFormatException ignored) {
            return false;
        }
    }

    public static String voiceName(String label) {
        if (label == null || label.trim().isEmpty()) return "Kore";
        String[] tokens = label.trim().split("\\\\s+");
        return tokens.length > 0 ? tokens[0] : "Kore";
    }

    public static String langEnglish(String label) {
        if (label == null || label.isEmpty() || "Auto Detect".equals(label)) return null;
        Matcher m = Pattern.compile("^(.*?)\\\\s*\\\\(").matcher(label);
        return m.find() ? m.group(1).trim() : label;
    }

    /**
     * Builds request JSON for Gemini API.
     * Lua: P.buildRequest(cfg, text)
     */
    public static String buildRequestBody(
            String model,
            String voice,
            String language,
            String style,
            boolean multi,
            String sp1Name,
            String sp1Voice,
            String sp2Name,
            String sp2Voice,
            String text
    ) throws JSONException {
        boolean newSchema = isNewSchema(model);
        String trimmedStyle = style != null ? style.trim() : "";

        JSONObject root = new JSONObject();
        JSONObject generationConfig = new JSONObject();

        JSONArray modalities = new JSONArray();
        modalities.put("AUDIO");
        generationConfig.put("responseModalities", modalities);

        JSONObject multiVoiceConfig = null;
        if (multi) {
            JSONArray speakerConfigs = new JSONArray();

            JSONObject sp1 = new JSONObject();
            sp1.put("speaker", sp1Name);
            JSONObject sp1Vc = new JSONObject();
            JSONObject sp1Pvc = new JSONObject();
            sp1Pvc.put("voiceName", sp1Voice);
            sp1Vc.put("prebuiltVoiceConfig", sp1Pvc);
            sp1.put("voiceConfig", sp1Vc);
            speakerConfigs.put(sp1);

            JSONObject sp2 = new JSONObject();
            sp2.put("speaker", sp2Name);
            JSONObject sp2Vc = new JSONObject();
            JSONObject sp2Pvc = new JSONObject();
            sp2Pvc.put("voiceName", sp2Voice);
            sp2Vc.put("prebuiltVoiceConfig", sp2Pvc);
            sp2.put("voiceConfig", sp2Vc);
            speakerConfigs.put(sp2);

            JSONObject multiSpk = new JSONObject();
            multiSpk.put("speakerVoiceConfigs", speakerConfigs);
            multiVoiceConfig = new JSONObject();
            multiVoiceConfig.put("multiSpeakerVoiceConfig", multiSpk);
        }

        JSONArray contents = new JSONArray();

        if (newSchema) {
            if (multi) {
                JSONArray parts = new JSONArray();
                String currentSpeaker = sp1Name;
                String[] lines = text.split("\\n");

                String sp1Tag = (sp1Name != null ? sp1Name.toLowerCase(Locale.US) : "joe") + ":";
                String sp2Tag = (sp2Name != null ? sp2Name.toLowerCase(Locale.US) : "jane") + ":";

                for (String rawLine : lines) {
                    String line = rawLine.trim();
                    if (!line.isEmpty()) {
                        String lower = line.toLowerCase(Locale.US);
                        if (lower.startsWith(sp1Tag)) {
                            currentSpeaker = sp1Name;
                            line = line.substring(sp1Tag.length()).trim();
                        } else if (lower.startsWith(sp2Tag)) {
                            currentSpeaker = sp2Name;
                            line = line.substring(sp2Tag.length()).trim();
                        }

                        if (!line.isEmpty()) {
                            JSONObject part = new JSONObject();
                            part.put("text", line);
                            JSONObject meta = new JSONObject();
                            meta.put("speaker", currentSpeaker);
                            if (!trimmedStyle.isEmpty()) {
                                meta.put("style", trimmedStyle);
                            }
                            part.put("speech_metadata", meta);
                            parts.put(part);
                        }
                    }
                }

                if (parts.length() == 0) {
                    JSONObject fallbackPart = new JSONObject();
                    fallbackPart.put("text", text);
                    JSONObject meta = new JSONObject();
                    meta.put("speaker", sp1Name);
                    fallbackPart.put("speech_metadata", meta);
                    parts.put(fallbackPart);
                }

                JSONObject contentObj = new JSONObject();
                contentObj.put("role", "user");
                contentObj.put("parts", parts);
                contents.put(contentObj);

                generationConfig.put("speechConfig", multiVoiceConfig.getJSONObject("multiSpeakerVoiceConfig"));
            } else {
                JSONObject part = new JSONObject();
                part.put("text", text);
                if (!trimmedStyle.isEmpty()) {
                    JSONObject meta = new JSONObject();
                    meta.put("style", trimmedStyle);
                    part.put("speech_metadata", meta);
                }

                JSONArray parts = new JSONArray();
                parts.put(part);

                JSONObject contentObj = new JSONObject();
                contentObj.put("role", "user");
                contentObj.put("parts", parts);
                contents.put(contentObj);

                JSONObject speechConfig = new JSONObject();
                JSONObject voiceConfig = new JSONObject();
                voiceConfig.put("voice", voice);
                speechConfig.put("voiceConfig", voiceConfig);
                generationConfig.put("speechConfig", speechConfig);
            }
        } else {
            List<String> hints = new ArrayList<>();
            String langHint = langEnglish(language);
            if (langHint != null) hints.add("in " + langHint);
            if (!trimmedStyle.isEmpty()) hints.add(trimmedStyle);

            String promptText;
            if (multi) {
                String extra = !hints.isEmpty() ? " " + String.join(", ", hints) : "";
                promptText = "TTS the following conversation between " + sp1Name + " and " + sp2Name + extra + ":\\n" + text;
            } else {
                if (!hints.isEmpty()) {
                    promptText = "Say " + String.join(", ", hints) + ":\\n" + text;
                } else {
                    promptText = text;
                }
            }

            JSONObject part = new JSONObject();
            part.put("text", promptText);
            JSONArray parts = new JSONArray();
            parts.put(part);

            JSONObject contentObj = new JSONObject();
            contentObj.put("parts", parts);
            contents.put(contentObj);

            if (multi) {
                generationConfig.put("speechConfig", multiVoiceConfig.getJSONObject("multiSpeakerVoiceConfig"));
            } else {
                JSONObject speechConfig = new JSONObject();
                JSONObject voiceConfig = new JSONObject();
                JSONObject prebuilt = new JSONObject();
                prebuilt.put("voiceName", voice);
                voiceConfig.put("prebuiltVoiceConfig", prebuilt);
                speechConfig.put("voiceConfig", voiceConfig);
                generationConfig.put("speechConfig", speechConfig);
            }
        }

        root.put("contents", contents);
        root.put("generationConfig", generationConfig);
        return root.toString();
    }

    /**
     * Extracts base64 audio and decodes to raw PCM byte array.
     * Lua: P.extractAudio(r)
     */
    public static ExtractedAudio extractAudio(String jsonString, boolean isNewSchema) throws JSONException {
        JSONObject root = new JSONObject(jsonString);

        JSONArray candidates = root.optJSONArray("candidates");
        if (candidates == null || candidates.length() == 0) {
            JSONObject promptFeedback = root.optJSONObject("promptFeedback");
            String blockReason = promptFeedback != null ? promptFeedback.optString("blockReason", null) : null;
            throw new IllegalStateException(blockReason != null ? "Content blocked: " + blockReason : "No candidate returned");
        }

        JSONObject firstCandidate = candidates.getJSONObject(0);
        JSONObject content = firstCandidate.optJSONObject("content");
        JSONArray parts = content != null ? content.optJSONArray("parts") : null;

        if (parts != null) {
            for (int idx = 0; idx < parts.length(); idx++) {
                JSONObject part = parts.getJSONObject(idx);
                JSONObject inlineData = part.optJSONObject("inlineData");
                if (inlineData != null) {
                    String base64Data = inlineData.optString("data", "");
                    String mimeType = inlineData.optString("mimeType", "audio/pcm;rate=24000");

                    if (!base64Data.isEmpty()) {
                        byte[] decodedBytes = Base64.decode(base64Data, Base64.DEFAULT);
                        int sampleRate = WavAudioUtil.parseRate(mimeType);
                        boolean shouldStrip = WavAudioUtil.shouldStripWav(mimeType, isNewSchema);
                        int skip = (shouldStrip && decodedBytes.length >= 44) ? 44 : 0;

                        int pcmLen = decodedBytes.length - skip;
                        pcmLen -= (pcmLen % 2);

                        if (pcmLen < 2) {
                            throw new IllegalStateException("Empty audio payload received");
                        }

                        byte[] pcmBytes = new byte[pcmLen];
                        System.arraycopy(decodedBytes, skip, pcmBytes, 0, pcmLen);

                        return new ExtractedAudio(pcmBytes, mimeType, sampleRate);
                    }
                }
            }
        }

        String finishReason = firstCandidate.optString("finishReason", "unknown");
        throw new IllegalStateException("No audio found in response (finishReason: " + finishReason + ")");
    }
}
`
  },
  {
    name: "MediaCodecAudioConverter.java",
    path: "app/src/main/java/com/gemini/tts/audio/MediaCodecAudioConverter.java",
    package: "com.gemini.tts.audio",
    language: "java",
    description: "Hardware accelerated MediaCodec AAC-LC encoder and MediaMuxer container writer in Java with percentage progress callback.",
    luaMapping: "encodeM4A, saveAudioTo",
    code: `package com.gemini.tts.audio;

import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import com.gemini.tts.core.WavAudioUtil;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.ByteBuffer;

/**
 * MediaCodecAudioConverter encodes raw PCM WAV files into AAC-compressed M4A containers in pure Java.
 */
public final class MediaCodecAudioConverter {

    private static final String MIME_TYPE = "audio/mp4a-latm";
    private static final int BIT_RATE = 64000; // 64 kbps
    private static final long BUFFER_TIMEOUT_US = 10000L;

    public interface ProgressCallback {
        void onProgress(int percent);
    }

    private MediaCodecAudioConverter() {}

    /**
     * Converts source WAV to M4A synchronously (designed to run on background thread).
     */
    public static void convertWavToM4a(File srcWav, File destM4a, ProgressCallback callback) throws IOException {
        if (!srcWav.exists()) {
            throw new IOException("Source WAV not found: " + srcWav.getAbsolutePath());
        }

        File parent = destM4a.getParentFile();
        if (parent != null && !parent.exists()) {
            parent.mkdirs();
        }

        MediaCodec codec = null;
        MediaMuxer muxer = null;
        FileInputStream fis = null;
        boolean muxerStarted = false;

        try {
            int sampleRate = WavAudioUtil.readWavRate(srcWav);
            int channels = 1;
            long totalPcmBytes = Math.max(1L, srcWav.length() - WavAudioUtil.WAV_HEADER_SIZE);

            fis = new FileInputStream(srcWav);
            fis.skip(WavAudioUtil.WAV_HEADER_SIZE); // Skip 44-byte WAV header

            MediaFormat format = MediaFormat.createAudioFormat(MIME_TYPE, sampleRate, channels);
            format.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC);
            format.setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE);
            format.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16384);

            codec = MediaCodec.createEncoderByType(MIME_TYPE);
            codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
            codec.start();

            muxer = new MediaMuxer(destM4a.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);

            MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();
            byte[] readBuf = new byte[8192];
            long bytesReadTotal = 0L;
            boolean inputDone = false;
            boolean outputDone = false;
            int trackIndex = -1;
            int lastReportedPercent = -1;

            while (!outputDone) {
                // Feed input PCM buffer
                if (!inputDone) {
                    int inputBufIndex = codec.dequeueInputBuffer(BUFFER_TIMEOUT_US);
                    if (inputBufIndex >= 0) {
                        ByteBuffer inputBuffer = codec.getInputBuffer(inputBufIndex);
                        if (inputBuffer != null) {
                            inputBuffer.clear();
                            int capacity = Math.min(inputBuffer.capacity(), 8192);
                            int alignedCapacity = capacity - (capacity % 2);
                            int bytesRead = fis.read(readBuf, 0, alignedCapacity);

                            long presentationTimeUs = (bytesReadTotal / (channels * 2) * 1_000_000L) / sampleRate;

                            if (bytesRead <= 0) {
                                codec.queueInputBuffer(inputBufIndex, 0, 0, presentationTimeUs, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                                inputDone = true;
                            } else {
                                inputBuffer.put(readBuf, 0, bytesRead);
                                codec.queueInputBuffer(inputBufIndex, 0, bytesRead, presentationTimeUs, 0);
                                bytesReadTotal += bytesRead;

                                int percent = (int) (bytesReadTotal * 100 / totalPcmBytes);
                                if (percent != lastReportedPercent && percent % 5 == 0) {
                                    lastReportedPercent = percent;
                                    if (callback != null) {
                                        callback.onProgress(Math.min(100, Math.max(0, percent)));
                                    }
                                }
                            }
                        }
                    }
                }

                // Retrieve output AAC packet
                int outputBufIndex = codec.dequeueOutputBuffer(bufferInfo, BUFFER_TIMEOUT_US);
                if (outputBufIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    if (muxerStarted) {
                        throw new RuntimeException("Format changed after muxer started");
                    }
                    trackIndex = muxer.addTrack(codec.getOutputFormat());
                    muxer.start();
                    muxerStarted = true;
                } else if (outputBufIndex >= 0) {
                    ByteBuffer outputBuffer = codec.getOutputBuffer(outputBufIndex);
                    if (outputBuffer != null) {
                        if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) {
                            bufferInfo.size = 0;
                        }

                        if (bufferInfo.size > 0 && muxerStarted) {
                            outputBuffer.position(bufferInfo.offset);
                            outputBuffer.limit(bufferInfo.offset + bufferInfo.size);
                            muxer.writeSampleData(trackIndex, outputBuffer, bufferInfo);
                        }

                        codec.releaseOutputBuffer(outputBufIndex, false);

                        if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                            outputDone = true;
                        }
                    }
                }
            }

            if (callback != null) callback.onProgress(100);

        } catch (Exception e) {
            destM4a.delete();
            throw new IOException("M4A encode failed: " + e.getMessage(), e);
        } finally {
            if (fis != null) {
                try { fis.close(); } catch (Exception ignored) {}
            }
            if (codec != null) {
                try {
                    codec.stop();
                    codec.release();
                } catch (Exception ignored) {}
            }
            if (muxer != null) {
                try {
                    if (muxerStarted) muxer.stop();
                    muxer.release();
                } catch (Exception ignored) {}
            }
        }
    }
}
`
  }
];
