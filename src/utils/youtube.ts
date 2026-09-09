/**
 * Extracts a YouTube video ID from common URL formats:
 * - youtube.com/watch?v=<id>
 * - youtu.be/<id>
 * - youtube.com/embed/<id>
 * - youtube.com/shorts/<id>
 *
 * Returns null if the URL doesn't match a recognized YouTube format.
 */
export function extractYouTubeId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '');
  const isYouTubeHost = host === 'youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com';
  if (!isYouTubeHost) return null;

  const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

  if (host === 'youtu.be') {
    const id = parsed.pathname.split('/').filter(Boolean)[0];
    return id && VIDEO_ID_PATTERN.test(id) ? id : null;
  }

  if (parsed.pathname === '/watch') {
    const id = parsed.searchParams.get('v');
    return id && VIDEO_ID_PATTERN.test(id) ? id : null;
  }

  const embedMatch = parsed.pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];

  const shortsMatch = parsed.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];

  return null;
}
