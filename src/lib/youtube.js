const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function extractYouTubeVideoId(value) {
  const input = String(value || '').trim();
  if (!input) return null;
  if (VIDEO_ID_PATTERN.test(input)) return input;

  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let candidate = null;

  if (host === 'youtu.be') {
    candidate = url.pathname.split('/').filter(Boolean)[0] || null;
  } else if (
    host === 'youtube.com'
    || host === 'm.youtube.com'
    || host === 'music.youtube.com'
    || host === 'youtube-nocookie.com'
  ) {
    if (url.pathname === '/watch') candidate = url.searchParams.get('v');
    if (!candidate) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(parts[0])) candidate = parts[1] || null;
    }
  }

  return candidate && VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
}

export function normalizeYouTubeUrl(value) {
  const videoId = extractYouTubeVideoId(value);
  if (!videoId) return null;
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function getYouTubeEmbedUrl(value) {
  const videoId = extractYouTubeVideoId(value);
  return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;
}

export function getYouTubeThumbnailUrls(value) {
  const videoId = extractYouTubeVideoId(value);
  if (!videoId) return null;
  return {
    max: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    fallback: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
}
