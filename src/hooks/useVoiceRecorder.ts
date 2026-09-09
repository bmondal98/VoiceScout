import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseVoiceRecorderResult {
  isRecording: boolean;
  audioBlob: Blob | null;
  volumeLevel: number; // 0 to 100 for live visualizers
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
}

export function useVoiceRecorder(): UseVoiceRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Clean up all hardware media stream tracks to guarantee the red recording indicator clears
  const stopMediaStreamTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Error stopping track:', e);
        }
      });
      mediaStreamRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.warn('Error closing AudioContext:', e);
      }
      audioContextRef.current = null;
    }

    setVolumeLevel(0);
  }, []);

  // Monitor live volume level for animated audio visualizer
  const setupVolumeMeter = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        setVolumeLevel(normalized);

        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (err) {
      console.warn('Could not initialize audio visualizer context:', err);
    }
  };

  const startRecording = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    audioChunksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = 'Microphone access is not supported in this browser.';
      setError(msg);
      throw new Error(msg);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;
      setupVolumeMeter(stream);

      // Determine supported MIME type
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(100); // 100ms slices
      setIsRecording(true);
    } catch (err: any) {
      stopMediaStreamTracks();
      const errorMsg =
        err.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Please allow microphone access.'
          : `Failed to access microphone: ${err.message || 'Unknown error'}`;
      setError(errorMsg);
      setIsRecording(false);
      throw new Error(errorMsg);
    }
  }, [stopMediaStreamTracks]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;

      if (!recorder || recorder.state === 'inactive') {
        stopMediaStreamTracks();
        setIsRecording(false);
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const finalBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(finalBlob);
        setIsRecording(false);
        stopMediaStreamTracks();
        resolve(finalBlob);
      };

      try {
        recorder.stop();
      } catch (err) {
        console.warn('Error stopping MediaRecorder:', err);
        stopMediaStreamTracks();
        setIsRecording(false);
        resolve(null);
      }
    });
  }, [stopMediaStreamTracks]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    stopMediaStreamTracks();
    audioChunksRef.current = [];
    setIsRecording(false);
    setAudioBlob(null);
  }, [stopMediaStreamTracks]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopMediaStreamTracks();
    };
  }, [stopMediaStreamTracks]);

  return {
    isRecording,
    audioBlob,
    volumeLevel,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
