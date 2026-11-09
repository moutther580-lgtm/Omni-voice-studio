import React, { useState } from 'react';
import { MIGRATION_TOPICS } from '../data/migrationGuide';
import { BookOpen, CheckCircle2, AlertTriangle, ArrowRight, Code } from 'lucide-react';

export const ArchitectureGuide: React.FC = () => {
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0);
  const currentTopic = MIGRATION_TOPICS[selectedTopicIndex];
  const [langTab, setLangTab] = useState<'kotlin' | 'java'>('kotlin');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-400" />
          Senior Architect Migration Guide: Lua to Native Android
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          In-depth technical breakdown covering concurrency, memory alignment, hardware encoders, and accessibility.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Navigation list */}
        <div className="lg:col-span-4 space-y-2">
          {MIGRATION_TOPICS.map((topic, idx) => {
            const isSelected = selectedTopicIndex === idx;
            return (
              <button
                key={topic.title}
                onClick={() => setSelectedTopicIndex(idx)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600/15 border-blue-500/50 text-white shadow-sm'
                    : 'bg-slate-900 border-slate-800 hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-blue-300">
                    {topic.badge}
                  </span>
                  {isSelected && <ArrowRight className="w-4 h-4 text-blue-400" />}
                </div>
                <h3 className="text-sm font-bold">{topic.title}</h3>
                <p className="text-xs text-slate-400 line-clamp-2">{topic.summary}</p>
              </button>
            );
          })}
        </div>

        {/* Detailed Breakdown */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                  {currentTopic.badge}
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">{currentTopic.title}</h3>
              </div>
            </div>

            <p className="text-sm text-slate-300">{currentTopic.summary}</p>

            {/* Code Comparison */}
            <div className="space-y-4">
              {/* Lua Source */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                <div className="px-3.5 py-2 bg-slate-900/70 border-b border-slate-800 text-xs font-mono text-amber-300 flex items-center justify-between">
                  <span>Original Lua (AndroLua v20)</span>
                  <span className="text-[10px] text-slate-500">1-indexed / Single Threaded</span>
                </div>
                <div className="p-3 text-xs font-mono text-slate-300 overflow-x-auto">
                  <pre>
                    <code>{currentTopic.luaPattern}</code>
                  </pre>
                </div>
              </div>

              {/* Native Android Target */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                <div className="px-3.5 py-2 bg-slate-900/70 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setLangTab('kotlin')}
                      className={`text-xs font-mono px-2 py-0.5 rounded cursor-pointer ${
                        langTab === 'kotlin' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Kotlin Equivalent
                    </button>
                    <button
                      onClick={() => setLangTab('java')}
                      className={`text-xs font-mono px-2 py-0.5 rounded cursor-pointer ${
                        langTab === 'java' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Java Equivalent
                    </button>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono">0-indexed / Multi-Threaded</span>
                </div>
                <div className="p-3 text-xs font-mono text-slate-200 overflow-x-auto">
                  <pre>
                    <code>{langTab === 'kotlin' ? currentTopic.kotlinEquivalent : currentTopic.javaEquivalent}</code>
                  </pre>
                </div>
              </div>
            </div>

            {/* Architectural Deep Dive Points */}
            <div className="pt-3 border-t border-slate-800 space-y-2.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Architectural Notes &amp; Implementation Details:
              </h4>
              <div className="space-y-2">
                {currentTopic.deepDive.map((note, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
