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
  youtubeId: string; // e.g. "kqtD5dpn9C8"
  title: string;
  originalLanguage: string;
  instructor: string;
  duration: string;
  description: string;
  badge: string;
  chapters: VideoChapter[];
  sampleQuestions: string[];
  isCustom?: boolean;
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
  target_language: TargetLanguage;
}
