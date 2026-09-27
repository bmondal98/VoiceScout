import { v4 as uuidv4 } from 'uuid';
import type { CatalogVideo, ProcessingLanguageCode, VideoOption, VideoProcessingResult } from '../types';

const API_BASE = import.meta.env.VITE_BACKEND_API_BASE_PATH;
const CATALOG_URL = `${API_BASE.replace(/\/$/, '')}/api/get-video`;
export const ADD_VIDEO_URL = `${API_BASE.replace(/\/$/, '')}/api/add-video`;

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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(CATALOG_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new VideoServiceError(`Catalog request failed: ${response.status} ${response.statusText}`);
    }

    const rawData = (await response.json()) as any;
    console.log('data>>>', rawData);
    const videoList: CatalogVideo[] = Array.isArray(rawData) ? rawData : (rawData?.videos || []);
    return videoList.map(mapCatalogVideoToOption);
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.warn('Catalog request timed out after 8s');
      return [];
    }
    throw err;
  }
}

import { extractYouTubeId } from '../utils/youtube';

function mapCatalogVideoToOption(video: CatalogVideo): VideoOption {
  const ytUrlCandidate = video.youtube_url || video.video_url;
  const extractedYtId = ytUrlCandidate ? extractYouTubeId(ytUrlCandidate) : null;
  const isYouTube = Boolean(extractedYtId);

  return {
    id: video.video_id,
    title: video.title,
    originalLanguage: video.source_language,
    badge: 'Catalog',
    video_filename: video.video_filename,
    videoUrl: isYouTube ? undefined : video.video_url,
    youtubeId: extractedYtId || undefined,
    youtube_url: video.youtube_url || (isYouTube ? video.video_url : undefined),
    isCatalog: true,
  };
}

/**
 * Requests an AWS S3 presigned upload URL from backend POST /api/generate-video-upload-url
 * Payload: { filename: "VocalScout-X.mp4", content_type: "video/mp4" }
 */
export async function generateVideoUploadUrl(
  filename: string,
  contentType?: string
): Promise<{ uploadUrl: string; contentType?: string }> {
  const url = `${API_BASE.replace(/\/$/, '')}/api/generate-video-upload-url`;
  console.log('Requesting upload URL from:', url, 'with filename:', filename);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename,
      content_type: contentType || 'video/mp4',
    }),
  });

  if (!response.ok) {
    throw new VideoServiceError(`Failed to generate upload URL: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const uploadUrl = data.upload_url || data.uploadUrl || data.url;
  if (!uploadUrl) {
    throw new VideoServiceError('Backend response did not include upload_url');
  }
  return {
    uploadUrl,
    contentType: data.content_type || data.contentType || contentType,
  };
}

/**
 * Uploads a raw File/Blob to AWS S3 using the presigned URL via PUT.
 * Uses ArrayBuffer to perform a single clean PUT request matching the backend S3 presigned URL signature.
 */
export async function uploadVideoToS3(
  uploadUrl: string,
  file: File | Blob
): Promise<void> {
  console.log('Uploading file to S3 via presigned URL:', uploadUrl);
  const arrayBuffer = await file.arrayBuffer();

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: arrayBuffer,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error('S3 upload error response:', errorBody);
    throw new VideoServiceError(`S3 upload failed (${response.status} ${response.statusText}): ${errorBody || 'Check CORS or presigned URL validity'}`);
  }
  console.log('File successfully uploaded to S3!');
}

/**
 * Registers an uploaded video in backend catalog at POST /api/add-video
 * Payload: { video_id, title, filename, source_language, youtube_url? }
 */
export async function addVideoToCatalog(payload: {
  video_id: string;
  title: string;
  filename: string;
  source_language: string;
  youtube_url?: string;
}): Promise<any> {
  const url = `${API_BASE.replace(/\/$/, '')}/api/add-video`;
  console.log('Posting video metadata to /api/add-video:', payload);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new VideoServiceError(`add-video request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('/api/add-video response:', data);
  return data;
}

/**
 * Submits a pasted YouTube URL + target language for backend processing
 * (download, transcription, indexing).
 */
export async function submitVideoForProcessing(
  _youtubeUrl: string,
  languageCode: ProcessingLanguageCode
): Promise<VideoProcessingResult> {
  const videoId = uuidv4();
  const filename = `${videoId}.mp4`;
  const title = videoId;

  console.log('submitVideoForProcessing payload:', {
    video_id: videoId,
    filename,
    title,
    source_language: languageCode,
  });

  return {
    status: 'pending',
    message: 'Processing pipeline not yet connected',
  };
}
