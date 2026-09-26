import type { AskResponse, AskTextPayload, TargetLanguage } from '../types';
import { SUPPORTED_LANGUAGES } from '../data/sampleVideos'; /* import { MOCK_RESPONSES } from '../data/sampleVideos'; */
import { wsService } from './websocketService';

const BASE_URL = 'http://localhost:8000';
const API_BASE_PATH = import.meta.env.VITE_BACKEND_API_BASE_PATH || BASE_URL;

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
    /*
    await simulateDelay(1400);
    const mock = getMockResponse(videoId, targetLanguage);
    return { ...mock, isMock: true };
    */
    throw new VoiceApiError('Mock response disabled');
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
    console.error('Backend /api/ask-voice error:', error);
    /*
    console.warn('Backend /api/ask-voice unreachable or errored. Using fail-safe demo response:', error);
    await simulateDelay(900);
    const mock = getMockResponse(videoId, targetLanguage);
    return { ...mock, isMock: true };
    */
    throw error instanceof VoiceApiError ? error : new VoiceApiError(error?.message || 'Backend /api/ask-voice error');
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
    /*
    await simulateDelay(1200);
    const mock = getMockResponse(payload.video_id, payload.target_language, payload.query);
    return { ...mock, isMock: true };
    */
    throw new VoiceApiError('Mock response disabled');
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    /* Old /api/ask-text fetch call commented out per instructions:
    const response = await fetch(`${BASE_URL}/api/ask-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    */

    const queryAgentUrl = `${API_BASE_PATH}/api/query-agent`;
    console.log('Sending query-agent request to:', queryAgentUrl, payload);

    const response = await fetch(queryAgentUrl, {
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
    console.log('query-agent response:', data);

    const responseMsg = typeof data === 'string' ? data : data?.message || JSON.stringify(data);

    // If response message contains "chat entry created" (or OK status), send WebSocket frame
    if (response.ok || (typeof responseMsg === 'string' && responseMsg.toLowerCase().includes('chat entry created'))) {
      const wsPayload = {
        url_path: 'query_agent',
        query: payload.query,
        video_id: payload.video_id,
        query_id: payload.chat_id,
        video_lang: payload.video_lang,
        query_lang: payload.query_lang,
      };

      console.log('Sending WebSocket payload after chat entry created:', wsPayload);
      wsService.sendWebSocketMessage(wsPayload);
    }

    return {
      transcribed_query: data.transcribed_query || payload.query,
      answer_text: data.answer_text || 'Query registered. Streaming response from AI agent...',
      target_seconds: Number(data.target_seconds) || 0,
      quote: data.quote || 'Referenced video segment',
      audio_url: data.audio_url,
      language: data.language || (payload.query_lang as TargetLanguage) || 'en',
      isMock: false,
    };
  } catch (error: any) {
    console.error('Backend /api/query-agent error:', error);
    /*
    console.warn('Backend /api/query-agent unreachable or errored. Using fail-safe demo response:', error);
    await simulateDelay(700);
    const mock = getMockResponse(payload.video_id, (payload.query_lang as TargetLanguage) || 'en', payload.query);
    return { ...mock, isMock: true };
    */
    throw error instanceof VoiceApiError ? error : new VoiceApiError(error?.message || 'Backend /api/query-agent error');
  }
}

/*
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
*/

/*
function simulateDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
*/

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
    return { stop: () => { } };
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
