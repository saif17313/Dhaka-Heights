'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { isAdminAuthError, requireAdmin } from '@/lib/auth/requireAdmin';
import {
  CUSTOMER_REVIEWS_CACHE_TAG,
  CustomerReviewDataError,
  persistCustomerReview,
  removeCustomerReview,
  updateCustomerReviewStatus,
} from '@/lib/customerReviewsRepository';
import {
  extractYouTubeVideoId,
  getYouTubeThumbnailUrls,
  normalizeYouTubeUrl,
} from '@/lib/youtube';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CUSTOMER_TYPES = new Set(['', 'Apartment Buyer', 'Landowner', 'Investor', 'Other']);
const STATUSES = new Set(['draft', 'published', 'archived']);

function text(value, max = 1000) {
  const normalized = String(value || '').trim();
  return normalized ? normalized.slice(0, max) : '';
}

function validateAndNormalize(input) {
  const errors = {};
  const review = input?.review || {};
  const media = Array.isArray(input?.media) ? input.media : [];

  const id = text(review.id, 80);
  const customerName = text(review.customerName, 160);
  const slug = text(review.slug, 180).toLowerCase();
  const reviewText = text(review.reviewText, 12000);
  const customerType = text(review.customerType, 40);
  const status = text(review.status, 20) || 'draft';
  const profileImageId = text(review.profileImageId, 80);
  const selectedPreviewMediaId = text(review.selectedPreviewMediaId, 80);
  const rating = review.rating === '' || review.rating == null ? null : Number(review.rating);
  const sortOrder = Number(review.sortOrder ?? 10);

  if (!UUID.test(id)) errors.id = 'A stable customer review ID is required.';
  if (!customerName) errors.customerName = 'Customer name is required.';
  if (String(review.customerName || '').trim().length > 160) errors.customerName = 'Customer name must be 160 characters or fewer.';
  if (!SLUG.test(slug)) errors.slug = 'Use lowercase letters, numbers, and single hyphens only.';
  if (String(review.slug || '').trim().length > 180) errors.slug = 'Slug must be 180 characters or fewer.';
  if (!reviewText) errors.reviewText = 'Full customer review text is required.';
  if (String(review.reviewText || '').trim().length > 12000) errors.reviewText = 'Review text must be 12,000 characters or fewer.';
  if (String(review.customerDesignation || '').trim().length > 180) errors.customerDesignation = 'Designation must be 180 characters or fewer.';
  if (String(review.customerLocation || '').trim().length > 200) errors.customerLocation = 'Location must be 200 characters or fewer.';
  if (String(review.reviewCategory || '').trim().length > 120) errors.reviewCategory = 'Category must be 120 characters or fewer.';
  if (String(review.relatedProject || '').trim().length > 220) errors.relatedProject = 'Related project must be 220 characters or fewer.';
  if (String(review.profileImageAlt || '').trim().length > 180) errors.profileImageAlt = 'Profile image alt text must be 180 characters or fewer.';
  if (!CUSTOMER_TYPES.has(customerType)) errors.customerType = 'Choose a supported customer type.';
  if (!STATUSES.has(status)) errors.status = 'Choose draft, published, or archived.';
  if (profileImageId && !UUID.test(profileImageId)) errors.profileImageId = 'Choose a valid profile image.';
  if (profileImageId && !text(review.profileImageAlt, 180)) errors.profileImageAlt = 'Profile image alt text is required when a profile photo is selected.';
  if (rating != null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) errors.rating = 'Rating must be between 1 and 5.';
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 1000000) errors.sortOrder = 'Sort order must be a non-negative whole number.';
  if (review.reviewDate && Number.isNaN(Date.parse(review.reviewDate))) errors.reviewDate = 'Choose a valid review date.';
  if (media.length > 60) errors.media = 'A review supports at most 60 media items.';

  const ids = new Set();
  const normalizedMedia = media.map((item, index) => {
    const mediaId = text(item.id, 80);
    const mediaType = text(item.mediaType, 20);
    const mediaSortOrder = Number(item.sortOrder ?? (index + 1) * 10);
    if (!UUID.test(mediaId)) errors[`media.${index}.id`] = 'A stable media ID is required.';
    if (ids.has(mediaId)) errors[`media.${index}.id`] = 'Media IDs must be unique.';
    ids.add(mediaId);
    if (!Number.isInteger(mediaSortOrder) || mediaSortOrder < 0) errors[`media.${index}.sortOrder`] = 'Media order must be a non-negative whole number.';

    if (mediaType === 'image') {
      const imageAssetId = text(item.imageAssetId, 80);
      if (!UUID.test(imageAssetId)) errors[`media.${index}.imageAssetId`] = 'Choose a valid uploaded image.';
      const altText = text(item.altText, 180);
      if (!altText) errors[`media.${index}.altText`] = 'Image alt text is required.';
      if (String(item.altText || '').trim().length > 180) errors[`media.${index}.altText`] = 'Image alt text must be 180 characters or fewer.';
      if (String(item.caption || '').trim().length > 500) errors[`media.${index}.caption`] = 'Caption must be 500 characters or fewer.';
      return {
        id: mediaId,
        mediaType: 'image',
        imageAssetId,
        caption: text(item.caption, 500) || null,
        altText,
        sortOrder: mediaSortOrder,
      };
    }

    if (mediaType === 'youtube') {
      const videoId = extractYouTubeVideoId(item.youtubeUrl || item.youtubeVideoId);
      if (!videoId) errors[`media.${index}.youtubeUrl`] = 'Paste a supported YouTube URL.';
      const normalizedUrl = videoId ? normalizeYouTubeUrl(videoId) : '';
      const thumbnails = videoId ? getYouTubeThumbnailUrls(videoId) : null;
      if (String(item.caption || '').trim().length > 500) errors[`media.${index}.caption`] = 'Caption must be 500 characters or fewer.';
      return {
        id: mediaId,
        mediaType: 'youtube',
        youtubeUrl: normalizedUrl,
        youtubeVideoId: videoId,
        thumbnailUrl: thumbnails?.max || null,
        caption: text(item.caption, 500) || null,
        sortOrder: mediaSortOrder,
      };
    }

    errors[`media.${index}.mediaType`] = 'Choose image or YouTube media.';
    return { id: mediaId, mediaType, sortOrder: mediaSortOrder };
  });

  if (selectedPreviewMediaId && !UUID.test(selectedPreviewMediaId)) {
    errors.selectedPreviewMediaId = 'Selected card preview is invalid.';
  } else if (selectedPreviewMediaId && !ids.has(selectedPreviewMediaId)) {
    errors.selectedPreviewMediaId = 'Selected card preview must belong to this review.';
  }

  return {
    errors,
    payload: {
      review: {
        id,
        slug,
        customerName,
        customerDesignation: text(review.customerDesignation, 180) || null,
        customerLocation: text(review.customerLocation, 200) || null,
        customerType: customerType || null,
        reviewCategory: text(review.reviewCategory, 120) || null,
        relatedProject: text(review.relatedProject, 220) || null,
        profileImageId: profileImageId || null,
        profileImageAlt: text(review.profileImageAlt, 180) || null,
        reviewText,
        rating,
        reviewDate: text(review.reviewDate, 20) || null,
        selectedPreviewMediaId: selectedPreviewMediaId || null,
        status,
        isFeatured: Boolean(review.isFeatured),
        sortOrder,
      },
      media: normalizedMedia,
      expectedUpdatedAt: input?.expectedUpdatedAt || null,
    },
  };
}

function failure(error) {
  if (isAdminAuthError(error)) return { ok: false, status: error.status, code: error.code, error: error.message };
  if (error instanceof CustomerReviewDataError) {
    return {
      ok: false,
      status: error.status,
      code: error.code,
      error: error.status >= 500 ? 'The customer review request could not be completed.' : error.message,
    };
  }
  console.error('Unexpected customer review action failure:', error);
  return { ok: false, status: 500, code: 'CUSTOMER_REVIEW_ACTION_FAILED', error: 'The customer review request could not be completed.' };
}

function revalidateCustomerReviews(slug = null) {
  updateTag(CUSTOMER_REVIEWS_CACHE_TAG);
  revalidatePath('/media-center');
  revalidatePath('/media-center/customer-reviews/[slug]', 'page');
  revalidatePath('/admin/media/customer-reviews');
  if (slug) revalidatePath(`/media-center/customer-reviews/${slug}`);
}

export async function saveCustomerReview(input) {
  try {
    await requireAdmin();
    const { errors, payload } = validateAndNormalize(input);
    if (Object.keys(errors).length) {
      return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'Review the customer review fields.', fieldErrors: errors };
    }
    const review = await persistCustomerReview(payload);
    revalidateCustomerReviews(review.slug);
    return { ok: true, data: review };
  } catch (error) {
    return failure(error);
  }
}

export async function changeCustomerReviewStatus(input) {
  try {
    const admin = await requireAdmin();
    if (!UUID.test(input?.id || '') || !STATUSES.has(input?.status)) {
      return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'Choose a valid customer review and status.' };
    }
    const result = await updateCustomerReviewStatus(input.id, input.status, admin.user.id);
    revalidateCustomerReviews();
    return { ok: true, data: result };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteCustomerReview(input) {
  try {
    const admin = await requireAdmin();
    if (!UUID.test(input?.id || '')) {
      return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'Choose a valid customer review.' };
    }
    const result = await removeCustomerReview(input.id, admin.user.id);
    revalidateCustomerReviews(result.slug);
    return { ok: true, data: result };
  } catch (error) {
    return failure(error);
  }
}
