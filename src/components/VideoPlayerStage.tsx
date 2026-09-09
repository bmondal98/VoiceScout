import React, { useState, useEffect, useRef } from 'react';
import YouTube from 'react-youtube';
import type { YouTubeProps, YouTubePlayer } from 'react-youtube';
import type { VideoOption, VideoChapter } from '../types';
import { SAMPLE_VIDEOS } from '../data/sampleVideos';
import { Play, Pause, RotateCcw, FastForward, Film, Clock, User, Bookmark } from 'lucide-react';

interface VideoPlayerStageProps {
  activeVideo: VideoOption;
  onSelectVideo: (video: VideoOption) => void;
  playerRef: React.MutableRefObject<YouTubePlayer | null>;
  lastJumpSeconds: number | null;
}

export const VideoPlayerStage: React.FC<VideoPlayerStageProps> = ({
  activeVideo,
  onSelectVideo,
  playerRef,
  lastJumpSeconds,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showJumpToast, setShowJumpToast] = useState(false);
  const timeIntervalRef = useRef<number | null>(null);

  // Trigger brief visual highlight when a voice jump happens
  useEffect(() => {
    if (lastJumpSeconds !== null) {
      setShowJumpToast(true);
      const timer = setTimeout(() => setShowJumpToast(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [lastJumpSeconds]);

  // Track playback time
  useEffect(() => {
    timeIntervalRef.current = window.setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const time = playerRef.current.getCurrentTime();
          setCurrentTime(Math.floor(time));
          const dur = playerRef.current.getDuration();
          if (dur) setDuration(Math.floor(dur));
        } catch (e) {
          // ignore
        }
      }
    }, 500);

    return () => {
      if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
    };
  }, [playerRef]);

  const onPlayerReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target;
    try {
      const dur = event.target.getDuration();
      if (dur) setDuration(Math.floor(dur));
    } catch (e) {
      // ignore
    }
  };

  const onPlayerStateChange: YouTubeProps['onStateChange'] = (event) => {
    if (event.data === 1) {
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  const handleTogglePlay = () => {
    if (!playerRef.current) return;
    try {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    } catch (e) {
      console.warn('Playback toggle error:', e);
    }
  };

  const handleSeek = (seconds: number) => {
    if (!playerRef.current) return;
    try {
      playerRef.current.seekTo(seconds, true);
      playerRef.current.playVideo();
    } catch (e) {
      console.warn('Seek error:', e);
    }
  };

  const formatSeconds = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const youtubeOptions: YouTubeProps['opts'] = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      modestbranding: 1,
      rel: 0,
      origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Demo Video Switcher Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-md">
        <div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold text-slate-400">
          <Film className="w-4 h-4 text-violet-400" />
          <span>Active Source Video:</span>
        </div>
        <div className="flex items-center gap-2">
          {SAMPLE_VIDEOS.map((video) => {
            const isSelected = video.id === activeVideo.id;
            return (
              <button
                key={video.id}
                onClick={() => onSelectVideo(video)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-violet-400/40 scale-[1.02]'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-cyan-300 animate-ping' : 'bg-slate-500'}`} />
                <span>{video.badge}:</span>
                <span className="truncate max-w-[140px] sm:max-w-none">{video.title}</span>
                <span className="text-[10px] opacity-75 font-normal">({video.originalLanguage.split(' ')[1] || 'EN'})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Synchronized YouTube Player Stage */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-800/90 bg-slate-950 shadow-2xl group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-500 pointer-events-none"></div>

        {/* 16:9 Aspect Ratio Frame */}
        <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
          <YouTube
            videoId={activeVideo.youtubeId}
            opts={youtubeOptions}
            onReady={onPlayerReady}
            onStateChange={onPlayerStateChange}
            className="w-full h-full"
            iframeClassName="w-full h-full absolute inset-0 border-0"
          />

          {/* Jump to Timestamp Toast Notification */}
          {showJumpToast && lastJumpSeconds !== null && (
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-violet-600/95 text-white text-xs font-bold shadow-xl shadow-violet-900/50 backdrop-blur-md border border-violet-400/50 animate-bounce">
              <FastForward className="w-4 h-4 text-cyan-300" />
              <span>Voice Tutor synced to timestamp: {formatSeconds(lastJumpSeconds)}</span>
            </div>
          )}
        </div>

        {/* Custom Quick Player Sub-bar */}
        <div className="relative z-10 px-4 py-3 bg-slate-900/95 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={handleTogglePlay}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium shadow-md shadow-violet-600/30 transition-transform active:scale-95 cursor-pointer"
              title={isPlaying ? 'Pause Video' : 'Play Video'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
            </button>

            <button
              onClick={() => handleSeek(Math.max(0, currentTime - 10))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Rewind 10 seconds"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-1.5 text-slate-300 font-mono font-medium">
              <Clock className="w-3.5 h-3.5 text-violet-400" />
              <span>{formatSeconds(currentTime)}</span>
              <span className="text-slate-500">/</span>
              <span className="text-slate-500">{formatSeconds(duration || 600)}</span>
            </div>
          </div>

          {/* Video Metadata Snippet */}
          <div className="flex items-center gap-3 text-slate-400">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span className="truncate max-w-[120px]">{activeVideo.instructor}</span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700/60 font-medium">
              {activeVideo.originalLanguage}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Indexed Timeline Hotspots (Chapters) */}
      <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800/70 shadow-sm">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Bookmark className="w-3.5 h-3.5 text-violet-400" />
            <span>Pre-Indexed Timeline Hotspots</span>
          </div>
          <span className="text-[11px] text-slate-500">Click to jump directly</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {activeVideo.chapters.map((chapter: VideoChapter, idx: number) => {
            const isNear = Math.abs(currentTime - chapter.seconds) <= 15;
            return (
              <button
                key={idx}
                onClick={() => handleSeek(chapter.seconds)}
                className={`p-2 rounded-xl text-left transition-all border cursor-pointer ${
                  isNear
                    ? 'bg-violet-950/60 border-violet-500/50 text-violet-200 ring-1 ring-violet-500/30'
                    : 'bg-slate-950/60 hover:bg-slate-800/60 border-slate-800/80 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-bold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">
                    {chapter.formattedTime}
                  </span>
                  {isNear && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />}
                </div>
                <p className="text-xs font-semibold line-clamp-1">{chapter.title}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
