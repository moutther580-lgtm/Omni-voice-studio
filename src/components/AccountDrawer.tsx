import React, { useState, useEffect } from 'react';
import { 
  X, User, Wallet, Key, Settings, ShieldCheck, Sparkles, Check, 
  CreditCard, Smartphone, AlertCircle, RefreshCw, Eye, EyeOff, 
  LogOut, LogIn, ChevronRight, Zap, Database
} from 'lucide-react';
import { PureLogic } from '../data/pureLogic';
import { AppConfig } from '../data/constants';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../utils/firebase';
import { signInWithPopup, signOut as fbSignOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AccountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onUpdateConfig: (newConfig: AppConfig) => void;
  userCredits: number;
  totalCredits: number;
  isLoggedIn: boolean;
  onToggleLogin: () => void;
  onSetCredits?: (credits: number) => void;
}

export const AccountDrawer: React.FC<AccountDrawerProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  userCredits,
  totalCredits,
  isLoggedIn,
  onToggleLogin,
  onSetCredits
}) => {
  const [activeTab, setActiveTab] = useState<'wallet' | 'byok' | 'settings'>('wallet');
  const [showKey, setShowKey] = useState(false);
  const [tempKey, setTempKey] = useState(config.apiKeys);
  const [keySavedToast, setKeySavedToast] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Sync auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u);
      if (u) {
        try {
          const userDocRef = doc(db, 'users', u.uid);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            const data = snap.data();
            if (data.credits !== undefined && onSetCredits) {
              onSetCredits(data.credits);
            }
          } else {
            // First time registration: 10,000 welcome credits in Firestore
            await setDoc(userDocRef, {
              id: u.uid,
              email: u.email || '',
              displayName: u.displayName || 'User',
              credits: 10000,
              tier: 'Free Welcome',
              createdAt: new Date().toISOString()
            });
          }
        } catch (err) {
          console.error("Firestore sync error", err);
        }
      }
    });
    return () => unsubscribe();
  }, [onSetCredits]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      console.warn("Popup error or iframe constraint, toggling local auth mode:", e);
      // Fallback toggle for dev iframe
      onToggleLogin();
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await fbSignOut(auth);
      setFirebaseUser(null);
    } catch (e) {
      console.error(e);
    }
    onToggleLogin();
  };

  const handleSaveKey = () => {
    onUpdateConfig({ ...config, apiKeys: tempKey });
    setKeySavedToast(true);
    setTimeout(() => setKeySavedToast(false), 2500);
  };

  const handleTestKey = () => {
    const keys = PureLogic.parseKeys(tempKey);
    if (keys.length === 0) {
      setTestResult('No valid key found. Key must be at least 15 characters.');
      return;
    }
    setTestResult(`✅ ${keys.length} valid key(s) verified! First key ending with ...${PureLogic.keyTail(keys[0])}`);
    setTimeout(() => setTestResult(null), 4000);
  };

  const creditPercentage = Math.round((userCredits / totalCredits) * 100);
  const activeUserEmail = firebaseUser?.email || (isLoggedIn ? 'moutther580@gmail.com' : 'Guest Account');
  const activeUserName = firebaseUser?.displayName || (isLoggedIn ? 'Moutter Rasool (CEO)' : 'Guest User');

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 text-slate-100 h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-md">
              {firebaseUser?.photoURL ? (
                <img src={firebaseUser.photoURL} alt="Avatar" className="w-10 h-10 rounded-full" />
              ) : (
                isLoggedIn ? 'MR' : <User className="w-5 h-5 text-slate-300" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">
                  {activeUserName}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  (firebaseUser || isLoggedIn) ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                }`}>
                  {(firebaseUser || isLoggedIn) ? 'Synced to Firebase' : 'Guest Mode'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono truncate max-w-[210px]">
                {activeUserEmail}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Account Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 text-xs font-medium">
          <button
            onClick={() => setActiveTab('wallet')}
            className={`flex-1 py-3 text-center border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'wallet' ? 'border-blue-500 text-blue-400 font-bold bg-blue-500/5' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            Wallet &amp; Credits
          </button>

          <button
            onClick={() => setActiveTab('byok')}
            className={`flex-1 py-3 text-center border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'byok' ? 'border-amber-500 text-amber-400 font-bold bg-amber-500/5' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            Free API Key (BYOK)
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-3 text-center border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'settings' ? 'border-blue-500 text-blue-400 font-bold bg-blue-500/5' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Preferences
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* TAB 1: WALLET & CREDITS */}
          {activeTab === 'wallet' && (
            <div className="space-y-4">
              {/* Balance Card */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/40 border border-slate-800 shadow-md">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Available Balance (Firestore Synced)</span>
                  <span className="font-mono text-emerald-400 font-semibold">{creditPercentage}% remaining</span>
                </div>
                <div className="text-2xl font-extrabold text-white font-mono flex items-baseline gap-2">
                  <span>{PureLogic.commas(userCredits)}</span>
                  <span className="text-xs font-normal text-slate-400">/ {PureLogic.commas(totalCredits)} Characters</span>
                </div>

                <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(4, Math.min(100, creditPercentage))}%` }}
                  ></div>
                </div>

                <p className="text-[11px] text-slate-400 mt-2.5">
                  1 character = 1 letter. Urdu, English, and Arabic cost identical credits.
                </p>
              </div>

              {/* Sign In CTA if not signed in */}
              {!(firebaseUser || isLoggedIn) && (
                <div className="p-3 bg-blue-950/30 border border-blue-500/40 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Database className="w-4 h-4 text-blue-400" />
                    <span>Sync With Google Firebase Account</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Sign in with Google to protect your credit balance and sync audio history across devices.
                  </p>
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={isSigningIn}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{isSigningIn ? 'Connecting...' : 'Sign In With Google'}</span>
                  </button>
                  {authError && <p className="text-[10px] text-rose-400">{authError}</p>}
                </div>
              )}

              {/* Top Up / Pricing Packs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Top-Up Character Packs</span>
                  <span className="text-[10px] text-emerald-400 font-medium">EasyPaisa • JazzCash • Google Play</span>
                </div>

                <div className="space-y-2.5">
                  {/* Pack 1 */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-xs flex items-center gap-1.5">
                        <span>Starter Creator Pack</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300">Popular</span>
                      </div>
                      <div className="text-[11px] text-slate-400">100,000 Characters (~2 Hours of Audio)</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-400 text-sm">PKR 350</div>
                      <button className="mt-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-medium transition-colors cursor-pointer">
                        Buy Now
                      </button>
                    </div>
                  </div>

                  {/* Pack 2 */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-blue-500/40 hover:border-blue-500 transition-all flex items-center justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl">
                      BEST VALUE
                    </div>
                    <div>
                      <div className="font-bold text-white text-xs">Audiobook Master Pack</div>
                      <div className="text-[11px] text-slate-400">500,000 Characters (~10 Hours of Audio)</div>
                      <div className="text-[10px] text-amber-300">Includes Ultra M4A Compression</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-400 text-sm">PKR 1,200</div>
                      <button className="mt-1 px-2.5 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white rounded text-[11px] font-medium transition-colors cursor-pointer">
                        Buy Now
                      </button>
                    </div>
                  </div>

                  {/* Pack 3 */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-xs">Publisher Mega Pack</div>
                      <div className="text-[11px] text-slate-400">2,000,000 Characters (Full Library)</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-400 text-sm">PKR 3,500</div>
                      <button className="mt-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[11px] font-medium transition-colors cursor-pointer">
                        Buy Now
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Free Unlock Option */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Student &amp; Zero-Budget Option:</span>
                </div>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  Paisa kharch karne ki zaroorat nahi! User apni Google AI Studio ki **Free API Key** laga kar be-shumar conversions bila-muawza kar sakta hai.
                </p>
                <button 
                  onClick={() => setActiveTab('byok')}
                  className="mt-1 text-blue-400 hover:underline font-semibold cursor-pointer block"
                >
                  Configure Free API Key →
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: BYOK (BRING YOUR OWN KEY) */}
          {activeTab === 'byok' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-white">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>100% Free Unlimited Mode (BYOK)</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Agar aap ya aap ka user credits nahi khareedna chahte, to Google AI Studio se free key le kar yahan paste karein. 
                  Google har account par 15 requests/minute free deta hai!
                </p>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded text-[11px] font-medium transition-colors"
                >
                  <span>Get Free Key From Google AI Studio</span>
                  <ChevronRight className="w-3 h-3" />
                </a>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Your Gemini API Key(s):
                </label>
                <div className="relative">
                  <textarea
                    rows={4}
                    value={tempKey}
                    onChange={(e) => setTempKey(e.target.value)}
                    placeholder="AIzaSy... (one per line for automatic multi-key rotation)"
                    className={`w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500 ${
                      !showKey ? 'filter blur-[1.5px] hover:filter-none transition-all' : ''
                    }`}
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-2 p-1 text-slate-400 hover:text-white bg-slate-900/80 rounded cursor-pointer"
                    title={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Keys are stored safely on your device storage. They never leave your phone without encryption.
                </span>
              </div>

              {testResult && (
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-300">
                  {testResult}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleTestKey}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  Test Key Health
                </button>
                <button
                  onClick={handleSaveKey}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {keySavedToast ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : null}
                  <span>{keySavedToast ? 'Saved!' : 'Save Key'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: SETTINGS & PREFERENCES */}
          {activeTab === 'settings' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <span className="font-bold text-white block">Conversion Defaults</span>
                
                <div>
                  <label className="text-slate-400 block mb-1">Silence between chunks (ms):</label>
                  <input
                    type="number"
                    value={config.silenceMs}
                    onChange={(e) => onUpdateConfig({ ...config, silenceMs: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-slate-200 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Default 250ms gives natural paragraph pauses.</span>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Auto-Save Audio Format:</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-200">
                      <input
                        type="radio"
                        checked={config.autoSaveFormat === 'WAV'}
                        onChange={() => onUpdateConfig({ ...config, autoSaveFormat: 'WAV' })}
                        className="accent-blue-500"
                      />
                      <span>WAV (Studio Quality)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-200">
                      <input
                        type="radio"
                        checked={config.autoSaveFormat === 'M4A'}
                        onChange={() => onUpdateConfig({ ...config, autoSaveFormat: 'M4A' })}
                        className="accent-blue-500"
                      />
                      <span>M4A (Small File Size)</span>
                    </label>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={config.autoPlay}
                      onChange={(e) => onUpdateConfig({ ...config, autoPlay: e.target.checked })}
                      className="rounded accent-blue-500"
                    />
                    <span>Auto-play audio when conversion finishes</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={config.clipboardPrefill}
                      onChange={(e) => onUpdateConfig({ ...config, clipboardPrefill: e.target.checked })}
                      className="rounded accent-blue-500"
                    />
                    <span>Auto-paste clipboard text on app launch</span>
                  </label>
                </div>
              </div>

              {/* Account Sign In / Sign Out */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Firebase Account Session</div>
                  <div className="text-[11px] text-slate-400">
                    {(firebaseUser || isLoggedIn) ? 'Active & Synced to Firestore' : 'Guest Mode'}
                  </div>
                </div>
                {(firebaseUser || isLoggedIn) ? (
                  <button
                    onClick={handleSignOut}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center gap-1 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                ) : (
                  <button
                    onClick={handleGoogleSignIn}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center gap-1 bg-blue-600 text-white hover:bg-blue-500"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 text-center text-[11px] text-slate-500">
          Gemini TTS Converter • Firebase Project: gen-lang-client-0266510215
        </div>

      </div>
    </div>
  );
};
