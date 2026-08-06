import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

export const CUSTOMER_REVIEWS_CACHE_TAG = 'customer-reviews:published';

export class CustomerReviewDataError extends Error {
  constructor(message, { status = 500, code = 'CUSTOMER_REVIEW_DATA_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = 'CustomerReviewDataError';
    this.status = status;
    this.code = code;
  }
}

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new CustomerReviewDataError('Public Supabase configuration is missing.', {
      status: 503,
      code: 'PUBLIC_SUPABASE_NOT_CONFIGURED',
    });
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function fail(error, message) {
  if (error) throw new CustomerReviewDataError(message, { cause: error });
}

function normalizeAsset(row) {
  if (!row) return null;
  return {
    id: row.id,
    secureUrl: row.secure_url,
    publicId: row.public_id,
    displayName: row.display_name,
    altText: row.alt_text || '',
    caption: row.caption || '',
    width: row.width,
    height: row.height,
    format: row.format,
  };
}

function normalizeMedia(row) {
  if (!row) return null;
  return {
    id: row.id,
    reviewId: row.review_id,
    mediaType: row.media_type,
    imageAssetId: row.image_asset_id,
    imageAsset: normalizeAsset(row.image_asset || row.imageAsset),
    youtubeUrl: row.youtube_url,
    youtubeVideoId: row.youtube_video_id,
    thumbnailUrl: row.thumbnail_url,
    caption: row.caption || '',
    altText: row.alt_text || '',
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeReview(row, media = null) {
  if (!row) return null;
  const selected = Array.isArray(row.selected_preview)
    ? row.selected_preview[0]
    : row.selected_preview;
  return {
    id: row.id,
    slug: row.slug,
    customerName: row.customer_name,
    customerDesignation: row.customer_designation || '',
    customerLocation: row.customer_location || '',
    customerType: row.customer_type || '',
    reviewCategory: row.review_category || '',
    relatedProject: row.related_project || '',
    profileImageId: row.profile_image_id,
    profileImage: normalizeAsset(row.profile_image || row.profileImage),
    profileImageAlt: row.profile_image_alt || '',
    reviewText: row.review_text,
    rating: row.rating == null ? null : Number(row.rating),
    reviewDate: row.review_date || '',
    selectedPreviewMediaId: row.selected_preview_media_id,
    selectedPreview: normalizeMedia(selected),
    status: row.status,
    isFeatured: Boolean(row.is_featured),
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    media: media ? media.map(normalizeMedia) : undefined,
  };
}

const LIST_SELECT = `
  id,slug,customer_name,customer_designation,customer_location,customer_type,review_category,
  related_project,profile_image_id,profile_image_alt,review_text,rating,review_date,
  selected_preview_media_id,status,is_featured,sort_order,created_at,updated_at,
  profile_image:media_assets!customer_reviews_profile_image_id_fkey(
    id,secure_url,public_id,display_name,alt_text,caption,width,height,format
  ),
  selected_preview:customer_review_media!customer_reviews_selected_preview_fkey(
    id,review_id,media_type,image_asset_id,youtube_url,youtube_video_id,thumbnail_url,
    caption,alt_text,sort_order,created_at,updated_at,
    image_asset:media_assets!customer_review_media_image_asset_id_fkey(
      id,secure_url,public_id,display_name,alt_text,caption,width,height,format
    )
  )
`;

async function loadPublishedCustomerReviews(page, limit) {
  const client = publicClient();
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(24, Math.max(1, Number(limit) || 9));
  const from = (safePage - 1) * safeLimit;
  const to = from + safeLimit - 1;

  const { data, count, error } = await client
    .from('customer_reviews')
    .select(LIST_SELECT, { count: 'exact' })
    .eq('status', 'published')
    .order('sort_order', { ascending: true })
    .order('review_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  fail(error, 'Published customer reviews could not be loaded.');
  const total = count || 0;
  return {
    reviews: (data || []).map((row) => normalizeReview(row)),
    page: safePage,
    pageSize: safeLimit,
    total,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

const cachedPublishedCustomerReviews = unstable_cache(
  loadPublishedCustomerReviews,
  ['published-customer-reviews-v1'],
  { tags: [CUSTOMER_REVIEWS_CACHE_TAG], revalidate: 600 }
);

export function getPublishedCustomerReviews({ page = 1, limit = 9 } = {}) {
  return cachedPublishedCustomerReviews(page, limit);
}

export async function getPublishedCustomerReview(slug) {
  const client = publicClient();
  const { data: review, error } = await client
    .from('customer_reviews')
    .select(`${LIST_SELECT},created_by,updated_by`)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  fail(error, 'The customer review could not be loaded.');
  if (!review) return null;

  const { data: media, error: mediaError } = await client
    .from('customer_review_media')
    .select(`
      id,review_id,media_type,image_asset_id,youtube_url,youtube_video_id,thumbnail_url,
      caption,alt_text,sort_order,created_at,updated_at,
      image_asset:media_assets!customer_review_media_image_asset_id_fkey(
        id,secure_url,public_id,display_name,alt_text,caption,width,height,format
      )
    `)
    .eq('review_id', review.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  fail(mediaError, 'Customer review media could not be loaded.');
  return normalizeReview(review, media || []);
}

export async function getAdminCustomerReviews({
  search = '',
  status = '',
  customerType = '',
  sort = 'serial',
  page = 1,
  limit = 12,
} = {}) {
  await requireAdmin();
  const admin = createAdminClient();
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 12));
  const from = (safePage - 1) * safeLimit;
  const to = from + safeLimit - 1;

  let query = admin.from('customer_reviews').select(LIST_SELECT, { count: 'exact' });
  const safeSearch = String(search || '').trim().replace(/[,%()]/g, ' ');
  if (safeSearch) {
    query = query.or(
      `customer_name.ilike.%${safeSearch}%,related_project.ilike.%${safeSearch}%,customer_location.ilike.%${safeSearch}%,customer_designation.ilike.%${safeSearch}%`
    );
  }
  if (['draft', 'published', 'archived'].includes(status)) query = query.eq('status', status);
  if (['Apartment Buyer', 'Landowner', 'Investor', 'Other'].includes(customerType)) {
    query = query.eq('customer_type', customerType);
  }

  if (sort === 'review-date') {
    query = query.order('review_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  } else if (sort === 'created-date') {
    query = query.order('created_at', { ascending: false });
  } else {
    query = query.order('sort_order', { ascending: true }).order('created_at', { ascending: false });
  }

  const { data, count, error } = await query.range(from, to);
  fail(error, 'Customer reviews could not be loaded for the admin panel.');
  const total = count || 0;
  return {
    reviews: (data || []).map((row) => normalizeReview(row)),
    page: safePage,
    pageSize: safeLimit,
    total,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

export async function getAdminCustomerReview(id) {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: review, error } = await admin
    .from('customer_reviews')
    .select(`${LIST_SELECT},created_by,updated_by`)
    .eq('id', id)
    .maybeSingle();
  fail(error, 'The customer review could not be loaded for editing.');
  if (!review) return null;

  const { data: media, error: mediaError } = await admin
    .from('customer_review_media')
    .select(`
      id,review_id,media_type,image_asset_id,youtube_url,youtube_video_id,thumbnail_url,
      caption,alt_text,sort_order,created_at,updated_at,
      image_asset:media_assets!customer_review_media_image_asset_id_fkey(
        id,secure_url,public_id,display_name,alt_text,caption,width,height,format
      )
    `)
    .eq('review_id', id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  fail(mediaError, 'Customer review media could not be loaded for editing.');
  return normalizeReview(review, media || []);
}

export async function persistCustomerReview(payload) {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc('save_customer_review', {
    p_payload: payload,
    p_expected_updated_at: payload.expectedUpdatedAt || null,
  });
  if (error) {
    const conflict = error.code === '40001' || error.code === '23505';
    const invalid = ['22023', '23502', '23503', '23514', '22P02'].includes(error.code);
    throw new CustomerReviewDataError(
      conflict ? 'This customer review changed in another session or its slug is already used.' : 'The customer review could not be saved.',
      {
        status: conflict ? 409 : invalid ? 422 : 500,
        code: conflict ? 'CUSTOMER_REVIEW_CONFLICT' : 'CUSTOMER_REVIEW_MUTATION_FAILED',
        cause: error,
      }
    );
  }
  const reviewId = data?.reviewId;
  if (!data?.ok || !reviewId) {
    throw new CustomerReviewDataError('The customer review save did not complete.', {
      status: 500,
      code: 'CUSTOMER_REVIEW_MUTATION_FAILED',
    });
  }
  return getAdminCustomerReview(reviewId);
}

export async function updateCustomerReviewStatus(id, status, actorId) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('customer_reviews')
    .update({ status, updated_by: actorId })
    .eq('id', id)
    .select('id,status,updated_at')
    .maybeSingle();
  fail(error, 'The customer review status could not be updated.');
  if (!data) throw new CustomerReviewDataError('Customer review not found.', { status: 404, code: 'CUSTOMER_REVIEW_NOT_FOUND' });
  return data;
}

export async function removeCustomerReview(id, actorId) {
  const admin = createAdminClient();
  const { data: existing, error: readError } = await admin
    .from('customer_reviews')
    .select('id,slug,customer_name')
    .eq('id', id)
    .maybeSingle();
  fail(readError, 'The customer review could not be checked before deletion.');
  if (!existing) throw new CustomerReviewDataError('Customer review not found.', { status: 404, code: 'CUSTOMER_REVIEW_NOT_FOUND' });

  const { error } = await admin.from('customer_reviews').delete().eq('id', id);
  fail(error, 'The customer review could not be deleted.');
  await admin.from('audit_logs').insert({
    admin_id: actorId,
    action: 'delete',
    table_name: 'customer_reviews',
    record_id: id,
    old_values: existing,
  });
  return existing;
}
