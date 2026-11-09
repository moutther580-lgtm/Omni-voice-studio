import React, { useState } from 'react';
import { KOTLIN_SOURCE_FILES, SourceFile } from '../data/androidSourceKotlin';
import { JAVA_SOURCE_FILES } from '../data/androidSourceJava';
import { CONFIG_SOURCE_FILES } from '../data/androidProjectConfig';
import { Copy, Check, FileCode, Folder, Columns, FileText, Sparkles, Terminal } from 'lucide-react';

export const CodeExplorer: React.FC = () => {
  const [selectedLanguage, setSelectedLanguage] = useState<'kotlin' | 'java' | 'config' | 'sideBySide'>('kotlin');
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copiedSecondary, setCopiedSecondary] = useState(false);

  const getFileList = (): SourceFile[] => {
    switch (selectedLanguage) {
      case 'kotlin':
        return KOTLIN_SOURCE_FILES;
      case 'java':
        return JAVA_SOURCE_FILES;
      case 'config':
        return CONFIG_SOURCE_FILES;
      case 'sideBySide':
        return KOTLIN_SOURCE_FILES;
    }
  };

  const files = getFileList();
  const currentFile = files[Math.min(selectedFileIndex, files.length - 1)] || files[0];

  // In side-by-side mode, find matching Java file
  const matchingJavaFile = JAVA_SOURCE_FILES.find(
    (jf) => jf.name.replace('.java', '') === currentFile.name.replace('.kt', '')
  );

  const handleCopy = (text: string, isSec: boolean = false) => {
    navigator.clipboard.writeText(text);
    if (isSec) {
      setCopiedSecondary(true);
      setTimeout(() => setCopiedSecondary(false), 2000);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Language / View Mode Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          <button
            onClick={() => { setSelectedLanguage('kotlin'); setSelectedFileIndex(0); }}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              selectedLanguage === 'kotlin' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Kotlin Sources (Coroutines)
          </button>
          <button
            onClick={() => { setSelectedLanguage('java'); setSelectedFileIndex(0); }}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              selectedLanguage === 'java' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Java Sources (Standard Java 17)
          </button>
          <button
            onClick={() => { setSelectedLanguage('sideBySide'); setSelectedFileIndex(0); }}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              selectedLanguage === 'sideBySide' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            Side-by-Side (Kotlin vs Java)
          </button>
          <button
            onClick={() => { setSelectedLanguage('config'); setSelectedFileIndex(0); }}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              selectedLanguage === 'config' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Manifest &amp; Gradle
          </button>
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Zero Placeholders • Ready for Android Studio</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* File Navigator Sidebar */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col max-h-[750px]">
          <div className="p-3.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-blue-400" />
              Project Files ({files.length})
            </span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              {selectedLanguage}
            </span>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-800/40 p-1.5 space-y-1">
            {files.map((file, idx) => {
              const isSelected = selectedFileIndex === idx;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFileIndex(idx)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all cursor-pointer flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-blue-600/15 border border-blue-500/40 text-blue-300'
                      : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileCode className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
                    <span className="font-mono font-medium truncate">{file.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 truncate pl-5">
                    {file.package}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-3 bg-slate-950/40 border-t border-slate-800 mt-auto text-[11px] text-slate-400 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-slate-500" />
            <span>Target SDK: 35 (Android 15 Ready)</span>
          </div>
        </div>

        {/* Code Content Area */}
        <div className="lg:col-span-9 flex flex-col space-y-4">
          {/* Metadata Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white font-mono">{currentFile.name}</h2>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300">
                    {currentFile.path}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-300">{currentFile.description}</p>
                {currentFile.luaMapping && (
                  <div className="mt-2 text-[11px] text-amber-400/90 font-mono flex items-center gap-1">
                    <span className="text-slate-400">Translated Lua modules:</span>
                    <span className="bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/30">
                      {currentFile.luaMapping}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <button
                  onClick={() => handleCopy(currentFile.code)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Code'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Standard Single View */}
          {selectedLanguage !== 'sideBySide' ? (
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
              <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>{currentFile.name} — {currentFile.language.toUpperCase()}</span>
                <span>{currentFile.code.split('\n').length} lines</span>
              </div>
              <div className="p-4 overflow-x-auto max-h-[600px] overflow-y-auto text-xs font-mono leading-relaxed text-slate-200 select-all">
                <pre>
                  <code>{currentFile.code}</code>
                </pre>
              </div>
            </div>
          ) : (
            /* Side-by-Side View (Kotlin vs Java) */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Kotlin Pane */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
                <div className="px-4 py-2 bg-blue-950/40 border-b border-slate-800 flex items-center justify-between text-xs text-blue-300 font-mono">
                  <span>Kotlin: {currentFile.name}</span>
                  <button
                    onClick={() => handleCopy(currentFile.code)}
                    className="hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy</span>
                  </button>
                </div>
                <div className="p-3.5 overflow-x-auto max-h-[580px] overflow-y-auto text-xs font-mono leading-relaxed text-slate-200">
                  <pre>
                    <code>{currentFile.code}</code>
                  </pre>
                </div>
              </div>

              {/* Java Pane */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
                <div className="px-4 py-2 bg-indigo-950/40 border-b border-slate-800 flex items-center justify-between text-xs text-indigo-300 font-mono">
                  <span>Java: {matchingJavaFile ? matchingJavaFile.name : 'N/A'}</span>
                  {matchingJavaFile && (
                    <button
                      onClick={() => handleCopy(matchingJavaFile.code, true)}
                      className="hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedSecondary ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copy</span>
                    </button>
                  )}
                </div>
                <div className="p-3.5 overflow-x-auto max-h-[580px] overflow-y-auto text-xs font-mono leading-relaxed text-slate-200">
                  <pre>
                    <code>
                      {matchingJavaFile
                        ? matchingJavaFile.code
                        : '// No direct Java equivalent file for this module.'}
                    </code>
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
