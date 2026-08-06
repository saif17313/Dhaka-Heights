'use client';

import { useMemo, useState } from 'react';
import { getYouTubeThumbnailUrls } from '@/lib/youtube';

export default function YouTubeThumbnail({ videoId, alt, className = '' }) {
  const thumbnails = useMemo(() => getYouTubeThumbnailUrls(videoId), [videoId]);
  const [fallbackVideoId, setFallbackVideoId] = useState(null);

  if (!thumbnails) return null;

  const src = fallbackVideoId === videoId ? thumbnails.fallback : thumbnails.max;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFallbackVideoId(videoId)}
    />
  );
}
