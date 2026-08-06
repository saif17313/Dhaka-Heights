import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

export const HOME_MEDIA_HIGHLIGHTS_SECTION_KEY = 'media-highlights-home';
export const HOME_MEDIA_HIGHLIGHTS_CACHE_TAG = 'home:media-highlights:published';

export class HomeMediaHighlightsDataError extends Error {
  constructor(message, { status = 500, code = 'HOME_MEDIA_HIGHLIGHTS_DATA_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = 'HomeMediaHighlightsDataError';
    this.status = status;
    this.code = code;
  }
}

function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new HomeMediaHighlightsDataError('Public Supabase configuration is missing.', { status: 503, code: 'PUBLIC_SUPABASE_NOT_CONFIGURED' });
  }
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
}

function queryError(error, message, code = 'HOME_MEDIA_HIGHLIGHTS_QUERY_FAILED') {
  if (error) throw new HomeMediaHighlightsDataError(message, { status: 500, code, cause: error });
}

function normalizeMedia(media) {
  if (!media || media.is_archived) return null;
  return {
    id: media.id,
    secureUrl: media.secureUrl ?? media.secure_url ?? null,
    displayName: media.displayName ?? media.display_name ?? media.original_filename ?? null,
    altText: media.altText ?? media.alt_text ?? '',
    width: media.width ?? null,
    height: media.height ?? null,
  };
}

function normalizeMediaPost(post) {
  if (!post) return null;
  return {
    id: post.id,
    slug: post.slug || '',
    title: post.title || '',
    category: post.category || '',
    publishedDate: post.publishedDate ?? post.published_date ?? null,
    excerpt: post.excerpt || '',
    status: post.status || 'published',
    coverMediaId: post.coverMediaId ?? post.cover_image_id ?? null,
    coverMedia: normalizeMedia(post.coverMedia),
  };
}

function normalizePlacement(placement, index = 0) {
  const mediaPost = normalizeMediaPost(placement.mediaPost ?? placement.media_post);
  const overrideTitle = placement.overrideTitle ?? placement.override_title ?? null;
  const overrideDescription = placement.overrideDescription ?? placement.override_description ?? null;
  const overrideCategory = placement.overrideCategory ?? placement.override_category ?? null;
  const overrideCoverMediaId = placement.overrideCoverMediaId ?? placement.override_cover_image_id ?? null;
  const overrideCtaLabel = placement.overrideCtaLabel ?? placement.override_cta_label ?? null;
  const overrideCtaUrl = placement.overrideCtaUrl ?? placement.override_cta_url ?? null;
  const effectiveCover = normalizeMedia(placement.coverMedia) || mediaPost?.coverMedia || null;
  return {
    placementId: placement.placementId ?? placement.id ?? null,
    mediaPostId: placement.mediaPostId ?? placement.media_post_id ?? mediaPost?.id ?? null,
    sortOrder: Number(placement.sortOrder ?? placement.sort_order ?? (index + 1) * 10),
    isVisible: placement.isVisible ?? placement.is_visible ?? true,
    overrideTitle,
    overrideDescription,
    overrideCategory,
    overrideCoverMediaId,
    overrideCtaLabel,
    overrideCtaUrl,
    title: overrideTitle || mediaPost?.title || '',
    summary: overrideDescription || mediaPost?.excerpt || '',
    category: overrideCategory || mediaPost?.category || '',
    publishedDate: mediaPost?.publishedDate || null,
    ctaLabel: overrideCtaLabel || 'Read Article',
    ctaUrl: overrideCtaUrl || (mediaPost?.slug ? `/media-center/${mediaPost.slug}` : '/media-center'),
    coverMedia: effectiveCover,
    mediaPost,
  };
}

function normalizeSnapshot(snapshot) {
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    pageId: snapshot.pageId ?? snapshot.page_id,
    sectionKey: snapshot.sectionKey ?? snapshot.section_key ?? HOME_MEDIA_HIGHLIGHTS_SECTION_KEY,
    status: snapshot.status,
    versionNumber: Number(snapshot.versionNumber ?? snapshot.version_number ?? 1),
    isVisible: snapshot.isVisible ?? snapshot.is_visible ?? true,
    tagText: snapshot.tagText ?? snapshot.tag_text ?? '',
    heading: snapshot.heading ?? '',
    viewAllLabel: snapshot.viewAllLabel ?? snapshot.settings?.view_all?.label ?? '',
    viewAllUrl: snapshot.viewAllUrl ?? snapshot.settings?.view_all?.url ?? '',
    updatedAt: snapshot.updatedAt ?? snapshot.updated_at ?? null,
    updatedBy: snapshot.updatedBy ?? snapshot.updated_by ?? null,
    publishedAt: snapshot.publishedAt ?? snapshot.published_at ?? null,
    publishedBy: snapshot.publishedBy ?? snapshot.published_by ?? null,
    articles: (snapshot.articles || []).map(normalizePlacement).sort((a, b) => a.sortOrder - b.sortOrder),
    history: (snapshot.history || []).map((revision) => ({
      id: revision.id,
      revisionNumber: Number(revision.revisionNumber ?? revision.version_number ?? 0),
      summary: revision.summary ?? revision.change_summary ?? 'Saved Home Media Highlights revision',
      createdAt: revision.createdAt ?? revision.created_at ?? null,
      createdBy: revision.createdBy ?? revision.created_by ?? null,
    })),
  };
}

async function loadRevisionHistory(supabase, sectionId) {
  const { data, error } = await supabase.from('content_revisions')
    .select('id, version_number, change_summary, created_at, created_by')
    .eq('table_name', 'page_sections').eq('record_id', sectionId)
    .order('created_at', { ascending: false }).limit(10);
  queryError(error, 'The Home Media Highlights revision history could not be loaded.');
  return data || [];
}

async function loadMediaPostRows(supabase, postIds, overrideMediaIds = []) {
  if (!postIds.length) return { posts: [], mediaById: new Map() };
  const { data: posts, error: postError } = await supabase.from('media_posts')
    .select('id,slug,title,category,published_date,excerpt,cover_image_id,status')
    .in('id', postIds);
  queryError(postError, 'The canonical Home media posts could not be loaded.');

  const mediaIds = [...new Set([...(posts || []).map((post) => post.cover_image_id), ...overrideMediaIds].filter(Boolean))];
  const mediaById = new Map();
  if (mediaIds.length) {
    const { data: mediaRows, error: mediaError } = await supabase.from('media_assets')
      .select('id,secure_url,display_name,original_filename,alt_text,width,height,is_archived')
      .in('id', mediaIds);
    queryError(mediaError, 'The canonical media covers could not be loaded.');
    for (const media of mediaRows || []) mediaById.set(media.id, normalizeMedia(media));
  }
  return {
    posts: (posts || []).map((post) => normalizeMediaPost({ ...post, coverMedia: mediaById.get(post.cover_image_id) || null })),
    mediaById,
  };
}

async function loadHomeMediaHighlights(supabase, { status }) {
  const { data: page, error: pageError } = await supabase.from('pages').select('id')
    .eq('slug', 'home').eq('is_published', true).maybeSingle();
  queryError(pageError, 'The Home page could not be loaded.', 'HOME_PAGE_QUERY_FAILED');
  if (!page) throw new HomeMediaHighlightsDataError('The Home page is not configured.', { status: 503, code: 'HOME_PAGE_NOT_CONFIGURED' });

  const { data: sections, error: sectionError } = await supabase.from('page_sections')
    .select('id,page_id,section_key,status,version_number,is_visible,tag_text,heading,settings,updated_at,updated_by,published_at,published_by')
    .eq('page_id', page.id).eq('section_key', HOME_MEDIA_HIGHLIGHTS_SECTION_KEY).eq('status', status)
    .order('version_number', { ascending: false }).limit(1);
  queryError(sectionError, 'The Home Media Highlights section could not be loaded.');
  const section = sections?.[0];
  if (!section) return null;

  const { data: selections, error: selectionError } = await supabase.from('section_entity_selections')
    .select('id').eq('section_id', section.id).eq('entity_type', 'media_post').limit(1);
  queryError(selectionError, 'The Home media selection could not be loaded.');
  const selection = selections?.[0];
  if (!selection) return normalizeSnapshot({ ...section, articles: [] });

  const { data: items, error: itemError } = await supabase.from('section_entity_selection_items')
    .select('id,media_post_id,override_title,override_description,override_category,override_cover_image_id,override_cta_label,override_cta_url,sort_order,is_visible')
    .eq('selection_id', selection.id).order('sort_order');
  queryError(itemError, 'The Home media placements could not be loaded.');

  const { posts, mediaById } = await loadMediaPostRows(
    supabase,
    (items || []).map((item) => item.media_post_id).filter(Boolean),
    (items || []).map((item) => item.override_cover_image_id).filter(Boolean)
  );
  const postById = new Map(posts.map((post) => [post.id, post]));
  return normalizeSnapshot({
    ...section,
    articles: (items || []).map((item) => ({
      ...item,
      mediaPost: postById.get(item.media_post_id) || null,
      coverMedia: mediaById.get(item.override_cover_image_id) || postById.get(item.media_post_id)?.coverMedia || null,
    })),
  });
}

const getCachedPublishedHomeMediaHighlights = unstable_cache(
  async () => {
    const highlights = await loadHomeMediaHighlights(createPublicClient(), { status: 'published' });
    if (!highlights) throw new HomeMediaHighlightsDataError('The published Home Media Highlights section is not configured.', { status: 503, code: 'HOME_MEDIA_HIGHLIGHTS_NOT_CONFIGURED' });
    const validArticles = highlights.articles.filter((article) => article.mediaPost && article.coverMedia?.secureUrl);
    if (highlights.isVisible && !validArticles.length) {
      return normalizeSnapshot({ ...highlights, isVisible: false, articles: [] });
    }
    if (validArticles.length !== highlights.articles.length) {
      return normalizeSnapshot({ ...highlights, articles: validArticles });
    }
    return highlights;
  },
  ['home-media-highlights-published-v1'],
  { tags: [HOME_MEDIA_HIGHLIGHTS_CACHE_TAG], revalidate: 3600 }
);

export async function getPublishedHomeMediaHighlights() {
  return getCachedPublishedHomeMediaHighlights();
}

export async function getAdminHomeMediaHighlights() {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  let highlights = await loadHomeMediaHighlights(supabase, { status: 'draft' });
  if (!highlights) highlights = await loadHomeMediaHighlights(supabase, { status: 'published' });
  if (!highlights) throw new HomeMediaHighlightsDataError('The Home Media Highlights section is not configured.', { status: 503, code: 'HOME_MEDIA_HIGHLIGHTS_NOT_CONFIGURED' });
  return normalizeSnapshot({ ...highlights, history: await loadRevisionHistory(supabase, highlights.id) });
}

export async function getAdminMediaPostCatalog() {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('media_posts').select('id').eq('status', 'published').order('published_date', { ascending: false });
  queryError(error, 'The media post catalog could not be loaded.');
  const { posts } = await loadMediaPostRows(supabase, (data || []).map((post) => post.id));
  return posts.sort((a, b) => String(b.publishedDate).localeCompare(String(a.publishedDate)) || a.title.localeCompare(b.title));
}

async function runMutation(name, args) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const validationCodes = new Set(['22023', '22P02', '23502', '23503', '23514']);
    const isConflict = error.code === '40001' || error.code === '23505';
    throw new HomeMediaHighlightsDataError('The Home Media Highlights mutation could not be completed.', {
      status: isConflict ? 409 : validationCodes.has(error.code) ? 422 : 500,
      code: isConflict ? 'HOME_MEDIA_HIGHLIGHTS_CONFLICT' : validationCodes.has(error.code) ? 'VALIDATION_ERROR' : 'HOME_MEDIA_HIGHLIGHTS_MUTATION_FAILED',
      cause: error,
    });
  }
  if (!data || typeof data !== 'object') throw new HomeMediaHighlightsDataError('The Home Media Highlights mutation returned an invalid response.', { code: 'HOME_MEDIA_HIGHLIGHTS_INVALID_MUTATION_RESPONSE' });
  if (data.ok === false) return data;
  const highlights = normalizeSnapshot(data.data);
  return { ok: true, data: normalizeSnapshot({ ...highlights, history: await loadRevisionHistory(supabase, highlights.id) }) };
}

export async function persistHomeMediaHighlightsDraft(payload) {
  return runMutation('save_home_media_highlights_draft', { p_payload: payload, p_expected_updated_at: payload.updatedAt });
}

export async function promoteHomeMediaHighlightsDraft({ id, expectedUpdatedAt }) {
  return runMutation('publish_home_media_highlights_draft', { p_section_id: id, p_expected_updated_at: expectedUpdatedAt });
}
