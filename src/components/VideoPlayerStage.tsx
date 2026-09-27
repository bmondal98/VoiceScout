import React, { useState, useEffect, useRef } from 'react';
import YouTube from 'react-youtube';
import type { YouTubeProps, YouTubePlayer } from 'react-youtube';
import type { ProcessingLanguageCode, VideoOption } from '../types';
import {
  // SAMPLE_VIDEOS, 
  PROCESSING_LANGUAGES
} from '../data/sampleVideos';
import { extractYouTubeId } from '../utils/youtube';
import { fetchCatalogVideos, submitVideoForProcessing, generateVideoUploadUrl, uploadVideoToS3, addVideoToCatalog } from '../services/videoService';
import { processUrlWithVidKraken } from '../services/vidKrakenService';
import { wsService } from '../services/websocketService';
import { Play, Pause, RotateCcw, FastForward, Film, Clock, User, Bookmark, Link2, ArrowLeft, AlertCircle, Loader2, Languages, Send, Upload, CheckCircle2, X, Terminal } from 'lucide-react';

interface VideoPlayerStageProps {
  activeVideo: VideoOption;
  onSelectVideo: (video: VideoOption) => void;
  playerRef: React.MutableRefObject<YouTubePlayer | null>;
  lastJumpSeconds: number | null;
  stageTab?: 'catalog' | 'url';
  onTabChange?: (tab: 'catalog' | 'url') => void;
}

export const VideoPlayerStage: React.FC<VideoPlayerStageProps> = ({
  activeVideo,
  onSelectVideo,
  playerRef,
  lastJumpSeconds,
  stageTab: propStageTab,
  onTabChange,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showJumpToast, setShowJumpToast] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [customUrlError, setCustomUrlError] = useState<string | null>(null);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const timeIntervalRef = useRef<number | null>(null);
  const html5VideoRef = useRef<HTMLVideoElement | null>(null);

  // Real video catalog (fetched fresh on mount — video_url is a short-lived presigned link)
  const [catalogVideos, setCatalogVideos] = useState<VideoOption[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Paste-YouTube-URL -> submit for backend processing (placeholder pipeline)
  const [processingLanguage, setProcessingLanguage] = useState<ProcessingLanguageCode | ''>('');
  const [processingState, setProcessingState] = useState<'idle' | 'pending' | 'error'>('idle');
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);

  // Real-time Transcription Modal State
  const [showTranscriptionModal, setShowTranscriptionModal] = useState(false);
  const [transcriptionLogs, setTranscriptionLogs] = useState<Array<{ timestamp: string; text: string; isError?: boolean }>>([]);
  const [transcriptionStatus, setTranscriptionStatus] = useState<'transcribing' | 'completed' | 'error'>('transcribing');
  const modalLogsEndRef = useRef<HTMLDivElement | null>(null);

  // Tab state: controlled via props or internal fallback
  const [internalStageTab, setInternalStageTab] = useState<'catalog' | 'url'>('catalog');
  const stageTab = propStageTab ?? internalStageTab;
  const setStageTab = (tab: 'catalog' | 'url') => {
    setInternalStageTab(tab);
    onTabChange?.(tab);
  };

  // Load the real video catalog once on mount
  useEffect(() => {
    let cancelled = false;

    setIsCatalogLoading(true);
    fetchCatalogVideos()
      .then((videos) => {
        console.log('videos>>>', videos);
        if (!cancelled) {
          setCatalogVideos(videos);
          setCatalogError(null);
          if (videos.length > 0) {
            onSelectVideo(videos[0]);
          }
        }
      })
      .catch((err) => {
        console.warn('Failed to load video catalog:', err);
        if (!cancelled) {
          setCatalogError('Could not load catalog videos.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsCatalogLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-scroll transcription modal log container to bottom
  useEffect(() => {
    if (showTranscriptionModal && modalLogsEndRef.current) {
      modalLogsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcriptionLogs, showTranscriptionModal]);

  // Subscribe to real-time WebSocket messages during transcription modal
  useEffect(() => {
    if (!showTranscriptionModal) return;

    const unsubscribe = wsService.subscribeWebSocketMessages((data: any) => {
      console.log('Transcription modal WS message:', data);
      const messageText = typeof data === 'string' ? data : data?.message || data?.text || JSON.stringify(data);
      const isError = typeof data === 'object' && (data?.status === 'error' || data?.error);

      setTranscriptionLogs((prev) => [
        ...prev,
        {
          timestamp: new Date().toLocaleTimeString(),
          text: messageText,
          isError: Boolean(isError),
        },
      ]);

      const lowerText = String(messageText).toLowerCase();
      const isCompleted =
        lowerText.includes('transcription completed') ||
        (typeof data === 'object' && data?.status === 'completed');

      if (isCompleted) {
        setTranscriptionStatus('completed');

        // Re-retrieve catalog videos
        fetchCatalogVideos()
          .then((videos) => {
            if (videos.length > 0) {
              setCatalogVideos(videos);
              onSelectVideo(videos[videos.length - 1] || videos[0]);
            }
          })
          .catch((e) => console.warn('Error refetching catalog after transcription:', e));

        // After completion delay, close modal, switch to 1st tab, reset Tab 2
        setTimeout(() => {
          setShowTranscriptionModal(false);
          setStageTab('catalog');
          setCustomUrlInput('');
          setSelectedUploadFile(null);
          setProcessingLanguage('');
        }, 1800);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [showTranscriptionModal, onSelectVideo]);

  // Trigger visual highlight & seek video (both YouTube and HTML5) when a voice jump happens
  useEffect(() => {
    if (lastJumpSeconds !== null) {
      setShowJumpToast(true);

      // 1. HTML5 Video player seek
      if (activeVideo.videoUrl && html5VideoRef.current) {
        try {
          html5VideoRef.current.currentTime = lastJumpSeconds;
          html5VideoRef.current.play().catch(() => { });
        } catch (e) {
          console.warn('HTML5 video seek error:', e);
        }
      }

      // 2. YouTube IFrame player seek & pause
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        try {
          playerRef.current.seekTo(lastJumpSeconds, true);
          if (typeof playerRef.current.pauseVideo === 'function') {
            playerRef.current.pauseVideo();
          }
        } catch (e) {
          console.warn('YouTube player seek error:', e);
        }
      }

      const timer = setTimeout(() => setShowJumpToast(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [lastJumpSeconds, activeVideo.videoUrl, playerRef]);

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

  const handleCustomUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!processingLanguage) {
      setCustomUrlError('Please select a video language from the dropdown before loading.');
      return;
    }

    // 1. Generate filename: VocalScout-{current fetched videos length + 1}
    const nextIndex = catalogVideos.length + 1;
    const filename = `VocalScout-${nextIndex}.mp4`;

    // 2. Generate videoId: current timestamp in seconds
    const videoId = Math.floor(Date.now() / 1000).toString();

    setCustomUrlError(null);
    setIsUploading(true);

    try {
      // 3. IF LOCAL FILE IS SELECTED -> Upload file to S3 via Presigned URL
      if (selectedUploadFile) {
        console.log(`Generating upload URL for local file: "${selectedUploadFile.name}"...`);
        const { uploadUrl } = await generateVideoUploadUrl(filename);
        await uploadVideoToS3(uploadUrl, selectedUploadFile);

        // POST to /api/add-video without youtube_url
        await addVideoToCatalog({
          video_id: videoId,
          title: filename,
          filename: filename,
          source_language: processingLanguage,
        });
      }
      // 4. IF LINK/URL IS GIVEN -> Skip S3 presigned URL upload, post youtube_url in /api/add-video
      else if (customUrlInput.trim()) {
        console.log(`Link provided: "${customUrlInput.trim()}". Skipping S3 presigned URL upload...`);

        // POST to /api/add-video WITH youtube_url
        await addVideoToCatalog({
          video_id: videoId,
          title: filename,
          filename: filename,
          source_language: processingLanguage,
          youtube_url: customUrlInput.trim(),
        });
      } else {
        throw new Error('Please select a video file or enter a valid URL.');
      }

      // 5. Open Real-Time Transcription Progress Modal immediately
      setTranscriptionLogs([
        {
          timestamp: new Date().toLocaleTimeString(),
          text: `Initiated transcription pipeline for ${filename} (${processingLanguage})`,
        },
      ]);
      setTranscriptionStatus('transcribing');
      setShowTranscriptionModal(true);

      // 6. If YouTube URL was provided, call VidKraken API and poll for job completion BEFORE WebSocket call
      let finalYoutubeUrl: string | undefined = undefined;
      if (!selectedUploadFile && customUrlInput.trim()) {
        const inputUrl = customUrlInput.trim();
        setTranscriptionLogs((prev) => [
          ...prev,
          {
            timestamp: new Date().toLocaleTimeString(),
            text: `Submitting URL to VidKraken API for download processing: ${inputUrl}`,
          },
        ]);

        try {
          const vidKrakenDirectUrl = await processUrlWithVidKraken(inputUrl);
          finalYoutubeUrl = vidKrakenDirectUrl;
          setTranscriptionLogs((prev) => [
            ...prev,
            {
              timestamp: new Date().toLocaleTimeString(),
              text: `VidKraken download job completed successfully. Direct URL: ${vidKrakenDirectUrl}`,
            },
          ]);
        } catch (vidKrakenErr: any) {
          console.error('VidKraken processing error:', vidKrakenErr);
          setTranscriptionLogs((prev) => [
            ...prev,
            {
              timestamp: new Date().toLocaleTimeString(),
              text: `VidKraken download failed: ${vidKrakenErr?.message || 'Could not process video URL'}`,
              isError: true,
            },
          ]);
          setTranscriptionStatus('error');
          return;
        }
      }

      // 7. Send 'transcribe' payload via WebSocket (includes VidKraken resolved download URL)
      const transcribeWsPayload: Record<string, any> = {
        url_path: 'transcribe',
        video_url: filename,
        video_file_name: filename,
        video_lang: processingLanguage,
        video_id: videoId,
      };

      if (finalYoutubeUrl) {
        transcribeWsPayload.youtube_url = finalYoutubeUrl;
      }

      console.log('Sending WebSocket transcribe payload:', transcribeWsPayload);
      wsService.sendWebSocketMessage(transcribeWsPayload);

    } catch (err: any) {
      console.error('handleCustomUrlSubmit error:', err);
      setCustomUrlError(err?.message || 'Failed to upload video or register with backend.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmitForProcessing = async (e: React.FormEvent) => {
    e.preventDefault();
    const videoId = extractYouTubeId(customUrlInput);
    if (!videoId) {
      setCustomUrlError('Could not recognize that as a valid YouTube URL.');
      return;
    }
    if (!processingLanguage) return;

    setProcessingState('pending');
    setProcessingMessage(null);

    try {
      const result = await submitVideoForProcessing(customUrlInput.trim(), processingLanguage);
      setProcessingMessage(result.message);
      setProcessingState(result.status === 'pending' ? 'pending' : 'idle');
    } catch (err) {
      console.warn('submitVideoForProcessing failed:', err);
      setProcessingState('error');
      setProcessingMessage('Could not submit video for processing. Please try again.');
    }
  };

  const handleBackToDemoVideos = () => {
    setCustomUrlError(null);
    setCustomUrlInput('');
    // onSelectVideo(SAMPLE_VIDEOS[0]);
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
      {/* Clean Seamless Tab Navigation (no outer boundary box) */}
      <div className="flex items-center justify-between gap-2 py-0.5">
        {/* Tab Buttons Container */}
        <div className="flex items-center gap-2 flex-1">
          <button
            type="button"
            onClick={() => setStageTab('catalog')}
            className={`group relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer active:scale-[0.98] ${stageTab === 'catalog'
              ? 'bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-violet-600/30 border border-violet-400/40 ring-1 ring-violet-400/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
              }`}
          >
            <div className={`p-1 rounded-lg transition-colors ${stageTab === 'catalog' ? 'bg-white/20 text-white' : 'bg-slate-800/80 text-violet-400 group-hover:text-violet-300'
              }`}>
              <Film className="w-3.5 h-3.5" />
            </div>
            <span>Catalog Player</span>
            {catalogVideos.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold transition-colors ${stageTab === 'catalog'
                ? 'bg-white/20 text-white'
                : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-slate-300'
                }`}>
                {catalogVideos.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setStageTab('url')}
            className={`group relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer active:scale-[0.98] ${stageTab === 'url'
              ? 'bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-violet-600/30 border border-violet-400/40 ring-1 ring-violet-400/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
              }`}
          >
            <div className={`p-1 rounded-lg transition-colors ${stageTab === 'url' ? 'bg-white/20 text-white' : 'bg-slate-800/80 text-violet-400 group-hover:text-violet-300'
              }`}>
              <Link2 className="w-3.5 h-3.5" />
            </div>
            <span>Load YouTube URL</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider transition-colors ${stageTab === 'url'
              ? 'bg-white/20 text-white'
              : 'bg-violet-950/60 text-violet-300 border border-violet-800/40'
              }`}>
              Import
            </span>
          </button>
        </div>

        {/* Ambient Status Indicator Pill */}
        <div className="hidden sm:flex items-center gap-2 px-2 py-1 text-[11px] font-medium text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{stageTab === 'catalog' ? 'Catalog Player Active' : 'URL Import Mode'}</span>
        </div>
      </div>

      {/* Tab 1: Select Source Video Dropdown & Synchronized Video Player Viewer */}
      {stageTab === 'catalog' && (
        <div className="flex flex-col gap-4">
          {/* 1. Source Video Selection Dropdown */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-md">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Film className="w-4 h-4 text-violet-400 shrink-0" />
              <span>Select Source Video:</span>
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <select
                value={activeVideo.id}
                onChange={(e) => {
                  const selected = catalogVideos.find((v) => v.id === e.target.value);
                  if (selected) onSelectVideo(selected);
                }}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 cursor-pointer"
                aria-label="Select Source Video"
              >
                {catalogVideos.map((video) => (
                  <option key={video.id} value={video.id} className="bg-slate-900 text-white py-1">
                    🎬 {video.title} — ({video.originalLanguage})
                  </option>
                ))}

                {activeVideo.isCustom && (
                  <option value={activeVideo.id} className="bg-slate-900 text-amber-300 py-1">
                    🔗 Custom Video: {activeVideo.title}
                  </option>
                )}
              </select>

              {isCatalogLoading && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800/50 text-slate-400 border border-slate-700/40">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading catalog…
                </span>
              )}

              {catalogError && !isCatalogLoading && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {catalogError}
                </span>
              )}
            </div>

            {/* 
              SAMPLE_VIDEOS commented out per instructions:
              {SAMPLE_VIDEOS.map((video) => (
                ...
              ))}
            */}

            {activeVideo.isCustom && (
              <button
                onClick={handleBackToDemoVideos}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to catalog</span>
              </button>
            )}
          </div>

          {/* 2. Synchronized YouTube / HTML5 Player Stage */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800/90 bg-slate-950 shadow-2xl group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-500 pointer-events-none"></div>

            {/* 16:9 Aspect Ratio Frame */}
            <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
              {(() => {
                const resolvedYoutubeId =
                  activeVideo.youtubeId ||
                  (activeVideo.youtube_url ? extractYouTubeId(activeVideo.youtube_url) : null) ||
                  (activeVideo.videoUrl ? extractYouTubeId(activeVideo.videoUrl) : null);

                if (resolvedYoutubeId) {
                  return (
                    <YouTube
                      videoId={resolvedYoutubeId}
                      opts={youtubeOptions}
                      onReady={onPlayerReady}
                      onStateChange={onPlayerStateChange}
                      className="w-full h-full"
                      iframeClassName="w-full h-full absolute inset-0 border-0"
                    />
                  );
                }

                return (
                  <video
                    ref={html5VideoRef}
                    key={activeVideo.id}
                    src={activeVideo.videoUrl}
                    controls
                    className="w-full h-full absolute inset-0 border-0 bg-black"
                  />
                );
              })()}

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
              {activeVideo.videoUrl ? (
                <p className="text-[11px] text-slate-500">Use the player controls above to play, pause and seek.</p>
              ) : (
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
              )}

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
        </div>
      )}

      {/* Tab 2: Load YouTube URL Section */}
      {stageTab === 'url' && (
        <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800/70 shadow-sm">
          <form onSubmit={handleCustomUrlSubmit} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 px-2 text-xs font-semibold text-slate-400 shrink-0">
                <Languages className="w-4 h-4 text-violet-400" />
                <span>Video language:</span>
              </div>
              <select
                value={processingLanguage}
                onChange={(e) => {
                  setProcessingLanguage(e.target.value as ProcessingLanguageCode);
                  if (customUrlError) setCustomUrlError(null);
                }}
                className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 font-medium cursor-pointer"
                aria-label="Select video language for upload"
              >
                <option value="" disabled>
                  Select language…
                </option>
                {PROCESSING_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60">
              <div className="flex items-center gap-2 px-2 text-xs font-semibold text-slate-400 shrink-0">
                <Link2 className="w-4 h-4 text-violet-400" />
                <span>Paste Video URL or File:</span>
              </div>
              <input
                type="text"
                value={customUrlInput}
                onChange={(e) => {
                  setCustomUrlInput(e.target.value);
                  if (customUrlError) setCustomUrlError(null);
                  if (processingState !== 'idle') {
                    setProcessingState('idle');
                    setProcessingMessage(null);
                  }
                }}
                placeholder="https://www.youtube.com/watch?v=... or video link"
                className="flex-1 min-w-[200px] bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 font-medium"
              />
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700/80 cursor-pointer transition-all">
                <Upload className="w-3.5 h-3.5 text-violet-400" />
                <span className="truncate max-w-[120px]">{selectedUploadFile ? selectedUploadFile.name : 'Choose File'}</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedUploadFile(e.target.files[0]);
                      if (customUrlError) setCustomUrlError(null);
                    }
                  }}
                  className="hidden"
                />
              </label>
              <button
                type="submit"
                disabled={!processingLanguage || (!customUrlInput.trim() && !selectedUploadFile) || isUploading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-violet-600/30 transition-all cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading…</span>
                  </>
                ) : (
                  <span>Load Video</span>
                )}
              </button>
            </div>
          </form>
          {customUrlError && (
            <div className="flex items-center gap-1.5 mt-2 px-1 text-[11px] text-rose-300">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              <span>{customUrlError}</span>
            </div>
          )}
          {activeVideo.isCustom && !customUrlError && (
            <p className="mt-2 px-1 text-[11px] text-slate-500">
              Playing a pasted video — playback only, no transcript indexing or voice Q&amp;A.
            </p>
          )}

          {/* Submit the pasted URL to the backend processing pipeline */}
          {/* {customUrlInput.trim() && ( */}
          {/* // <form
            //   onSubmit={handleSubmitForProcessing}
            //   className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-800/70"
            // > */}
          {/* <div className="flex items-center gap-2 px-2 text-xs font-semibold text-slate-400 shrink-0">
                <Languages className="w-4 h-4 text-violet-400" />
                <span>Video language:</span>
              </div> */}
          {/* <select
                value={processingLanguage}
                onChange={(e) => setProcessingLanguage(e.target.value as ProcessingLanguageCode)}
                className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 font-medium cursor-pointer"
                aria-label="Select video language for processing"
              >
                <option value="" disabled>
                  Select language…
                </option>
                {PROCESSING_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                    {lang.label}
                  </option>
                ))}
              </select> */}
          {/* <button
                type="submit"
                disabled={!processingLanguage || processingState === 'pending'}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
              >
                {processingState === 'pending' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing…</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit for Transcription</span>
                  </>
                )}
              </button> */}
          {/* </form> */}
          {/* )} */}

          {processingState === 'pending' && processingMessage && (
            <div className="flex items-center gap-1.5 mt-2 px-1 text-[11px] text-amber-300">
              <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
              <span>{processingMessage} — this video will appear in the catalog once ready.</span>
            </div>
          )}
          {processingState === 'error' && processingMessage && (
            <div className="flex items-center gap-1.5 mt-2 px-1 text-[11px] text-rose-300">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              <span>{processingMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* Real-Time Transcription Progress Modal */}
      {showTranscriptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                {transcriptionStatus === 'transcribing' ? (
                  <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
                    <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                  </div>
                ) : (
                  <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {transcriptionStatus === 'transcribing' ? 'Transcribing & Indexing Video…' : 'Transcription Completed!'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Real-time WebSocket Pipeline Feed</p>
                </div>
              </div>

              {transcriptionStatus === 'completed' && (
                <button
                  onClick={() => setShowTranscriptionModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Modal Body / Live Terminal Logs */}
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-violet-400" />
                  WebSocket Stream Logs
                </span>
                {transcriptionStatus === 'transcribing' && (
                  <span className="flex items-center gap-1.5 text-[11px] text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    Listening for completion…
                  </span>
                )}
              </div>

              <div className="h-64 rounded-xl bg-slate-950 border border-slate-800/90 p-3 font-mono text-[11px] text-slate-300 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                {transcriptionLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-slate-500 text-[10px] shrink-0 font-sans mt-0.5">{log.timestamp}</span>
                    <span className={log.isError ? 'text-rose-400 font-medium' : log.text.toLowerCase().includes('completed') ? 'text-emerald-300 font-bold' : 'text-slate-200'}>
                      {log.text}
                    </span>
                  </div>
                ))}
                <div ref={modalLogsEndRef} />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500">
                {transcriptionStatus === 'transcribing'
                  ? 'Keep this open while AssemblyAI transcribes the video.'
                  : 'Refetched catalog & switching to 1st tab…'}
              </span>
              {transcriptionStatus === 'completed' && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready!
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
