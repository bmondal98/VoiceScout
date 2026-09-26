export type InteractionState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'ERROR';

export type TargetLanguage = 'hi' | 'mr' | 'bn' | 'en';

export interface LanguageOption {
  code: TargetLanguage;
  label: string;
  nativeLabel: string;
  flag: string;
  speechCode: string; // for Web Speech API fallback
}

export interface VideoChapter {
  title: string;
  seconds: number;
  formattedTime: string;
}

export interface VideoOption {
  id: string; // e.g. "vid_py_01"
  youtubeId?: string; // e.g. "kqtD5dpn9C8" — omitted for catalog videos, which play via videoUrl instead
  title: string;
  originalLanguage: string;
  instructor?: string;
  duration?: string;
  description?: string;
  badge: string;
  chapters?: VideoChapter[];
  sampleQuestions?: string[];
  isCustom?: boolean;
  /** Presigned S3 playback URL for catalog videos. Short-lived (~1hr) — fetch fresh, don't persist. */
  videoUrl?: string;
  isCatalog?: boolean;
  video_filename?: string;
}

/** Raw shape returned by GET /get-video (the video catalog API). */
export interface CatalogVideo {
  video_id: string;
  title: string;
  source_language: string;
  video_url: string;
  video_filename: string;
}

export type ProcessingLanguageCode = 'en' | 'fr' | 'hi' | 'fil';

export interface ProcessingLanguageOption {
  code: ProcessingLanguageCode;
  label: string;
}

export interface VideoProcessingResult {
  status: string;
  message: string;
}

export interface AskResponse {
  transcribed_query: string;
  answer_text: string;
  target_seconds: number;
  quote: string;
  audio_url?: string;
  language?: string;
  confidence?: number;
}

export interface AskTextPayload {
  video_id: string;
  query: string;
  query_lang: TargetLanguage;
  target_language?: TargetLanguage;
  chat_id: string | number;
  video_lang: string;
}

export interface WsContextItem {
  id: string;
  page_content: string;
  metadata: {
    chunk_id?: string;
    start_sec?: string | number;
    end_sec?: string | number;
    start_ms?: string | number;
    end_ms?: string | number;
    video_id?: string;
    source_language?: string;
  };
}

export interface WsAgentResponseData {
  answer: string;
  context?: WsContextItem[];
}

export interface WsAgentMessage {
  status: string;
  data: WsAgentResponseData | null;
}
