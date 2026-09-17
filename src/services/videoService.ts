import { v4 as uuidv4 } from 'uuid';
import type { CatalogVideo, ProcessingLanguageCode, VideoOption, VideoProcessingResult } from '../types';

const CATALOG_URL = 'https://1cui283870.execute-api.us-east-1.amazonaws.com/dev/api/get-video';
export const ADD_VIDEO_URL = 'https://1cui283870.execute-api.us-east-1.amazonaws.com/dev/api/add-video';

export class VideoServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VideoServiceError';
  }
}

/**
 * Fetches the real video catalog from the backend.
 * video_url is a presigned S3 link valid for ~1 hour — always call this fresh
 * (e.g. on mount) rather than caching/persisting the result.
 */
export async function fetchCatalogVideos(): Promise<VideoOption[]> {
  const response = await fetch(CATALOG_URL);

  if (!response.ok) {
    throw new VideoServiceError(`Catalog request failed: ${response.status} ${response.statusText}`);
  }

  const data: CatalogVideo[] = await response.json();
  return data.map(mapCatalogVideoToOption);
}

function mapCatalogVideoToOption(video: CatalogVideo): VideoOption {
  return {
    id: video.video_id,
    title: video.title,
    originalLanguage: video.source_language,
    instructor: 'Unknown',
    duration: '--:--',
    description: 'A video from the VocalScout catalog.',
    badge: 'Catalog',
    chapters: [],
    sampleQuestions: [],
    videoUrl: video.video_url,
    isCatalog: true,
  };
}

/**
 * Submits a pasted YouTube URL + target language for backend processing
 * (download, transcription, indexing).
 *
 * TODO: replace with real pipeline trigger endpoint once backend provides it.
 */
export async function submitVideoForProcessing(
  youtubeUrl: string,
  languageCode: ProcessingLanguageCode
): Promise<VideoProcessingResult> {
  const videoId = uuidv4();
  const filename = `${videoId}.mp4`;
  const title = videoId;

  console.log('submitVideoForProcessing payload:', {
    video_id: videoId,
    filename,
    title,
    youtubeUrl,
    languageCode,
  });

  return {
    status: 'pending',
    message: 'Processing pipeline not yet connected',
  };
}
