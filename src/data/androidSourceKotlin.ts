/**
 * Complete, production-ready Kotlin source code files for Android Studio.
 * Clean architecture, full coroutine/concurrency support, strict null-safety,
 * OkHttp3 network client, Android MediaCodec M4A/AAC encoder, and TalkBack accessibility.
 */

export interface SourceFile {
  name: string;
  path: string;
  package: string;
  language: 'kotlin' | 'java' | 'xml' | 'groovy' | 'json' | 'yaml';
  description: string;
  luaMapping: string;
  code: string;
}

export const KOTLIN_SOURCE_FILES: SourceFile[] = [
  {
    name: "TextProcessor.kt",
    path: "app/src/main/kotlin/com/gemini/tts/core/TextProcessor.kt",
    package: "com.gemini.tts.core",
    language: "kotlin",
    description: "Pure text parsing, UTF-8 unicode character counting, Urdu/Arabic sentence boundary splitting, and hierarchical paragraph/sentence/word chunking.",
    luaMapping: "P.trim, P.ulen, P.byteIndexAfterChars, P.hasContent, P.commas, P.fmtDuration, P.cleanText, P.splitSentences, P.splitWords, P.splitLong, P.splitChunks",
    code: `package com.gemini.tts.core

import java.text.NumberFormat
import java.util.Locale
import java.util.regex.Pattern

/**
 * TextProcessor handles all string manipulations, text cleansing,
 * UTF-8 unicode character measurements, Urdu/Arabic sentence splitting,
 * and chunk construction without depending on Android UI components.
 */
object TextProcessor {

    /**
     * Trims leading and trailing whitespace.
     */
    fun trim(s: String?): String {
        return s?.trim() ?: ""
    }

    /**
     * Returns true if string contains alphanumeric or letters/numbers in any language.
     * Lua: s:find("[%w\\128-\\255]") ~= nil
     */
    fun hasContent(s: String?): Boolean {
        if (s.isNullOrEmpty()) return false
        return s.any { Character.isLetterOrDigit(it) }
    }

    /**
     * Unicode-aware character count (code points count).
     * Lua: P.ulen(s) using UTF-8 byte classification.
     */
    fun ulen(s: String?): Int {
        if (s.isNullOrEmpty()) return 0
        return s.codePointCount(0, s.length)
    }

    /**
     * Returns the substring holding exactly [count] unicode characters.
     * Lua: P.byteIndexAfterChars(s, n)
     */
    fun takeChars(s: String, count: Int): String {
        var charCount = 0
        var i = 0
        while (i < s.length && charCount < count) {
            val cp = s.codePointAt(i)
            i += Character.charCount(cp)
            charCount++
        }
        return s.substring(0, i)
    }

    /**
     * Splits string at unicode character index [count], returning (prefix, remainder).
     */
    fun splitAtChars(s: String, count: Int): Pair<String, String> {
        var charCount = 0
        var i = 0
        while (i < s.length && charCount < count) {
            val cp = s.codePointAt(i)
            i += Character.charCount(cp)
            charCount++
        }
        return Pair(s.substring(0, i), s.substring(i))
    }

    /**
     * Formats integer with thousand commas.
     * Lua: P.commas(n)
     */
    fun commas(n: Long): String {
        return NumberFormat.getIntegerInstance(Locale.US).format(n)
    }

    /**
     * Formats seconds into human-readable duration string.
     * Lua: P.fmtDuration(sec)
     */
    fun fmtDuration(seconds: Double): String {
        val totalSec = Math.round(seconds).toInt()
        val h = totalSec / 3600
        val m = (totalSec % 3600) / 60
        val s = totalSec % 60

        return when {
            h > 0 -> "$h hours $m minutes"
            m > 0 -> "$m minutes $s seconds"
            else -> "$s seconds"
        }
    }

    /**
     * Cleans text by stripping markdown headings, blockquotes, bold/italic,
     * URLs, extra blank lines, and lone page numbers.
     * Lua: P.cleanText(s)
     */
    fun cleanText(input: String?): String {
        if (input.isNullOrEmpty()) return ""
        val normalized = input.replace("\\r\\n", "\\n").replace("\\r", "\\n")
        val noLinks = normalized
            .replace(Regex("https?://\\\\S+"), "")
            .replace(Regex("www\\\\.\\\\S+"), "")

        val lines = noLinks.split("\\n")
        val out = mutableListOf<String>()

        for (rawLine in lines) {
            var line = rawLine
                .replace(Regex("^\\\\s*#+\\\\s*"), "")
                .replace(Regex("^\\\\s*>+\\\\s?"), "")
                .replace(Regex("[*\\u0060~]"), "")
                .replace(Regex("__+"), "")
                .replace(Regex("[ \\\\t]+"), " ")
                .trim()

            // Skip lines that are only numbers (e.g. page numbers)
            if (!line.matches(Regex("^\\\\d+$")) && line.isNotEmpty()) {
                out.add(line)
            }
        }

        val result = out.joinToString("\\n")
            .replace(Regex("\\\\n\\\\n\\\\n+"), "\\n\\n")

        return result.trim()
    }

    /**
     * Splits paragraph into sentences supporting:
     * - English (. ! ?)
     * - Urdu full stop (\\u06D4 '۔')
     * - Arabic question mark (\\u061F '؟')
     * - Attached quotes/brackets: .\" ?) etc.
     * Lua: P.splitSentences(p)
     */
    fun splitSentences(paragraph: String): List<String> {
        val p = paragraph.trim()
        if (p.isEmpty()) return emptyList()

        val out = mutableListOf<String>()
        val len = p.length
        var startI = 0
        var i = 0

        while (i < len) {
            val ch = p[i]
            var endLen = 0

            // Check standard punctuation
            if (ch == '.' || ch == '!' || ch == '?') {
                endLen = 1
            } else if (ch == '\\u06D4' || ch == '\\u061F') {
                // Urdu full stop (۔) or Arabic question mark (؟)
                endLen = 1
            }

            if (endLen > 0) {
                var j = i + endLen
                // Consume trailing quotes or closing brackets
                while (j < len) {
                    val nextChar = p[j]
                    if (nextChar == '.' || nextChar == '!' || nextChar == '?' ||
                        nextChar == '\"' || nextChar == '\\'' || nextChar == ')' ||
                        nextChar == ']' || nextChar == '}' || nextChar == '»') {
                        j++
                    } else {
                        break
                    }
                }

                // If followed by whitespace or end of string, finish sentence
                if (j >= len || Character.isWhitespace(p[j])) {
                    val piece = p.substring(startI, j).trim()
                    if (piece.isNotEmpty()) {
                        out.add(piece)
                    }
                    startI = j
                }
                i = j
            } else {
                i++
            }
        }

        if (startI < len) {
            val piece = p.substring(startI).trim()
            if (piece.isNotEmpty()) {
                out.add(piece)
            }
        }

        return if (out.isEmpty()) listOf(p) else out
    }

    /**
     * Splits a sentence into word chunks respecting unicode effective length limit.
     * Lua: P.splitWords(s, eff)
     */
    fun splitWords(s: String, effectiveMax: Int): List<String> {
        val out = mutableListOf<String>()
        var cur = ""
        val words = s.split(Regex("\\\\s+")).filter { it.isNotEmpty() }

        for (w in words) {
            val wl = ulen(w)
            if (wl > effectiveMax) {
                if (cur.isNotEmpty()) {
                    out.add(cur)
                    cur = ""
                }
                var rest = w
                while (ulen(rest) > effectiveMax) {
                    val (prefix, remainder) = splitAtChars(rest, effectiveMax)
                    out.add(prefix)
                    rest = remainder
                }
                cur = rest
            } else if (cur.isNotEmpty() && ulen(cur) + 1 + wl <= effectiveMax) {
                cur = "$cur $w"
            } else {
                if (cur.isNotEmpty()) {
                    out.add(cur)
                }
                cur = w
            }
        }

        if (cur.isNotEmpty()) {
            out.add(cur)
        }
        return out
    }

    /**
     * Splits long paragraphs exceeding maxChars: sentences first, then words, then hard cut.
     * Preserves dialogue prefix (e.g. "Speaker: ") across subsequent sub-chunks when carry=true.
     * Lua: P.splitLong(p, maxChars, carry)
     */
    fun splitLong(p: String, maxChars: Int, carry: Boolean): List<String> {
        var prefix: String? = null
        var effectiveMax = maxChars

        if (carry) {
            val pattern = Pattern.compile("^([^:\\\\n]+):\\\\s")
            val matcher = pattern.matcher(p)
            if (matcher.find()) {
                val foundPrefix = matcher.group(1) ?: ""
                if (ulen(foundPrefix) <= 40) {
                    prefix = foundPrefix
                    effectiveMax = maxChars - (ulen(prefix) + 2)
                    if (effectiveMax < 50) effectiveMax = 50
                }
            }
        }

        val sentences = splitSentences(p)
        val pieces = mutableListOf<String>()
        var cur = ""

        for (s in sentences) {
            val sl = ulen(s)
            if (sl > effectiveMax) {
                if (cur.isNotEmpty()) {
                    pieces.add(cur)
                    cur = ""
                }
                val words = splitWords(s, effectiveMax)
                for (k in 0 until words.size - 1) {
                    pieces.add(words[k])
                }
                cur = words.lastOrNull() ?: ""
            } else if (cur.isNotEmpty() && ulen(cur) + 1 + sl <= effectiveMax) {
                cur = "$cur $s"
            } else {
                if (cur.isNotEmpty()) {
                    pieces.add(cur)
                }
                cur = s
            }
        }

        if (cur.isNotEmpty()) {
            pieces.add(cur)
        }

        if (prefix != null && pieces.size > 1) {
            for (idx in 1 until pieces.size) {
                pieces[idx] = "$prefix: \${pieces[idx]}"
            }
        }

        return pieces
    }

    /**
     * Main hierarchical chunker.
     * Splits text into paragraphs, breaks oversized paragraphs cleanly,
     * and accumulates up to [maxChars] characters without cutting mid-sentence.
     * Lua: P.splitChunks(text, maxChars, carry)
     */
    fun splitChunks(rawText: String, maxCharsParam: Int = 1800, carry: Boolean = false): List<String> {
        val text = rawText.replace("\\r\\n", "\\n").replace("\\r", "\\n")
        val maxChars = Math.max(50, maxCharsParam)
        val chunks = mutableListOf<String>()
        var cur = ""

        fun flush() {
            val c = trim(cur)
            if (c.isNotEmpty() && hasContent(c)) {
                chunks.add(c)
            }
            cur = ""
        }

        val paragraphs = text.split("\\n")
        for (para in paragraphs) {
            val p = trim(para)
            if (p.isNotEmpty()) {
                val pl = ulen(p)
                if (pl > maxChars) {
                    flush()
                    val pieces = splitLong(p, maxChars, carry)
                    for (k in 0 until pieces.size - 1) {
                        chunks.add(pieces[k])
                    }
                    cur = pieces.lastOrNull() ?: ""
                } else if (cur.isNotEmpty() && ulen(cur) + 1 + pl <= maxChars) {
                    cur = "$cur\\n$p"
                } else {
                    flush()
                    cur = p
                }
            }
        }

        flush()
        return chunks
    }
}
`
  },
  {
    name: "WavAudioUtil.kt",
    path: "app/src/main/kotlin/com/gemini/tts/core/WavAudioUtil.kt",
    package: "com.gemini.tts.core",
    language: "kotlin",
    description: "Constructs 44-byte standard RIFF/WAVE PCM headers with 32-bit Little-Endian fields, parses sample rates, injects silence bytes, and appends chunks directly.",
    luaMapping: "P.le32, P.wavHeader, P.parseRate, P.shouldStripWav, writeHeader, createEmptyWav, silenceBytes",
    code: `package com.gemini.tts.core

import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * WavAudioUtil manages 16-bit PCM RIFF/WAVE header creation,
 * audio sampling rate parsing, silence padding generation, and direct disk streaming.
 */
object WavAudioUtil {

    const val DEFAULT_SAMPLE_RATE = 24000
    const val DEFAULT_CHANNELS = 1
    const val BITS_PER_SAMPLE = 16
    const val WAV_HEADER_SIZE = 44

    /**
     * Converts a 32-bit unsigned int to 4 Little-Endian bytes.
     * Lua: P.le32(v)
     */
    fun le32(v: Long): ByteArray {
        val buf = ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN)
        buf.putInt(v.toInt())
        return buf.array()
    }

    /**
     * Converts a 16-bit unsigned int to 2 Little-Endian bytes.
     */
    fun le16(v: Int): ByteArray {
        val buf = ByteBuffer.allocate(2).order(ByteOrder.LITTLE_ENDIAN)
        buf.putShort(v.toShort())
        return buf.array()
    }

    /**
     * Constructs a standard 44-byte RIFF WAVE header for linear PCM audio.
     * Lua: P.wavHeader(dataLen, rate, channels)
     */
    fun buildWavHeader(dataLen: Long, sampleRate: Int = DEFAULT_SAMPLE_RATE, channels: Int = DEFAULT_CHANNELS): ByteArray {
        val byteRate = sampleRate * channels * (BITS_PER_SAMPLE / 8)
        val blockAlign = channels * (BITS_PER_SAMPLE / 8)
        val buffer = ByteBuffer.allocate(WAV_HEADER_SIZE).order(ByteOrder.LITTLE_ENDIAN)

        // RIFF header
        buffer.put("RIFF".toByteArray(Charsets.US_ASCII))
        buffer.putInt((dataLen + 36).toInt()) // File size - 8
        buffer.put("WAVE".toByteArray(Charsets.US_ASCII))

        // "fmt " chunk
        buffer.put("fmt ".toByteArray(Charsets.US_ASCII))
        buffer.putInt(16) // Subchunk1Size for PCM (16 bytes)
        buffer.putShort(1.toShort()) // AudioFormat 1 = PCM
        buffer.putShort(channels.toShort())
        buffer.putInt(sampleRate)
        buffer.putInt(byteRate)
        buffer.putShort(blockAlign.toShort())
        buffer.putShort(BITS_PER_SAMPLE.toShort())

        // "data" chunk
        buffer.put("data".toByteArray(Charsets.US_ASCII))
        buffer.putInt(dataLen.toInt())

        return buffer.array()
    }

    /**
     * Parses sample rate from API MIME type string (e.g. "audio/pcm;rate=24000").
     * Lua: P.parseRate(mime)
     */
    fun parseRate(mime: String?): Int {
        if (mime == null) return DEFAULT_SAMPLE_RATE
        val regex = Regex("rate=(\\\\d+)")
        val match = regex.find(mime)
        if (match != null) {
            val rate = match.groupValues[1].toIntOrNull()
            if (rate != null && rate in 8000..48000) {
                return rate
            }
        }
        return DEFAULT_SAMPLE_RATE
    }

    /**
     * Determines whether the received audio packet includes a 44-byte WAV header that must be stripped.
     * Lua: P.shouldStripWav(mime, model)
     */
    fun shouldStripWav(mime: String?, isNewSchema: Boolean): Boolean {
        if (mime != null && mime.contains("wav", ignoreCase = true)) {
            return true
        }
        return isNewSchema
    }

    /**
     * Creates an empty WAV file on disk with a valid 44-byte header and 0 data length.
     * Lua: createEmptyWav(path, rate)
     */
    fun createEmptyWav(file: File, sampleRate: Int = DEFAULT_SAMPLE_RATE, channels: Int = DEFAULT_CHANNELS) {
        file.parentFile?.let { if (!it.exists()) it.mkdirs() }
        RandomAccessFile(file, "rw").use { raf ->
            raf.setLength(0)
            val header = buildWavHeader(0, sampleRate, channels)
            raf.write(header)
        }
    }

    /**
     * Generates a byte array of silent PCM samples (all zeros) for the specified duration in ms.
     * Lua: silenceBytes(rate, ms)
     */
    fun createSilenceBytes(sampleRate: Int, durationMs: Int, channels: Int = DEFAULT_CHANNELS): ByteArray {
        val totalBytes = (sampleRate.toLong() * durationMs / 1000L * channels * (BITS_PER_SAMPLE / 8)).toInt()
        val evenBytes = totalBytes - (totalBytes % 2)
        if (evenBytes <= 0) return ByteArray(0)
        return ByteArray(evenBytes) // In Kotlin/Java, new ByteArray is initialized to zeros
    }

    /**
     * Reads the sample rate from an existing WAV file header (bytes 24-27).
     * Lua: readWavRate(path)
     */
    fun readWavRate(file: File): Int {
        if (!file.exists() || file.length() < WAV_HEADER_SIZE) return DEFAULT_SAMPLE_RATE
        return try {
            RandomAccessFile(file, "r").use { raf ->
                raf.seek(24)
                val b = ByteArray(4)
                raf.readFully(b)
                val rate = ByteBuffer.wrap(b).order(ByteOrder.LITTLE_ENDIAN).int
                if (rate in 8000..48000) rate else DEFAULT_SAMPLE_RATE
            }
        } catch (e: Exception) {
            DEFAULT_SAMPLE_RATE
        }
    }

    /**
     * Appends raw PCM bytes to an ongoing WAV file and updates the 44-byte header.
     */
    @Synchronized
    fun appendPcmData(
        wavFile: File,
        currentDataBytes: Long,
        pcmBytes: ByteArray,
        offset: Int,
        length: Int,
        sampleRate: Int,
        channels: Int = DEFAULT_CHANNELS,
        silenceBytes: ByteArray? = null
    ): Long {
        wavFile.parentFile?.let { if (!it.exists()) it.mkdirs() }

        var newBytes = currentDataBytes
        RandomAccessFile(wavFile, "rw").use { raf ->
            raf.seek(WAV_HEADER_SIZE + currentDataBytes)

            // Inject silence if requested
            if (silenceBytes != null && silenceBytes.isNotEmpty() && currentDataBytes > 0) {
                raf.write(silenceBytes)
                newBytes += silenceBytes.size
            }

            // Write PCM chunk
            raf.write(pcmBytes, offset, length)
            newBytes += length

            // Seek back to start and update header with new total payload length
            val updatedHeader = buildWavHeader(newBytes, sampleRate, channels)
            raf.seek(0)
            raf.write(updatedHeader)
        }
        return newBytes
    }
}
`
  },
  {
    name: "KeyRotationManager.kt",
    path: "app/src/main/kotlin/com/gemini/tts/core/KeyRotationManager.kt",
    package: "com.gemini.tts.core",
    language: "kotlin",
    description: "Multi-key pool manager with automatic round-robin rotation, 429 rate limit cooldown tracking, daily quota exhaustion detection, and masked key tail display.",
    luaMapping: "P.parseKeys, P.keyTail, P.classifyResponse, P.pickKey",
    code: `package com.gemini.tts.core

import org.json.JSONObject

/**
 * KeyStatus tracks the operational state of an individual Gemini API key.
 */
data class ManagedKey(
    val key: String,
    var coolUntilEpochSec: Long = 0,
    var isDead: Boolean = false
) {
    val tail: String
        get() = if (key.length >= 4) key.takeLast(4) else key
}

sealed class ResponseClassification {
    object Ok : ResponseClassification()
    data class Network(val message: String) : ResponseClassification()
    data class RateLimitMinute(val waitSeconds: Long, val message: String?) : ResponseClassification()
    data class RateLimitDay(val message: String?) : ResponseClassification()
    data class BadKey(val message: String?) : ResponseClassification()
    data class BadModel(val message: String?) : ResponseClassification()
    data class BadRequest(val message: String?) : ResponseClassification()
    data class ServerError(val message: String?) : ResponseClassification()
    data class Other(val message: String?) : ResponseClassification()
}

/**
 * KeyRotationManager manages multiple Gemini API keys,
 * automatically switching to the next healthy key when 429 rate limit occurs,
 * putting throttled keys on cooldown, and permanently disabling dead keys.
 */
class KeyRotationManager(rawKeys: String) {

    private val keys: MutableList<ManagedKey> = parseKeys(rawKeys)
    private var currentIndex: Int = 0

    val totalKeys: Int
        get() = keys.size

    val activeKeysCount: Int
        get() = keys.count { !it.isDead }

    /**
     * Parses comma, semicolon, newline, or space separated keys.
     * Deduplicates and ignores tokens shorter than 15 chars.
     * Lua: P.parseKeys(raw)
     */
    companion object {
        fun parseKeys(raw: String?): MutableList<ManagedKey> {
            if (raw.isNullOrBlank()) return mutableListOf()
            val seen = mutableSetOf<String>()
            val result = mutableListOf<ManagedKey>()

            val tokens = raw.split(Regex("[\\\\s,;]+"))
            for (token in tokens) {
                val clean = token.trim()
                if (clean.length >= 15 && seen.add(clean)) {
                    result.add(ManagedKey(clean))
                }
            }
            return result
        }

        fun keyTail(k: String?): String {
            if (k.isNullOrEmpty()) return ""
            return if (k.length >= 4) k.takeLast(4) else k
        }

        /**
         * Analyzes HTTP status code and response body to classify the error type.
         * Lua: P.classifyResponse(code, body)
         */
        fun classifyResponse(code: Int, body: String?): ResponseClassification {
            val responseBody = body ?: ""
            var parsedMsg: String? = null

            try {
                if (responseBody.isNotEmpty()) {
                    val json = JSONObject(responseBody)
                    if (json.has("error")) {
                        val errorObj = json.getJSONObject("error")
                        parsedMsg = errorObj.optString("message", null)
                    } else if (json.has("message")) {
                        parsedMsg = json.optString("message", null)
                    }
                }
            } catch (_: Exception) {
                // Ignore JSON parse failure, fallback to regex
            }

            if (parsedMsg == null) {
                val match = Regex("\"message\"\\\\s*:\\\\s*\"([^\"]+)\"").find(responseBody)
                parsedMsg = match?.groupValues?.get(1)
            }

            if (code == 200) return ResponseClassification.Ok
            if (code <= 0) return ResponseClassification.Network(responseBody)

            if (code == 429) {
                // Check if quota is per day or per minute
                val lower = responseBody.lowercase()
                val isDaily = lower.contains("perday") || lower.contains("per day")

                // Extract retryDelay seconds if provided by Google API
                val retryMatch = Regex("retryDelay\"\\\\s*:\\\\s*\"(\\\\d+)").find(responseBody)
                val delaySeconds = retryMatch?.groupValues?.get(1)?.toLongOrNull() ?: 40L
                val wait = delaySeconds + 2L // Safety buffer

                return if (isDaily) {
                    ResponseClassification.RateLimitDay(parsedMsg)
                } else {
                    ResponseClassification.RateLimitMinute(wait, parsedMsg)
                }
            }

            if (code == 401 || code == 403) {
                return ResponseClassification.BadKey(parsedMsg)
            }

            if (code == 400) {
                if (responseBody.contains("API_KEY_INVALID") ||
                    responseBody.contains("API key not valid") ||
                    responseBody.contains("API key expired")
                ) {
                    return ResponseClassification.BadKey(parsedMsg)
                }
                return ResponseClassification.BadRequest(parsedMsg)
            }

            if (code == 404) return ResponseClassification.BadModel(parsedMsg)
            if (code >= 500) return ResponseClassification.ServerError(parsedMsg)

            return ResponseClassification.Other(parsedMsg)
        }
    }

    /**
     * Chooses the next usable key.
     * Returns Triple(key, index, waitSeconds).
     * If all keys are in cooldown, waitSeconds > 0 indicates how long to pause.
     * If all keys are dead or none configured, returns null.
     * Lua: P.pickKey(keys, start, now)
     */
    @Synchronized
    fun pickKey(nowEpochSec: Long = System.currentTimeMillis() / 1000): Triple<ManagedKey, Int, Long>? {
        if (keys.isEmpty()) return null

        var minCooldownRemaining: Long? = null
        val n = keys.size

        for (offset in 0 until n) {
            val i = (currentIndex + offset) % n
            val candidate = keys[i]

            if (!candidate.isDead) {
                if (candidate.coolUntilEpochSec <= nowEpochSec) {
                    currentIndex = i
                    return Triple(candidate, i, 0L)
                }
                val remaining = candidate.coolUntilEpochSec - nowEpochSec
                if (minCooldownRemaining == null || remaining < minCooldownRemaining) {
                    minCooldownRemaining = remaining
                }
            }
        }

        // All active keys are on cooldown
        if (minCooldownRemaining != null && minCooldownRemaining > 0) {
            return Triple(keys[currentIndex], currentIndex, minCooldownRemaining)
        }

        return null // No usable key left (all dead)
    }

    /**
     * Marks key at [index] as throttled for [waitSeconds].
     */
    @Synchronized
    fun markKeyCooldown(index: Int, waitSeconds: Long, nowEpochSec: Long = System.currentTimeMillis() / 1000) {
        if (index in keys.indices) {
            keys[index].coolUntilEpochSec = nowEpochSec + waitSeconds
            advanceIndex()
        }
    }

    /**
     * Marks key at [index] as dead (exhausted quota or invalid).
     */
    @Synchronized
    fun markKeyDead(index: Int) {
        if (index in keys.indices) {
            keys[index].isDead = true
            advanceIndex()
        }
    }

    private fun advanceIndex() {
        if (keys.isNotEmpty()) {
            currentIndex = (currentIndex + 1) % keys.size
        }
    }
}
`
  },
  {
    name: "GeminiRequestHelper.kt",
    path: "app/src/main/kotlin/com/gemini/tts/core/GeminiRequestHelper.kt",
    package: "com.gemini.tts.core",
    language: "kotlin",
    description: "Constructs standard Gemini generateContent JSON payloads for both Gemini 3.8+ audio schema (with speech_metadata and multiSpeakerVoiceConfig) and Gemini 2.5 models.",
    luaMapping: "P.isNewSchema, P.voiceName, P.langEnglish, P.matchSpeaker, P.buildRequest, P.extractAudio",
    code: `package com.gemini.tts.core

import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject

data class ExtractedAudio(
    val pcmBytes: ByteArray,
    val mimeType: String,
    val sampleRate: Int
)

/**
 * GeminiRequestHelper builds HTTP request JSON and parses response audio base64 buffers.
 */
object GeminiRequestHelper {

    /**
     * Gemini 3.8 and newer use the modern responseModalities = ["AUDIO"] and speech_metadata schema.
     * Lua: P.isNewSchema(model)
     */
    fun isNewSchema(model: String?): Boolean {
        if (model == null) return false
        val regex = Regex("gemini-(\\\\d+)\\\\.(\\\\d+)")
        val match = regex.find(model) ?: return false
        val major = match.groupValues[1].toIntOrNull() ?: 0
        val minor = match.groupValues[2].toIntOrNull() ?: 0
        return major > 3 || (major == 3 && minor >= 8)
    }

    fun voiceName(label: String?): String {
        if (label.isNullOrBlank()) return "Kore"
        val firstToken = label.trim().split(Regex("\\\\s+")).firstOrNull() ?: "Kore"
        return firstToken
    }

    fun langEnglish(label: String?): String? {
        if (label.isNullOrBlank() || label == "Auto Detect") return null
        val match = Regex("^(.*?)\\\\s*\\\\(").find(label)
        return match?.groupValues?.get(1)?.trim() ?: label
    }

    /**
     * Checks if line starts with Speaker1 or Speaker2 prefix (e.g. "Joe: Hello").
     * Lua: P.matchSpeaker(line, cfg)
     */
    fun matchSpeaker(line: String, sp1Name: String, sp2Name: String): Pair<String?, String> {
        val lower = line.lowercase()
        val names = listOf(sp1Name, sp2Name)

        for (name in names) {
            if (name.isNotEmpty()) {
                val tag = name.lowercase() + ":"
                if (lower.startsWith(tag)) {
                    val rest = line.substring(tag.length).trim()
                    return Pair(name, rest)
                }
            }
        }
        return Pair(null, line)
    }

    /**
     * Builds the complete generateContent JSON request body.
     * Lua: P.buildRequest(cfg, text)
     */
    fun buildRequestBody(
        model: String,
        voice: String,
        language: String,
        style: String,
        multi: Boolean,
        sp1Name: String,
        sp1Voice: String,
        sp2Name: String,
        sp2Voice: String,
        text: String
    ): String {
        val newSchema = isNewSchema(model)
        val trimmedStyle = style.trim()

        val root = JSONObject()
        val generationConfig = JSONObject()

        // Audio response modality
        val modalities = JSONArray()
        modalities.put("AUDIO")
        generationConfig.put("responseModalities", modalities)

        // Multi-speaker voice config
        var multiVoiceConfig: JSONObject? = null
        if (multi) {
            val speakerConfigs = JSONArray()

            val sp1 = JSONObject()
            sp1.put("speaker", sp1Name)
            val sp1Vc = JSONObject()
            val sp1Pvc = JSONObject()
            sp1Pvc.put("voiceName", sp1Voice)
            sp1Vc.put("prebuiltVoiceConfig", sp1Pvc)
            sp1.put("voiceConfig", sp1Vc)
            speakerConfigs.put(sp1)

            val sp2 = JSONObject()
            sp2.put("speaker", sp2Name)
            val sp2Vc = JSONObject()
            val sp2Pvc = JSONObject()
            sp2Pvc.put("voiceName", sp2Voice)
            sp2Vc.put("prebuiltVoiceConfig", sp2Pvc)
            sp2.put("voiceConfig", sp2Vc)
            speakerConfigs.put(sp2)

            val multiSpk = JSONObject()
            multiSpk.put("speakerVoiceConfigs", speakerConfigs)
            multiVoiceConfig = JSONObject()
            multiVoiceConfig.put("multiSpeakerVoiceConfig", multiSpk)
        }

        val contents = JSONArray()

        if (newSchema) {
            if (multi) {
                val parts = JSONArray()
                var currentSpeaker = sp1Name
                val lines = text.split("\\n")

                for (rawLine in lines) {
                    val line = rawLine.trim()
                    if (line.isNotEmpty()) {
                        val (matchedSpeaker, dialogue) = matchSpeaker(line, sp1Name, sp2Name)
                        if (matchedSpeaker != null) {
                            currentSpeaker = matchedSpeaker
                        }
                        if (dialogue.isNotEmpty()) {
                            val part = JSONObject()
                            part.put("text", dialogue)
                            val meta = JSONObject()
                            meta.put("speaker", currentSpeaker)
                            if (trimmedStyle.isNotEmpty()) {
                                meta.put("style", trimmedStyle)
                            }
                            part.put("speech_metadata", meta)
                            parts.put(part)
                        }
                    }
                }

                if (parts.length() == 0) {
                    val fallbackPart = JSONObject()
                    fallbackPart.put("text", text)
                    val meta = JSONObject()
                    meta.put("speaker", sp1Name)
                    fallbackPart.put("speech_metadata", meta)
                    parts.put(fallbackPart)
                }

                val contentObj = JSONObject()
                contentObj.put("role", "user")
                contentObj.put("parts", parts)
                contents.put(contentObj)

                generationConfig.put("speechConfig", multiVoiceConfig?.getJSONObject("multiSpeakerVoiceConfig"))
            } else {
                val part = JSONObject()
                part.put("text", text)
                if (trimmedStyle.isNotEmpty()) {
                    val meta = JSONObject()
                    meta.put("style", trimmedStyle)
                    part.put("speech_metadata", meta)
                }

                val parts = JSONArray()
                parts.put(part)

                val contentObj = JSONObject()
                contentObj.put("role", "user")
                contentObj.put("parts", parts)
                contents.put(contentObj)

                val speechConfig = JSONObject()
                val voiceConfig = JSONObject()
                voiceConfig.put("voice", voice)
                speechConfig.put("voiceConfig", voiceConfig)
                generationConfig.put("speechConfig", speechConfig)
            }
        } else {
            // Older Gemini 2.5 schema
            val hints = mutableListOf<String>()
            val langHint = langEnglish(language)
            if (langHint != null) hints.add("in $langHint")
            if (trimmedStyle.isNotEmpty()) hints.add(trimmedStyle)

            val promptText = if (multi) {
                val extra = if (hints.isNotEmpty()) " " + hints.joinToString(", ") else ""
                "TTS the following conversation between $sp1Name and $sp2Name$extra:\\n$text"
            } else {
                if (hints.isNotEmpty()) {
                    "Say \${hints.joinToString(", ")}:\\n$text"
                } else {
                    text
                }
            }

            val part = JSONObject()
            part.put("text", promptText)
            val parts = JSONArray()
            parts.put(part)

            val contentObj = JSONObject()
            contentObj.put("parts", parts)
            contents.put(contentObj)

            if (multi) {
                generationConfig.put("speechConfig", multiVoiceConfig?.getJSONObject("multiSpeakerVoiceConfig"))
            } else {
                val speechConfig = JSONObject()
                val voiceConfig = JSONObject()
                val prebuilt = JSONObject()
                prebuilt.put("voiceName", voice)
                voiceConfig.put("prebuiltVoiceConfig", prebuilt)
                speechConfig.put("voiceConfig", voiceConfig)
                generationConfig.put("speechConfig", speechConfig)
            }
        }

        root.put("contents", contents)
        root.put("generationConfig", generationConfig)
        return root.toString()
    }

    /**
     * Extracts base64 audio data and MIME type from Gemini response JSON.
     * Strips 44-byte WAV header if necessary.
     * Lua: P.extractAudio(r)
     */
    fun extractAudio(jsonString: String, isNewSchema: Boolean): ExtractedAudio {
        val root = JSONObject(jsonString)

        val candidates = root.optJSONArray("candidates")
        if (candidates == null || candidates.length() == 0) {
            val promptFeedback = root.optJSONObject("promptFeedback")
            val blockReason = promptFeedback?.optString("blockReason", null)
            throw IllegalStateException(blockReason?.let { "Content blocked: $it" } ?: "No candidate returned")
        }

        val firstCandidate = candidates.getJSONObject(0)
        val content = firstCandidate.optJSONObject("content")
        val parts = content?.optJSONArray("parts")

        if (parts != null) {
            for (idx in 0 until parts.length()) {
                val part = parts.getJSONObject(idx)
                val inlineData = part.optJSONObject("inlineData")
                if (inlineData != null) {
                    val base64Data = inlineData.optString("data", "")
                    val mimeType = inlineData.optString("mimeType", "audio/pcm;rate=24000")

                    if (base64Data.isNotEmpty()) {
                        val decodedBytes = Base64.decode(base64Data, Base64.DEFAULT)
                        val sampleRate = WavAudioUtil.parseRate(mimeType)
                        val shouldStrip = WavAudioUtil.shouldStripWav(mimeType, isNewSchema)
                        val skip = if (shouldStrip && decodedBytes.size >= 44) 44 else 0

                        var pcmLen = decodedBytes.size - skip
                        pcmLen -= (pcmLen % 2) // Ensure 16-bit 2-byte alignment

                        if (pcmLen < 2) {
                            throw IllegalStateException("Empty audio payload")
                        }

                        val pcmBytes = ByteArray(pcmLen)
                        System.arraycopy(decodedBytes, skip, pcmBytes, 0, pcmLen)

                        return ExtractedAudio(pcmBytes, mimeType, sampleRate)
                    }
                }
            }
        }

        val finishReason = firstCandidate.optString("finishReason", "unknown")
        throw IllegalStateException("No audio found in response (finishReason: $finishReason)")
    }
}
`
  },
  {
    name: "MediaCodecAudioConverter.kt",
    path: "app/src/main/kotlin/com/gemini/tts/audio/MediaCodecAudioConverter.kt",
    package: "com.gemini.tts.audio",
    language: "kotlin",
    description: "Converts 16-bit raw PCM WAV audio to compressed M4A (AAC-LC @ 64kbps) using Android MediaCodec hardware encoder and MediaMuxer container with progress reporting.",
    luaMapping: "encodeM4A, saveAudioTo",
    code: `package com.gemini.tts.audio

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import com.gemini.tts.core.WavAudioUtil
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.nio.ByteBuffer

/**
 * MediaCodecAudioConverter handles high-performance encoding of WAV audio files
 * to M4A/AAC containers using standard Android MediaCodec and MediaMuxer.
 */
object MediaCodecAudioConverter {

    private const val MIME_TYPE = "audio/mp4a-latm" // AAC Audio
    private const val BIT_RATE = 64000 // 64 kbps
    private const val BUFFER_TIMEOUT_US = 10000L // 10ms poll timeout

    /**
     * Converts source WAV file to M4A destination.
     * Runs asynchronously on Dispatchers.IO with cancellation and progress reporting.
     */
    suspend fun convertWavToM4a(
        srcWav: File,
        destM4a: File,
        onProgress: (percent: Int) -> Unit
    ): Result<File> = withContext(Dispatchers.IO) {
        if (!srcWav.exists()) {
            return@withContext Result.failure(IllegalArgumentException("Source WAV file does not exist: \${srcWav.path}"))
        }

        destM4a.parentFile?.let { if (!it.exists()) it.mkdirs() }

        var codec: MediaCodec? = null
        var muxer: MediaMuxer? = null
        var fis: FileInputStream? = null
        var muxerStarted = false

        try {
            val sampleRate = WavAudioUtil.readWavRate(srcWav)
            val channels = 1
            val totalPcmBytes = Math.max(1L, srcWav.length() - WavAudioUtil.WAV_HEADER_SIZE)

            fis = FileInputStream(srcWav)
            fis.skip(WavAudioUtil.WAV_HEADER_SIZE.toLong()) // Skip 44-byte WAV header

            // Configure AAC MediaFormat
            val format = MediaFormat.createAudioFormat(MIME_TYPE, sampleRate, channels).apply {
                setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
                setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE)
                setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16384)
            }

            codec = MediaCodec.createEncoderByType(MIME_TYPE)
            codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            codec.start()

            muxer = MediaMuxer(destM4a.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)

            val bufferInfo = MediaCodec.BufferInfo()
            val readBuf = ByteArray(8192)
            var bytesReadTotal = 0L
            var inputDone = false
            var outputDone = false
            var trackIndex = -1
            var lastReportedPercent = -1

            while (!outputDone && isActive) {
                // 1. Feed PCM input buffer to encoder
                if (!inputDone) {
                    val inputBufIndex = codec.dequeueInputBuffer(BUFFER_TIMEOUT_US)
                    if (inputBufIndex >= 0) {
                        val inputBuffer = codec.getInputBuffer(inputBufIndex)
                        inputBuffer?.clear()

                        val capacity = Math.min(inputBuffer?.capacity() ?: 8192, 8192)
                        val alignedCapacity = capacity - (capacity % 2)
                        val bytesRead = fis.read(readBuf, 0, alignedCapacity)

                        // Calculate PTS in microseconds
                        val presentationTimeUs = (bytesReadTotal / (channels * 2) * 1_000_000L) / sampleRate

                        if (bytesRead <= 0) {
                            codec.queueInputBuffer(
                                inputBufIndex,
                                0,
                                0,
                                presentationTimeUs,
                                MediaCodec.BUFFER_FLAG_END_OF_STREAM
                            )
                            inputDone = true
                        } else {
                            inputBuffer?.put(readBuf, 0, bytesRead)
                            codec.queueInputBuffer(
                                inputBufIndex,
                                0,
                                bytesRead,
                                presentationTimeUs,
                                0
                            )
                            bytesReadTotal += bytesRead

                            val percent = (bytesReadTotal * 100 / totalPcmBytes).toInt()
                            if (percent != lastReportedPercent && percent % 5 == 0) {
                                lastReportedPercent = percent
                                onProgress(percent.coerceIn(0, 100))
                            }
                        }
                    }
                }

                // 2. Pull encoded AAC packets from encoder
                val outputBufIndex = codec.dequeueOutputBuffer(bufferInfo, BUFFER_TIMEOUT_US)
                when {
                    outputBufIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        if (muxerStarted) {
                            throw RuntimeException("Output format changed after muxer started")
                        }
                        val newFormat = codec.outputFormat
                        trackIndex = muxer.addTrack(newFormat)
                        muxer.start()
                        muxerStarted = true
                    }
                    outputBufIndex >= 0 -> {
                        val outputBuffer = codec.getOutputBuffer(outputBufIndex)
                        if (outputBuffer != null) {
                            if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) {
                                bufferInfo.size = 0
                            }

                            if (bufferInfo.size > 0 && muxerStarted) {
                                outputBuffer.position(bufferInfo.offset)
                                outputBuffer.limit(bufferInfo.offset + bufferInfo.size)
                                muxer.writeSampleData(trackIndex, outputBuffer, bufferInfo)
                            }

                            codec.releaseOutputBuffer(outputBufIndex, false)

                            if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                                outputDone = true
                            }
                        }
                    }
                }
            }

            onProgress(100)
            Result.success(destM4a)
        } catch (e: Exception) {
            // Clean up partial file on failure
            destM4a.delete()
            Result.failure(e)
        } finally {
            try { fis?.close() } catch (_: Exception) {}
            try {
                codec?.stop()
                codec?.release()
            } catch (_: Exception) {}
            try {
                if (muxerStarted) {
                    muxer?.stop()
                }
                muxer?.release()
            } catch (_: Exception) {}
        }
    }
}
`
  },
  {
    name: "AudioPlayerController.kt",
    path: "app/src/main/kotlin/com/gemini/tts/audio/AudioPlayerController.kt",
    package: "com.gemini.tts.audio",
    language: "kotlin",
    description: "MediaPlayer controller with dynamic PlaybackParams speed cycling (0.75x to 2.0x), seek forward/backwards by 10s, and TalkBack state callbacks.",
    luaMapping: "playFile, togglePause, stopAudio, seekBy, cycleSpeed, applySpeed",
    code: `package com.gemini.tts.audio

import android.content.Context
import android.media.MediaPlayer
import android.media.PlaybackParams
import android.os.Build
import com.gemini.tts.core.TextProcessor
import java.io.File

/**
 * Playback state observable by UI and screen readers.
 */
sealed class PlaybackState {
    object Idle : PlaybackState()
    data class Playing(val filePath: String, val speed: Float) : PlaybackState()
    data class Paused(val filePath: String, val positionMs: Int) : PlaybackState()
    object Finished : PlaybackState()
    data class Error(val message: String) : PlaybackState()
}

/**
 * AudioPlayerController encapsulates Android MediaPlayer operations with
 * playback speed adjustment and accessibility state announcements.
 */
class AudioPlayerController(private val context: Context) {

    private var mediaPlayer: MediaPlayer? = null
    var currentSpeed: Float = 1.0f
        private set

    private val availableSpeeds = listOf(0.75f, 1.0f, 1.25f, 1.5f, 2.0f)
    var currentState: PlaybackState = PlaybackState.Idle
        private set

    var onStateChangedListener: ((PlaybackState, String) -> Unit)? = null

    val isPlaying: Boolean
        get() = mediaPlayer?.isPlaying == true

    val isPaused: Boolean
        get() = currentState is PlaybackState.Paused

    /**
     * Plays the audio file at [path].
     * Lua: playFile(path)
     */
    fun play(path: String?) {
        if (path.isNullOrEmpty()) {
            notifyState(PlaybackState.Error("No audio file available. Generate audio first."), "No audio available.")
            return
        }
        val file = File(path)
        if (!file.exists()) {
            notifyState(PlaybackState.Error("Audio file not found: \${file.name}"), "Audio file not found.")
            return
        }

        try {
            stop()
            mediaPlayer = MediaPlayer().apply {
                setDataSource(file.absolutePath)
                prepare()
                applySpeed(currentSpeed)
                start()

                setOnCompletionListener {
                    notifyState(PlaybackState.Finished, "Playback finished.")
                }
                setOnErrorListener { _, what, extra ->
                    notifyState(PlaybackState.Error("Playback error: what=\$what extra=\$extra"), "Playback error occurred.")
                    true
                }
            }
            notifyState(PlaybackState.Playing(path, currentSpeed), "Playing audio.")
        } catch (e: Exception) {
            notifyState(PlaybackState.Error("Could not play audio: \${e.localizedMessage}"), "Could not play audio.")
        }
    }

    /**
     * Toggles between pause and resume.
     * Lua: togglePause()
     */
    fun togglePause() {
        val player = mediaPlayer ?: return

        try {
            if (player.isPlaying) {
                player.pause()
                val pos = player.currentPosition
                notifyState(PlaybackState.Paused("", pos), "Playback paused.")
            } else if (currentState is PlaybackState.Paused) {
                player.start()
                applySpeed(currentSpeed)
                notifyState(PlaybackState.Playing("", currentSpeed), "Playback resumed.")
            }
        } catch (e: Exception) {
            notifyState(PlaybackState.Error("Failed to toggle playback: \${e.message}"), "Playback toggle failed.")
        }
    }

    /**
     * Stops audio playback.
     * Lua: stopAudio()
     */
    fun stop() {
        mediaPlayer?.let { player ->
            try {
                if (player.isPlaying) {
                    player.stop()
                }
                player.release()
            } catch (_: Exception) {}
            mediaPlayer = null
        }
        notifyState(PlaybackState.Idle, "Playback stopped.")
    }

    /**
     * Seeks playback forward or backward by [offsetMs].
     * Lua: seekBy(ms)
     */
    fun seekBy(offsetMs: Int): String {
        val player = mediaPlayer ?: return "Nothing is playing."
        val duration = player.duration
        if (duration <= 0) return "Duration unknown."

        val current = player.currentPosition
        val target = (current + offsetMs).coerceIn(0, duration)
        player.seekTo(target)

        val announcement = "Position \${TextProcessor.fmtDuration(target / 1000.0)} of \${TextProcessor.fmtDuration(duration / 1000.0)}."
        notifyState(currentState, announcement)
        return announcement
    }

    /**
     * Cycles through 0.75x, 1.0x, 1.25x, 1.5x, 2.0x.
     * Lua: cycleSpeed()
     */
    fun cycleSpeed(): Float {
        val currentIndex = availableSpeeds.indexOf(currentSpeed)
        val nextIndex = if (currentIndex >= 0) (currentIndex + 1) % availableSpeeds.size else 1
        currentSpeed = availableSpeeds[nextIndex]

        applySpeed(currentSpeed)
        val msg = String.format(java.util.Locale.US, "Speed: %.2fx", currentSpeed)
        notifyState(currentState, "Playback $msg")
        return currentSpeed
    }

    private fun applySpeed(speed: Float) {
        mediaPlayer?.let { player ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    val params = player.playbackParams ?: PlaybackParams()
                    params.speed = speed
                    player.playbackParams = params
                } catch (_: Exception) {}
            }
        }
    }

    private fun notifyState(state: PlaybackState, announcement: String) {
        currentState = state
        onStateChangedListener?.invoke(state, announcement)
    }

    fun release() {
        stop()
    }
}
`
  },
  {
    name: "TtsForegroundService.kt",
    path: "app/src/main/kotlin/com/gemini/tts/service/TtsForegroundService.kt",
    package: "com.gemini.tts.service",
    language: "kotlin",
    description: "Android Foreground Service with WakeLock, notification channel progress bar, coroutine-based key rotation execution, and seamless resume support.",
    luaMapping: "acquireWake, releaseWake, E.run, E.process, E.send, E.append, E.onResponse, E.finish, E.fail, E.cancel, E.start, E.resume",
    code: `package com.gemini.tts.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.gemini.tts.core.GeminiRequestHelper
import com.gemini.tts.core.KeyRotationManager
import com.gemini.tts.core.ResponseClassification
import com.gemini.tts.core.TextProcessor
import com.gemini.tts.core.WavAudioUtil
import com.gemini.tts.data.AppConfig
import com.gemini.tts.data.TtsRepository
import com.gemini.tts.ui.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * TtsForegroundService runs long-running TTS batch generation jobs in the background,
 * holding a PARTIAL_WAKE_LOCK to prevent CPU sleep, displaying ongoing progress notifications,
 * and surviving activity recreation.
 */
class TtsForegroundService : Service() {

    private val binder = LocalBinder()
    private val serviceJob = Job()
    private val scope = CoroutineScope(Dispatchers.Main + serviceJob)

    private var wakeLock: PowerManager.WakeLock? = null
    private lateinit var notificationManager: NotificationManager
    private lateinit var repository: TtsRepository

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(60, TimeUnit.SECONDS)
        .readTimeout(180, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    // Observable status listeners
    var onProgressUpdate: ((done: Int, total: Int, message: String, isFinished: Boolean) -> Unit)? = null
    var isRunning: Boolean = false
        private set

    private var activeJobCancellationRequested = false

    inner class LocalBinder : Binder() {
        fun getService(): TtsForegroundService = this@TtsForegroundService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        repository = TtsRepository(applicationContext)
        createNotificationChannel()
    }

    /**
     * Starts a new TTS conversion job.
     */
    fun startJob(rawText: String, config: AppConfig) {
        if (isRunning) return
        activeJobCancellationRequested = false

        val text = if (config.cleanText) TextProcessor.cleanText(rawText) else TextProcessor.trim(rawText)
        if (text.isEmpty()) {
            onProgressUpdate?.invoke(0, 0, "Please enter some text.", false)
            return
        }

        val keysManager = KeyRotationManager(config.apiKeys)
        if (keysManager.totalKeys == 0) {
            onProgressUpdate?.invoke(0, 0, "No API key found. Add a key in Settings.", false)
            return
        }

        val chunks = TextProcessor.splitChunks(text, config.chunkSize, config.multi)
        if (chunks.isEmpty()) {
            onProgressUpdate?.invoke(0, 0, "No readable text found.", false)
            return
        }

        acquireWakeLock()
        isRunning = true
        startForeground(NOTIFICATION_ID, buildNotification("Starting TTS generation...", 0, chunks.size))

        // Save active job state to repository
        repository.saveJobState(chunks, 0, 0L, WavAudioUtil.DEFAULT_SAMPLE_RATE, config, text)

        scope.launch {
            executeGenerationLoop(chunks, 0, 0L, config, keysManager)
        }
    }

    /**
     * Resumes an unfinished job from saved state.
     */
    fun resumeJob() {
        if (isRunning) return
        val saved = repository.loadSavedJob()
        if (saved == null) {
            onProgressUpdate?.invoke(0, 0, "No unfinished job found to resume.", false)
            return
        }

        val keysManager = KeyRotationManager(saved.config.apiKeys)
        if (keysManager.totalKeys == 0) {
            onProgressUpdate?.invoke(0, 0, "No API key. Open Settings to add a key, then resume.", false)
            return
        }

        activeJobCancellationRequested = false
        acquireWakeLock()
        isRunning = true
        startForeground(NOTIFICATION_ID, buildNotification("Resuming TTS generation...", saved.done, saved.chunks.size))

        scope.launch {
            executeGenerationLoop(saved.chunks, saved.done, saved.dataBytes, saved.config, keysManager)
        }
    }

    /**
     * Cancels the active job, preserving completed chunks on disk for subsequent resume.
     */
    fun cancelJob() {
        if (!isRunning) return
        activeJobCancellationRequested = true
        isRunning = false
        releaseWakeLock()
        stopForeground(STOP_FOREGROUND_REMOVE)
        onProgressUpdate?.invoke(0, 0, "Job cancelled by user. Progress saved.", false)
    }

    private suspend fun executeGenerationLoop(
        chunks: List<String>,
        startDone: Int,
        initialDataBytes: Long,
        config: AppConfig,
        keysManager: KeyRotationManager
    ) = withContext(Dispatchers.IO) {
        val totalChunks = chunks.size
        var doneChunks = startDone
        var currentDataBytes = initialDataBytes
        var sampleRate = WavAudioUtil.DEFAULT_SAMPLE_RATE
        val workWav = repository.getWorkWavFile()

        if (doneChunks == 0) {
            WavAudioUtil.createEmptyWav(workWav, sampleRate)
        }

        val isNewSchema = GeminiRequestHelper.isNewSchema(config.model)
        val silenceBytes = WavAudioUtil.createSilenceBytes(sampleRate, config.silenceMs)
        val apiBase = "https://generativelanguage.googleapis.com/v1beta/models/\${config.resolvedModel()}:generateContent"

        var consecutiveWaits = 0

        while (doneChunks < totalChunks && isActive && !activeJobCancellationRequested) {
            val chunkIndex = doneChunks
            val chunkText = chunks[chunkIndex]

            // 1. Pick a key from pool
            val keyTriple = keysManager.pickKey()
            if (keyTriple == null) {
                withContext(Dispatchers.Main) {
                    finishWithError("No usable API key left. All keys exhausted or invalid. Progress saved. Resume anytime.")
                }
                return@withContext
            }

            val (managedKey, keyIndex, waitSeconds) = keyTriple

            if (waitSeconds > 0) {
                consecutiveWaits++
                if (consecutiveWaits > 12) {
                    withContext(Dispatchers.Main) {
                        finishWithError("Rate limit cooldown persists. Progress saved. Press Resume Unfinished Job later.")
                    }
                    return@withContext
                }
                withContext(Dispatchers.Main) {
                    val msg = "Rate limit reached. Waiting \${waitSeconds}s, then continuing automatically."
                    updateNotification(msg, doneChunks, totalChunks)
                    onProgressUpdate?.invoke(doneChunks, totalChunks, msg, false)
                }
                delay(waitSeconds * 1000)
                continue
            }

            consecutiveWaits = 0

            // 2. Build request body
            val requestBodyJson = GeminiRequestHelper.buildRequestBody(
                model = config.resolvedModel(),
                voice = config.voice,
                language = config.language,
                style = config.style,
                multi = config.multi,
                sp1Name = config.sp1Name,
                sp1Voice = config.sp1Voice,
                sp2Name = config.sp2Name,
                sp2Voice = config.sp2Voice,
                text = chunkText
            )

            val request = Request.Builder()
                .url(apiBase)
                .addHeader("Content-Type", "application/json")
                .addHeader("x-goog-api-key", managedKey.key)
                .post(requestBodyJson.toRequestBody("application/json; charset=utf-8".toMediaType()))
                .build()

            // 3. Execute HTTP Call
            var chunkSuccess = false
            var retryCount = 0

            while (!chunkSuccess && retryCount < 5 && isActive && !activeJobCancellationRequested) {
                try {
                    val response = httpClient.newCall(request).execute()
                    val code = response.code
                    val responseBody = response.body?.string() ?: ""

                    val classification = KeyRotationManager.classifyResponse(code, responseBody)

                    when (classification) {
                        is ResponseClassification.Ok -> {
                            val extracted = GeminiRequestHelper.extractAudio(responseBody, isNewSchema)
                            sampleRate = extracted.sampleRate

                            currentDataBytes = WavAudioUtil.appendPcmData(
                                wavFile = workWav,
                                currentDataBytes = currentDataBytes,
                                pcmBytes = extracted.pcmBytes,
                                offset = 0,
                                length = extracted.pcmBytes.size,
                                sampleRate = sampleRate,
                                silenceBytes = if (doneChunks > 0) silenceBytes else null
                            )

                            doneChunks++
                            chunkSuccess = true

                            // Persist checkpoint
                            repository.updateJobProgress(doneChunks, currentDataBytes, sampleRate)

                            val pct = (doneChunks * 100) / totalChunks
                            val msg = "Chunk \$doneChunks of \$totalChunks done (\$pct%)."

                            withContext(Dispatchers.Main) {
                                updateNotification(msg, doneChunks, totalChunks)
                                onProgressUpdate?.invoke(doneChunks, totalChunks, msg, false)
                            }

                            // Optional pause between requests
                            if (config.pauseSec > 0 && doneChunks < totalChunks) {
                                delay((config.pauseSec * 1000).toLong())
                            }
                        }

                        is ResponseClassification.RateLimitMinute -> {
                            keysManager.markKeyCooldown(keyIndex, classification.waitSeconds)
                            withContext(Dispatchers.Main) {
                                val msg = "Key \${keyIndex + 1} (... \${managedKey.tail}) hit rate limit. Switching key."
                                onProgressUpdate?.invoke(doneChunks, totalChunks, msg, false)
                            }
                            break // Re-pick next key
                        }

                        is ResponseClassification.RateLimitDay -> {
                            keysManager.markKeyDead(keyIndex)
                            withContext(Dispatchers.Main) {
                                val msg = "Key \${keyIndex + 1} (... \${managedKey.tail}) daily quota reached. Trying next key."
                                onProgressUpdate?.invoke(doneChunks, totalChunks, msg, false)
                            }
                            break // Re-pick next key
                        }

                        is ResponseClassification.BadKey -> {
                            keysManager.markKeyDead(keyIndex)
                            withContext(Dispatchers.Main) {
                                val msg = "Key \${keyIndex + 1} (... \${managedKey.tail}) is invalid. Skipping."
                                onProgressUpdate?.invoke(doneChunks, totalChunks, msg, false)
                            }
                            break
                        }

                        is ResponseClassification.BadModel -> {
                            withContext(Dispatchers.Main) {
                                finishWithError("Model '\${config.resolvedModel()}' not available for your key.")
                            }
                            return@withContext
                        }

                        else -> {
                            retryCount++
                            val delaySec = retryCount * 3
                            delay(delaySec * 1000L)
                        }
                    }
                } catch (e: Exception) {
                    retryCount++
                    delay(retryCount * 3000L)
                }
            }
        }

        if (doneChunks >= totalChunks) {
            withContext(Dispatchers.Main) {
                finishWithSuccess(workWav, totalChunks, currentDataBytes, sampleRate, config)
            }
        }
    }

    private fun finishWithSuccess(workWav: File, total: Int, bytes: Long, sampleRate: Int, config: AppConfig) {
        val destFile = repository.archiveToHistory(workWav)
        repository.clearSavedJob()
        isRunning = false
        releaseWakeLock()
        stopForeground(STOP_FOREGROUND_REMOVE)

        val durationSec = bytes / (sampleRate * 2.0)
        val msg = "Finished \$total chunks (\${TextProcessor.fmtDuration(durationSec)} of audio). Saved in history."
        onProgressUpdate?.invoke(total, total, msg, true)
    }

    private fun finishWithError(errorMessage: String) {
        isRunning = false
        releaseWakeLock()
        stopForeground(STOP_FOREGROUND_REMOVE)
        onProgressUpdate?.invoke(0, 0, errorMessage, false)
    }

    private fun acquireWakeLock() {
        if (wakeLock == null) {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "GeminiTTS:ForegroundJob")
            wakeLock?.setReferenceCounted(false)
        }
        wakeLock?.acquire(6 * 60 * 60 * 1000L) // 6 hours max
    }

    private fun releaseWakeLock() {
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Gemini TTS Conversion",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows progress of ongoing Gemini TTS audio synthesis."
            }
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String, done: Int, total: Int): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Gemini TTS Converter")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentIntent(pendingIntent)
            .setOngoing(true)

        if (total > 0) {
            builder.setProgress(total, done, false)
        } else {
            builder.setProgress(0, 0, true)
        }

        return builder.build()
    }

    private fun updateNotification(text: String, done: Int, total: Int) {
        notificationManager.notify(NOTIFICATION_ID, buildNotification(text, done, total))
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceJob.cancel()
        releaseWakeLock()
    }

    companion object {
        const val NOTIFICATION_ID = 1001
        const val CHANNEL_ID = "gemini_tts_channel"
    }
}
`
  },
  {
    name: "TtsRepository.kt",
    path: "app/src/main/kotlin/com/gemini/tts/data/TtsRepository.kt",
    package: "com.gemini.tts.data",
    language: "kotlin",
    description: "Data persistence layer for JSON configuration, job state serialization, history directory scanning, and clean filename utilities.",
    luaMapping: "saveConfig, loadConfig, E.saveMeta, E.clearJobFiles, listFiles, cleanFilename",
    code: `package com.gemini.tts.data

import android.content.Context
import android.content.SharedPreferences
import com.gemini.tts.core.TextProcessor
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class SavedJobState(
    val chunks: List<String>,
    val done: Int,
    val dataBytes: Long,
    val rate: Int,
    val config: AppConfig,
    val text: String
)

data class AppConfig(
    val apiKeys: String = "",
    val language: String = "Auto Detect",
    val voice: String = "Kore",
    val model: String = "gemini-3.8-flash-tts",
    val customModel: String = "",
    val style: String = "",
    val chunkSize: Int = 1800,
    val pauseSec: Int = 2,
    val silenceMs: Int = 250,
    val cleanText: Boolean = false,
    val clipboardPrefill: Boolean = true,
    val autoPlay: Boolean = true,
    val autoSave: Boolean = false,
    val autoSaveFormat: String = "WAV",
    val multi: Boolean = false,
    val sp1Name: String = "Joe",
    val sp1Voice: String = "Puck",
    val sp2Name: String = "Jane",
    val sp2Voice: String = "Kore"
) {
    fun resolvedModel(): String {
        val custom = customModel.trim()
        return if (custom.isNotEmpty()) custom else model
    }
}

/**
 * TtsRepository handles local file storage, job serialization,
 * and history list queries for Android.
 */
class TtsRepository(private val context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences("gemini_tts_prefs", Context.MODE_PRIVATE)

    private val baseDir: File = File(context.getExternalFilesDir(null) ?: context.filesDir, "GeminiTTS")
    private val workDir: File = File(baseDir, "work")
    private val historyDir: File = File(baseDir, "history")

    init {
        if (!workDir.exists()) workDir.mkdirs()
        if (!historyDir.exists()) historyDir.mkdirs()
    }

    fun getWorkWavFile(): File = File(workDir, "current.wav")
    private fun getJobMetaFile(): File = File(workDir, "job.json")
    private fun getJobTextFile(): File = File(workDir, "job_text.txt")

    fun saveConfig(config: AppConfig) {
        prefs.edit().apply {
            putString("apiKeys", config.apiKeys)
            putString("language", config.language)
            putString("voice", config.voice)
            putString("model", config.model)
            putString("customModel", config.customModel)
            putString("style", config.style)
            putInt("chunkSize", config.chunkSize)
            putInt("pauseSec", config.pauseSec)
            putInt("silenceMs", config.silenceMs)
            putBoolean("cleanText", config.cleanText)
            putBoolean("clipboardPrefill", config.clipboardPrefill)
            putBoolean("autoPlay", config.autoPlay)
            putBoolean("autoSave", config.autoSave)
            putString("autoSaveFormat", config.autoSaveFormat)
            putBoolean("multi", config.multi)
            putString("sp1Name", config.sp1Name)
            putString("sp1Voice", config.sp1Voice)
            putString("sp2Name", config.sp2Name)
            putString("sp2Voice", config.sp2Voice)
            apply()
        }
    }

    fun loadConfig(): AppConfig {
        return AppConfig(
            apiKeys = prefs.getString("apiKeys", "") ?: "",
            language = prefs.getString("language", "Auto Detect") ?: "Auto Detect",
            voice = prefs.getString("voice", "Kore") ?: "Kore",
            model = prefs.getString("model", "gemini-3.8-flash-tts") ?: "gemini-3.8-flash-tts",
            customModel = prefs.getString("customModel", "") ?: "",
            style = prefs.getString("style", "") ?: "",
            chunkSize = prefs.getInt("chunkSize", 1800),
            pauseSec = prefs.getInt("pauseSec", 2),
            silenceMs = prefs.getInt("silenceMs", 250),
            cleanText = prefs.getBoolean("cleanText", false),
            clipboardPrefill = prefs.getBoolean("clipboardPrefill", true),
            autoPlay = prefs.getBoolean("autoPlay", true),
            autoSave = prefs.getBoolean("autoSave", false),
            autoSaveFormat = prefs.getString("autoSaveFormat", "WAV") ?: "WAV",
            multi = prefs.getBoolean("multi", false),
            sp1Name = prefs.getString("sp1Name", "Joe") ?: "Joe",
            sp1Voice = prefs.getString("sp1Voice", "Puck") ?: "Puck",
            sp2Name = prefs.getString("sp2Name", "Jane") ?: "Jane",
            sp2Voice = prefs.getString("sp2Voice", "Kore") ?: "Kore"
        )
    }

    fun saveJobState(chunks: List<String>, done: Int, dataBytes: Long, rate: Int, config: AppConfig, fullText: String) {
        val meta = JSONObject().apply {
            put("done", done)
            put("total", chunks.size)
            put("dataBytes", dataBytes)
            put("rate", rate)
            put("chunkSize", config.chunkSize)
            put("pauseSec", config.pauseSec)
            put("silenceMs", config.silenceMs)
            put("model", config.resolvedModel())
            put("voice", config.voice)
            put("multi", config.multi)
        }
        getJobMetaFile().writeText(meta.toString())
        getJobTextFile().writeText(fullText)
    }

    fun updateJobProgress(done: Int, dataBytes: Long, rate: Int) {
        val metaFile = getJobMetaFile()
        if (metaFile.exists()) {
            val json = JSONObject(metaFile.readText())
            json.put("done", done)
            json.put("dataBytes", dataBytes)
            json.put("rate", rate)
            metaFile.writeText(json.toString())
        }
    }

    fun loadSavedJob(): SavedJobState? {
        val metaFile = getJobMetaFile()
        val textFile = getJobTextFile()
        if (!metaFile.exists() || !textFile.exists()) return null

        return try {
            val json = JSONObject(metaFile.readText())
            val fullText = textFile.readText()
            val config = loadConfig()
            val chunks = TextProcessor.splitChunks(fullText, config.chunkSize, config.multi)

            SavedJobState(
                chunks = chunks,
                done = json.optInt("done", 0),
                dataBytes = json.optLong("dataBytes", 0L),
                rate = json.optInt("rate", 24000),
                config = config,
                text = fullText
            )
        } catch (_: Exception) {
            null
        }
    }

    fun hasUnfinishedJob(): Boolean = getJobMetaFile().exists()

    fun clearSavedJob() {
        getJobMetaFile().delete()
        getJobTextFile().delete()
    }

    fun archiveToHistory(workFile: File): File {
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val historyFile = File(historyDir, "Gemini_\$timestamp.wav")
        if (!workFile.renameTo(historyFile)) {
            workFile.copyTo(historyFile, overwrite = true)
            workFile.delete()
        }
        return historyFile
    }

    fun getHistoryFiles(): List<File> {
        val files = historyDir.listFiles { f ->
            val name = f.name.lowercase()
            name.endsWith(".wav") || name.endsWith(".m4a")
        } ?: emptyArray()
        return files.sortedByDescending { it.lastModified() }
    }
}
`
  },
  {
    name: "MainActivity.kt",
    path: "app/src/main/kotlin/com/gemini/tts/ui/MainActivity.kt",
    package: "com.gemini.tts.ui",
    language: "kotlin",
    description: "Main accessible UI dashboard with TalkBack announcements, real-time character & duration counter, clipboard auto-paste, audio controls, and background service binding.",
    luaMapping: "UI.dashboard, updateCounter, playTone, setStatus, announce",
    code: `package com.gemini.tts.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.media.AudioManager
import android.media.ToneGenerator
import android.net.Uri
import android.os.Bundle
import android.os.IBinder
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import com.gemini.tts.R
import com.gemini.tts.audio.AudioPlayerController
import com.gemini.tts.audio.PlaybackState
import com.gemini.tts.core.TextProcessor
import com.gemini.tts.data.AppConfig
import com.gemini.tts.data.TtsRepository
import com.gemini.tts.service.TtsForegroundService
import java.io.File

/**
 * MainActivity delivers an accessibility-first Android dashboard designed for TalkBack screen readers,
 * matching every feature of the original Gemini TTS Converter.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var repository: TtsRepository
    private lateinit var playerController: AudioPlayerController
    private var config: AppConfig = AppConfig()

    // Foreground service connection
    private var ttsService: TtsForegroundService? = null
    private var isBound: Boolean = false

    // UI View references
    private lateinit var tvStatus: TextView
    private lateinit var etInput: EditText
    private lateinit var tvCounter: TextView
    private lateinit var etStyle: EditText
    private lateinit var btnGenerate: Button
    private lateinit var btnCancel: Button
    private lateinit var btnResume: Button
    private lateinit var btnPlay: Button
    private lateinit var btnPause: Button
    private lateinit var btnStop: Button
    private lateinit var btnSpeed: Button

    private var currentAudioPath: String? = null

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            val localBinder = binder as TtsForegroundService.LocalBinder
            ttsService = localBinder.getService()
            isBound = true

            ttsService?.onProgressUpdate = { done, total, message, isFinished ->
                runOnUiThread {
                    setStatus(message, speak = (done == 1 || done % 5 == 0 || isFinished))
                    refreshButtonStates()
                    if (isFinished) {
                        playCompletionTone()
                        currentAudioPath = repository.getHistoryFiles().firstOrNull()?.absolutePath
                        if (config.autoPlay && currentAudioPath != null) {
                            playerController.play(currentAudioPath)
                        }
                    }
                }
            }
            refreshButtonStates()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            ttsService = null
            isBound = false
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        repository = TtsRepository(this)
        config = repository.loadConfig()
        playerController = AudioPlayerController(this)

        initViews()
        setupListeners()
        bindTtsService()

        // Auto-paste clipboard if enabled
        if (config.clipboardPrefill) {
            val clipboardText = getClipboardText()
            if (clipboardText.isNotEmpty() && clipboardText != "settings") {
                etInput.setText(clipboardText)
            }
        }

        updateCharacterCounter()
        checkUnfinishedJob()
    }

    private fun initViews() {
        tvStatus = findViewById(R.id.tv_status)
        etInput = findViewById(R.id.et_input)
        tvCounter = findViewById(R.id.tv_counter)
        etStyle = findViewById(R.id.et_style)
        btnGenerate = findViewById(R.id.btn_generate)
        btnCancel = findViewById(R.id.btn_cancel)
        btnResume = findViewById(R.id.btn_resume)
        btnPlay = findViewById(R.id.btn_play)
        btnPause = findViewById(R.id.btn_pause)
        btnStop = findViewById(R.id.btn_stop)
        btnSpeed = findViewById(R.id.btn_speed)

        etStyle.setText(config.style)
    }

    private fun setupListeners() {
        etInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                updateCharacterCounter()
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        findViewById<Button>(R.id.btn_clear).setOnClickListener {
            etInput.setText("")
            setStatus("Text cleared.", speak = true)
        }

        findViewById<Button>(R.id.btn_paste).setOnClickListener {
            val text = getClipboardText()
            etInput.setText(text)
            setStatus("Pasted clipboard text.", speak = true)
        }

        findViewById<Button>(R.id.btn_settings).setOnClickListener {
            if (ttsService?.isRunning == true) {
                Toast.makeText(this, "Wait for job to finish or cancel first.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            startActivity(Intent(this, SettingsActivity::class.java))
        }

        findViewById<Button>(R.id.btn_history).setOnClickListener {
            startActivity(Intent(this, HistoryActivity::class.java))
        }

        btnGenerate.setOnClickListener {
            val text = etInput.text.toString()
            if (text.isBlank()) {
                Toast.makeText(this, "Please enter some text.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            config = repository.loadConfig().copy(style = etStyle.text.toString().trim())
            repository.saveConfig(config)

            if (repository.hasUnfinishedJob()) {
                AlertDialog.Builder(this)
                    .setTitle("Unfinished job found")
                    .setMessage("An unfinished job is saved. Starting a new one will discard it.")
                    .setPositiveButton("Discard & Start New") { _, _ -> startGeneration(text) }
                    .setNegativeButton("Cancel", null)
                    .show()
            } else {
                startGeneration(text)
            }
        }

        btnCancel.setOnClickListener {
            ttsService?.cancelJob()
            refreshButtonStates()
        }

        btnResume.setOnClickListener {
            ttsService?.resumeJob()
            refreshButtonStates()
        }

        btnPlay.setOnClickListener {
            playerController.play(currentAudioPath)
        }

        btnPause.setOnClickListener {
            playerController.togglePause()
            btnPause.text = if (playerController.isPaused) "Resume Playback" else "Pause"
        }

        btnStop.setOnClickListener {
            playerController.stop()
            btnPause.text = "Pause"
        }

        findViewById<Button>(R.id.btn_seek_back).setOnClickListener {
            playerController.seekBy(-10000)
        }

        findViewById<Button>(R.id.btn_seek_fwd).setOnClickListener {
            playerController.seekBy(10000)
        }

        btnSpeed.setOnClickListener {
            val newSpeed = playerController.cycleSpeed()
            btnSpeed.text = String.format(java.util.Locale.US, "Speed: %.2fx", newSpeed)
        }

        findViewById<Button>(R.id.btn_save).setOnClickListener {
            currentAudioPath?.let { path ->
                SaveAudioDialog(this, path).show()
            } ?: Toast.makeText(this, "No audio generated yet.", Toast.LENGTH_SHORT).show()
        }

        findViewById<Button>(R.id.btn_share).setOnClickListener {
            shareCurrentAudio()
        }

        findViewById<Button>(R.id.btn_help).setOnClickListener {
            showDeveloperInfo()
        }
    }

    private fun startGeneration(text: String) {
        val serviceIntent = Intent(this, TtsForegroundService::class.java)
        startService(serviceIntent)
        ttsService?.startJob(text, config)
        refreshButtonStates()
    }

    private fun updateCharacterCounter() {
        val text = etInput.text.toString()
        val count = TextProcessor.ulen(text)
        val chunkSize = config.chunkSize

        if (count == 0) {
            tvCounter.text = "Characters: 0."
            return
        }

        val chunks = Math.ceil(count.toDouble() / chunkSize).toInt()
        val durationEst = TextProcessor.fmtDuration(count / 14.0) // approx 14 chars per sec
        val msg = "Characters: \${TextProcessor.commas(count.toLong())}. About \$chunks chunks of up to \$chunkSize chars. Roughly \$durationEst of audio."
        tvCounter.text = msg
    }

    private fun checkUnfinishedJob() {
        if (repository.hasUnfinishedJob()) {
            val job = repository.loadSavedJob()
            if (job != null) {
                setStatus("Unfinished job found: \${job.done} of \${job.chunks.size} chunks done. Use Resume to continue.", speak = false)
            }
        }
    }

    private fun setStatus(msg: String, speak: Boolean) {
        tvStatus.text = msg
        if (speak) {
            tvStatus.announceForAccessibility(msg)
        }
    }

    private fun refreshButtonStates() {
        val isRunning = ttsService?.isRunning == true
        btnGenerate.isEnabled = !isRunning
        btnCancel.isEnabled = isRunning
        btnResume.isEnabled = !isRunning && repository.hasUnfinishedJob()
    }

    private fun playCompletionTone() {
        try {
            val tone = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100)
            tone.startTone(ToneGenerator.TONE_PROP_ACK, 400)
        } catch (_: Exception) {}
    }

    private fun shareCurrentAudio() {
        val path = currentAudioPath ?: return
        val file = File(path)
        if (!file.exists()) return

        val uri = FileProvider.getUriForFile(this, "\${packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = if (path.endsWith(".m4a", ignoreCase = true)) "audio/mp4" else "audio/wav"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startActivity(Intent.createChooser(intent, "Share Audio via"))
    }

    private fun showDeveloperInfo() {
        AlertDialog.Builder(this)
            .setTitle("Developer Info")
            .setMessage("Developed by: Moutter Rasool\\n\\nDedicated to empowering the visually impaired with accessible AI tools.")
            .setPositiveButton("WhatsApp") { _, _ ->
                val uri = Uri.parse("https://api.whatsapp.com/send?phone=923457812726")
                startActivity(Intent(Intent.ACTION_VIEW, uri))
            }
            .setNegativeButton("Close", null)
            .show()
    }

    private fun getClipboardText(): String {
        val cm = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
        val clip = cm?.primaryClip
        if (clip != null && clip.itemCount > 0) {
            return clip.getItemAt(0).text?.toString() ?: ""
        }
        return ""
    }

    private fun bindTtsService() {
        val intent = Intent(this, TtsForegroundService::class.java)
        bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
    }

    override fun onDestroy() {
        super.onDestroy()
        playerController.release()
        if (isBound) {
            unbindService(serviceConnection)
            isBound = false
        }
    }
}
`
  }
];
