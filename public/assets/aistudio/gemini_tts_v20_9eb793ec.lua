require "import"
import "android.app.*"
import "android.os.*"
import "android.widget.*"
import "android.view.*"
import "android.graphics.Typeface"
import "android.graphics.Color"
import "android.content.Context"
import "android.content.Intent"
import "android.net.Uri"
import "android.media.MediaPlayer"
import "android.media.MediaCodec"
pcall(function() import "android.media.MediaCodec$BufferInfo" end)
import "android.media.MediaFormat"
import "android.media.MediaMuxer"
import "android.media.ToneGenerator"
import "android.media.AudioManager"
import "android.util.Base64"
import "android.text.TextWatcher"
import "android.text.method.PasswordTransformationMethod"
import "android.text.method.HideReturnsTransformationMethod"
import "java.io.File"
import "java.io.FileOutputStream"
import "java.io.FileInputStream"
import "java.io.RandomAccessFile"
import "java.nio.ByteBuffer"
import "java.lang.Runnable"
import "cjson"

-- ==========================================================
-- 0. SYSTEM POLICIES
-- ==========================================================
pcall(function()
  local builder = StrictMode.VmPolicy.Builder()
  StrictMode.setVmPolicy(builder.build())
end)

-- ==========================================================
-- 1. PURE LOGIC (no Android calls, tested outside the phone)
-- ==========================================================
-- BEGIN PURE
local P = {}

function P.trim(s)
  return (s:gsub("^%s+", ""):gsub("%s+$", ""))
end

-- number of characters (UTF-8 aware)
function P.ulen(s)
  local _, n = s:gsub("[^\128-\191]", "")
  return n
end

-- byte index so that s:sub(1, idx) holds exactly n characters
function P.byteIndexAfterChars(s, n)
  local count, i, len = 0, 1, #s
  while i <= len do
    local b = s:byte(i)
    if b < 128 or b >= 192 then
      if count == n then return i - 1 end
      count = count + 1
    end
    i = i + 1
  end
  return len
end

function P.hasContent(s)
  return s:find("[%w\128-\255]") ~= nil
end

function P.commas(n)
  local s = tostring(math.floor(n))
  local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
  out = out:gsub("^,", "")
  return out
end

function P.fmtDuration(sec)
  sec = math.floor(sec + 0.5)
  local h = math.floor(sec / 3600)
  local m = math.floor((sec % 3600) / 60)
  local s = sec % 60
  if h > 0 then return string.format("%d hours %d minutes", h, m) end
  if m > 0 then return string.format("%d minutes %d seconds", m, s) end
  return string.format("%d seconds", s)
end

-- optional gentle cleanup: links, markdown marks, lone page numbers, blank lines
function P.cleanText(s)
  s = s:gsub("\r\n", "\n"):gsub("\r", "\n")
  s = s:gsub("https?://%S+", "")
  s = s:gsub("www%.%S+", "")
  local out = {}
  for line in (s .. "\n"):gmatch("(.-)\n") do
    line = line:gsub("^%s*#+%s*", "")
    line = line:gsub("^%s*>+%s?", "")
    line = line:gsub("[%*`~]", "")
    line = line:gsub("__+", "")
    line = line:gsub("[ \t]+", " ")
    line = P.trim(line)
    if not line:match("^%d+$") then
      out[#out + 1] = line
    end
  end
  local r = table.concat(out, "\n")
  r = r:gsub("\n\n\n+", "\n\n")
  return P.trim(r)
end

-- split a paragraph into sentences (. ! ? and Urdu/Arabic full stop and question mark)
function P.splitSentences(p)
  local out = {}
  local startI, i, len = 1, 1, #p
  while i <= len do
    local b = p:byte(i)
    local endLen = 0
    if b == 46 or b == 33 or b == 63 then
      endLen = 1
    elseif b == 0xDB and p:byte(i + 1) == 0x94 then
      endLen = 2
    elseif b == 0xD8 and p:byte(i + 1) == 0x9F then
      endLen = 2
    end
    if endLen > 0 then
      local j = i + endLen
      while true do
        local nb = p:byte(j)
        if nb == 46 or nb == 33 or nb == 63 or nb == 34 or nb == 39 or nb == 41 then
          j = j + 1
        else
          break
        end
      end
      local nxt = p:byte(j)
      if nxt == nil or nxt == 32 or nxt == 9 or nxt == 10 then
        local piece = P.trim(p:sub(startI, j - 1))
        if piece ~= "" then out[#out + 1] = piece end
        startI = j
      end
      i = j
    else
      i = i + 1
    end
  end
  if startI <= len then
    local piece = P.trim(p:sub(startI))
    if piece ~= "" then out[#out + 1] = piece end
  end
  return out
end

function P.splitWords(s, eff)
  local out, cur = {}, ""
  for w in s:gmatch("%S+") do
    local wl = P.ulen(w)
    if wl > eff then
      if cur ~= "" then out[#out + 1] = cur; cur = "" end
      local rest = w
      while P.ulen(rest) > eff do
        local idx = P.byteIndexAfterChars(rest, eff)
        out[#out + 1] = rest:sub(1, idx)
        rest = rest:sub(idx + 1)
      end
      cur = rest
    elseif cur ~= "" and P.ulen(cur) + 1 + wl <= eff then
      cur = cur .. " " .. w
    else
      if cur ~= "" then out[#out + 1] = cur end
      cur = w
    end
  end
  if cur ~= "" then out[#out + 1] = cur end
  return out
end

-- a paragraph longer than the limit: sentences first, then words, then hard cut
function P.splitLong(p, maxChars, carry)
  local prefix = nil
  local eff = maxChars
  if carry then
    prefix = p:match("^([^:\n]+):%s")
    if prefix and P.ulen(prefix) <= 40 then
      eff = maxChars - (P.ulen(prefix) + 2)
      if eff < 50 then eff = 50 end
    else
      prefix = nil
    end
  end
  local sentences = P.splitSentences(p)
  local pieces = {}
  local cur = ""
  for _, s in ipairs(sentences) do
    local sl = P.ulen(s)
    if sl > eff then
      if cur ~= "" then pieces[#pieces + 1] = cur; cur = "" end
      local words = P.splitWords(s, eff)
      for i = 1, #words - 1 do pieces[#pieces + 1] = words[i] end
      cur = words[#words] or ""
    elseif cur ~= "" and P.ulen(cur) + 1 + sl <= eff then
      cur = cur .. " " .. s
    else
      if cur ~= "" then pieces[#pieces + 1] = cur end
      cur = s
    end
  end
  if cur ~= "" then pieces[#pieces + 1] = cur end
  if prefix then
    for i = 2, #pieces do pieces[i] = prefix .. ": " .. pieces[i] end
  end
  return pieces
end

-- main chunker: prefers paragraph ends, then sentence ends, then word ends
function P.splitChunks(text, maxChars, carry)
  text = text:gsub("\r\n", "\n"):gsub("\r", "\n")
  maxChars = math.max(50, math.floor(maxChars or 1800))
  local chunks = {}
  local cur = ""
  local function flush()
    local c = P.trim(cur)
    if c ~= "" and P.hasContent(c) then chunks[#chunks + 1] = c end
    cur = ""
  end
  for para in (text .. "\n"):gmatch("(.-)\n") do
    local p = P.trim(para)
    if p ~= "" then
      local pl = P.ulen(p)
      if pl > maxChars then
        flush()
        local pieces = P.splitLong(p, maxChars, carry)
        for i = 1, #pieces - 1 do chunks[#chunks + 1] = pieces[i] end
        cur = pieces[#pieces] or ""
      elseif cur ~= "" and P.ulen(cur) + 1 + pl <= maxChars then
        cur = cur .. "\n" .. p
      else
        flush()
        cur = p
      end
    end
  end
  flush()
  return chunks
end

function P.parseKeys(raw)
  local out, seen = {}, {}
  for tok in (raw or ""):gmatch("[^%s,;]+") do
    if #tok >= 15 and not seen[tok] then
      seen[tok] = true
      out[#out + 1] = tok
    end
  end
  return out
end

function P.keyTail(k)
  return k:sub(-4)
end

function P.le32(v)
  v = math.floor(v)
  return { v % 256, math.floor(v / 256) % 256, math.floor(v / 65536) % 256, math.floor(v / 16777216) % 256 }
end

function P.wavHeader(dataLen, rate, channels)
  channels = channels or 1
  local byteRate = rate * channels * 2
  local t = { 82, 73, 70, 70 }
  local function add(bytes)
    for i = 1, #bytes do t[#t + 1] = bytes[i] end
  end
  add(P.le32(dataLen + 36))
  add({ 87, 65, 86, 69, 102, 109, 116, 32, 16, 0, 0, 0, 1, 0, channels, 0 })
  add(P.le32(rate))
  add(P.le32(byteRate))
  add({ channels * 2, 0, 16, 0, 100, 97, 116, 97 })
  add(P.le32(dataLen))
  return t
end

function P.parseRate(mime)
  local r = tonumber(mime and tostring(mime):match("rate=(%d+)"))
  if r and r >= 8000 and r <= 48000 then return r end
  return 24000
end

-- Gemini 3.8 and newer use the new request format
function P.isNewSchema(model)
  local maj, min = tostring(model or ""):match("gemini%-(%d+)%.(%d+)")
  maj, min = tonumber(maj), tonumber(min)
  if not maj then return false end
  return maj > 3 or (maj == 3 and min >= 8)
end

function P.shouldStripWav(mime, model)
  if mime then return tostring(mime):lower():find("wav", 1, true) ~= nil end
  return P.isNewSchema(model)
end

function P.voiceName(label)
  return (tostring(label or ""):match("^(%S+)")) or "Kore"
end

function P.langEnglish(label)
  if not label or label == "" or label == "Auto Detect" then return nil end
  return label:match("^(.-)%s*%(") or label
end

function P.matchSpeaker(line, cfg)
  local ll = line:lower()
  local names = { cfg.sp1Name, cfg.sp2Name }
  for i = 1, 2 do
    local n = names[i]
    if n and n ~= "" then
      local tag = n:lower() .. ":"
      if ll:sub(1, #tag) == tag then
        return n, P.trim(line:sub(#tag + 1))
      end
    end
  end
  return nil, line
end

function P.buildRequest(cfg, text)
  local newS = P.isNewSchema(cfg.model)
  local style = P.trim(cfg.style or "")
  local gen = { responseModalities = { "AUDIO" } }
  local contents
  local multiCfg = nil
  if cfg.multi then
    multiCfg = { multiSpeakerVoiceConfig = { speakerVoiceConfigs = {
      { speaker = cfg.sp1Name, voiceConfig = { prebuiltVoiceConfig = { voiceName = cfg.sp1Voice } } },
      { speaker = cfg.sp2Name, voiceConfig = { prebuiltVoiceConfig = { voiceName = cfg.sp2Voice } } }
    } } }
  end
  if newS then
    if cfg.multi then
      local parts = {}
      local last = cfg.sp1Name
      for line in (text .. "\n"):gmatch("(.-)\n") do
        line = P.trim(line)
        if line ~= "" then
          local spk, rest = P.matchSpeaker(line, cfg)
          if spk then last = spk; line = rest end
          if line ~= "" then
            local meta = { speaker = last }
            if style ~= "" then meta.style = style end
            parts[#parts + 1] = { text = line, speech_metadata = meta }
          end
        end
      end
      if #parts == 0 then
        parts[1] = { text = text, speech_metadata = { speaker = cfg.sp1Name } }
      end
      contents = { { role = "user", parts = parts } }
      gen.speechConfig = multiCfg
    else
      local part = { text = text }
      if style ~= "" then part.speech_metadata = { style = style } end
      contents = { { role = "user", parts = { part } } }
      gen.speechConfig = { voiceConfig = { voice = cfg.voice } }
    end
  else
    local hints = {}
    local ln = P.langEnglish(cfg.lang)
    if ln then hints[#hints + 1] = "in " .. ln end
    if style ~= "" then hints[#hints + 1] = style end
    local prompt
    if cfg.multi then
      local extra = ""
      if #hints > 0 then extra = " " .. table.concat(hints, ", ") end
      prompt = "TTS the following conversation between " .. cfg.sp1Name .. " and " .. cfg.sp2Name .. extra .. ":\n" .. text
      gen.speechConfig = multiCfg
    else
      if #hints > 0 then
        prompt = "Say " .. table.concat(hints, ", ") .. ":\n" .. text
      else
        prompt = text
      end
      gen.speechConfig = { voiceConfig = { prebuiltVoiceConfig = { voiceName = cfg.voice } } }
    end
    contents = { { parts = { { text = prompt } } } }
  end
  return { contents = contents, generationConfig = gen }
end

local function tbl(x)
  if type(x) == "table" then return x end
  return nil
end

-- returns base64 data, mime  OR  nil, reason
function P.extractAudio(r)
  r = tbl(r)
  if not r then return nil, "badjson" end
  local cands = tbl(r.candidates)
  local c = cands and tbl(cands[1])
  if not c then
    local pf = tbl(r.promptFeedback)
    local br = pf and pf.blockReason
    if br then return nil, "blocked:" .. tostring(br) end
    return nil, "nocandidate"
  end
  local content = tbl(c.content)
  local parts = content and tbl(content.parts)
  if parts then
    for i = 1, #parts do
      local p = tbl(parts[i])
      local inl = p and tbl(p.inlineData)
      if inl and type(inl.data) == "string" and inl.data ~= "" then
        return inl.data, inl.mimeType
      end
    end
  end
  return nil, "noaudio:" .. tostring(c.finishReason or "unknown")
end

function P.classifyResponse(code, body)
  body = tostring(body or "")
  code = tonumber(code) or -1
  local msg = body:match('"message"%s*:%s*"(.-)"')
  if code == 200 then return "ok", {} end
  if code <= 0 then return "network", { msg = body } end
  if code == 429 then
    local wait = tonumber(body:match('retryDelay"%s*:%s*"(%d+)'))
    local lb = body:lower()
    local kind = "rate_minute"
    if lb:find("perday", 1, true) or lb:find("per day", 1, true) then kind = "rate_day" end
    return kind, { wait = wait and (wait + 2) or 40, msg = msg }
  end
  if code == 401 or code == 403 then return "bad_key", { msg = msg } end
  if code == 400 then
    if body:find("API_KEY_INVALID", 1, true) or body:find("API key not valid", 1, true)
       or body:find("API key expired", 1, true) then
      return "bad_key", { msg = msg }
    end
    return "bad_request", { msg = msg }
  end
  if code == 404 then return "bad_model", { msg = msg } end
  if code >= 500 then return "server", { msg = msg } end
  return "other", { msg = msg }
end

-- choose a usable key; returns index, 0  or  nil, secondsToWait  or  nil, nil
function P.pickKey(keys, start, now)
  local n = #keys
  if n == 0 then return nil, nil end
  local minCool = nil
  for off = 0, n - 1 do
    local i = ((start - 1 + off) % n) + 1
    local k = keys[i]
    if not k.dead then
      if (k.cool or 0) <= now then return i, 0 end
      if not minCool or k.cool < minCool then minCool = k.cool end
    end
  end
  if minCool then return nil, minCool - now end
  return nil, nil
end
-- END PURE

-- ==========================================================
-- 2. CONFIGURATION
-- ==========================================================
local BASE_DIR = "/sdcard/Jieshuo/"
local CONFIG_FILE = BASE_DIR .. "gemini_v19_config.json"
local WORK_DIR = BASE_DIR .. "gemini_tts_work/"
local HIST_DIR = BASE_DIR .. "gemini_tts_history/"
local LOG_FILE = BASE_DIR .. "gemini_tts_log.txt"
local JOB_META = WORK_DIR .. "job.json"
local JOB_TEXT = WORK_DIR .. "job_text.txt"
local WORK_WAV = WORK_DIR .. "current.wav"
local PREVIEW_WAV = WORK_DIR .. "preview.wav"
local DOWNLOAD_DIR = "/sdcard/Download/"
local FALLBACK_DIR = BASE_DIR
local API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/"
local REQ_TIMEOUT_MS = 180000

local MODEL_PRESETS = {
  { label = "Gemini 3.8 Flash TTS (best quality)", id = "gemini-3.8-flash-tts" },
  { label = "Gemini 3.8 Flash-Lite TTS (fast)", id = "gemini-3.8-flash-lite-tts" },
  { label = "Gemini 3.1 Flash TTS Preview", id = "gemini-3.1-flash-tts-preview" },
  { label = "Gemini 2.5 Pro Preview TTS", id = "gemini-2.5-pro-preview-tts" },
  { label = "Gemini 2.5 Flash Preview TTS (old)", id = "gemini-2.5-flash-preview-tts" }
}

local voices = {
  "Zephyr (Bright)", "Puck (Upbeat)", "Charon (Informative)", "Kore (Firm)", "Fenrir (Excitable)",
  "Leda (Youthful)", "Orus (Firm)", "Aoede (Breezy)", "Callirrhoe (Easy-going)", "Autonoe (Bright)",
  "Enceladus (Breathy)", "Iapetus (Clear)", "Umbriel (Easy-going)", "Algieba (Smooth)", "Despina (Smooth)",
  "Erinome (Clear)", "Algenib (Gravelly)", "Rasalgethi (Informative)", "Laomedeia (Upbeat)", "Achernar (Soft)",
  "Alnilam (Firm)", "Schedar (Even)", "Gacrux (Mature)", "Pulcherrima (Forward)", "Achird (Friendly)",
  "Zubenelgenubi (Casual)", "Vindemiatrix (Gentle)", "Sadachbia (Lively)", "Sadaltager (Knowledgeable)", "Sulafat (Warm)"
}

local languages = {
  "Auto Detect", "Urdu (اردو)", "English", "Arabic (العربية)", "Hindi (हिन्दी)", "Punjabi (پنجابی)",
  "Sindhi (سنڌي)", "Pashto (پښتو)", "Bengali (বাংলা)", "Persian (فارسی)", "Chinese (中文)",
  "Spanish (Español)", "French (Français)", "German (Deutsch)", "Russian (Русский)",
  "Portuguese (Português)", "Japanese (日本語)", "Korean (한국어)", "Turkish (Türkçe)",
  "Indonesian (Bahasa Indonesia)", "Italian (Italiano)", "Dutch (Nederlands)", "Polish (Polski)",
  "Tamil (தமிழ்)", "Telugu (తెలుగు)", "Marathi (मराठी)", "Gujarati (ગુજરાતી)"
}

local formats = { "WAV", "M4A" }

local config = {
  apiKeys = "",
  language = "Auto Detect",
  voice = "Kore",
  model = MODEL_PRESETS[1].id,
  customModel = "",
  style = "",
  chunkSize = 1800,
  pauseSec = 2,
  silenceMs = 250,
  cleanText = false,
  clipboardPrefill = true,
  autoSave = false,
  autoSaveFormat = "WAV",
  autoPlay = true,
  multi = false,
  sp1Name = "Joe", sp1Voice = "Puck",
  sp2Name = "Jane", sp2Voice = "Kore"
}

-- runtime state
local S = {
  currentAudio = nil, running = false, token = 0, job = nil, wake = nil,
  paused = false, speed = 1.0, lastText = "", status = "Ready."
}
local SPEEDS = { 0.75, 1.0, 1.25, 1.5, 2.0 }
local mp = MediaPlayer()
local dashboardDlg, settingsDlg, saveDlg
local UI = {}
local E = {}

-- ==========================================================
-- 3. UTILITIES
-- ==========================================================
local function logLine(msg)
  pcall(function()
    local f = File(LOG_FILE)
    local parent = f.getParentFile()
    if parent and not parent.exists() then parent.mkdirs() end
    if f.exists() and f.length() > 400000 then f.delete() end
    local fos = FileOutputStream(f, true)
    fos.write(String(os.date("%Y-%m-%d %H:%M:%S") .. "  " .. tostring(msg) .. "\n").getBytes("UTF-8"))
    fos.close()
  end)
end

local function showToast(msg)
  pcall(function()
    Toast.makeText(service, String(tostring(msg)), Toast.LENGTH_SHORT).show()
  end)
end

local function announce(msg)
  pcall(function() v_status.announceForAccessibility(String(tostring(msg))) end)
end

local function setStatus(msg, speak)
  S.status = msg
  pcall(function() v_status.setText(String(msg)) end)
  if speak then announce(msg) end
  logLine("STATUS: " .. msg)
end

local handler = nil
pcall(function() handler = Handler(Looper.getMainLooper()) end)

local function later(ms, fn)
  local wrapped = function()
    local ok, err = pcall(fn)
    if not ok then logLine("ERROR in timer: " .. tostring(err)) end
  end
  local ok = pcall(function() handler.postDelayed(Runnable({ run = wrapped }), ms) end)
  if not ok then
    pcall(function() task(ms, wrapped) end)
  end
end

local function getClipboardText()
  local success, text = pcall(function()
    local cm = service.getSystemService(Context.CLIPBOARD_SERVICE)
    if cm and cm.hasPrimaryClip() then
      local clipData = cm.getPrimaryClip()
      if clipData and clipData.getItemCount() > 0 then
        return clipData.getItemAt(0).getText().toString()
      end
    end
    return ""
  end)
  if success and text then return tostring(text) else return "" end
end

local function openWhatsApp()
  local msg = "I'm from Geminate TTS Converter and I need your help."
  local url = "https://api.whatsapp.com/send?phone=923457812726&text=" .. Uri.encode(msg)
  local intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
  intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
  service.startActivity(intent)
end

local function getFreeKey()
  local url = "https://aistudio.google.com/app/apikey"
  local intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
  intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
  service.startActivity(intent)
end

local function cleanFilename(name)
  if not name then return "audio" end
  local clean = name:gsub("[\\/:*?\"<>|]", "")
  clean = clean:gsub("%c", "")
  clean = clean:gsub("^%s*(.-)%s*$", "%1")
  if clean == "" then clean = "audio" end
  return clean
end

local function readText(path)
  local f = File(path)
  if not f.exists() then return nil end
  local size = math.floor(f.length())
  local fis = FileInputStream(f)
  local buf = byte[size]
  local total = 0
  while total < size do
    local n = fis.read(buf, total, size - total)
    if n < 0 then break end
    total = total + n
  end
  fis.close()
  local s = tostring(String(buf, "UTF-8"))
  s = s:gsub("^\239\187\191", "")
  return s
end

local function writeText(path, str)
  local f = File(path)
  local parent = f.getParentFile()
  if parent and not parent.exists() then parent.mkdirs() end
  local fos = FileOutputStream(f)
  fos.write(String(str).getBytes("UTF-8"))
  fos.close()
end

local function copyFile(srcPath, destPath)
  local fis, fos
  local ok, err = pcall(function()
    local dest = File(destPath)
    local parent = dest.getParentFile()
    if parent and not parent.exists() then parent.mkdirs() end
    fis = FileInputStream(File(srcPath))
    fos = FileOutputStream(dest)
    local buffer = byte[16384]
    while true do
      local length = fis.read(buffer)
      if length <= 0 then break end
      fos.write(buffer, 0, length)
    end
  end)
  pcall(function() if fis then fis.close() end end)
  pcall(function() if fos then fos.close() end end)
  return ok, err
end

local function listFiles(dir)
  local out = {}
  pcall(function()
    local arr = File(dir).listFiles()
    if not arr then return end
    local t = nil
    if luajava and luajava.astable then t = luajava.astable(arr) end
    if t then
      for i = 1, #t do out[#out + 1] = t[i] end
    else
      for i = 0, #arr - 1 do out[#out + 1] = arr[i] end
    end
  end)
  return out
end

local function fileSizeText(f)
  local mb = f.length() / 1048576
  if mb >= 1 then return string.format("%.1f MB", mb) end
  return string.format("%d KB", math.floor(f.length() / 1024))
end

local function clamp(v, lo, hi, def)
  v = tonumber(v)
  if not v then return def end
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

local function indexOfVoice(name)
  for i = 1, #voices do
    if P.voiceName(voices[i]) == name then return i end
  end
  return 1
end

local function resolvedModel()
  local c = P.trim(config.customModel or "")
  if c ~= "" then return c end
  return config.model
end

-- ==========================================================
-- 4. DATA PERSISTENCE
-- ==========================================================
local function saveConfig()
  local ok, err = pcall(function() writeText(CONFIG_FILE, cjson.encode(config)) end)
  if not ok then logLine("saveConfig failed: " .. tostring(err)) end
end

local function loadConfig()
  local ok, err = pcall(function()
    local str = readText(CONFIG_FILE)
    if not str or #str == 0 then return end
    local success, saved = pcall(cjson.decode, str)
    if not (success and type(saved) == "table") then return end
    -- old versions stored one key in customApiKey
    if type(saved.apiKeys) == "string" then config.apiKeys = saved.apiKeys
    elseif type(saved.customApiKey) == "string" then config.apiKeys = saved.customApiKey end
    if type(saved.language) == "string" then config.language = saved.language end
    if type(saved.voice) == "string" then config.voice = P.voiceName(saved.voice) end
    if type(saved.model) == "string" and saved.model ~= "" then config.model = saved.model end
    if type(saved.customModel) == "string" then config.customModel = saved.customModel end
    if type(saved.style) == "string" then config.style = saved.style end
    config.chunkSize = clamp(saved.chunkSize, 300, 3000, config.chunkSize)
    config.pauseSec = clamp(saved.pauseSec, 0, 60, config.pauseSec)
    config.silenceMs = clamp(saved.silenceMs, 0, 3000, config.silenceMs)
    local flags = { "cleanText", "clipboardPrefill", "autoSave", "autoPlay", "multi" }
    for _, k in ipairs(flags) do
      if type(saved[k]) == "boolean" then config[k] = saved[k] end
    end
    if saved.autoSaveFormat == "WAV" or saved.autoSaveFormat == "M4A" then config.autoSaveFormat = saved.autoSaveFormat end
    if type(saved.sp1Name) == "string" and saved.sp1Name ~= "" then config.sp1Name = saved.sp1Name end
    if type(saved.sp2Name) == "string" and saved.sp2Name ~= "" then config.sp2Name = saved.sp2Name end
    if type(saved.sp1Voice) == "string" then config.sp1Voice = P.voiceName(saved.sp1Voice) end
    if type(saved.sp2Voice) == "string" then config.sp2Voice = P.voiceName(saved.sp2Voice) end
  end)
  if not ok then logLine("loadConfig failed: " .. tostring(err)) end
end

-- ==========================================================
-- 5. AUDIO ENGINE: WAV FILES, PLAYBACK, SHARE
-- ==========================================================
local function writeHeader(raf, dataLen, rate)
  local h = P.wavHeader(dataLen, rate, 1)
  raf.seek(0)
  for i = 1, #h do raf.write(h[i]) end
end

local function createEmptyWav(path, rate)
  local f = File(path)
  local parent = f.getParentFile()
  if parent and not parent.exists() then parent.mkdirs() end
  local raf = RandomAccessFile(f, "rw")
  raf.setLength(0)
  writeHeader(raf, 0, rate)
  raf.close()
end

local silenceCache = {}
local function silenceBytes(rate, ms)
  local n = math.floor(rate * ms / 1000) * 2
  if n <= 0 then return nil end
  local key = n
  if not silenceCache[key] then silenceCache[key] = byte[n] end
  return silenceCache[key]
end

local function readWavRate(path)
  local rate = 24000
  pcall(function()
    local raf = RandomAccessFile(File(path), "r")
    raf.seek(24)
    local b1, b2, b3, b4 = raf.read(), raf.read(), raf.read(), raf.read()
    raf.close()
    local r = b1 + b2 * 256 + b3 * 65536 + b4 * 16777216
    if r >= 8000 and r <= 48000 then rate = r end
  end)
  return rate
end

local function refreshButtons()
  pcall(function()
    v_btn_generate.setEnabled(not S.running)
    v_btn_cancel.setEnabled(S.running)
    local hasJob = File(JOB_META).exists()
    v_btn_resume.setEnabled((not S.running) and hasJob)
  end)
end

local function applySpeed()
  pcall(function()
    if mp.isPlaying() then
      local pp = mp.getPlaybackParams()
      pp.setSpeed(S.speed)
      mp.setPlaybackParams(pp)
    end
  end)
end

local function playFile(path)
  if not path then showToast("No audio yet. Generate first.") return end
  local f = File(path)
  if not f.exists() then showToast("Audio file not found.") return end
  local ok, err = pcall(function()
    mp.reset()
    mp.setDataSource(path)
    mp.prepare()
    mp.start()
    S.paused = false
    pcall(function() v_btn_pause.setText("Pause") end)
    applySpeed()
    pcall(function()
      mp.setOnCompletionListener({ onCompletion = function() setStatus("Playback finished.", true) end })
    end)
  end)
  if ok then
    setStatus("Playing audio.", true)
  else
    setStatus("Could not play audio: " .. tostring(err), true)
  end
end

local function togglePause()
  pcall(function()
    if mp.isPlaying() then
      mp.pause()
      S.paused = true
      v_btn_pause.setText("Resume Playback")
      setStatus("Playback paused.", true)
    elseif S.paused then
      mp.start()
      S.paused = false
      v_btn_pause.setText("Pause")
      applySpeed()
      setStatus("Playback resumed.", true)
    else
      showToast("Nothing is playing.")
    end
  end)
end

local function stopAudio()
  pcall(function()
    if mp.isPlaying() or S.paused then
      mp.stop()
      S.paused = false
      pcall(function() v_btn_pause.setText("Pause") end)
      setStatus("Playback stopped.", true)
    end
  end)
end

local function seekBy(ms)
  pcall(function()
    local d = mp.getDuration()
    if not d or d <= 0 then return end
    local pos = mp.getCurrentPosition() + ms
    if pos < 0 then pos = 0 end
    if pos > d then pos = d end
    mp.seekTo(pos)
    setStatus("Position " .. P.fmtDuration(pos / 1000) .. " of " .. P.fmtDuration(d / 1000) .. ".", true)
  end)
end

local function cycleSpeed()
  local idx = 1
  for i = 1, #SPEEDS do
    if SPEEDS[i] == S.speed then idx = i end
  end
  idx = idx % #SPEEDS + 1
  S.speed = SPEEDS[idx]
  local label = string.format("Speed: %.2fx", S.speed)
  pcall(function() v_btn_speed.setText(label) end)
  applySpeed()
  setStatus("Playback " .. label, true)
end

local function shareFile(path)
  if not path then showToast("Generate first.") return end
  local f = File(path)
  if not f.exists() then showToast("Audio file not found.") return end
  local mime = "audio/wav"
  if path:lower():match("%.m4a$") then mime = "audio/mp4" end
  local success, err = pcall(function()
    local intent = Intent(Intent.ACTION_SEND)
    intent.setType(mime)
    intent.putExtra(Intent.EXTRA_STREAM, Uri.fromFile(f))
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    service.startActivity(Intent.createChooser(intent, "Share Audio via").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  end)
  if not success then
    logLine("share failed: " .. tostring(err))
    setStatus("Share failed. The file is at " .. path, true)
  end
end

local function shareLog()
  local f = File(LOG_FILE)
  if not f.exists() then showToast("No log yet.") return end
  pcall(function()
    local intent = Intent(Intent.ACTION_SEND)
    intent.setType("text/plain")
    intent.putExtra(Intent.EXTRA_STREAM, Uri.fromFile(f))
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    service.startActivity(Intent.createChooser(intent, "Share Error Log").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  end)
end

local function playTone()
  pcall(function()
    local tg = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100)
    tg.startTone(ToneGenerator.TONE_PROP_ACK, 400)
  end)
end

-- ==========================================================
-- 6. M4A ENCODER (WAV to AAC in M4A, runs in small steps)
-- ==========================================================
local function encodeM4A(srcPath, destPath, onProgress, onDone)
  local st = { bytesRead = 0, inputDone = false, muxStarted = false, lastPct = -1 }

  local function cleanup(deleteDest)
    pcall(function()
      if st.codec then
        pcall(function() st.codec.stop() end)
        st.codec.release()
      end
    end)
    pcall(function()
      if st.muxer then
        if st.muxStarted then pcall(function() st.muxer.stop() end) end
        st.muxer.release()
      end
    end)
    pcall(function() if st.fis then st.fis.close() end end)
    if deleteDest then pcall(function() File(destPath).delete() end) end
  end

  local ok, err = pcall(function()
    st.rate = readWavRate(srcPath)
    local sf = File(srcPath)
    st.total = math.max(1, sf.length() - 44)
    st.fis = FileInputStream(sf)
    st.fis.skip(44)
    st.readBuf = byte[8192]
    local parent = File(destPath).getParentFile()
    if parent and not parent.exists() then parent.mkdirs() end
    local fmt = MediaFormat.createAudioFormat("audio/mp4a-latm", st.rate, 1)
    fmt.setInteger("aac-profile", 2)
    fmt.setInteger("bitrate", 64000)
    fmt.setInteger("max-input-size", 16384)
    st.codec = MediaCodec.createEncoderByType("audio/mp4a-latm")
    st.codec.configure(fmt, nil, nil, 1)
    st.codec.start()
    st.muxer = MediaMuxer(destPath, 0)
    st.info = BufferInfo()
  end)
  if not ok then
    cleanup(true)
    onDone(false, tostring(err))
    return
  end

  local function pump()
    local ok2, err2 = pcall(function()
      local t0 = os.clock()
      while os.clock() - t0 < 0.04 do
        if not st.inputDone then
          local idx = st.codec.dequeueInputBuffer(0)
          if idx >= 0 then
            local buf = st.codec.getInputBuffer(idx)
            buf.clear()
            local want = math.min(buf.capacity(), 8192)
            want = want - (want % 2)
            local n = st.fis.read(st.readBuf, 0, want)
            local pts = math.floor(st.bytesRead / 2 / st.rate * 1000000)
            if n <= 0 then
              st.codec.queueInputBuffer(idx, 0, 0, pts, 4)
              st.inputDone = true
            else
              buf.put(st.readBuf, 0, n)
              st.codec.queueInputBuffer(idx, 0, n, pts, 0)
              st.bytesRead = st.bytesRead + n
            end
          end
        end
        local oidx = st.codec.dequeueOutputBuffer(st.info, 0)
        if oidx == -2 then
          st.track = st.muxer.addTrack(st.codec.getOutputFormat())
          st.muxer.start()
          st.muxStarted = true
        elseif oidx >= 0 then
          local ob = st.codec.getOutputBuffer(oidx)
          local flags = st.info.flags
          local size = st.info.size
          if math.floor(flags / 2) % 2 == 1 then size = 0 end
          if size > 0 and st.muxStarted then
            ob.position(st.info.offset)
            ob.limit(st.info.offset + size)
            st.muxer.writeSampleData(st.track, ob, st.info)
          end
          st.codec.releaseOutputBuffer(oidx, false)
          if math.floor(flags / 4) % 2 == 1 then
            st.finished = true
            return
          end
        end
      end
    end)
    if not ok2 then
      logLine("M4A encode error: " .. tostring(err2))
      cleanup(true)
      onDone(false, tostring(err2))
      return
    end
    if st.finished then
      cleanup(false)
      onDone(true, destPath)
      return
    end
    local pct = math.floor(st.bytesRead * 100 / st.total)
    if pct ~= st.lastPct and pct % 10 == 0 then
      st.lastPct = pct
      onProgress(pct)
    end
    later(1, pump)
  end
  later(1, pump)
end

-- ==========================================================
-- 7. SAVE LOGIC
-- ==========================================================
-- format: "WAV" or "M4A". done(success, message, path)
local function saveAudioTo(srcPath, baseName, format, onProgress, done)
  local name = cleanFilename(baseName):gsub("%.%w+$", "")
  local function saveWav(reasonPrefix)
    local dest = DOWNLOAD_DIR .. name .. ".wav"
    local ok = copyFile(srcPath, dest)
    if ok then done(true, (reasonPrefix or "") .. "Saved to " .. dest, dest) return end
    local fb = FALLBACK_DIR .. name .. ".wav"
    local ok2, err2 = copyFile(srcPath, fb)
    if ok2 then done(true, (reasonPrefix or "") .. "Saved to " .. fb, fb) else done(false, "Save failed: " .. tostring(err2)) end
  end
  if format ~= "M4A" then saveWav() return end
  local dest = DOWNLOAD_DIR .. name .. ".m4a"
  local function tryFallback(firstErr)
    local fb = FALLBACK_DIR .. name .. ".m4a"
    encodeM4A(srcPath, fb, onProgress, function(ok2, res2)
      if ok2 then
        done(true, "Saved to " .. fb, fb)
      else
        logLine("M4A failed twice: " .. tostring(firstErr) .. " / " .. tostring(res2))
        saveWav("M4A conversion is not available on this phone, so a WAV file was saved instead. ")
      end
    end)
  end
  encodeM4A(srcPath, dest, onProgress, function(ok, res)
    if ok then done(true, "Saved to " .. dest, dest) else tryFallback(res) end
  end)
end

local function showMessage(title, text)
  local dlg
  local layout = {
    LinearLayout, orientation = "vertical", padding = "20dp", backgroundColor = "#FFFFFF",
    { TextView, text = title, textSize = "20sp", textColor = "#1565C0", id = "v_msg_title", layout_marginBottom = "12dp" },
    { TextView, text = text, textSize = "16sp", textColor = "#333333", layout_marginBottom = "16dp" },
    { Button, text = "Close", layout_width = "fill", backgroundColor = "#333333", textColor = "#FFFFFF",
      onClick = function() dlg.dismiss() end }
  }
  dlg = LuaDialog(service)
  dlg.setView(loadlayout(layout))
  pcall(function() v_msg_title.setTypeface(Typeface.DEFAULT_BOLD) end)
  pcall(function() v_msg_title.setAccessibilityHeading(true) end)
  dlg.show()
  announce(title .. ". " .. text)
end

local function confirmDialog(title, text, yesLabel, onYes)
  local dlg
  local layout = {
    LinearLayout, orientation = "vertical", padding = "20dp", backgroundColor = "#FFFFFF",
    { TextView, text = title, textSize = "20sp", textColor = "#1565C0", id = "v_conf_title", layout_marginBottom = "12dp" },
    { TextView, text = text, textSize = "16sp", textColor = "#333333", layout_marginBottom = "16dp" },
    { Button, text = yesLabel, layout_width = "fill", backgroundColor = "#F44336", textColor = "#FFFFFF",
      onClick = function() dlg.dismiss() onYes() end },
    { Button, text = "Cancel", layout_width = "fill", backgroundColor = "#333333", textColor = "#FFFFFF", layout_marginTop = "8dp",
      onClick = function() dlg.dismiss() end }
  }
  dlg = LuaDialog(service)
  dlg.setView(loadlayout(layout))
  pcall(function() v_conf_title.setTypeface(Typeface.DEFAULT_BOLD) end)
  pcall(function() v_conf_title.setAccessibilityHeading(true) end)
  dlg.show()
end

local function showSaveDialog(srcPath)
  srcPath = srcPath or S.currentAudio
  if not srcPath or not File(srcPath).exists() then showToast("No generated audio.") return end
  local defaultName = "Gemini_" .. os.date("%H%M%S")
  local busy = false
  local layout = {
    LinearLayout, orientation = "vertical", padding = "20dp", backgroundColor = "#FFFFFF",
    { TextView, text = "Save Audio", textSize = "20sp", textColor = "#1565C0", id = "saveTitle", layout_marginBottom = "15dp" },
    { TextView, text = "File Name:", textColor = "#555555" },
    { EditText, id = "input_filename", text = defaultName, hint = "Filename", layout_width = "fill", backgroundColor = "#F5F5F5", padding = "10dp" },
    { TextView, text = "Select Format:", layout_marginTop = "10dp", textColor = "#555555" },
    { RadioGroup, id = "format_group", orientation = "horizontal",
      { RadioButton, id = "rb_wav", text = "WAV (large, best quality)", checked = true },
      { RadioButton, id = "rb_m4a", text = "M4A (small file)" }
    },
    { TextView, id = "v_save_status", text = "", textColor = "#333333", layout_marginTop = "8dp" },
    {
      LinearLayout, orientation = "horizontal", layout_width = "fill", layout_marginTop = "20dp",
      { Button, text = "Cancel", layout_weight = 1, backgroundColor = "#F44336", textColor = "#FFFFFF",
        onClick = function() if not busy then saveDlg.dismiss() else showToast("Please wait for the conversion to finish.") end end },
      { View, layout_width = "10dp", layout_height = "1dp" },
      {
        Button, text = "Save", layout_weight = 1, backgroundColor = "#4CAF50", textColor = "#FFFFFF",
        onClick = function()
          if busy then return end
          busy = true
          local format = "WAV"
          if rb_m4a.isChecked() then format = "M4A" end
          local raw = tostring(input_filename.getText())
          local function say(m) pcall(function() v_save_status.setText(String(m)) end) announce(m) end
          if format == "M4A" then say("Converting to M4A. Please wait.") end
          saveAudioTo(srcPath, raw, format,
            function(pct) say("Converting: " .. pct .. " percent.") end,
            function(ok, msg)
              busy = false
              setStatus(msg, true)
              showToast(msg)
              if ok then pcall(function() saveDlg.dismiss() end) else say(msg) end
            end)
        end
      }
    }
  }
  saveDlg = LuaDialog(service)
  saveDlg.setView(loadlayout(layout))
  saveTitle.setTypeface(Typeface.DEFAULT_BOLD)
  pcall(function() saveTitle.setAccessibilityHeading(true) end)
  saveDlg.show()
end

-- ==========================================================
-- 8. GENERATION ENGINE (chunking, key rotation, resume)
-- ==========================================================
local function acquireWake()
  pcall(function()
    if not S.wake then
      local pm = service.getSystemService(Context.POWER_SERVICE)
      S.wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "GeminiTTS:job")
      S.wake.setReferenceCounted(false)
    end
    if not S.wake.isHeld() then S.wake.acquire(6 * 60 * 60 * 1000) end
  end)
end

local function releaseWake()
  pcall(function() if S.wake and S.wake.isHeld() then S.wake.release() end end)
end

function E.later(ms, fn)
  local tok = S.token
  later(ms, function()
    if S.running and S.token == tok then fn() end
  end)
end

function E.snapshot()
  local style = P.trim(config.style or "")
  return {
    model = resolvedModel(), voice = config.voice, lang = config.language, style = style,
    multi = config.multi, sp1Name = config.sp1Name, sp1Voice = config.sp1Voice,
    sp2Name = config.sp2Name, sp2Voice = config.sp2Voice,
    pauseSec = config.pauseSec, silenceMs = config.silenceMs, chunkSize = config.chunkSize
  }
end

function E.makeKeys()
  local list = P.parseKeys(config.apiKeys)
  local keys = {}
  for i = 1, #list do keys[i] = { key = list[i], cool = 0, dead = false } end
  return keys
end

function E.saveMeta()
  local J = S.job
  if not J then return end
  local m = {
    v = 1, status = J.status, total = J.total, done = J.done, dataBytes = J.dataBytes,
    rate = J.rate, cfg = J.cfg, updated = os.time()
  }
  local ok, err = pcall(function() writeText(JOB_META, cjson.encode(m)) end)
  if not ok then logLine("saveMeta failed: " .. tostring(err)) end
end

function E.clearJobFiles()
  pcall(function() File(JOB_META).delete() end)
  pcall(function() File(JOB_TEXT).delete() end)
end

function E.run()
  local J = S.job
  S.running = true
  S.token = S.token + 1
  J.status = "running"
  J.tries = 0
  J.waits = 0
  J.reqId = 0
  J.ki = J.ki or 1
  acquireWake()
  refreshButtons()
  setStatus(string.format("Generating audio. %d of %d chunks remaining.", J.total - J.done, J.total), true)
  E.process()
end

function E.process()
  local J = S.job
  if not S.running or not J then return end
  if J.done >= J.total then E.finish() return end
  local idx, wait = P.pickKey(J.keys, J.ki or 1, os.time())
  if not idx then
    if wait and wait > 0 then
      J.waits = (J.waits or 0) + 1
      if J.waits > 12 then
        E.fail("The rate limit keeps blocking requests. Progress is saved. Press Resume Unfinished Job later, or add another key.")
        return
      end
      setStatus(string.format("Rate limit reached. Waiting %d seconds, then continuing.", math.floor(wait)), true)
      E.later(wait * 1000, E.process)
      return
    end
    E.fail("No usable API key left. All keys are invalid or their daily quota is finished. Progress is saved. Add a key in Settings and press Resume Unfinished Job.")
    return
  end
  J.ki = idx
  E.send(J.done + 1, idx)
end

function E.send(ci, ki)
  local J = S.job
  local key = J.keys[ki].key
  J.reqId = J.reqId + 1
  local rid = J.reqId
  J.pending = rid
  local tok = S.token
  local okb, bodyOrErr = pcall(function() return cjson.encode(P.buildRequest(J.cfg, J.chunks[ci])) end)
  if not okb then
    E.fail("Could not build the request: " .. tostring(bodyOrErr))
    return
  end
  local url = API_BASE .. J.cfg.model .. ":generateContent"
  logLine(string.format("REQUEST chunk %d/%d key #%d (ends %s) model %s", ci, J.total, ki, P.keyTail(key), J.cfg.model))
  local okp, errp = pcall(function()
    Http.post(url, bodyOrErr, nil, "utf-8",
      { ["Content-Type"] = "application/json", ["x-goog-api-key"] = key },
      function(code, resp)
        if S.token ~= tok or J.pending ~= rid then return end
        J.pending = nil
        local ok, err = pcall(E.onResponse, ci, ki, code, resp)
        if not ok then
          logLine("ERROR in onResponse: " .. tostring(err))
          E.fail("Unexpected error: " .. tostring(err))
        end
      end)
  end)
  if not okp then
    J.pending = nil
    logLine("Http.post threw: " .. tostring(errp))
    E.onResponse(ci, ki, -1, tostring(errp))
    return
  end
  E.later(REQ_TIMEOUT_MS, function()
    if J.pending == rid then
      J.pending = nil
      E.onResponse(ci, ki, -1, "timeout")
    end
  end)
end

-- write one chunk of audio into the growing WAV file
function E.append(resp)
  local J = S.job
  local okd, r = pcall(cjson.decode, resp)
  if not okd then return false, "badjson" end
  local data, mime = P.extractAudio(r)
  if not data then return false, mime end
  local bytes = Base64.decode(data, Base64.DEFAULT)
  local len = #bytes
  local skip = 0
  if P.shouldStripWav(mime, J.cfg.model) then skip = 44 end
  local pcmLen = len - skip
  pcmLen = pcmLen - (pcmLen % 2)
  if pcmLen < 2 then return false, "emptyaudio" end
  if J.done == 0 and J.dataBytes == 0 then J.rate = P.parseRate(mime) end
  local raf = nil
  local ok, err = pcall(function()
    raf = RandomAccessFile(File(WORK_WAV), "rw")
    raf.seek(44 + J.dataBytes)
    local added = 0
    if J.done > 0 and J.cfg.silenceMs > 0 then
      local sb = silenceBytes(J.rate, J.cfg.silenceMs)
      if sb then raf.write(sb); added = added + #sb end
    end
    raf.write(bytes, skip, pcmLen)
    added = added + pcmLen
    J.newBytes = J.dataBytes + added
    writeHeader(raf, J.newBytes, J.rate)
  end)
  pcall(function() if raf then raf.close() end end)
  if not ok then return false, "write:" .. tostring(err) end
  J.dataBytes = J.newBytes
  return true
end

function E.onResponse(ci, ki, code, resp)
  local J = S.job
  if not S.running or not J then return end
  local kind, info = P.classifyResponse(code, resp)
  local k = J.keys[ki]
  local tail = P.keyTail(k.key)
  logLine(string.format("RESPONSE chunk %d code %s kind %s %s", ci, tostring(code), kind, tostring(info and info.msg or "")))

  if kind == "ok" then
    local ok, reason = E.append(resp)
    if ok then
      J.done = ci
      J.tries = 0
      J.waits = 0
      E.saveMeta()
      local pct = math.floor(J.done * 100 / J.total)
      local msg = string.format("Chunk %d of %d done, %d percent.", J.done, J.total, pct)
      local speak = (J.done == 1) or (J.done % 5 == 0) or (J.done == J.total)
      setStatus(msg, speak)
      if J.done >= J.total then
        E.finish()
      else
        E.later(math.floor(J.cfg.pauseSec * 1000), E.process)
      end
      return
    end
    kind = "noaudio"
    info = { msg = tostring(reason) }
    logLine("append failed: " .. tostring(reason))
    if tostring(reason):find("^write:") then
      E.fail("Could not write the audio file: " .. tostring(reason))
      return
    end
  end

  if kind == "rate_minute" then
    k.cool = os.time() + (info.wait or 40)
    J.ki = ki + 1
    setStatus(string.format("Key %d, ending %s, hit the per-minute limit. Switching or waiting.", ki, tail), true)
    E.later(500, E.process)
  elseif kind == "rate_day" then
    k.dead = true
    J.ki = ki + 1
    setStatus(string.format("Key %d, ending %s, has finished its daily quota. Trying the next key.", ki, tail), true)
    E.later(500, E.process)
  elseif kind == "bad_key" then
    k.dead = true
    J.ki = ki + 1
    setStatus(string.format("Key %d, ending %s, is invalid or not allowed. Skipping it.", ki, tail), true)
    E.later(500, E.process)
  elseif kind == "bad_model" then
    E.fail("The model " .. J.cfg.model .. " was not found for your key. Open Settings and choose another model. " .. tostring(info.msg or ""))
  elseif kind == "bad_request" then
    E.fail("Google rejected the request: " .. tostring(info.msg or ("code " .. tostring(code))))
  else
    -- network, server, noaudio, other: retry the same chunk a few times
    J.tries = (J.tries or 0) + 1
    if J.tries > 4 then
      E.fail(string.format("Chunk %d failed after several tries (%s). Progress is saved. Press Resume Unfinished Job to try again.", ci, kind))
      return
    end
    local delay = 3 * J.tries
    setStatus(string.format("Chunk %d had a problem (%s). Retrying in %d seconds, attempt %d.", ci, kind, delay, J.tries), J.tries >= 2)
    E.later(delay * 1000, function() E.send(ci, ki) end)
  end
end

function E.finish()
  local J = S.job
  S.running = false
  S.token = S.token + 1
  releaseWake()
  local dest = HIST_DIR .. "Gemini_" .. os.date("%Y%m%d_%H%M%S") .. ".wav"
  pcall(function()
    local d = File(HIST_DIR)
    if not d.exists() then d.mkdirs() end
  end)
  local moved = false
  pcall(function() moved = File(WORK_WAV).renameTo(File(dest)) end)
  if not moved then
    local ok = copyFile(WORK_WAV, dest)
    if ok then pcall(function() File(WORK_WAV).delete() end) else dest = WORK_WAV end
  end
  local secs = J.dataBytes / (J.rate * 2)
  E.clearJobFiles()
  S.job = nil
  S.currentAudio = dest
  refreshButtons()
  playTone()
  local msg = string.format("Finished. %d chunks, about %s of audio. Saved in history as %s.", J.total, P.fmtDuration(secs), File(dest).getName())
  setStatus(msg, true)
  showToast("Audio is ready.")
  if config.autoPlay then playFile(dest) end
  if config.autoSave then
    local name = "Gemini_" .. os.date("%Y%m%d_%H%M%S")
    saveAudioTo(dest, name, config.autoSaveFormat,
      function(pct) setStatus("Auto-save converting: " .. pct .. " percent.", false) end,
      function(ok, m) setStatus("Auto-save: " .. m, true) end)
  end
end

function E.fail(msg)
  local J = S.job
  S.running = false
  S.token = S.token + 1
  releaseWake()
  if J then
    J.status = "paused"
    E.saveMeta()
    if J.dataBytes > 0 then S.currentAudio = WORK_WAV end
    msg = msg .. string.format(" Completed %d of %d chunks.", J.done, J.total)
  end
  refreshButtons()
  setStatus(msg, true)
  showToast("Stopped. See the status line.")
end

function E.cancel()
  if not S.running then showToast("Nothing is running.") return end
  local J = S.job
  S.running = false
  S.token = S.token + 1
  releaseWake()
  if J then
    J.status = "paused"
    E.saveMeta()
    if J.dataBytes > 0 then S.currentAudio = WORK_WAV end
  end
  refreshButtons()
  setStatus(string.format("Cancelled. %d of %d chunks are done and saved. Press Resume Unfinished Job to continue.", J and J.done or 0, J and J.total or 0), true)
end

function E.start(rawText)
  if S.running then showToast("A job is already running.") return end
  local text = rawText
  if config.cleanText then text = P.cleanText(text) end
  text = P.trim(text)
  if text == "" then showToast("Please enter some text.") return end
  local snap = E.snapshot()
  if snap.multi then
    local a, b = P.trim(snap.sp1Name), P.trim(snap.sp2Name)
    if a == "" or b == "" or a:lower() == b:lower() then
      setStatus("Multi-speaker needs two different speaker names. Open Settings to fix them.", true)
      return
    end
  end
  local keys = E.makeKeys()
  if #keys == 0 then
    setStatus("No API key. Open Settings, paste your key, or use Get Free API Key.", true)
    return
  end
  local chunks = P.splitChunks(text, snap.chunkSize, snap.multi)
  if #chunks == 0 then showToast("Nothing readable in the text.") return end
  E.clearJobFiles()
  local ok, err = pcall(function()
    writeText(JOB_TEXT, text)
    createEmptyWav(WORK_WAV, 24000)
  end)
  if not ok then
    setStatus("Could not create work files: " .. tostring(err), true)
    return
  end
  S.job = { chunks = chunks, total = #chunks, done = 0, dataBytes = 0, rate = 24000, cfg = snap, keys = keys, ki = 1 }
  E.saveMeta()
  logLine(string.format("START job: %d chars, %d chunks, model %s", P.ulen(text), #chunks, snap.model))
  E.run()
end

function E.resume()
  if S.running then showToast("A job is already running.") return end
  local ok, meta, text = pcall(function()
    local m = readText(JOB_META)
    local t = readText(JOB_TEXT)
    if not m or not t then return nil, nil end
    local good, decoded = pcall(cjson.decode, m)
    if not good or type(decoded) ~= "table" then return nil, nil end
    return decoded, t
  end)
  if not ok or not meta or not text then
    setStatus("There is no unfinished job to resume.", true)
    refreshButtons()
    return
  end
  local cfg = meta.cfg
  cfg.chunkSize = clamp(cfg.chunkSize, 300, 3000, 1800)
  cfg.pauseSec = clamp(cfg.pauseSec, 0, 60, 2)
  cfg.silenceMs = clamp(cfg.silenceMs, 0, 3000, 250)
  local chunks = P.splitChunks(text, cfg.chunkSize, cfg.multi)
  if #chunks ~= meta.total then
    setStatus("The saved job does not match its text. Please start a new job.", true)
    return
  end
  local keys = E.makeKeys()
  if #keys == 0 then
    setStatus("No API key. Open Settings and add a key, then resume.", true)
    return
  end
  local dataBytes = math.floor(meta.dataBytes or 0)
  local rate = math.floor(meta.rate or 24000)
  local okw, errw = pcall(function()
    local wf = File(WORK_WAV)
    if not wf.exists() then
      if dataBytes > 0 then error("the partial audio file is missing") end
      createEmptyWav(WORK_WAV, rate)
    end
    if wf.length() < 44 + dataBytes then error("the partial audio file is shorter than expected") end
    local raf = RandomAccessFile(wf, "rw")
    raf.setLength(44 + dataBytes)
    writeHeader(raf, dataBytes, rate)
    raf.close()
  end)
  if not okw then
    setStatus("Cannot resume: " .. tostring(errw) .. ". Please start a new job.", true)
    return
  end
  S.job = { chunks = chunks, total = #chunks, done = math.floor(meta.done or 0), dataBytes = dataBytes,
            rate = rate, cfg = cfg, keys = keys, ki = 1 }
  logLine(string.format("RESUME job at chunk %d of %d", S.job.done, S.job.total))
  E.run()
end

-- ==========================================================
-- 9. KEY TEST AND VOICE PREVIEW
-- ==========================================================
local function testKeys(raw)
  local keys = P.parseKeys(raw)
  if #keys == 0 then showToast("Paste at least one API key first.") return end
  local results = {}
  local i = 0
  local function nextKey()
    i = i + 1
    if i > #keys then
      showMessage("Key test results", table.concat(results, "\n"))
      return
    end
    setStatus(string.format("Testing key %d of %d.", i, #keys), false)
    local cur = i
    local okg, errg = pcall(function()
      Http.get("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", nil, "utf-8",
        { ["x-goog-api-key"] = keys[cur] },
        function(code, body)
          local kind = P.classifyResponse(code, body)
          local label
          if kind == "ok" then label = "valid"
          elseif kind == "rate_minute" or kind == "rate_day" then label = "valid, but its quota limit is reached right now"
          elseif kind == "bad_key" then label = "INVALID or not allowed"
          else label = "could not be verified (code " .. tostring(code) .. ")" end
          results[#results + 1] = string.format("Key %d, ending %s: %s", cur, P.keyTail(keys[cur]), label)
          nextKey()
        end)
    end)
    if not okg then
      results[#results + 1] = string.format("Key %d, ending %s: test failed (%s)", cur, P.keyTail(keys[cur]), tostring(errg))
      nextKey()
    end
  end
  nextKey()
end

local function previewVoice(cfg, rawKeys)
  local keys = P.parseKeys(rawKeys)
  if #keys == 0 then showToast("Paste an API key first.") return end
  local text = "Hello. This is a short preview of the selected voice."
  if cfg.lang and cfg.lang:match("^Urdu") then
    text = "یہ منتخب آواز کا ایک مختصر نمونہ ہے۔"
  end
  local c = {}
  for k, v in pairs(cfg) do c[k] = v end
  c.multi = false
  c.style = cfg.style or ""
  setStatus("Generating voice preview.", true)
  local okp, errp = pcall(function()
    Http.post(API_BASE .. c.model .. ":generateContent", cjson.encode(P.buildRequest(c, text)), nil, "utf-8",
      { ["Content-Type"] = "application/json", ["x-goog-api-key"] = keys[1] },
      function(code, resp)
        local kind, info = P.classifyResponse(code, resp)
        if kind ~= "ok" then
          setStatus("Preview failed: " .. kind .. ". " .. tostring(info.msg or ""), true)
          return
        end
        local okd, r = pcall(cjson.decode, resp)
        local data, mime = P.extractAudio(okd and r or nil)
        if not data then setStatus("Preview failed: " .. tostring(mime), true) return end
        local bytes = Base64.decode(data, Base64.DEFAULT)
        local skip = 0
        if P.shouldStripWav(mime, c.model) then skip = 44 end
        local pcmLen = #bytes - skip
        pcmLen = pcmLen - (pcmLen % 2)
        local rate = P.parseRate(mime)
        local okw, errw = pcall(function()
          createEmptyWav(PREVIEW_WAV, rate)
          local raf = RandomAccessFile(File(PREVIEW_WAV), "rw")
          raf.seek(44)
          raf.write(bytes, skip, pcmLen)
          writeHeader(raf, pcmLen, rate)
          raf.close()
        end)
        if not okw then setStatus("Preview failed: " .. tostring(errw), true) return end
        playFile(PREVIEW_WAV)
      end)
  end)
  if not okp then setStatus("Preview failed: " .. tostring(errp), true) end
end

-- ==========================================================
-- 10. UI SCREENS
-- ==========================================================
local function updateCounter()
  pcall(function()
    local t = tostring(v_input.getText())
    local n = P.ulen(t)
    local size = clamp(config.chunkSize, 300, 3000, 1800)
    if n == 0 then
      v_counter.setText("Characters: 0.")
      return
    end
    local chunks = math.ceil(n / size)
    local msg = string.format("Characters: %s. About %d chunks of up to %d characters. Roughly %s of audio.",
      P.commas(n), chunks, math.floor(size), P.fmtDuration(n / 14))
    if chunks > 20 then
      msg = msg .. " Free keys have limited requests. Add more keys in Settings if the quota runs out; you can also resume later."
    end
    v_counter.setText(msg)
  end)
end

function UI.help()
  local helpDlg
  local layout = {
    ScrollView, layout_width = "fill", layout_height = "fill",
    {
      LinearLayout, orientation = "vertical", padding = "20dp", backgroundColor = "#FFFFFF", gravity = "center",
      { TextView, text = "Developer Info", textSize = "22sp", textColor = "#1565C0", id = "devTitle", layout_marginBottom = "15dp" },
      { TextView, text = "Developed by: Moutter Rasool", textSize = "18sp", textColor = "#333333", id = "devName", layout_marginBottom = "10dp" },
      { TextView, text = "Moutter Rasool is a visionary developer dedicated to empowering the visually impaired. His innovative tools bridge the gap between technology and accessibility, making digital content available to everyone. Through his tireless efforts, he continues to uplift the blind community with cutting-edge solutions.", textSize = "16sp", textColor = "#555555", gravity = "center", layout_marginBottom = "20dp" },
      { Button, text = "WhatsApp: +92 345 7812726", layout_width = "fill", backgroundColor = "#25D366", textColor = "#FFFFFF", textSize = "16sp",
        onClick = function() openWhatsApp() end },
      { Button, text = "Share Error Log", layout_width = "fill", backgroundColor = "#607D8B", textColor = "#FFFFFF", layout_marginTop = "10dp",
        contentDescription = "Share Error Log. Use this to send the log file to the developer when something goes wrong.",
        onClick = function() shareLog() end },
      { Button, text = "Close", layout_width = "fill", backgroundColor = "#333333", textColor = "#FFFFFF", layout_marginTop = "15dp",
        onClick = function() if helpDlg then helpDlg.dismiss() end end }
    }
  }
  helpDlg = LuaDialog(service)
  helpDlg.setView(loadlayout(layout))
  devTitle.setTypeface(Typeface.DEFAULT_BOLD)
  devName.setTypeface(Typeface.DEFAULT_BOLD)
  pcall(function() devTitle.setAccessibilityHeading(true) end)
  helpDlg.show()
end

function UI.history()
  local files = {}
  for _, f in ipairs(listFiles(HIST_DIR)) do
    local n = tostring(f.getName())
    local low = n:lower()
    if low:match("%.wav$") or low:match("%.m4a$") then files[#files + 1] = f end
  end
  table.sort(files, function(a, b) return tostring(a.getName()) > tostring(b.getName()) end)
  if #files == 0 then showMessage("History", "No saved audio yet.") return end
  local names = {}
  for i, f in ipairs(files) do names[i] = tostring(f.getName()) .. "  (" .. fileSizeText(f) .. ")" end
  local histDlg
  local function actions(f)
    local path = tostring(f.getAbsolutePath())
    local adlg
    local layout = {
      LinearLayout, orientation = "vertical", padding = "20dp", backgroundColor = "#FFFFFF",
      { TextView, text = tostring(f.getName()), textSize = "18sp", textColor = "#1565C0", id = "v_act_title", layout_marginBottom = "12dp" },
      { Button, text = "Play", layout_width = "fill", backgroundColor = "#4CAF50", textColor = "#FFFFFF",
        onClick = function() S.currentAudio = path adlg.dismiss() histDlg.dismiss() playFile(path) end },
      { Button, text = "Share", layout_width = "fill", backgroundColor = "#9C27B0", textColor = "#FFFFFF", layout_marginTop = "6dp",
        onClick = function() shareFile(path) end },
      { Button, text = "Save As", layout_width = "fill", backgroundColor = "#FF9800", textColor = "#FFFFFF", layout_marginTop = "6dp",
        onClick = function() adlg.dismiss() showSaveDialog(path) end },
      { Button, text = "Delete", layout_width = "fill", backgroundColor = "#F44336", textColor = "#FFFFFF", layout_marginTop = "6dp",
        onClick = function()
          adlg.dismiss()
          confirmDialog("Delete audio", "Delete " .. tostring(f.getName()) .. " permanently?", "Delete", function()
            pcall(function() f.delete() end)
            if S.currentAudio == path then S.currentAudio = nil end
            histDlg.dismiss()
            setStatus("Deleted " .. tostring(f.getName()), true)
          end)
        end },
      { Button, text = "Close", layout_width = "fill", backgroundColor = "#333333", textColor = "#FFFFFF", layout_marginTop = "6dp",
        onClick = function() adlg.dismiss() end }
    }
    adlg = LuaDialog(service)
    adlg.setView(loadlayout(layout))
    pcall(function() v_act_title.setAccessibilityHeading(true) end)
    adlg.show()
  end
  local layout = {
    LinearLayout, orientation = "vertical", padding = "16dp", backgroundColor = "#FFFFFF",
    { TextView, text = "History: tap a file for options", textSize = "20sp", textColor = "#1565C0", id = "v_hist_title", layout_marginBottom = "10dp" },
    { ListView, id = "v_hist_list", layout_width = "fill", layout_height = "320dp",
      onItemClick = function(parent, view, pos, id) actions(files[pos + 1]) end },
    { Button, text = "Close", layout_width = "fill", backgroundColor = "#333333", textColor = "#FFFFFF", layout_marginTop = "10dp",
      onClick = function() histDlg.dismiss() end }
  }
  histDlg = LuaDialog(service)
  histDlg.setView(loadlayout(layout))
  v_hist_list.setAdapter(ArrayAdapter(service, android.R.layout.simple_list_item_1, names))
  pcall(function() v_hist_title.setAccessibilityHeading(true) end)
  histDlg.show()
end

function UI.loadFile()
  local files = {}
  local dirs = { DOWNLOAD_DIR, "/sdcard/Documents/", BASE_DIR, "/sdcard/" }
  for _, d in ipairs(dirs) do
    for _, f in ipairs(listFiles(d)) do
      local n = tostring(f.getName()):lower()
      if n:match("%.txt$") and f.isFile() then files[#files + 1] = f end
    end
  end
  local ldlg
  local function loadPath(path)
    local ok, content = pcall(readText, path)
    if ok and content then
      pcall(function() v_input.setText(String(content)) end)
      S.lastText = content
      updateCounter()
      setStatus("Loaded " .. P.commas(P.ulen(content)) .. " characters from " .. File(path).getName(), true)
      pcall(function() ldlg.dismiss() end)
    else
      setStatus("Could not read that file: " .. tostring(content), true)
    end
  end
  local names = {}
  for i, f in ipairs(files) do names[i] = tostring(f.getName()) .. "  (" .. fileSizeText(f) .. ")  in " .. tostring(f.getParent()) end
  local layout = {
    LinearLayout, orientation = "vertical", padding = "16dp", backgroundColor = "#FFFFFF",
    { TextView, text = "Load Text File", textSize = "20sp", textColor = "#1565C0", id = "v_lf_title", layout_marginBottom = "8dp" },
    { TextView, text = "Tap a .txt file from the list, or type a full path below.", textColor = "#555555" },
    { ListView, id = "v_lf_list", layout_width = "fill", layout_height = "220dp",
      onItemClick = function(parent, view, pos, id) loadPath(tostring(files[pos + 1].getAbsolutePath())) end },
    { EditText, id = "v_lf_path", hint = "Full path, for example /sdcard/Download/syllabus.txt", layout_width = "fill", backgroundColor = "#F5F5F5", padding = "10dp" },
    { Button, text = "Load This Path", layout_width = "fill", backgroundColor = "#2196F3", textColor = "#FFFFFF", layout_marginTop = "8dp",
      onClick = function() loadPath(P.trim(tostring(v_lf_path.getText()))) end },
    { Button, text = "Close", layout_width = "fill", backgroundColor = "#333333", textColor = "#FFFFFF", layout_marginTop = "8dp",
      onClick = function() ldlg.dismiss() end }
  }
  ldlg = LuaDialog(service)
  ldlg.setView(loadlayout(layout))
  v_lf_list.setAdapter(ArrayAdapter(service, android.R.layout.simple_list_item_1, names))
  pcall(function() v_lf_title.setAccessibilityHeading(true) end)
  ldlg.show()
end

function UI.settings()
  local function finishSettings()
    config.apiKeys = tostring(v_keys.getText())
    config.voice = P.voiceName(voices[v_spin_voice.getSelectedItemPosition() + 1])
    config.language = languages[v_spin_lang.getSelectedItemPosition() + 1]
    config.model = MODEL_PRESETS[v_spin_model.getSelectedItemPosition() + 1].id
    config.customModel = P.trim(tostring(v_custom_model.getText()))
    config.chunkSize = clamp(tostring(v_chunk.getText()), 300, 3000, 1800)
    config.pauseSec = clamp(tostring(v_pause.getText()), 0, 60, 2)
    config.silenceMs = clamp(tostring(v_silence.getText()), 0, 3000, 250)
    config.cleanText = v_cb_clean.isChecked()
    config.clipboardPrefill = v_cb_clip.isChecked()
    config.autoPlay = v_cb_play.isChecked()
    config.autoSave = v_cb_save.isChecked()
    config.autoSaveFormat = formats[v_spin_fmt.getSelectedItemPosition() + 1]
    config.multi = v_cb_multi.isChecked()
    config.sp1Name = P.trim(tostring(v_sp1name.getText()))
    config.sp2Name = P.trim(tostring(v_sp2name.getText()))
    if config.sp1Name == "" then config.sp1Name = "Joe" end
    if config.sp2Name == "" then config.sp2Name = "Jane" end
    config.sp1Voice = P.voiceName(voices[v_spin_sp1.getSelectedItemPosition() + 1])
    config.sp2Voice = P.voiceName(voices[v_spin_sp2.getSelectedItemPosition() + 1])
    saveConfig()
    settingsDlg.dismiss()
    updateCounter()
    setStatus("Settings saved.", true)
    showToast("Settings Saved!")
  end

  local function settingsSnapshot()
    local custom = P.trim(tostring(v_custom_model.getText()))
    local model = MODEL_PRESETS[v_spin_model.getSelectedItemPosition() + 1].id
    if custom ~= "" then model = custom end
    return {
      model = model,
      voice = P.voiceName(voices[v_spin_voice.getSelectedItemPosition() + 1]),
      lang = languages[v_spin_lang.getSelectedItemPosition() + 1],
      style = P.trim(config.style or "")
    }
  end

  local keysHidden = true
  local layout = {
    ScrollView, layout_width = "fill", layout_height = "fill",
    {
      LinearLayout, orientation = "vertical", padding = "20dp", backgroundColor = "#FFFFFF",
      { TextView, text = "Settings", textSize = "22sp", textColor = "#1565C0", id = "stTitle", gravity = "center", layout_marginBottom = "20dp" },

      { TextView, text = "Your API Keys (one per line; add several to switch automatically when a quota ends):", textColor = "#333333" },
      { EditText, id = "v_keys", text = config.apiKeys, hint = "AIzaSy... paste your key here", layout_width = "fill", layout_height = "110dp",
        gravity = "top", backgroundColor = "#F5F5F5", padding = "10dp", inputType = "textMultiLine" },
      { Button, id = "v_btn_showkeys", text = "Show Keys", layout_width = "fill", backgroundColor = "#EEEEEE", textColor = "#333333",
        onClick = function()
          keysHidden = not keysHidden
          if keysHidden then
            v_keys.setTransformationMethod(PasswordTransformationMethod.getInstance())
            v_btn_showkeys.setText("Show Keys")
            announce("Keys hidden.")
          else
            v_keys.setTransformationMethod(HideReturnsTransformationMethod.getInstance())
            v_btn_showkeys.setText("Hide Keys")
            announce("Keys visible.")
          end
        end },
      { Button, text = "Test Keys", layout_width = "fill", backgroundColor = "#2196F3", textColor = "#FFFFFF", layout_marginTop = "6dp",
        contentDescription = "Test Keys. Checks every key above and tells you which ones work.",
        onClick = function() testKeys(tostring(v_keys.getText())) end },
      { TextView, text = "No key yet? Get one free from Google AI Studio. Sign in, create an API key, copy it, then come back here and paste it above.", textColor = "#555555", layout_marginTop = "10dp" },
      { Button, text = "Get Free API Key", layout_width = "fill", backgroundColor = "#4CAF50", textColor = "#FFFFFF", layout_marginBottom = "15dp",
        contentDescription = "Get Free API Key. Opens Google AI Studio in your browser.",
        onClick = function() getFreeKey() end },

      { TextView, text = "Model:", layout_marginTop = "10dp", textColor = "#333333" },
      { Spinner, id = "v_spin_model", layout_width = "fill" },
      { TextView, text = "Custom model name (optional, overrides the list above):", textColor = "#333333", layout_marginTop = "6dp" },
      { EditText, id = "v_custom_model", text = config.customModel, hint = "Leave empty to use the list", layout_width = "fill", backgroundColor = "#F5F5F5", padding = "10dp", singleLine = true },

      { TextView, text = "Voice:", layout_marginTop = "10dp", textColor = "#333333" },
      { Spinner, id = "v_spin_voice", layout_width = "fill" },
      { Button, text = "Preview Voice", layout_width = "fill", backgroundColor = "#FF9800", textColor = "#FFFFFF", layout_marginTop = "6dp",
        contentDescription = "Preview Voice. Plays a short sample using the selected model and voice.",
        onClick = function() previewVoice(settingsSnapshot(), tostring(v_keys.getText())) end },

      { TextView, text = "Input Language Hint (used by older models; the 3.8 models detect the language automatically):", layout_marginTop = "15dp", textColor = "#333333" },
      { Spinner, id = "v_spin_lang", layout_width = "fill" },

      { CheckBox, id = "v_cb_multi", text = "Multi-speaker mode (two speakers; write lines like Joe: Hello)", checked = config.multi, layout_marginTop = "15dp" },
      { TextView, text = "Speaker 1 name:", textColor = "#333333" },
      { EditText, id = "v_sp1name", text = config.sp1Name, layout_width = "fill", backgroundColor = "#F5F5F5", padding = "10dp", singleLine = true },
      { TextView, text = "Speaker 1 voice:", textColor = "#333333" },
      { Spinner, id = "v_spin_sp1", layout_width = "fill" },
      { TextView, text = "Speaker 2 name:", textColor = "#333333" },
      { EditText, id = "v_sp2name", text = config.sp2Name, layout_width = "fill", backgroundColor = "#F5F5F5", padding = "10dp", singleLine = true },
      { TextView, text = "Speaker 2 voice:", textColor = "#333333" },
      { Spinner, id = "v_spin_sp2", layout_width = "fill" },

      { TextView, text = "Chunk size in characters (300 to 3000):", layout_marginTop = "15dp", textColor = "#333333" },
      { EditText, id = "v_chunk", text = tostring(math.floor(config.chunkSize)), layout_width = "fill", backgroundColor = "#F5F5F5", padding = "10dp", inputType = "number", singleLine = true },
      { TextView, text = "Pause between requests in seconds (0 to 60):", textColor = "#333333" },
      { EditText, id = "v_pause", text = tostring(math.floor(config.pauseSec)), layout_width = "fill", backgroundColor = "#F5F5F5", padding = "10dp", inputType = "number", singleLine = true },
      { TextView, text = "Silence between chunks in milliseconds (0 to 3000):", textColor = "#333333" },
      { EditText, id = "v_silence", text = tostring(math.floor(config.silenceMs)), layout_width = "fill", backgroundColor = "#F5F5F5", padding = "10dp", inputType = "number", singleLine = true },

      { CheckBox, id = "v_cb_clean", text = "Clean text before reading (removes links, markdown marks, lone page numbers, extra blank lines)", checked = config.cleanText, layout_marginTop = "15dp" },
      { CheckBox, id = "v_cb_clip", text = "Paste clipboard text automatically when the tool opens", checked = config.clipboardPrefill },
      { CheckBox, id = "v_cb_play", text = "Play the audio automatically when finished", checked = config.autoPlay },
      { CheckBox, id = "v_cb_save", text = "Save automatically to the Download folder when finished", checked = config.autoSave },
      { TextView, text = "Auto-save format:", textColor = "#333333" },
      { Spinner, id = "v_spin_fmt", layout_width = "fill" },

      { Button, text = "Save Configuration", layout_width = "fill", layout_marginTop = "25dp", backgroundColor = "#2196F3", textColor = "#FFFFFF",
        onClick = finishSettings },
      { Button, text = "Cancel", layout_width = "fill", layout_marginTop = "8dp", backgroundColor = "#333333", textColor = "#FFFFFF",
        onClick = function() settingsDlg.dismiss() end }
    }
  }

  settingsDlg = LuaDialog(service)
  settingsDlg.setView(loadlayout(layout))
  stTitle.setTypeface(Typeface.DEFAULT_BOLD)
  pcall(function() stTitle.setAccessibilityHeading(true) end)
  v_keys.setTransformationMethod(PasswordTransformationMethod.getInstance())

  local modelLabels = {}
  for i = 1, #MODEL_PRESETS do modelLabels[i] = MODEL_PRESETS[i].label end
  local function setupSpinner(spin, items)
    local ad = ArrayAdapter(service, android.R.layout.simple_spinner_item, items)
    ad.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
    spin.setAdapter(ad)
  end
  setupSpinner(v_spin_model, modelLabels)
  setupSpinner(v_spin_voice, voices)
  setupSpinner(v_spin_lang, languages)
  setupSpinner(v_spin_sp1, voices)
  setupSpinner(v_spin_sp2, voices)
  setupSpinner(v_spin_fmt, formats)

  for i = 1, #MODEL_PRESETS do
    if MODEL_PRESETS[i].id == config.model then v_spin_model.setSelection(i - 1) end
  end
  v_spin_voice.setSelection(indexOfVoice(config.voice) - 1)
  v_spin_sp1.setSelection(indexOfVoice(config.sp1Voice) - 1)
  v_spin_sp2.setSelection(indexOfVoice(config.sp2Voice) - 1)
  for i = 1, #languages do
    if languages[i] == config.language then v_spin_lang.setSelection(i - 1) end
  end
  for i = 1, #formats do
    if formats[i] == config.autoSaveFormat then v_spin_fmt.setSelection(i - 1) end
  end

  settingsDlg.show()
end

function UI.dashboard()
  local layout = {
    LinearLayout, orientation = "vertical", layout_width = "fill", layout_height = "fill", backgroundColor = "#FFFFFF",

    -- HEADER
    {
      LinearLayout, orientation = "vertical", layout_width = "fill", padding = "16dp", backgroundColor = "#FAFAFA",
      { TextView, text = "Gemini TTS Converter", textSize = "24sp", textColor = "#1565C0", id = "mainTitle", gravity = "center" },
      {
        LinearLayout, orientation = "horizontal", layout_width = "fill", layout_marginTop = "10dp",
        { Button, text = "Settings", layout_weight = 1, backgroundColor = "#EEEEEE", textColor = "#333333",
          onClick = function()
            if S.running then showToast("Wait for the job to finish or cancel it first.") return end
            UI.settings()
          end },
        { View, layout_width = "5dp", layout_height = "1dp" },
        { Button, text = "History", layout_weight = 1, backgroundColor = "#EEEEEE", textColor = "#333333",
          onClick = function() UI.history() end },
      },
    },

    -- SCROLL CONTENT
    {
      ScrollView, layout_width = "fill", layout_height = "fill",
      {
        LinearLayout, orientation = "vertical", layout_width = "fill", padding = "16dp",

        { TextView, id = "v_status", text = S.status, textColor = "#1B5E20", textSize = "16sp", layout_marginBottom = "8dp" },

        { TextView, text = "Input Text (Mixed Languages Supported):", textColor = "#666666", layout_marginTop = "5dp" },

        {
          LinearLayout, orientation = "horizontal", layout_width = "fill",
          { Button, text = "Clear Text", layout_weight = 1, backgroundColor = "#FFEBEE", textColor = "#C62828",
            onClick = function() v_input.setText("") end },
          { View, layout_width = "5dp", layout_height = "1dp" },
          { Button, text = "Paste Clipboard", layout_weight = 1, backgroundColor = "#E3F2FD", textColor = "#1565C0",
            onClick = function() v_input.setText(getClipboardText()) end },
        },
        { Button, text = "Load Text File", layout_width = "fill", backgroundColor = "#E8F5E9", textColor = "#2E7D32", layout_marginTop = "5dp",
          onClick = function() UI.loadFile() end },

        { EditText, id = "v_input", hint = "Type or paste text here...", layout_width = "fill", layout_height = "250dp", gravity = "top",
          backgroundColor = "#F5F5F5", padding = "10dp", textSize = "16sp", inputType = "textMultiLine", layout_marginTop = "5dp" },
        { TextView, id = "v_counter", text = "Characters: 0.", textColor = "#555555", layout_marginTop = "4dp" },

        { TextView, text = "Style instruction (optional), for example: slowly and calmly", textColor = "#666666", layout_marginTop = "10dp" },
        { EditText, id = "v_style", text = config.style, hint = "Leave empty for the normal voice", layout_width = "fill",
          backgroundColor = "#F5F5F5", padding = "10dp", singleLine = true },

        { Button, id = "v_btn_generate", text = "Generate Audio", layout_width = "fill", backgroundColor = "#2196F3", textColor = "#FFFFFF", layout_marginTop = "15dp",
          onClick = function()
            local t = tostring(v_input.getText())
            if #t == 0 then showToast("Please enter some text.") return end
            config.style = P.trim(tostring(v_style.getText()))
            saveConfig()
            S.lastText = t
            if File(JOB_META).exists() then
              confirmDialog("Unfinished job found",
                "An unfinished job is saved. Starting a new one will discard it. Use Resume Unfinished Job if you want to continue it.",
                "Discard and Start New", function() E.start(t) end)
            else
              E.start(t)
            end
          end },
        { Button, id = "v_btn_cancel", text = "Cancel Generation", layout_width = "fill", backgroundColor = "#B71C1C", textColor = "#FFFFFF", layout_marginTop = "5dp",
          onClick = function() E.cancel() end },
        { Button, id = "v_btn_resume", text = "Resume Unfinished Job", layout_width = "fill", backgroundColor = "#00796B", textColor = "#FFFFFF", layout_marginTop = "5dp",
          onClick = function() E.resume() end },

        {
          LinearLayout, orientation = "horizontal", layout_width = "fill", layout_marginTop = "15dp",
          { Button, text = "Play", layout_weight = 1, backgroundColor = "#4CAF50", textColor = "#FFFFFF", onClick = function() playFile(S.currentAudio) end },
          { View, layout_width = "5dp", layout_height = "1dp" },
          { Button, id = "v_btn_pause", text = "Pause", layout_weight = 1, backgroundColor = "#FFA000", textColor = "#FFFFFF", onClick = function() togglePause() end },
          { View, layout_width = "5dp", layout_height = "1dp" },
          { Button, text = "Stop", layout_weight = 1, backgroundColor = "#FF5722", textColor = "#FFFFFF", onClick = function() stopAudio() end },
        },
        {
          LinearLayout, orientation = "horizontal", layout_width = "fill", layout_marginTop = "5dp",
          { Button, text = "Back 10 Seconds", layout_weight = 1, backgroundColor = "#78909C", textColor = "#FFFFFF", onClick = function() seekBy(-10000) end },
          { View, layout_width = "5dp", layout_height = "1dp" },
          { Button, text = "Forward 10 Seconds", layout_weight = 1, backgroundColor = "#78909C", textColor = "#FFFFFF", onClick = function() seekBy(10000) end },
        },
        { Button, id = "v_btn_speed", text = "Speed: 1.00x", layout_width = "fill", backgroundColor = "#546E7A", textColor = "#FFFFFF", layout_marginTop = "5dp",
          contentDescription = "Playback speed. Double tap to change it.",
          onClick = function() cycleSpeed() end },

        {
          LinearLayout, orientation = "horizontal", layout_width = "fill", layout_marginTop = "5dp",
          { Button, text = "Save", layout_weight = 1, backgroundColor = "#FF9800", textColor = "#FFFFFF", onClick = function() showSaveDialog(S.currentAudio) end },
          { View, layout_width = "5dp", layout_height = "1dp" },
          { Button, text = "Share", layout_weight = 1, backgroundColor = "#9C27B0", textColor = "#FFFFFF", onClick = function() shareFile(S.currentAudio) end },
        },

        { Button, text = "Help and Developer Info", layout_width = "fill", backgroundColor = "#333333", textColor = "#FFFFFF", layout_marginTop = "30dp", onClick = function() UI.help() end },
        { Button, text = "Close Tool", layout_width = "fill", backgroundColor = "#000000", textColor = "#FFFFFF", layout_marginTop = "5dp",
          onClick = function()
            if S.running then E.cancel() end
            dashboardDlg.dismiss()
          end }
      }
    }
  }

  dashboardDlg = LuaDialog(service)
  dashboardDlg.setView(loadlayout(layout))
  mainTitle.setTypeface(Typeface.DEFAULT_BOLD)
  pcall(function() mainTitle.setAccessibilityHeading(true) end)
  pcall(function()
    dashboardDlg.setOnDismissListener({ onDismiss = function()
      pcall(function() S.lastText = tostring(v_input.getText()) end)
      if S.running then E.cancel() end
    end })
  end)

  v_input.addTextChangedListener(TextWatcher({
    onTextChanged = function(s, a, b, c) updateCounter() end,
    beforeTextChanged = function(s, a, b, c) end,
    afterTextChanged = function(s) end
  }))

  -- pre-fill: text from last session, else clipboard (optional)
  local prefilled = false
  if S.lastText and #S.lastText > 0 then
    v_input.setText(String(S.lastText))
    prefilled = true
  elseif config.clipboardPrefill then
    local clip = getClipboardText()
    if clip and #clip > 0 and clip ~= "settings" then
      v_input.setText(String(clip))
      prefilled = true
    end
  end
  updateCounter()
  refreshButtons()

  if File(JOB_META).exists() and not S.running then
    pcall(function()
      local meta = cjson.decode(readText(JOB_META))
      setStatus(string.format("Unfinished job found: %d of %d chunks done. Use Resume Unfinished Job to continue.",
        math.floor(meta.done), math.floor(meta.total)), false)
    end)
  elseif S.running then
    setStatus(S.status, false)
  end

  dashboardDlg.show()
end

-- ==========================================================
-- 11. EXECUTION
-- ==========================================================
loadConfig()
pcall(function()
  local d = File(WORK_DIR)
  if not d.exists() then d.mkdirs() end
end)
logLine("Tool opened.")
UI.dashboard()

return true
