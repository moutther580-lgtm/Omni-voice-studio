import React, { useState } from 'react';
import { 
  Download, Terminal, Check, Copy, ShieldCheck, Play, Sparkles, 
  ExternalLink, ArrowRight, Smartphone, FileCheck, Layers, PackageCheck, Zap,
  RefreshCw, GitBranch, AlertTriangle
} from 'lucide-react';
import { generateAndroidStudioProjectZip } from '../utils/zipExport';

export const PlayStoreLaunchpad: React.FC = () => {
  const [copiedKeytool, setCopiedKeytool] = useState(false);
  const [copiedBundle, setCopiedBundle] = useState(false);
  const [copiedApk, setCopiedApk] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Update simulator state
  const [currentVersionCode, setCurrentVersionCode] = useState(20);
  const [currentVersionName, setCurrentVersionName] = useState('2.0');
  const [bumpSuccess, setBumpSuccess] = useState(false);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const blob = await generateAndroidStudioProjectZip('all');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OmniVoiceStudio_PlayStore_Project.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const copyText = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const handleBumpVersion = () => {
    const nextCode = currentVersionCode + 1;
    const parts = currentVersionName.split('.');
    const nextMinor = (parseInt(parts[1] || '0', 10) + 1);
    const nextName = `${parts[0]}.${nextMinor}`;
    setCurrentVersionCode(nextCode);
    setCurrentVersionName(nextName);
    setBumpSuccess(true);
    setTimeout(() => setBumpSuccess(false), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/30 via-slate-900 to-[#121418] border border-amber-500/30 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Official Play Store Launchpad
              </span>
              <span className="text-xs text-slate-400">App: OmniVoice Studio • Package: com.omnivoice.studio • Target SDK: 35</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-1.5 flex items-center gap-2">
              Google Play Console Release &amp; Future Updates Hub
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1">
              Bhai, yahan se aap apni pehli release (Version {currentVersionName}) aur aainda aane wali tamam **Updates** asani se tayyar karke Play Store par publish kar sakte hain.
            </p>
          </div>

          <button
            onClick={handleDownload}
            disabled={downloading}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 text-slate-950 font-bold text-sm shadow-xl shadow-amber-500/25 transition-all cursor-pointer flex items-center gap-2 shrink-0 self-start md:self-center disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
            <span>{downloading ? 'Packing App Bundle...' : 'Download Android Studio App (.ZIP)'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: BUILD & UPDATE SYSTEM */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Play Store Update Management Guide */}
          <div className="bg-[#121418] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-400" />
                <span>Play Store Par Nayi Update Kaise Denge? (Update Protocol)</span>
              </h3>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300">
                v{currentVersionName} (Code {currentVersionCode})
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Jab aap app pehli baar launch kar dein aur baad mein koi naya feature daalna ho ya update deni ho, to Google Play Console ka yeh **Golden Rule** yaad rakhein:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-[#0A0C0E] rounded-lg border border-slate-800 space-y-1">
                <span className="text-[11px] font-mono font-bold text-amber-400">Rule 1: VersionCode Bump</span>
                <p className="text-[11px] text-slate-400">
                  Har nayi update mein <code className="text-white">versionCode</code> barhana lazmi hai (e.g. 20 se 21). Google purana code dobara accept nahi karta.
                </p>
              </div>

              <div className="p-3 bg-[#0A0C0E] rounded-lg border border-slate-800 space-y-1">
                <span className="text-[11px] font-mono font-bold text-amber-400">Rule 2: Same Keystore</span>
                <p className="text-[11px] text-slate-400">
                  <code className="text-white">release.keystore</code> file hamesha mehfooz rakhein. Agar key gum ho gayi to aap app ko update nahi kar sakenge!
                </p>
              </div>

              <div className="p-3 bg-[#0A0C0E] rounded-lg border border-slate-800 space-y-1">
                <span className="text-[11px] font-mono font-bold text-amber-400">Rule 3: Staged Rollout</span>
                <p className="text-[11px] text-slate-400">
                  Pehle 10% ya 20% users ko update dein, sab theek chale to 100% rollout kar dein.
                </p>
              </div>
            </div>

            {/* Version Bump Simulator Button */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Next Version Preparation Tool</span>
                <span className="text-[11px] text-amber-300">Increment version for upcoming Google Play update</span>
              </div>
              <button
                onClick={handleBumpVersion}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>{bumpSuccess ? 'Bumped to v' + currentVersionName : 'Prepare Next Version'}</span>
              </button>
            </div>
          </div>

          {/* 3 Step Build Commands */}
          <div className="bg-[#121418] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Compilation &amp; Build Commands (Ready to Run)</span>
            </h3>

            {/* Step 1: Keystore */}
            <div className="p-3.5 bg-[#0A0C0E] rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-mono text-[11px]">1</span>
                  Digital Keystore (Only needed once for life)
                </span>
                <button
                  onClick={() => copyText('keytool -genkey -v -keystore release.keystore -alias geminitts -keyalg RSA -keysize 2048 -validity 10000', setCopiedKeytool)}
                  className="hover:text-white text-slate-400 flex items-center gap-1 cursor-pointer"
                >
                  {copiedKeytool ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKeytool ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="p-2 bg-slate-950 rounded font-mono text-[11px] text-amber-300 overflow-x-auto">
                keytool -genkey -v -keystore release.keystore -alias geminitts -keyalg RSA -keysize 2048 -validity 10000
              </div>
            </div>

            {/* Step 2: Build AAB */}
            <div className="p-3.5 bg-[#0A0C0E] rounded-xl border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono text-[11px]">2</span>
                  Build .AAB (Run this for initial release AND every future update)
                </span>
                <button
                  onClick={() => copyText('./gradlew bundleRelease', setCopiedBundle)}
                  className="hover:text-white text-slate-400 flex items-center gap-1 cursor-pointer"
                >
                  {copiedBundle ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedBundle ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="p-2 bg-slate-950 rounded font-mono text-[11px] text-emerald-300 overflow-x-auto">
                ./gradlew bundleRelease
              </div>
              <span className="text-[10px] text-emerald-400 font-mono block">
                Output file: app/build/outputs/bundle/release/app-release.aab
              </span>
            </div>

            {/* Step 3: Direct APK for Testing */}
            <div className="p-3.5 bg-[#0A0C0E] rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-mono text-[11px]">3</span>
                  Build Standalone .APK (Phone testing before upload)
                </span>
                <button
                  onClick={() => copyText('./gradlew assembleRelease', setCopiedApk)}
                  className="hover:text-white text-slate-400 flex items-center gap-1 cursor-pointer"
                >
                  {copiedApk ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedApk ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="p-2 bg-slate-950 rounded font-mono text-[11px] text-amber-300 overflow-x-auto">
                ./gradlew assembleRelease
              </div>
              <span className="text-[10px] text-slate-400 font-mono block">
                Output file: app/build/outputs/apk/release/app-release.apk
              </span>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: PLAY CONSOLE METADATA & REVENUE ENGINE */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#121418] border border-slate-800 rounded-xl p-5 shadow-sm space-y-3.5">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-amber-400" />
              <span>Google Play Console Metadata</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 bg-[#0A0C0E] rounded-lg border border-slate-800 flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">Official App Name (Max 30 Chars):</span>
                  <span className="text-amber-300 font-mono font-medium">OmniVoice: Pro Speech &amp; Audio</span>
                </div>
              </div>

              <div className="p-2.5 bg-[#0A0C0E] rounded-lg border border-slate-800 flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">Category &amp; Content Rating:</span>
                  <span className="text-slate-300">Tools / Audio Production • Rating: Everyone (PEGI 3)</span>
                </div>
              </div>

              <div className="p-2.5 bg-[#0A0C0E] rounded-lg border border-slate-800 flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">Backend Cloud Database:</span>
                  <span className="text-slate-300">Firebase Auth + Firestore Configured (`app/google-services.json`)</span>
                </div>
              </div>

              <div className="p-2.5 bg-[#0A0C0E] rounded-lg border border-slate-800 flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">In-App Purchases (Revenue Setup):</span>
                  <span className="text-slate-300">PKR 350 (Starter) • PKR 1,200 (Master) • PKR 3,500 (Mega)</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl text-xs text-amber-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-white">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Play Store Update Ka Tareeqa (Simple):</span>
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Jab bhi update deni ho:
                1. <code className="text-amber-300">versionCode</code> barhayein.
                2. <code className="text-emerald-400">./gradlew bundleRelease</code> chalayein.
                3. Play Console par **"Create New Release"** dabba kar nayi <code className="text-white font-mono">app-release.aab</code> upload kar dein.
                Aap ke tamam purane users ke mobile mein khud-bakhud update chali jayegi!
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
