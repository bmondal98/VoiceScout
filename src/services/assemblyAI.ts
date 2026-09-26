import { AssemblyAI } from 'assemblyai';

const apiKey = import.meta.env.VITE_ASSEMBLYAI_API_KEY;

export interface AssemblyAITranscribeResult {
  text: string;
  language_code?: string;
  language_confidence?: number;
}

/**
 * Sends a recorded audio blob to AssemblyAI using a named File object and client.files.upload.
 * Enables language_detection: true to detect spoken language.
 */
export async function transcribeAudioWithAssemblyAI(audioBlob: Blob): Promise<AssemblyAITranscribeResult> {
  if (!apiKey) {
    throw new Error('VITE_ASSEMBLYAI_API_KEY is missing in your .env file.');
  }

  // 1. Guard against empty/ultra-short audio recordings
  if (!audioBlob || audioBlob.size < 2000) {
    throw new Error('Voice recording was too short. Please hold down the mic button while speaking.');
  }

  const client = new AssemblyAI({ apiKey });

  // 2. Determine MIME type & extension
  const mimeType = audioBlob.type || 'audio/webm';
  const extension = mimeType.includes('mp4')
    ? 'mp4'
    : mimeType.includes('ogg')
    ? 'ogg'
    : mimeType.includes('wav')
    ? 'wav'
    : 'webm';

  // 3. Wrap Blob into a named File object so AssemblyAI receives the .webm extension metadata
  const audioFile = new File([audioBlob], `query.${extension}`, { type: mimeType });

  // 4. Upload named File via AssemblyAI SDK
  const uploadUrl = await client.files.upload(audioFile);
  console.log('AssemblyAI uploadUrl:', uploadUrl);

  // 5. Transcribe using uploadUrl with language_detection: true
  const transcript = await client.transcripts.transcribe({
    audio_url: uploadUrl,
    language_detection: true,
  });

  if (transcript.status === 'error') {
    throw new Error(transcript.error || 'AssemblyAI transcription failed.');
  }

  return {
    text: transcript.text || '',
    language_code: transcript.language_code || undefined,
    language_confidence: (transcript as any).language_confidence || undefined,
  };
}
