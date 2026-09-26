/**
 * VidKraken API Integration Service
 * Submits YouTube/Media URLs for processing and polls until completed download URL is ready.
 */

interface VidKrakenSubmitResponse {
  jobId?: string;
  id?: string;
  error?: string;
}

interface VidKrakenStatusResponse {
  jobId?: string;
  status?: string;
  downloadUrl?: string;
  url?: string;
  error?: string;
}

const VIDKRAKEN_API_BASE = '/vidkraken-api';

const getVidKrakenApiKey = (): string => {
  const apiKey = import.meta.env.VITE_VIDKRAKEN_API_KEY;
  if (!apiKey) {
    console.warn('VITE_VIDKRAKEN_API_KEY is not defined in environment variables.');
  }
  return apiKey || '';
};

/**
 * Submits a URL download job to VidKraken API.
 */
export const submitVidKrakenDownload = async (mediaUrl: string): Promise<string> => {
  const apiKey = getVidKrakenApiKey();
  console.log('Submitting URL to VidKraken:', mediaUrl);

  const response = await fetch(`${VIDKRAKEN_API_BASE}/download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url: mediaUrl,
      format: 'audio',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`VidKraken download request failed (${response.status}): ${errorText}`);
  }

  const data: VidKrakenSubmitResponse = await response.json();
  const jobId = data.jobId || data.id;

  if (!jobId) {
    throw new Error('VidKraken did not return a valid jobId.');
  }

  console.log('VidKraken job submitted successfully. Job ID:', jobId);
  return jobId;
};

/**
 * Polls VidKraken job status until completion or timeout.
 */
export const pollVidKrakenJob = async (
  jobId: string,
  maxAttempts: number = 60,
  intervalMs: number = 3000
): Promise<string> => {
  const apiKey = getVidKrakenApiKey();
  console.log(`Polling VidKraken job ${jobId}...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(`${VIDKRAKEN_API_BASE}/download/${jobId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.warn(`VidKraken status poll attempt ${attempt} returned HTTP ${response.status}`);
    } else {
      const data: VidKrakenStatusResponse = await response.json();
      console.log(`VidKraken poll attempt ${attempt}/${maxAttempts} response:`, data);

      const status = (data.status || '').toUpperCase();
      // Look for the generated download URL in the response
      const resultDownloadUrl = data.downloadUrl || (data as any).resultUrl || (data as any).cdnUrl || (data as any).fileUrl;

      if (status === 'COMPLETED' || status === 'FINISHED' || status === 'SUCCESS') {
        const finalUrl = resultDownloadUrl || data.url;
        if (finalUrl) {
          console.log('VidKraken job completed successfully. Result URL:', finalUrl);
          return finalUrl;
        }
      }

      if (status === 'FAILED' || status === 'ERROR' || data.error) {
        throw new Error(`VidKraken job failed: ${data.error || status}`);
      }
    }

    // Wait before next attempt
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`VidKraken job ${jobId} timed out after ${maxAttempts * (intervalMs / 1000)} seconds.`);
};

/**
 * Helper function to submit URL and wait for the resultant download URL.
 */
export const processUrlWithVidKraken = async (mediaUrl: string): Promise<string> => {
  const jobId = await submitVidKrakenDownload(mediaUrl);
  const resultUrl = await pollVidKrakenJob(jobId);
  return resultUrl;
};
