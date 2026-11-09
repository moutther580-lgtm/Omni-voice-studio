import React, { useState } from 'react';
import { Download, Code2, Cpu, BookOpen, Layers, Check, User, Smartphone, Volume2, Wallet, Rocket } from 'lucide-react';
import { generateAndroidStudioProjectZip } from '../utils/zipExport';
import { PureLogic } from '../data/pureLogic';

interface HeaderProps {
  activeTab: 'app' | 'playstore' | 'explorer' | 'workbench' | 'guide';
  setActiveTab: (tab: 'app' | 'playstore' | 'explorer' | 'workbench' | 'guide') => void;
  onOpenAccount: () => void;
  userCredits: number;
  isLoggedIn: boolean;
}

export const Header: React.FC<HeaderProps> = ({ 
  activeTab, 
  setActiveTab,
  onOpenAccount,
  userCredits,
  isLoggedIn
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownloadZip = async () => {
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
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <header className="border-b border-slate-800 bg-[#0C0E12] text-slate-100 sticky top-0 z-40 backdrop-blur-md bg-[#0C0E12]/95" role="banner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          
          {/* Brand Identity: OmniVoice Studio */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center font-bold text-slate-950 shadow-lg shadow-amber-500/20 shrink-0" aria-hidden="true">
              <Volume2 className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>OmniVoice Studio</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">Universal Audio</span>
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  v2.0 RELEASE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Global High-Cadence Speech Synthesizer • Founder &amp; CEO: Moutter Rasool
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2.5 self-end sm:self-center">
            {/* Wallet / Credit Balance Badge */}
            <button
              onClick={onOpenAccount}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#14171D] hover:bg-[#1A1E26] border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-mono transition-all cursor-pointer shadow-sm"
              title="Open Account & Wallet"
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-white font-bold">{PureLogic.commas(userCredits)}</span>
              <span className="text-slate-400 text-[10px]">Credits</span>
            </button>

            {/* Profile Button */}
            <button
              onClick={onOpenAccount}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                isLoggedIn
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-[#14171D] border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{isLoggedIn ? 'Moutter (CEO)' : 'Account'}</span>
            </button>

            {/* Download Android Studio Project */}
            <button
              onClick={handleDownloadZip}
              disabled={downloading}
              className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 text-slate-950 font-bold text-xs rounded-lg shadow-md transition-all cursor-pointer"
            >
              <Download className={`w-3.5 h-3.5 ${downloading ? 'animate-bounce' : ''}`} />
              <span>{downloadSuccess ? 'Downloaded!' : 'Download Android App (.ZIP)'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-3.5 flex border-b border-slate-800 space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar pt-1">
          <button
            onClick={() => setActiveTab('app')}
            className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'app'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4 text-amber-400" />
            <span>Voice Studio Deck</span>
          </button>

          <button
            onClick={() => setActiveTab('playstore')}
            className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'playstore'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Rocket className="w-4 h-4 text-emerald-400" />
            <span>Play Store Release Hub (.AAB &amp; .APK)</span>
          </button>

          <button
            onClick={() => setActiveTab('explorer')}
            className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'explorer'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Android Code (Java &amp; Kotlin)</span>
          </button>

          <button
            onClick={() => setActiveTab('workbench')}
            className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'workbench'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Acoustic Algorithm Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'guide'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Architecture &amp; Rules</span>
          </button>
        </div>
      </div>
    </header>
  );
};
