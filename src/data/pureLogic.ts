/**
 * Pure logic translation of the Lua P module into TypeScript for the interactive workbench.
 * This directly mirrors the Kotlin & Java TextProcessor, WavAudioUtil, KeyRotationManager, and GeminiRequestHelper.
 */

export const PureLogic = {
  trim(s: string): string {
    return (s || '').trim();
  },

  // Number of unicode characters (UTF-8 aware)
  ulen(s: string): number {
    if (!s) return 0;
    // Count UTF-8 unicode code points
    return Array.from(s).length;
  },

  // Character index limit
  byteIndexAfterChars(s: string, n: number): number {
    const chars = Array.from(s || '');
    return chars.slice(0, n).join('').length;
  },

  hasContent(s: string): boolean {
    return /[\p{L}\p{N}]/u.test(s);
  },

  commas(n: number): string {
    return Math.floor(n).toLocaleString('en-US');
  },

  fmtDuration(sec: number): string {
    sec = Math.floor(sec + 0.5);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h} hours ${m} minutes`;
    if (m > 0) return `${m} minutes ${s} seconds`;
    return `${s} seconds`;
  },

  cleanText(s: string): string {
    if (!s) return '';
    let text = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    text = text.replace(/https?:\/\/\S+/g, '');
    text = text.replace(/www\.\S+/g, '');
    const lines = text.split('\n');
    const out: string[] = [];

    for (let line of lines) {
      line = line.replace(/^\s*#+\s*/, '');
      line = line.replace(/^\s*>+\s?/, '');
      line = line.replace(/[*`~]/g, '');
      line = line.replace(/__+/g, '');
      line = line.replace(/[ \t]+/g, ' ');
      line = line.trim();
      if (!/^\d+$/.test(line) && line.length > 0) {
        out.push(line);
      }
    }

    let r = out.join('\n');
    r = r.replace(/\n\n\n+/g, '\n\n');
    return r.trim();
  },

  // Split a paragraph into sentences (. ! ? and Urdu full stop \u06D4 / Arabic question mark \u061F)
  splitSentences(p: string): string[] {
    const out: string[] = [];
    if (!p) return out;

    // Regex matching sentence terminators followed by quotes/brackets and whitespace/boundary
    // Note: \u06D4 is Urdu full stop (۔), \u061F is Arabic question mark (؟)
    const regex = /([^.!?\u06D4\u061F]+[.!?\u06D4\u061F]+['")\]]*(?:\s+|$)|[^.!?\u06D4\u061F]+$)/g;
    let match;
    while ((match = regex.exec(p)) !== null) {
      const piece = match[0].trim();
      if (piece) out.push(piece);
    }
    return out.length > 0 ? out : [p.trim()];
  },

  splitWords(s: string, eff: number): string[] {
    const out: string[] = [];
    let cur = '';
    const words = (s || '').match(/\S+/g) || [];

    for (const w of words) {
      const wl = this.ulen(w);
      if (wl > eff) {
        if (cur !== '') {
          out.push(cur);
          cur = '';
        }
        let rest = w;
        while (this.ulen(rest) > eff) {
          const chars = Array.from(rest);
          const chunk = chars.slice(0, eff).join('');
          out.push(chunk);
          rest = chars.slice(eff).join('');
        }
        cur = rest;
      } else if (cur !== '' && this.ulen(cur) + 1 + wl <= eff) {
        cur = cur + ' ' + w;
      } else {
        if (cur !== '') out.push(cur);
        cur = w;
      }
    }
    if (cur !== '') out.push(cur);
    return out;
  },

  splitLong(p: string, maxChars: number, carry: boolean): string[] {
    let prefix: string | null = null;
    let eff = maxChars;

    if (carry) {
      const match = p.match(/^([^:\n]+):\s/);
      if (match && this.ulen(match[1]) <= 40) {
        prefix = match[1];
        eff = maxChars - (this.ulen(prefix) + 2);
        if (eff < 50) eff = 50;
      }
    }

    const sentences = this.splitSentences(p);
    const pieces: string[] = [];
    let cur = '';

    for (const s of sentences) {
      const sl = this.ulen(s);
      if (sl > eff) {
        if (cur !== '') {
          pieces.push(cur);
          cur = '';
        }
        const words = this.splitWords(s, eff);
        for (let i = 0; i < words.length - 1; i++) {
          pieces.push(words[i]);
        }
        cur = words[words.length - 1] || '';
      } else if (cur !== '' && this.ulen(cur) + 1 + sl <= eff) {
        cur = cur + ' ' + s;
      } else {
        if (cur !== '') pieces.push(cur);
        cur = s;
      }
    }
    if (cur !== '') pieces.push(cur);

    if (prefix) {
      for (let i = 1; i < pieces.length; i++) {
        pieces[i] = prefix + ': ' + pieces[i];
      }
    }
    return pieces;
  },

  splitChunks(text: string, maxChars: number, carry: boolean = false): string[] {
    text = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    maxChars = Math.max(50, Math.floor(maxChars || 1800));
    const chunks: string[] = [];
    let cur = '';

    const flush = () => {
      const c = this.trim(cur);
      if (c !== '' && this.hasContent(c)) {
        chunks.push(c);
      }
      cur = '';
    };

    const paragraphs = text.split('\n');
    for (const para of paragraphs) {
      const p = this.trim(para);
      if (p !== '') {
        const pl = this.ulen(p);
        if (pl > maxChars) {
          flush();
          const pieces = this.splitLong(p, maxChars, carry);
          for (let i = 0; i < pieces.length - 1; i++) {
            chunks.push(pieces[i]);
          }
          cur = pieces[pieces.length - 1] || '';
        } else if (cur !== '' && this.ulen(cur) + 1 + pl <= maxChars) {
          cur = cur + '\n' + p;
        } else {
          flush();
          cur = p;
        }
      }
    }
    flush();
    return chunks;
  },

  parseKeys(raw: string): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    const tokens = (raw || '').match(/[^%s,;\s\n]+/g) || [];
    for (const tok of tokens) {
      if (tok.length >= 15 && !seen.has(tok)) {
        seen.add(tok);
        out.push(tok);
      }
    }
    return out;
  },

  keyTail(k: string): string {
    return k && k.length >= 4 ? k.slice(-4) : k;
  },

  le32(v: number): number[] {
    v = Math.floor(v);
    return [
      v % 256,
      Math.floor(v / 256) % 256,
      Math.floor(v / 65536) % 256,
      Math.floor(v / 16777216) % 256
    ];
  },

  wavHeader(dataLen: number, rate: number = 24000, channels: number = 1): number[] {
    const byteRate = rate * channels * 2;
    const t = [82, 73, 70, 70]; // "RIFF"
    const add = (bytes: number[]) => {
      for (const b of bytes) t.push(b);
    };
    add(this.le32(dataLen + 36));
    add([87, 65, 86, 69, 102, 109, 116, 32, 16, 0, 0, 0, 1, 0, channels, 0]); // "WAVEfmt "
    add(this.le32(rate));
    add(this.le32(byteRate));
    add([channels * 2, 0, 16, 0, 100, 97, 116, 97]); // blockAlign, bitsPerSample, "data"
    add(this.le32(dataLen));
    return t;
  },

  voiceName(label: string): string {
    const match = (label || '').match(/^(\S+)/);
    return match ? match[1] : 'Kore';
  },

  langEnglish(label: string): string | null {
    if (!label || label === '' || label === 'Auto Detect') return null;
    const match = label.match(/^(.-)\s*\(/);
    return match ? match[1].trim() : label;
  },

  isNewSchema(model: string): boolean {
    const match = (model || '').match(/gemini-(\d+)\.(\d+)/);
    if (!match) return false;
    const maj = parseInt(match[1], 10);
    const min = parseInt(match[2], 10);
    return maj > 3 || (maj === 3 && min >= 8);
  },

  buildRequest(cfg: {
    model: string;
    voice: string;
    lang: string;
    style?: string;
    multi?: boolean;
    sp1Name?: string;
    sp1Voice?: string;
    sp2Name?: string;
    sp2Voice?: string;
  }, text: string) {
    const newS = this.isNewSchema(cfg.model);
    const style = this.trim(cfg.style || '');
    const gen: Record<string, any> = { responseModalities: ['AUDIO'] };
    let contents: any;

    let multiCfg: any = null;
    if (cfg.multi) {
      multiCfg = {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            { speaker: cfg.sp1Name || 'Joe', voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.sp1Voice || 'Puck' } } },
            { speaker: cfg.sp2Name || 'Jane', voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.sp2Voice || 'Kore' } } }
          ]
        }
      };
    }

    if (newS) {
      if (cfg.multi) {
        const parts: any[] = [];
        let last = cfg.sp1Name || 'Joe';
        const lines = (text || '').split('\n');
        for (let line of lines) {
          line = this.trim(line);
          if (line !== '') {
            // Check matchSpeaker
            const sp1 = (cfg.sp1Name || 'Joe').toLowerCase() + ':';
            const sp2 = (cfg.sp2Name || 'Jane').toLowerCase() + ':';
            if (line.toLowerCase().startsWith(sp1)) {
              last = cfg.sp1Name || 'Joe';
              line = this.trim(line.slice(sp1.length));
            } else if (line.toLowerCase().startsWith(sp2)) {
              last = cfg.sp2Name || 'Jane';
              line = this.trim(line.slice(sp2.length));
            }

            if (line !== '') {
              const meta: any = { speaker: last };
              if (style !== '') meta.style = style;
              parts.push({ text: line, speech_metadata: meta });
            }
          }
        }
        if (parts.length === 0) {
          parts.push({ text, speech_metadata: { speaker: cfg.sp1Name || 'Joe' } });
        }
        contents = [{ role: 'user', parts }];
        gen.speechConfig = multiCfg;
      } else {
        const part: any = { text };
        if (style !== '') part.speech_metadata = { style };
        contents = [{ role: 'user', parts: [part] }];
        gen.speechConfig = { voiceConfig: { voice: cfg.voice } };
      }
    } else {
      const hints: string[] = [];
      const ln = this.langEnglish(cfg.lang);
      if (ln) hints.push('in ' + ln);
      if (style !== '') hints.push(style);

      let prompt = '';
      if (cfg.multi) {
        const extra = hints.length > 0 ? ' ' + hints.join(', ') : '';
        prompt = `TTS the following conversation between ${cfg.sp1Name || 'Joe'} and ${cfg.sp2Name || 'Jane'}${extra}:\n${text}`;
        gen.speechConfig = multiCfg;
      } else {
        if (hints.length > 0) {
          prompt = `Say ${hints.join(', ')}:\n${text}`;
        } else {
          prompt = text;
        }
        gen.speechConfig = { voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.voice } } };
      }
      contents = [{ parts: [{ text: prompt }] }];
    }

    return { contents, generationConfig: gen };
  }
};
