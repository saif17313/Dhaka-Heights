import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

export const HOME_ABOUT_SECTION_KEY = 'about-corporate-home';
export const HOME_ABOUT_CACHE_TAG = 'home:about:published';

export class HomeAboutDataError extends Error {
  constructor(message, { status = 500, code = 'HOME_ABOUT_DATA_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = 'HomeAboutDataError';
    this.status = status;
    this.code = code;
  }
}

function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new HomeAboutDataError('Public Supabase configuration is missing.', {
      status: 503,
      code: 'PUBLIC_SUPABASE_NOT_CONFIGURED',
    });
  }

  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

function queryError(error, message, code = 'HOME_ABOUT_QUERY_FAILED') {
  if (!error) return;
  throw new HomeAboutDataError(message, { status: 500, code, cause: error });
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

function normalizeImage(image) {
  if (!image) return null;
  return {
    itemId: image.itemId ?? image.id ?? null,
    mediaId: image.mediaId ?? image.image_asset_id ?? image.media?.id ?? null,
    imageAlt: image.imageAlt ?? image.image_alt ?? '',
    media: normalizeMedia(image.media),
  };
}

function normalizeSnapshot(snapshot) {
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    pageId: snapshot.pageId ?? snapshot.page_id,
    sectionKey: snapshot.sectionKey ?? snapshot.section_key ?? HOME_ABOUT_SECTION_KEY,
    status: snapshot.status,
    versionNumber: Number(snapshot.versionNumber ?? snapshot.version_number ?? 1),
    isVisible: snapshot.isVisible ?? snapshot.is_visible ?? true,
    tagText: snapshot.tagText ?? snapshot.tag_text ?? '',
    heading: snapshot.heading ?? '',
    highlightedHeading: snapshot.highlightedHeading ?? snapshot.subheading ?? '',
    leadText: snapshot.leadText ?? snapshot.description ?? '',
    bodyText: snapshot.bodyText ?? snapshot.settings?.body_text ?? '',
    primaryCtaLabel: snapshot.primaryCtaLabel ?? snapshot.settings?.primary_cta?.label ?? '',
    primaryCtaUrl: snapshot.primaryCtaUrl ?? snapshot.settings?.primary_cta?.url ?? '',
    primaryCtaTarget: snapshot.primaryCtaTarget ?? snapshot.settings?.primary_cta?.target ?? '_self',
    videoButtonLabel: snapshot.videoButtonLabel ?? snapshot.settings?.video_button_label ?? '',
    updatedAt: snapshot.updatedAt ?? snapshot.updated_at ?? null,
    updatedBy: snapshot.updatedBy ?? snapshot.updated_by ?? null,
    publishedAt: snapshot.publishedAt ?? snapshot.published_at ?? null,
    publishedBy: snapshot.publishedBy ?? snapshot.published_by ?? null,
    topImage: normalizeImage(snapshot.topImage),
    bottomImage: normalizeImage(snapshot.bottomImage),
    history: (snapshot.history || []).map((revision) => ({
      id: revision.id,
      revisionNumber: Number(revision.revisionNumber ?? revision.version_number ?? 0),
      summary: revision.summary ?? revision.change_summary ?? 'Saved Home About revision',
      createdAt: revision.createdAt ?? revision.created_at ?? null,
      createdBy: revision.createdBy ?? revision.created_by ?? null,
    })),
  };
}

async function loadRevisionHistory(supabase, sectionId) {
  const { data, error } = await supabase
    .from('content_revisions')
    .select('id, version_number, change_summary, created_at, created_by')
    .eq('table_name', 'page_sections')
    .eq('record_id', sectionId)
    .order('created_at', { ascending: false })
    .limit(10);
  queryError(error, 'The Home About revision history could not be loaded.');
  return data || [];
}

async function loadHomeAbout(supabase, { status }) {
  const { data: page, error: pageError } = await supabase
    .from('pages')
    .select('id')
    .eq('slug', 'home')
    .eq('is_published', true)
    .maybeSingle();
  queryError(pageError, 'The Home page could not be loaded.', 'HOME_PAGE_QUERY_FAILED');
  if (!page) {
    throw new HomeAboutDataError('The Home page is not configured.', {
      status: 503,
      code: 'HOME_PAGE_NOT_CONFIGURED',
    });
  }

  const { data: sections, error: sectionError } = await supabase
    .from('page_sections')
    .select('id,page_id,section_key,status,version_number,is_visible,tag_text,heading,subheading,description,settings,updated_at,updated_by,published_at,published_by')
    .eq('page_id', page.id)
    .eq('section_key', HOME_ABOUT_SECTION_KEY)
    .eq('status', status)
    .order('version_number', { ascending: false })
    .limit(1);
  queryError(sectionError, 'The Home About section could not be loaded.');
  const section = sections?.[0];
  if (!section) return null;

  const { data: items, error: itemError } = await supabase
    .from('section_items')
    .select('id,item_key,image_asset_id,image_alt,is_visible,sort_order')
    .eq('section_id', section.id)
    .in('item_key', ['top-image', 'bottom-image'])
    .order('sort_order');
  queryError(itemError, 'The Home About images could not be loaded.');

  const mediaIds = [...new Set((items || []).map((item) => item.image_asset_id).filter(Boolean))];
  const mediaById = new Map();
  if (mediaIds.length) {
    const { data: mediaRows, error: mediaError } = await supabase
      .from('media_assets')
      .select('id,secure_url,display_name,original_filename,alt_text,width,height,is_archived')
      .in('id', mediaIds);
    queryError(mediaError, 'The Home About media could not be loaded.');
    for (const media of mediaRows || []) mediaById.set(media.id, normalizeMedia(media));
  }

  const itemByKey = new Map((items || []).map((item) => [item.item_key, item]));
  const imageFor = (key) => {
    const item = itemByKey.get(key);
    if (!item) return null;
    return {
      itemId: item.id,
      mediaId: item.image_asset_id,
      imageAlt: item.image_alt || '',
      media: mediaById.get(item.image_asset_id) || null,
    };
  };

  return normalizeSnapshot({
    ...section,
    topImage: imageFor('top-image'),
    bottomImage: imageFor('bottom-image'),
  });
}

const getCachedPublishedHomeAbout = unstable_cache(
  async () => {
    const about = await loadHomeAbout(createPublicClient(), { status: 'published' });
    if (!about) {
      throw new HomeAboutDataError('The published Home About block is not configured.', {
        status: 503,
        code: 'HOME_ABOUT_NOT_CONFIGURED',
      });
    }
    if (!about.isVisible) return about;
    if (!about.topImage?.media?.secureUrl || !about.bottomImage?.media?.secureUrl) {
      throw new HomeAboutDataError('Published Home About media is not configured.', {
        status: 503,
        code: 'HOME_ABOUT_MEDIA_NOT_CONFIGURED',
      });
    }
    return about;
  },
  ['home-about-published-v1'],
  { tags: [HOME_ABOUT_CACHE_TAG], revalidate: 3600 }
);

export async function getPublishedHomeAbout() {
  return getCachedPublishedHomeAbout();
}

export async function getAdminHomeAbout() {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  let about = await loadHomeAbout(supabase, { status: 'draft' });
  if (!about) about = await loadHomeAbout(supabase, { status: 'published' });
  if (!about) {
    throw new HomeAboutDataError('The Home About block is not configured.', {
      status: 503,
      code: 'HOME_ABOUT_NOT_CONFIGURED',
    });
  }
  return normalizeSnapshot({
    ...about,
    history: await loadRevisionHistory(supabase, about.id),
  });
}

async function runMutation(name, args) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const validationCodes = new Set(['22023', '22P02', '23502', '23503', '23514']);
    const isConflict = error.code === '40001' || error.code === '23505';
    throw new HomeAboutDataError('The Home About mutation could not be completed.', {
      status: isConflict ? 409 : validationCodes.has(error.code) ? 422 : 500,
      code: isConflict ? 'HOME_ABOUT_CONFLICT' : validationCodes.has(error.code) ? 'VALIDATION_ERROR' : 'HOME_ABOUT_MUTATION_FAILED',
      cause: error,
    });
  }
  if (!data || typeof data !== 'object') {
    throw new HomeAboutDataError('The Home About mutation returned an invalid response.', {
      code: 'HOME_ABOUT_INVALID_MUTATION_RESPONSE',
    });
  }
  if (data.ok === false) return data;
  const about = normalizeSnapshot(data.data);
  return {
    ok: true,
    data: normalizeSnapshot({
      ...about,
      history: await loadRevisionHistory(supabase, about.id),
    }),
  };
}

export async function persistHomeAboutDraft(payload) {
  return runMutation('save_home_about_draft', {
    p_payload: payload,
    p_expected_updated_at: payload.updatedAt,
  });
}

export async function promoteHomeAboutDraft({ id, expectedUpdatedAt }) {
  return runMutation('publish_home_about_draft', {
    p_section_id: id,
    p_expected_updated_at: expectedUpdatedAt,
  });
}
