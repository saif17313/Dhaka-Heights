import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

export const HOME_HERO_SECTION_KEY = 'hero-slider';
export const HOME_HERO_CACHE_TAG = 'home:hero:published';

export class HomeHeroDataError extends Error {
  constructor(message, { status = 500, code = 'HOME_HERO_DATA_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = 'HomeHeroDataError';
    this.status = status;
    this.code = code;
  }
}

function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new HomeHeroDataError('Public Supabase configuration is missing.', {
      status: 503,
      code: 'PUBLIC_SUPABASE_NOT_CONFIGURED',
    });
  }

  return createSupabaseClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function queryError(error, message, code = 'HOME_HERO_QUERY_FAILED') {
  if (!error) return;

  throw new HomeHeroDataError(message, {
    status: 500,
    code,
    cause: error,
  });
}

function mapMedia(row) {
  if (!row || row.is_archived) return null;

  return {
    id: row.id,
    secureUrl: row.secure_url,
    displayName: row.display_name || row.original_filename || null,
    altText: row.alt_text || '',
    width: row.width ?? null,
    height: row.height ?? null,
  };
}

function normalizeMedia(media) {
  if (!media) return null;

  return {
    id: media.id,
    secureUrl: media.secureUrl ?? media.secure_url ?? null,
    displayName: media.displayName ?? media.display_name ?? media.original_filename ?? null,
    altText: media.altText ?? media.alt_text ?? '',
    width: media.width ?? null,
    height: media.height ?? null,
  };
}

function normalizeSnapshot(snapshot) {
  if (!snapshot) return null;

  return {
    id: snapshot.id,
    pageId: snapshot.pageId ?? snapshot.page_id,
    sectionKey: snapshot.sectionKey ?? snapshot.section_key,
    status: snapshot.status,
    versionNumber: Number(snapshot.versionNumber ?? snapshot.version_number ?? 1),
    isVisible: snapshot.isVisible ?? snapshot.is_visible ?? true,
    autoplayMs: Number(snapshot.autoplayMs ?? snapshot.autoplay_ms ?? 6000),
    updatedAt: snapshot.updatedAt ?? snapshot.updated_at ?? null,
    updatedBy: snapshot.updatedBy ?? snapshot.updated_by ?? null,
    publishedAt: snapshot.publishedAt ?? snapshot.published_at ?? null,
    publishedBy: snapshot.publishedBy ?? snapshot.published_by ?? null,
    history: (snapshot.history || []).map((revision) => ({
      id: revision.id,
      revisionNumber: Number(revision.revisionNumber ?? revision.version_number ?? 0),
      summary: revision.summary ?? revision.change_summary ?? 'Saved Home Hero revision',
      createdAt: revision.createdAt ?? revision.created_at ?? null,
      createdBy: revision.createdBy ?? revision.created_by ?? null,
    })),
    slides: (snapshot.slides || []).map((slide, index) => ({
      id: slide.id,
      eyebrow: slide.eyebrow ?? slide.tag_text ?? '',
      title: slide.title ?? '',
      description: slide.description ?? slide.body_text ?? '',
      primaryCtaLabel: slide.primaryCtaLabel ?? slide.primary_cta_label ?? '',
      primaryCtaUrl: slide.primaryCtaUrl ?? slide.primary_cta_url ?? '',
      primaryCtaTarget: slide.primaryCtaTarget ?? slide.primary_cta_target ?? '_self',
      secondaryCtaLabel: slide.secondaryCtaLabel ?? slide.secondary_cta_label ?? '',
      secondaryCtaUrl: slide.secondaryCtaUrl ?? slide.secondary_cta_url ?? '',
      secondaryCtaTarget: slide.secondaryCtaTarget ?? slide.secondary_cta_target ?? '_self',
      desktopMediaId: slide.desktopMediaId ?? slide.image_asset_id ?? null,
      mobileMediaId: slide.mobileMediaId ?? slide.mobile_image_asset_id ?? null,
      imageAlt: slide.imageAlt ?? slide.image_alt ?? '',
      sortOrder: Number(slide.sortOrder ?? slide.sort_order ?? (index + 1) * 10),
      isVisible: slide.isVisible ?? slide.is_visible ?? true,
      desktopMedia: normalizeMedia(slide.desktopMedia),
      mobileMedia: normalizeMedia(slide.mobileMedia),
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

  queryError(error, 'The Home Hero revision history could not be loaded.');
  return data || [];
}

async function withRevisionHistory(supabase, hero) {
  if (!hero?.id) return hero;
  return normalizeSnapshot({
    ...hero,
    history: await loadRevisionHistory(supabase, hero.id),
  });
}

async function loadHomeHero(supabase, { status, visibleOnly }) {
  const { data: page, error: pageError } = await supabase
    .from('pages')
    .select('id')
    .eq('slug', 'home')
    .eq('is_published', true)
    .maybeSingle();

  queryError(pageError, 'The Home page could not be loaded.', 'HOME_PAGE_QUERY_FAILED');

  if (!page) {
    throw new HomeHeroDataError('The Home page is not configured.', {
      status: 503,
      code: 'HOME_PAGE_NOT_CONFIGURED',
    });
  }

  let sectionQuery = supabase
    .from('page_sections')
    .select(
      'id, page_id, section_key, status, version_number, settings, is_visible, updated_at, updated_by, published_at, published_by'
    )
    .eq('page_id', page.id)
    .eq('section_key', HOME_HERO_SECTION_KEY)
    .eq('status', status)
    .order('version_number', { ascending: false })
    .limit(1);

  const { data: sections, error: sectionError } = await sectionQuery;
  queryError(sectionError, 'The Home Hero section could not be loaded.');

  const section = sections?.[0];
  if (!section) return null;

  let itemQuery = supabase
    .from('section_items')
    .select(
      'id, tag_text, title, body_text, primary_cta_label, primary_cta_url, primary_cta_target, secondary_cta_label, secondary_cta_url, secondary_cta_target, image_asset_id, mobile_image_asset_id, image_alt, sort_order, is_visible'
    )
    .eq('section_id', section.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (visibleOnly) itemQuery = itemQuery.eq('is_visible', true);

  const { data: items, error: itemError } = await itemQuery;
  queryError(itemError, 'The Home Hero slides could not be loaded.');

  const mediaIds = [
    ...new Set(
      (items || [])
        .flatMap((item) => [item.image_asset_id, item.mobile_image_asset_id])
        .filter(Boolean)
    ),
  ];

  const mediaById = new Map();
  if (mediaIds.length) {
    const { data: mediaRows, error: mediaError } = await supabase
      .from('media_assets')
      .select('id, secure_url, display_name, original_filename, alt_text, width, height, is_archived')
      .in('id', mediaIds);

    queryError(mediaError, 'The Home Hero media could not be loaded.');
    for (const media of mediaRows || []) mediaById.set(media.id, mapMedia(media));
  }

  return normalizeSnapshot({
    ...section,
    autoplay_ms: Number(section.settings?.autoplay_ms) || 6000,
    slides: (items || []).map((item) => ({
      ...item,
      desktopMedia: mediaById.get(item.image_asset_id) || null,
      mobileMedia: mediaById.get(item.mobile_image_asset_id) || null,
    })),
  });
}

const getCachedPublishedHomeHero = unstable_cache(
  async () => {
    const hero = await loadHomeHero(createPublicClient(), {
      status: 'published',
      visibleOnly: true,
    });

    if (!hero) {
      throw new HomeHeroDataError('The published Home Hero is not configured.', {
        status: 503,
        code: 'HOME_HERO_NOT_CONFIGURED',
      });
    }

    if (hero.isVisible === false) return hero;

    if (hero.slides.length === 0) {
      throw new HomeHeroDataError('The published Home Hero has no visible slides.', {
        status: 503,
        code: 'HOME_HERO_SLIDES_NOT_CONFIGURED',
      });
    }

    if (hero.slides.some((slide) => !slide.desktopMedia?.secureUrl)) {
      throw new HomeHeroDataError('Published Home Hero media is not configured.', {
        status: 503,
        code: 'HOME_HERO_MEDIA_NOT_CONFIGURED',
      });
    }

    return hero;
  },
  ['home-hero-published-v1'],
  { tags: [HOME_HERO_CACHE_TAG], revalidate: 3600 }
);

export async function getPublishedHomeHero() {
  return getCachedPublishedHomeHero();
}

export async function getAdminHomeHero() {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const draft = await loadHomeHero(supabase, {
    status: 'draft',
    visibleOnly: false,
  });

  if (draft) return withRevisionHistory(supabase, draft);

  const published = await loadHomeHero(supabase, {
    status: 'published',
    visibleOnly: false,
  });

  if (!published) {
    throw new HomeHeroDataError('The Home Hero is not configured.', {
      status: 503,
      code: 'HOME_HERO_NOT_CONFIGURED',
    });
  }

  return withRevisionHistory(supabase, published);
}

async function runMutation(name, args) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(name, args);

  if (error) {
    const validationCodes = new Set(['22023', '22P02', '23502', '23503', '23514']);
    const isConflict = error.code === '40001' || error.code === '23505';
    const isValidation = validationCodes.has(error.code);

    throw new HomeHeroDataError('The Home Hero mutation could not be completed.', {
      status: isConflict ? 409 : isValidation ? 422 : 500,
      code: isConflict
        ? 'HOME_HERO_CONFLICT'
        : isValidation
          ? 'VALIDATION_ERROR'
          : 'HOME_HERO_MUTATION_FAILED',
      cause: error,
    });
  }

  if (!data || typeof data !== 'object') {
    throw new HomeHeroDataError('The Home Hero mutation returned an invalid response.', {
      status: 500,
      code: 'HOME_HERO_INVALID_MUTATION_RESPONSE',
    });
  }

  if (data.ok === false) return data;

  const hero = normalizeSnapshot(data.data);
  return { ok: true, data: await withRevisionHistory(supabase, hero) };
}

export async function persistHomeHeroDraft(payload) {
  return runMutation('save_home_hero_draft', {
    p_payload: payload,
    p_expected_updated_at: payload.updatedAt,
  });
}

export async function promoteHomeHeroDraft({ id, expectedUpdatedAt }) {
  return runMutation('publish_home_hero_draft', {
    p_section_id: id,
    p_expected_updated_at: expectedUpdatedAt,
  });
}
