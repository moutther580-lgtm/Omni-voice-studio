import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CommercialAppView } from './components/CommercialAppView';
import { PlayStoreLaunchpad } from './components/PlayStoreLaunchpad';
import { CodeExplorer } from './components/CodeExplorer';
import { InteractiveWorkbench } from './components/InteractiveWorkbench';
import { ArchitectureGuide } from './components/ArchitectureGuide';
import { AccountDrawer } from './components/AccountDrawer';
import { DEFAULT_CONFIG, AppConfig } from './data/constants';
import { ShieldCheck, Download, Smartphone } from 'lucide-react';
import { generateAndroidStudioProjectZip } from './utils/zipExport';
import { testFirestoreConnection } from './utils/firebase';

export default function App() {
  const [activeTab, setActiveTab] = useState<'app' | 'playstore' | 'explorer' | 'workbench' | 'guide'>('app');
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [userCredits, setUserCredits] = useState<number>(10000); // 10,000 free welcome credits
  const totalCredits = 10000;
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    testFirestoreConnection();
  }, []);

  const handleDeductCredits = (chars: number) => {
    // Only deduct if user doesn't have custom BYOK key
    if (!config.apiKeys) {
      setUserCredits((prev) => Math.max(0, prev - chars));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navigation & App Banner */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAccount={() => setIsAccountOpen(true)}
        userCredits={userCredits}
        isLoggedIn={isLoggedIn}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 pb-16">
        {activeTab === 'app' && (
          <CommercialAppView
            config={config}
            onUpdateConfig={setConfig}
            onOpenAccount={() => setIsAccountOpen(true)}
            userCredits={userCredits}
            onDeductCredits={handleDeductCredits}
            isLoggedIn={isLoggedIn}
          />
        )}
        {activeTab === 'playstore' && <PlayStoreLaunchpad />}
        {activeTab === 'explorer' && <CodeExplorer />}
        {activeTab === 'workbench' && <InteractiveWorkbench />}
        {activeTab === 'guide' && <ArchitectureGuide />}
      </main>

      {/* Account, Wallet, Pricing & BYOK Drawer */}
      <AccountDrawer
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        config={config}
        onUpdateConfig={setConfig}
        userCredits={userCredits}
        totalCredits={totalCredits}
        isLoggedIn={isLoggedIn}
        onToggleLogin={() => setIsLoggedIn((prev) => !prev)}
        onSetCredits={(c) => setUserCredits(c)}
      />

      {/* Production-grade Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <div className="flex items-center gap-1.5 font-medium text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Gemini Voice Studio • Firebase Auth &amp; Firestore Synced</span>
            </div>
            <span className="hidden sm:inline text-slate-700">•</span>
            <span>Founder &amp; CEO: Moutter Rasool</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => setActiveTab('playstore')}
              className="text-emerald-400 hover:text-emerald-300 cursor-pointer font-medium"
            >
              Play Store .AAB &amp; .APK Guide
            </button>
            <span className="text-slate-700">•</span>
            <button
              onClick={async () => {
                const blob = await generateAndroidStudioProjectZip('all');
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `GeminiVoiceStudio_PlayStore_Project.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1 font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Android Studio Project (.ZIP)</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
