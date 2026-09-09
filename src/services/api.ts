import type { AskResponse, AskTextPayload, TargetLanguage } from '../types';
import { MOCK_RESPONSES, SUPPORTED_LANGUAGES } from '../data/sampleVideos';

const BASE_URL = 'http://localhost:8000';

export class VoiceApiError extends Error {
  isNetworkError: boolean;

  constructor(message: string, isNetworkError = false) {
    super(message);
    this.name = 'VoiceApiError';
    this.isNetworkError = isNetworkError;
  }
}

/**
 * Sends recorded audio blob to the backend at POST /api/ask-voice.
 * Falls back to realistic mock responses if the local server is offline.
 */
export async function sendVoiceQuery(
  audioBlob: Blob,
  videoId: string,
  targetLanguage: TargetLanguage,
  forceMock = false
): Promise<AskResponse & { isMock?: boolean }> {
  if (forceMock) {
    await simulateDelay(1400);
    const mock = getMockResponse(videoId, targetLanguage);
    return { ...mock, isMock: true };
  }

  const formData = new FormData();
  formData.append('file', audioBlob, 'query.webm');
  formData.append('audio', audioBlob, 'query.webm');
  formData.append('video_id', videoId);
  formData.append('target_language', targetLanguage);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${BASE_URL}/api/ask-voice`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new VoiceApiError(`Server error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      transcribed_query: data.transcribed_query || 'Audio Query',
      answer_text: data.answer_text || 'Explanation received from VocalScout AI.',
      target_seconds: Number(data.target_seconds) || 0,
      quote: data.quote || 'Referenced video segment',
      audio_url: data.audio_url,
      language: data.language || targetLanguage,
      isMock: false,
    };
  } catch (error: any) {
    console.warn('Backend /api/ask-voice unreachable or errored. Using fail-safe demo response:', error);
    await simulateDelay(900);
    const mock = getMockResponse(videoId, targetLanguage);
    return { ...mock, isMock: true };
  }
}

/**
 * Sends typed query to the backend at POST /api/ask-text.
 * Falls back gracefully if backend is offline.
 */
export async function sendTextQuery(
  payload: AskTextPayload,
  forceMock = false
): Promise<AskResponse & { isMock?: boolean }> {
  if (forceMock) {
    await simulateDelay(1200);
    const mock = getMockResponse(payload.video_id, payload.target_language, payload.query);
    return { ...mock, isMock: true };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${BASE_URL}/api/ask-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new VoiceApiError(`Server error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      transcribed_query: data.transcribed_query || payload.query,
      answer_text: data.answer_text || 'Explanation received from VocalScout AI.',
      target_seconds: Number(data.target_seconds) || 0,
      quote: data.quote || 'Referenced video segment',
      audio_url: data.audio_url,
      language: data.language || payload.target_language,
      isMock: false,
    };
  } catch (error: any) {
    console.warn('Backend /api/ask-text unreachable. Using fail-safe demo response:', error);
    await simulateDelay(700);
    const mock = getMockResponse(payload.video_id, payload.target_language, payload.query);
    return { ...mock, isMock: true };
  }
}

function getMockResponse(videoId: string, targetLanguage: TargetLanguage, customQuery?: string): AskResponse {
  const videoResponses = MOCK_RESPONSES[videoId] || MOCK_RESPONSES.vid_py_01;
  const response = videoResponses[targetLanguage] || videoResponses.en;
  
  if (customQuery) {
    return {
      ...response,
      transcribed_query: customQuery,
    };
  }
  return response;
}

function simulateDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Audio playback synthesizer:
 * 1. If audio_url is provided, plays standard HTML5 Audio.
 * 2. If no audio_url (e.g. offline mock or local text-to-speech fallback),
 *    uses the browser's Web Speech API SpeechSynthesis with matching regional voice!
 */
export function playSynthesizedAudio(
  text: string,
  audioUrl?: string,
  targetLanguage: TargetLanguage = 'en',
  onEnd?: () => void
): { stop: () => void } {
  if (audioUrl) {
    const audio = new Audio(audioUrl);
    audio.play().catch((err) => {
      console.warn('Audio URL playback failed, falling back to Web Speech API:', err);
      return fallbackWebSpeech(text, targetLanguage, onEnd);
    });

    if (onEnd) {
      audio.onended = onEnd;
      audio.onerror = () => {
        console.warn('Audio stream error, falling back to Web Speech API');
        fallbackWebSpeech(text, targetLanguage, onEnd);
      };
    }

    return {
      stop: () => {
        audio.pause();
        audio.currentTime = 0;
      },
    };
  }

  return fallbackWebSpeech(text, targetLanguage, onEnd);
}

function fallbackWebSpeech(
  text: string,
  targetLanguage: TargetLanguage,
  onEnd?: () => void
): { stop: () => void } {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    setTimeout(() => onEnd?.(), 3000);
    return { stop: () => {} };
  }

  window.speechSynthesis.cancel();

  const cleanSpeechText = text.replace(/[`*#_]/g, '');
  const utterance = new SpeechSynthesisUtterance(cleanSpeechText);

  const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === targetLanguage);
  utterance.lang = langConfig?.speechCode || 'en-US';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find(
    (v) => v.lang.startsWith(targetLanguage) || (langConfig && v.lang === langConfig.speechCode)
  );
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  utterance.onend = () => {
    onEnd?.();
  };

  utterance.onerror = (e) => {
    console.warn('Speech synthesis event error:', e);
    onEnd?.();
  };

  window.speechSynthesis.speak(utterance);

  return {
    stop: () => {
      window.speechSynthesis.cancel();
    },
  };
}
