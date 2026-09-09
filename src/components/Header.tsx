import React from 'react';
import type { TargetLanguage } from '../types';
import { SUPPORTED_LANGUAGES } from '../data/sampleVideos';
import { Languages, Radio, Volume2 } from 'lucide-react';

interface HeaderProps {
  selectedLanguage: TargetLanguage;
  onSelectLanguage: (lang: TargetLanguage) => void;
  isDemoMode: boolean;
  onToggleDemoMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedLanguage,
  onSelectLanguage,
  isDemoMode,
  onToggleDemoMode,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo & Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 shadow-lg shadow-indigo-500/25 ring-1 ring-violet-400/30">
            <Volume2 className="w-5 h-5 text-white animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                Vocal<span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">Scout</span>
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">
                v1.0 Demo
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
              Interactive Multilingual Video Voice Tutor
            </p>
          </div>
        </div>

        {/* Center/Right Controls: Language Selector & Mode Toggle */}
        <div className="flex items-center gap-3">
          {/* Target Language Dropdown Selector */}
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow-sm hover:border-slate-700 transition-colors">
            <Languages className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="text-xs font-medium text-slate-400 hidden md:inline">Target Language:</span>
            <select
              value={selectedLanguage}
              onChange={(e) => onSelectLanguage(e.target.value as TargetLanguage)}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-1"
              aria-label="Select Target Spoken Language"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-slate-900 text-white py-1">
                  {lang.flag} {lang.nativeLabel} ({lang.label})
                </option>
              ))}
            </select>
          </div>

          {/* Backend Status / Demo Fallback Mode Switch */}
          <button
            type="button"
            onClick={onToggleDemoMode}
            title={isDemoMode ? 'Running in Offline Demo Mode (Mock Engine active)' : 'Connected to live backend (http://localhost:8000)'}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-sm ${
              isDemoMode
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isDemoMode ? 'text-amber-400' : 'text-emerald-400 animate-pulse'}`} />
            <span className="hidden sm:inline">
              {isDemoMode ? 'Demo Mode (Stage Safe)' : 'Backend: :8000'}
            </span>
            <span className="sm:hidden">{isDemoMode ? 'Demo' : 'Live'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
