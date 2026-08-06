import 'server-only';

import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export default cloudinary;

export class CloudinaryUploadValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CloudinaryUploadValidationError';
  }
}

function normalizeFolder(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CloudinaryUploadValidationError(`${label} must be a non-empty string.`);
  }

  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const segments = normalized.split('/');

  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        !/^[A-Za-z0-9._ -]+$/.test(segment)
    )
  ) {
    throw new CloudinaryUploadValidationError(`${label} contains an invalid path segment.`);
  }

  return segments.join('/');
}

function resolveUploadFolder(requestedFolder) {
  const rootFolder = normalizeFolder(
    process.env.CLOUDINARY_ROOT_FOLDER || 'dhaka-heights/dev',
    'Cloudinary root folder'
  );

  if (requestedFolder === undefined || requestedFolder === null || requestedFolder === '') {
    return rootFolder;
  }

  const requested = normalizeFolder(requestedFolder, 'Upload folder');
  if (requested === rootFolder || requested.startsWith(`${rootFolder}/`)) {
    return requested;
  }

  return `${rootFolder}/${requested}`;
}

function getCloudinaryRootFolder() {
  return normalizeFolder(
    process.env.CLOUDINARY_ROOT_FOLDER || 'dhaka-heights/dev',
    'Cloudinary root folder'
  );
}

function normalizePublicId(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CloudinaryUploadValidationError('public_id must be a non-empty string.');
  }

  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (normalized.includes('/../') || normalized.startsWith('../') || normalized.endsWith('/..')) {
    throw new CloudinaryUploadValidationError('public_id contains an invalid path segment.');
  }

  const rootFolder = getCloudinaryRootFolder();
  if (normalized !== rootFolder && !normalized.startsWith(`${rootFolder}/`)) {
    throw new CloudinaryUploadValidationError('The uploaded asset is outside the configured root folder.');
  }

  return normalized;
}

function normalizeTags(tags) {
  if (tags === undefined || tags === null) return undefined;
  if (!Array.isArray(tags)) {
    throw new CloudinaryUploadValidationError('tags must be an array of strings.');
  }

  const normalized = tags.map((tag) => {
    if (typeof tag !== 'string' || !tag.trim()) {
      throw new CloudinaryUploadValidationError('Each tag must be a non-empty string.');
    }
    return tag.trim();
  });

  return normalized.length > 0 ? normalized.join(',') : undefined;
}

function normalizeResourceType(value = 'image') {
  if (!['image', 'video'].includes(value)) {
    throw new CloudinaryUploadValidationError('Unsupported Cloudinary resource type.');
  }
  return value;
}

/**
 * Generate a signature for the exact, allowlisted parameters returned here.
 * Callers cannot override the sanitized folder by spreading arbitrary input.
 */
export function generateUploadSignature({ folder, tags, resourceType = 'image' } = {}) {
  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary server credentials are not configured.');
  }

  const timestamp = Math.round(Date.now() / 1000);
  const targetFolder = resolveUploadFolder(folder);
  const normalizedTags = normalizeTags(tags);
  const normalizedResourceType = normalizeResourceType(resourceType);
  const uploadParams = {
    timestamp,
    folder: targetFolder,
    ...(normalizedTags ? { tags: normalizedTags } : {}),
  };

  const signature = cloudinary.utils.api_sign_request(
    uploadParams,
    process.env.CLOUDINARY_API_SECRET
  );

  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    folder: targetFolder,
    resourceType: normalizedResourceType,
    ...(normalizedTags ? { tags: normalizedTags } : {}),
  };
}

/**
 * Re-read an uploaded resource from Cloudinary before trusting binary metadata
 * submitted by the browser.
 */
export async function getVerifiedCloudinaryAsset(publicId, resourceType = 'image') {
  const normalizedPublicId = normalizePublicId(publicId);
  const normalizedResourceType = normalizeResourceType(resourceType);

  const resource = await cloudinary.api.resource(normalizedPublicId, {
    resource_type: normalizedResourceType,
    type: 'upload',
  });

  if (!resource?.public_id || !resource?.secure_url) {
    throw new Error('Cloudinary returned incomplete asset metadata.');
  }

  const verifiedPublicId = normalizePublicId(resource.public_id);
  if (verifiedPublicId !== normalizedPublicId) {
    throw new CloudinaryUploadValidationError('Cloudinary resource identity did not match the upload.');
  }

  const finalSlash = verifiedPublicId.lastIndexOf('/');
  const folder = finalSlash > 0 ? verifiedPublicId.slice(0, finalSlash) : getCloudinaryRootFolder();

  return {
    public_id: verifiedPublicId,
    secure_url: resource.secure_url,
    resource_type: resource.resource_type,
    format: resource.format || 'bin',
    width: resource.width || null,
    height: resource.height || null,
    bytes: resource.bytes || null,
    folder,
  };
}
