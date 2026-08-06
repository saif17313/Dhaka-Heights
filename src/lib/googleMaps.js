const DEFAULT_MAP_LOCATION = Object.freeze({
  latitude: 23.8137067,
  longitude: 90.428437,
  zoom: 17,
});

const GOOGLE_MAP_HOST_PATTERN = /(^|\.)google\.[a-z.]+$/i;
const GOOGLE_SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl']);
const COORDINATE_PATTERN = /(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)/;

function validCoordinates(latitude, longitude) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

export function buildGoogleMapsEmbedUrl({
  latitude = DEFAULT_MAP_LOCATION.latitude,
  longitude = DEFAULT_MAP_LOCATION.longitude,
  zoom = DEFAULT_MAP_LOCATION.zoom,
} = {}) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const normalizedZoom = Math.max(1, Math.min(21, Number(zoom) || DEFAULT_MAP_LOCATION.zoom));

  if (!validCoordinates(lat, lng)) {
    return buildGoogleMapsEmbedUrl(DEFAULT_MAP_LOCATION);
  }

  const params = new URLSearchParams({
    q: `${lat},${lng}`,
    z: String(normalizedZoom),
    output: 'embed',
  });

  return `https://www.google.com/maps?${params.toString()}`;
}

function coordinatesFromText(value) {
  const match = String(value || '').match(COORDINATE_PATTERN);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  return validCoordinates(latitude, longitude) ? { latitude, longitude } : null;
}

export function normalizeGoogleMapsEmbedUrl(value, fallback = DEFAULT_MAP_LOCATION) {
  const fallbackUrl = buildGoogleMapsEmbedUrl(fallback);
  const input = String(value || '').trim();
  if (!input) return fallbackUrl;

  const plainCoordinates = coordinatesFromText(input);
  if (plainCoordinates && !/^https?:\/\//i.test(input)) {
    return buildGoogleMapsEmbedUrl({ ...fallback, ...plainCoordinates });
  }

  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    return fallbackUrl;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (GOOGLE_SHORT_HOSTS.has(hostname)) return fallbackUrl;
  if (!GOOGLE_MAP_HOST_PATTERN.test(hostname) && hostname !== 'maps.google.com') return fallbackUrl;

  if (parsed.pathname.includes('/maps/embed') || parsed.searchParams.get('output') === 'embed') {
    parsed.protocol = 'https:';
    return parsed.toString();
  }

  const queryCoordinates = coordinatesFromText(
    parsed.searchParams.get('q')
      || parsed.searchParams.get('query')
      || parsed.searchParams.get('ll')
      || ''
  );
  if (queryCoordinates) {
    return buildGoogleMapsEmbedUrl({ ...fallback, ...queryCoordinates });
  }

  const pathCoordinates = parsed.pathname.match(/@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
  if (pathCoordinates) {
    const latitude = Number(pathCoordinates[1]);
    const longitude = Number(pathCoordinates[2]);
    if (validCoordinates(latitude, longitude)) {
      return buildGoogleMapsEmbedUrl({ ...fallback, latitude, longitude });
    }
  }

  return fallbackUrl;
}

export { DEFAULT_MAP_LOCATION };
