import { useState, useRef } from 'react';
import type { YouTubePlayer } from 'react-youtube';
import type { TargetLanguage, VideoOption } from './types';
// import { SAMPLE_VIDEOS } from './data/sampleVideos';
import { Header } from './components/Header';
import { VideoPlayerStage } from './components/VideoPlayerStage';
import { VoiceAssistantPanel } from './components/VoiceAssistantPanel';
import { Cpu, Zap, Volume2, Shield } from 'lucide-react';

export default function App() {
  const [activeVideo, setActiveVideo] = useState<VideoOption>({} as VideoOption);
  const [selectedLanguage, setSelectedLanguage] = useState<TargetLanguage>('hi');
  const [lastJumpSeconds, setLastJumpSeconds] = useState<number | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [stageTab, setStageTab] = useState<'catalog' | 'url'>('catalog');

  // Reference to the YouTube player instance
  const playerRef = useRef<YouTubePlayer | null>(null);

  const handleSelectVideo = (video: VideoOption) => {
    setActiveVideo(video);
    setLastJumpSeconds(null);
  };

  const handleVoiceJump = (seconds: number) => {
    setLastJumpSeconds(seconds);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-violet-500/30 selection:text-violet-200">
      {/* 1. Global Navigation Header */}
      <Header
        selectedLanguage={selectedLanguage}
        onSelectLanguage={setSelectedLanguage}
        isDemoMode={isDemoMode}
        onToggleDemoMode={() => setIsDemoMode(!isDemoMode)}
      />

      {/* Main Single-Screen Dashboard Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-5">
        {/* Subtle Ambient Background Gradients */}
        <div className="fixed top-20 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Video Player Stage (7 cols on catalog tab, 12 cols centered on url tab) */}
          <div className={stageTab === 'catalog' ? 'lg:col-span-7 flex flex-col gap-4' : 'lg:col-span-12 max-w-4xl mx-auto w-full flex flex-col gap-4'}>
            <VideoPlayerStage
              activeVideo={activeVideo}
              onSelectVideo={handleSelectVideo}
              playerRef={playerRef}
              lastJumpSeconds={lastJumpSeconds}
              stageTab={stageTab}
              onTabChange={setStageTab}
            />
          </div>

          {/* Right Column: AI Voice Assistant Hub (visible ONLY when in Catalog Player tab) */}
          {stageTab === 'catalog' && (
            <div className="lg:col-span-5 flex flex-col gap-4 animate-fadeIn">
              <VoiceAssistantPanel
                activeVideo={activeVideo}
                selectedLanguage={selectedLanguage}
                onSelectLanguage={setSelectedLanguage}
                playerRef={playerRef}
                onVoiceJump={handleVoiceJump}
                isDemoMode={isDemoMode}
              />
            </div>
          )}
        </div>

        {/* System Architecture & Hackathon Presentation Badges */}
        <section className="mt-2 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-200">Push-to-Talk FSM</p>
              <p className="text-[11px] text-slate-400">Auto-pauses video on hold</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-200">Semantic RAG Search</p>
              <p className="text-[11px] text-slate-400">Timestamp quote extraction</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-200">Regional Voice TTS</p>
              <p className="text-[11px] text-slate-400">HI, MR, BN, EN synthesis</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-200">Stage Noise Fallback</p>
              <p className="text-[11px] text-slate-400">Fail-safe typed query drawer</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 bg-slate-950 py-3 text-center text-[11px] text-slate-500">
        <p>VocalScout Hackathon Prototype &bull; AI-Powered Multilingual Video Intelligence</p>
      </footer>
    </div>
  );
}
