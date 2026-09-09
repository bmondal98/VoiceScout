import React, { useState, useRef, useEffect } from 'react';
import type { YouTubePlayer } from 'react-youtube';
import type {
  InteractionState,
  TargetLanguage,
  VideoOption,
  AskResponse,
  AskTextPayload,
} from '../types';
import { SUPPORTED_LANGUAGES } from '../data/sampleVideos';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { sendVoiceQuery, sendTextQuery, playSynthesizedAudio } from '../services/api';
import {
  Mic,
  Volume2,
  FastForward,
  Play,
  Pause,
  Sparkles,
  AlertCircle,
  Keyboard,
  ChevronDown,
  ChevronUp,
  Quote,
  CheckCircle2,
  Copy,
  Check,
  Send,
} from 'lucide-react';

interface VoiceAssistantPanelProps {
  activeVideo: VideoOption;
  selectedLanguage: TargetLanguage;
  playerRef: React.MutableRefObject<YouTubePlayer | null>;
  onVoiceJump: (seconds: number) => void;
  isDemoMode: boolean;
}

export const VoiceAssistantPanel: React.FC<VoiceAssistantPanelProps> = ({
  activeVideo,
  selectedLanguage,
  playerRef,
  onVoiceJump,
  isDemoMode,
}) => {
  // Finite State Machine
  const [fsmState, setFsmState] = useState<InteractionState>('IDLE');
  const [explanation, setExplanation] = useState<AskResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio Playback State for Spoken Explanation
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioControllerRef = useRef<{ stop: () => void } | null>(null);

  // Fail-Safe Text Fallback Drawer
  const [isTextDrawerOpen, setIsTextDrawerOpen] = useState(false);
  const [textQuery, setTextQuery] = useState('');
  const [isSubmittingText, setIsSubmittingText] = useState(false);
  const [hasCopiedQuote, setHasCopiedQuote] = useState(false);

  // Voice recording hook
  const {
    startRecording,
    stopRecording,
    error: recorderError,
  } = useVoiceRecorder();

  const activeLangConfig = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage);

  // Reset state when the active video changes
  useEffect(() => {
    stopCurrentAudio();
    setExplanation(null);
    setFsmState('IDLE');
    setErrorMessage(null);
    setTextQuery('');
  }, [activeVideo.id]);

  // Clean up audio playback on unmount
  useEffect(() => {
    return () => {
      stopCurrentAudio();
    };
  }, []);

  const stopCurrentAudio = () => {
    if (audioControllerRef.current) {
      try {
        audioControllerRef.current.stop();
      } catch (e) {
        // ignore
      }
      audioControllerRef.current = null;
    }
    setIsAudioPlaying(false);
  };

  // 1. PUSH-TO-TALK: Start Listening (Mouse Down / Touch Start)
  const handleMicPressStart = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (activeVideo.isCustom) return;
    if (fsmState === 'THINKING' || fsmState === 'SPEAKING') {
      stopCurrentAudio();
    }

    setErrorMessage(null);

    // Step 1: Automatically pause the YouTube video
    if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
      try {
        playerRef.current.pauseVideo();
      } catch (err) {
        console.warn('Could not pause YouTube video:', err);
      }
    }

    try {
      setFsmState('LISTENING');
      await startRecording();
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      setErrorMessage(err.message || 'Microphone error. Check browser permissions.');
      setFsmState('ERROR');
    }
  };

  // 2. PUSH-TO-TALK: Stop Listening & Process (Mouse Up / Touch End)
  const handleMicPressEnd = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (fsmState !== 'LISTENING') return;

    setFsmState('THINKING');

    try {
      const audioBlob = await stopRecording();
      if (!audioBlob || audioBlob.size < 200) {
        setErrorMessage('Voice input was too brief. Please hold down the button while speaking.');
        setFsmState('ERROR');
        return;
      }

      // Step 2 & 3: Send audio to backend
      const response = await sendVoiceQuery(
        audioBlob,
        activeVideo.id,
        selectedLanguage,
        isDemoMode
      );

      handleProcessSuccess(response);
    } catch (err: any) {
      console.error('Ask voice error:', err);
      setErrorMessage(err.message || 'Error communicating with voice tutor service.');
      setFsmState('ERROR');
    }
  };

  // 3. Process AskResponse: Sync Video + Play Audio Aloud
  const handleProcessSuccess = (response: AskResponse) => {
    setExplanation(response);
    setFsmState('SPEAKING');

    // Automatically seek the YouTube player to the exact target seconds
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      try {
        playerRef.current.seekTo(response.target_seconds, true);
        playerRef.current.pauseVideo();
        onVoiceJump(response.target_seconds);
      } catch (err) {
        console.warn('Could not seek YouTube player:', err);
      }
    }

    // Play synthesized regional spoken explanation aloud
    playSpokenAnswer(response.answer_text, response.audio_url);
  };

  const playSpokenAnswer = (answerText: string, audioUrl?: string) => {
    stopCurrentAudio();
    setIsAudioPlaying(true);

    const controller = playSynthesizedAudio(
      answerText,
      audioUrl,
      selectedLanguage,
      () => {
        setIsAudioPlaying(false);
        setFsmState('IDLE');
      }
    );

    audioControllerRef.current = controller;
  };

  const toggleAudioPlayback = () => {
    if (isAudioPlaying) {
      stopCurrentAudio();
      setFsmState('IDLE');
    } else if (explanation) {
      setFsmState('SPEAKING');
      playSpokenAnswer(explanation.answer_text, explanation.audio_url);
    }
  };

  // 4. Fail-Safe Stage Fallback: Text Query Submission
  const handleTextSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!textQuery.trim() || isSubmittingText) return;

    setIsSubmittingText(true);
    setFsmState('THINKING');
    setErrorMessage(null);
    stopCurrentAudio();

    if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
      try {
        playerRef.current.pauseVideo();
      } catch (err) {
        // ignore
      }
    }

    try {
      const payload: AskTextPayload = {
        video_id: activeVideo.id,
        query: textQuery.trim(),
        target_language: selectedLanguage,
      };

      const response = await sendTextQuery(payload, isDemoMode);
      setTextQuery('');
      setIsTextDrawerOpen(false);
      handleProcessSuccess(response);
    } catch (err: any) {
      console.error('Text query error:', err);
      setErrorMessage(err.message || 'Error retrieving explanation for text query.');
      setFsmState('ERROR');
    } finally {
      setIsSubmittingText(false);
    }
  };

  const formatSeconds = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCopyQuote = (quote: string) => {
    navigator.clipboard.writeText(quote);
    setHasCopiedQuote(true);
    setTimeout(() => setHasCopiedQuote(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Voice Assistant Card */}
      <div className="relative rounded-2xl bg-slate-900/90 border border-slate-800/80 p-5 shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col gap-5">
        {/* Top Header: FSM State Pill & Live Indicators */}
        <div className="flex items-center justify-between border-b border-slate-800/70 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">AI Voice Tutor Hub</h2>
              <p className="text-[11px] text-slate-400">
                Spoken in {activeLangConfig?.nativeLabel} ({activeLangConfig?.label})
              </p>
            </div>
          </div>

          {/* Explicit FSM Status Badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm transition-all ${
              fsmState === 'IDLE'
                ? 'bg-slate-800/80 border-slate-700 text-slate-300'
                : fsmState === 'LISTENING'
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 ring-2 ring-rose-500/30 animate-pulse'
                : fsmState === 'THINKING'
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : fsmState === 'SPEAKING'
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 ring-2 ring-emerald-500/30'
                : 'bg-rose-600/30 border-rose-600 text-rose-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                fsmState === 'IDLE'
                  ? 'bg-slate-400'
                  : fsmState === 'LISTENING'
                  ? 'bg-rose-400 animate-ping'
                  : fsmState === 'THINKING'
                  ? 'bg-amber-400 animate-spin'
                  : fsmState === 'SPEAKING'
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <span>{fsmState}</span>
          </div>
        </div>

        {/* Central Push-To-Talk (PTT) Interactive Control Stage */}
        <div className="flex flex-col items-center justify-center py-5">
          <div className="relative flex items-center justify-center">
            {/* Concentric Audio Ripple Pulses when LISTENING */}
            {fsmState === 'LISTENING' && (
              <>
                <div className="absolute w-36 h-36 rounded-full bg-rose-500/20 border border-rose-500/40 animate-ripple-1 pointer-events-none" />
                <div className="absolute w-48 h-48 rounded-full bg-rose-500/15 border border-rose-500/30 animate-ripple-2 pointer-events-none" />
                <div className="absolute w-60 h-60 rounded-full bg-rose-500/10 border border-rose-500/20 animate-ripple-3 pointer-events-none" />
              </>
            )}

            {/* Glowing Ring when IDLE or SPEAKING */}
            {fsmState === 'IDLE' && (
              <div className="absolute w-28 h-28 rounded-full bg-gradient-to-r from-violet-600/30 to-indigo-600/30 blur-md pointer-events-none animate-pulse" />
            )}
            {fsmState === 'SPEAKING' && (
              <div className="absolute w-32 h-32 rounded-full bg-emerald-500/20 blur-lg pointer-events-none animate-pulse" />
            )}

            {/* THE PUSH-TO-TALK BUTTON */}
            <button
              type="button"
              onMouseDown={handleMicPressStart}
              onMouseUp={handleMicPressEnd}
              onTouchStart={handleMicPressStart}
              onTouchEnd={handleMicPressEnd}
              disabled={fsmState === 'THINKING' || activeVideo.isCustom}
              className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all duration-200 shadow-2xl select-none focus:outline-none ${
                activeVideo.isCustom
                  ? 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-60'
                  : fsmState === 'LISTENING'
                  ? 'bg-gradient-to-tr from-rose-600 to-red-500 text-white scale-110 shadow-rose-600/50 ring-4 ring-rose-400 cursor-pointer'
                  : fsmState === 'THINKING'
                  ? 'bg-slate-800 text-amber-300 border border-amber-500/40 cursor-wait'
                  : fsmState === 'SPEAKING'
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-emerald-600/40 ring-2 ring-emerald-400 cursor-pointer'
                  : 'bg-gradient-to-tr from-violet-600 via-indigo-600 to-indigo-700 hover:from-violet-500 hover:to-indigo-500 text-white shadow-indigo-700/40 hover:scale-105 active:scale-95 ring-2 ring-violet-400/30 cursor-pointer'
              }`}
              title={activeVideo.isCustom ? 'Voice Q&A unavailable for pasted videos' : 'Hold to talk in your native language'}
              aria-label="Push to talk microphone button"
            >
              {activeVideo.isCustom ? (
                <div className="flex flex-col items-center px-2 text-center">
                  <Mic className="w-8 h-8 text-slate-500 mb-0.5" />
                  <span className="text-[9px] font-extrabold uppercase tracking-wider">Unavailable</span>
                </div>
              ) : fsmState === 'LISTENING' ? (
                <div className="flex flex-col items-center">
                  <Mic className="w-8 h-8 animate-bounce text-white mb-0.5" />
                  <span className="text-[10px] font-black uppercase tracking-wider">RELEASE</span>
                </div>
              ) : fsmState === 'THINKING' ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[9px] font-bold text-amber-300 uppercase">THINKING</span>
                </div>
              ) : fsmState === 'SPEAKING' ? (
                <div className="flex flex-col items-center">
                  <Volume2 className="w-8 h-8 animate-pulse text-white mb-0.5" />
                  <span className="text-[10px] font-black uppercase tracking-wider">SPEAKING</span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Mic className="w-8 h-8 text-white mb-0.5 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">HOLD PTT</span>
                </div>
              )}
            </button>
          </div>

          {/* Sound Wave Equalizer Bars during recording or speaking */}
          <div className="h-6 flex items-center justify-center gap-1 mt-4">
            {activeVideo.isCustom ? (
              <p className="text-xs font-medium text-slate-400 text-center">
                Voice Q&amp;A isn't available for pasted videos — there's no indexed transcript to search.
              </p>
            ) : fsmState === 'LISTENING' ? (
              <>
                <div className="w-1 bg-rose-400 rounded-full animate-bar-1" />
                <div className="w-1 bg-rose-500 rounded-full animate-bar-2" />
                <div className="w-1 bg-rose-300 rounded-full animate-bar-3" />
                <div className="w-1 bg-rose-400 rounded-full animate-bar-4" />
                <div className="w-1 bg-rose-500 rounded-full animate-bar-5" />
                <div className="w-1 bg-rose-400 rounded-full animate-bar-6" />
                <span className="text-xs font-mono font-bold text-rose-400 ml-2">
                  Recording audio...
                </span>
              </>
            ) : fsmState === 'SPEAKING' ? (
              <>
                <div className="w-1 bg-emerald-400 rounded-full animate-bar-3" />
                <div className="w-1 bg-teal-400 rounded-full animate-bar-1" />
                <div className="w-1 bg-emerald-300 rounded-full animate-bar-5" />
                <div className="w-1 bg-teal-300 rounded-full animate-bar-2" />
                <div className="w-1 bg-emerald-400 rounded-full animate-bar-6" />
                <span className="text-xs font-mono font-bold text-emerald-400 ml-2">
                  Synthesizing regional voice answer
                </span>
              </>
            ) : fsmState === 'THINKING' ? (
              <span className="text-xs font-mono text-amber-300/90 animate-pulse">
                Transcribing & indexing video segments...
              </span>
            ) : (
              <p className="text-xs font-medium text-slate-400 text-center">
                Press & hold to ask in <strong className="text-violet-300">{activeLangConfig?.label}</strong>. Video will auto-pause.
              </p>
            )}
          </div>
        </div>

        {/* Error Notification Banner */}
        {(errorMessage || recorderError) && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <div className="flex-1">
              <p className="font-semibold">{errorMessage || recorderError}</p>
              <p className="text-[11px] text-rose-300/80 mt-0.5">
                Try holding the mic button again, or use the stage text fallback drawer below.
              </p>
            </div>
            <button
              onClick={() => {
                setErrorMessage(null);
                setFsmState('IDLE');
              }}
              className="text-rose-400 hover:text-white text-xs font-bold underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Shimmer Skeleton during THINKING state */}
        {fsmState === 'THINKING' && (
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-amber-500/30 flex flex-col gap-3 shadow-lg animate-pulse">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
              <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span>Analyzing speech query & cross-referencing video transcript...</span>
            </div>
            <div className="w-3/4 h-4 rounded-md animate-shimmer" />
            <div className="w-full h-12 rounded-lg animate-shimmer" />
            <div className="w-1/2 h-4 rounded-md animate-shimmer" />
          </div>
        )}

        {/* 3. EXPLANATION CARD (When in SPEAKING or IDLE with previous result) */}
        {explanation && fsmState !== 'THINKING' && (
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-violet-500/30 shadow-xl flex flex-col gap-3.5 relative group">
            {/* Query Header Pill */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
                  Transcribed Query:
                </span>
                <p className="text-xs font-semibold text-slate-200 mt-0.5">
                  "{explanation.transcribed_query}"
                </p>
              </div>

              {/* Direct Jump Button to Target Seconds */}
              <button
                type="button"
                onClick={() => {
                  if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
                    playerRef.current.seekTo(explanation.target_seconds, true);
                    playerRef.current.playVideo();
                    onVoiceJump(explanation.target_seconds);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-lg shadow-violet-600/30 transition-all active:scale-95 shrink-0 cursor-pointer"
                title="Jump YouTube player to exact segment"
              >
                <FastForward className="w-3.5 h-3.5 text-cyan-300" />
                <span>Jump to {formatSeconds(explanation.target_seconds)}</span>
              </button>
            </div>

            {/* Verbatim Video Quote Callout */}
            <div className="relative p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-violet-400 font-bold text-[11px]">
                  <Quote className="w-3 h-3" />
                  <span>Referenced Video Quote ({formatSeconds(explanation.target_seconds)}):</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyQuote(explanation.quote)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Copy quote"
                >
                  {hasCopiedQuote ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="italic text-slate-300 leading-relaxed">
                {explanation.quote}
              </p>
            </div>

            {/* Synthesized Spoken Answer Box */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-violet-950/40 via-indigo-950/40 to-slate-900 border border-violet-500/20 text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Regional Explanation ({activeLangConfig?.label}):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleAudioPlayback}
                    className="flex items-center gap-1 text-[11px] font-bold text-violet-300 hover:text-white px-2 py-0.5 rounded bg-violet-600/30 border border-violet-500/30 cursor-pointer"
                  >
                    {isAudioPlaying ? (
                      <>
                        <Pause className="w-3 h-3 text-rose-400" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 text-emerald-400" />
                        <span>Play Aloud</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <p className="text-slate-200 leading-relaxed font-medium">
                {explanation.answer_text}
              </p>
            </div>
          </div>
        )}

        {/* 4. FAIL-SAFE STAGE FALLBACK DRAWER */}
        <div className="border-t border-slate-800/80 pt-3">
          <button
            type="button"
            onClick={() => setIsTextDrawerOpen(!isTextDrawerOpen)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/70 hover:bg-slate-800/60 border border-slate-800 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-violet-400" />
              <span>Can't speak? Type your query (Stage Noise Fallback)</span>
            </div>
            {isTextDrawerOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {/* Expandable Fallback Input Drawer */}
          {isTextDrawerOpen && (
            <div className="mt-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-3 shadow-inner">
              <form onSubmit={handleTextSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={textQuery}
                  onChange={(e) => setTextQuery(e.target.value)}
                  placeholder={`Ask about ${activeVideo.title} in ${activeLangConfig?.label}...`}
                  className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 font-medium"
                />
                <button
                  type="submit"
                  disabled={!textQuery.trim() || isSubmittingText}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-violet-600/30 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>

              {/* Sample Quick Questions */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Quick Stage Test Prompts:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {activeVideo.sampleQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setTextQuery(q);
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 text-left transition-colors cursor-pointer"
                    >
                      "{q}"
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
