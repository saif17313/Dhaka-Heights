/**
 * Universal, client-safe image optimization utility for Cloudinary assets.
 * Handles format (f_auto), quality (q_auto), and responsive width scaling
 * while preserving version segments, public IDs, and existing transformations.
 */

export function getCloudinaryUrl(url, opts = {}) {
  if (!url || typeof url !== 'string') return url || '';
  if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) return url;
  if (url.endsWith('.svg') || url.includes('.svg?')) return url;

  const [base, ...rest] = url.split('/image/upload/');
  const path = rest.join('/image/upload/');

  const parts = path.split('/');
  let existingTransforms = [];
  let pathAfterTransforms = path;

  // Detect existing transformation segment before version (e.g. v12345) or public id
  if (parts[0] && !parts[0].match(/^v\d+$/) && !parts[0].includes('.')) {
    existingTransforms = parts[0].split(',');
    pathAfterTransforms = parts.slice(1).join('/');
  }

  const newTransforms = [];
  const hasFormat = existingTransforms.some((t) => t.startsWith('f_'));
  const hasQuality = existingTransforms.some((t) => t.startsWith('q_'));
  if (!hasFormat && opts.format !== false) newTransforms.push('f_auto');
  if (!hasQuality && opts.quality !== false) newTransforms.push('q_auto');

  if (opts.crop) newTransforms.push(`c_${opts.crop}`);
  if (opts.gravity) newTransforms.push(`g_${opts.gravity}`);
  if (opts.width) newTransforms.push(`w_${opts.width}`);
  if (opts.height) newTransforms.push(`h_${opts.height}`);

  const merged = [
    ...existingTransforms.filter((t) => {
      if (opts.width && t.startsWith('w_')) return false;
      if (opts.height && t.startsWith('h_')) return false;
      if (opts.crop && t.startsWith('c_')) return false;
      if (opts.gravity && t.startsWith('g_')) return false;
      return true;
    }),
    ...newTransforms,
  ].join(',');

  return `${base}/image/upload/${merged}/${pathAfterTransforms}`;
}

export function getCloudinarySrcSet(url, widths = [360, 640, 768, 1024, 1440, 1920], opts = {}) {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com')) return '';
  return widths.map((w) => `${getCloudinaryUrl(url, { ...opts, width: w })} ${w}w`).join(', ');
}
