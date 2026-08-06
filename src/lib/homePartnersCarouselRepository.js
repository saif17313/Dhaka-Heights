import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

export const HOME_PARTNERS_CAROUSEL_SECTION_KEY = 'partners-carousel';
export const HOME_PARTNERS_CAROUSEL_CACHE_TAG = 'home:partners-carousel:published';

export class HomePartnersCarouselDataError extends Error {
  constructor(message, { status = 500, code = 'HOME_PARTNERS_CAROUSEL_DATA_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = 'HomePartnersCarouselDataError';
    this.status = status;
    this.code = code;
  }
}

function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new HomePartnersCarouselDataError('Public Supabase configuration is missing.', {
      status: 503,
      code: 'PUBLIC_SUPABASE_NOT_CONFIGURED',
    });
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

function queryError(error, message, code = 'HOME_PARTNERS_CAROUSEL_QUERY_FAILED') {
  if (error) throw new HomePartnersCarouselDataError(message, { status: 500, code, cause: error });
}

function normalizeMedia(row) {
  if (!row) return null;
  return {
    id: row.id,
    secureUrl: row.secure_url ?? row.secureUrl,
    displayName: row.display_name ?? row.displayName ?? '',
    altText: row.alt_text ?? row.altText ?? '',
    format: row.format ?? '',
    width: row.width ?? null,
    height: row.height ?? null,
  };
}

async function loadCustomIconMedia(supabase, partners) {
  const ids = [...new Set((partners || []).map((partner) => partner.custom_icon_asset_id ?? partner.customIconMediaId).filter(Boolean))];
  if (!ids.length) return new Map();
  const { data, error } = await supabase
    .from('media_assets')
    .select('id,secure_url,display_name,alt_text,format,width,height,is_archived,resource_type')
    .in('id', ids)
    .eq('is_archived', false)
    .eq('resource_type', 'image');
  queryError(error, 'The Home Partners Carousel custom icons could not be loaded.');
  return new Map((data || []).map((item) => [item.id, normalizeMedia(item)]));
}

function normalizePartner(partner, index = 0, mediaMap = new Map()) {
  return {
    itemId: partner.itemId ?? partner.id ?? null,
    itemKey: partner.itemKey ?? partner.item_key ?? `partner-${index + 1}`,
    name: partner.name ?? partner.title ?? '',
    category: partner.category ?? partner.subtitle ?? '',
    iconMode: partner.iconMode ?? partner.icon_mode ?? partner.iconLibrary ?? partner.icon_library ?? (partner.customIconMediaId ?? partner.custom_icon_asset_id ? 'custom' : 'fontawesome'),
    iconKey: partner.iconKey ?? partner.icon_key ?? '',
    customIconMediaId: partner.customIconMediaId ?? partner.custom_icon_asset_id ?? null,
    customIconMedia: mediaMap.get(partner.customIconMediaId ?? partner.custom_icon_asset_id) || partner.customIconMedia || null,
    accentColor: partner.accentColor ?? partner.accent_color ?? '#c5a880',
    sortOrder: Number(partner.sortOrder ?? partner.sort_order ?? (index + 1) * 10),
    isVisible: partner.isVisible ?? partner.is_visible ?? true,
  };
}

function normalizeSnapshot(snapshot, mediaMap = new Map()) {
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    pageId: snapshot.pageId ?? snapshot.page_id,
    sectionKey: snapshot.sectionKey ?? snapshot.section_key ?? HOME_PARTNERS_CAROUSEL_SECTION_KEY,
    status: snapshot.status,
    versionNumber: Number(snapshot.versionNumber ?? snapshot.version_number ?? 1),
    heading: snapshot.heading ?? '',
    isVisible: snapshot.isVisible ?? snapshot.is_visible ?? true,
    updatedAt: snapshot.updatedAt ?? snapshot.updated_at ?? null,
    updatedBy: snapshot.updatedBy ?? snapshot.updated_by ?? null,
    publishedAt: snapshot.publishedAt ?? snapshot.published_at ?? null,
    publishedBy: snapshot.publishedBy ?? snapshot.published_by ?? null,
    partners: (snapshot.partners || []).map((partner, index) => normalizePartner(partner, index, mediaMap)).sort((a, b) => a.sortOrder - b.sortOrder),
    history: (snapshot.history || []).map((revision) => ({
      id: revision.id,
      revisionNumber: Number(revision.revisionNumber ?? revision.version_number ?? 0),
      summary: revision.summary ?? revision.change_summary ?? 'Saved Home Partners Carousel revision',
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
  queryError(error, 'The Home Partners Carousel revision history could not be loaded.');
  return data || [];
}

async function loadHomePartnersCarousel(supabase, { status }) {
  const { data: page, error: pageError } = await supabase
    .from('pages').select('id').eq('slug', 'home').eq('is_published', true).maybeSingle();
  queryError(pageError, 'The Home page could not be loaded.', 'HOME_PAGE_QUERY_FAILED');
  if (!page) {
    throw new HomePartnersCarouselDataError('The Home page is not configured.', { status: 503, code: 'HOME_PAGE_NOT_CONFIGURED' });
  }

  const { data: sections, error: sectionError } = await supabase
    .from('page_sections')
    .select('id,page_id,section_key,status,version_number,heading,is_visible,updated_at,updated_by,published_at,published_by')
    .eq('page_id', page.id)
    .eq('section_key', HOME_PARTNERS_CAROUSEL_SECTION_KEY)
    .eq('status', status)
    .order('version_number', { ascending: false })
    .limit(1);
  queryError(sectionError, 'The Home Partners Carousel section could not be loaded.');
  const section = sections?.[0];
  if (!section) return null;

  const { data: partners, error: partnerError } = await supabase
    .from('section_items')
    .select('id,item_key,title,subtitle,icon_library,icon_key,custom_icon_asset_id,accent_color,sort_order,is_visible')
    .eq('section_id', section.id)
    .order('sort_order');
  queryError(partnerError, 'The Home Partners Carousel items could not be loaded.');
  const mediaMap = await loadCustomIconMedia(supabase, partners || []);
  return normalizeSnapshot({ ...section, partners: partners || [] }, mediaMap);
}

const getCachedPublishedHomePartnersCarousel = unstable_cache(
  async () => {
    const carousel = await loadHomePartnersCarousel(createPublicClient(), { status: 'published' });
    if (!carousel) {
      throw new HomePartnersCarouselDataError('The published Home Partners Carousel is not configured.', { status: 503, code: 'HOME_PARTNERS_CAROUSEL_NOT_CONFIGURED' });
    }
    if (carousel.isVisible && !carousel.partners.some((partner) => partner.isVisible)) {
      throw new HomePartnersCarouselDataError('The published Home Partners Carousel has no visible partners.', { status: 503, code: 'HOME_PARTNERS_CAROUSEL_ITEMS_NOT_CONFIGURED' });
    }
    return carousel;
  },
  ['home-partners-carousel-published-v1'],
  { tags: [HOME_PARTNERS_CAROUSEL_CACHE_TAG], revalidate: 3600 }
);

export async function getPublishedHomePartnersCarousel() {
  return getCachedPublishedHomePartnersCarousel();
}

export async function getAdminHomePartnersCarousel() {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  let carousel = await loadHomePartnersCarousel(supabase, { status: 'draft' });
  if (!carousel) carousel = await loadHomePartnersCarousel(supabase, { status: 'published' });
  if (!carousel) {
    throw new HomePartnersCarouselDataError('The Home Partners Carousel is not configured.', { status: 503, code: 'HOME_PARTNERS_CAROUSEL_NOT_CONFIGURED' });
  }
  return normalizeSnapshot({ ...carousel, history: await loadRevisionHistory(supabase, carousel.id) });
}

async function runMutation(name, args) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const validationCodes = new Set(['22023', '22P02', '23502', '23503', '23514']);
    const isConflict = error.code === '40001' || error.code === '23505';
    throw new HomePartnersCarouselDataError('The Home Partners Carousel mutation could not be completed.', {
      status: isConflict ? 409 : validationCodes.has(error.code) ? 422 : 500,
      code: isConflict ? 'HOME_PARTNERS_CAROUSEL_CONFLICT' : validationCodes.has(error.code) ? 'VALIDATION_ERROR' : 'HOME_PARTNERS_CAROUSEL_MUTATION_FAILED',
      cause: error,
    });
  }
  if (!data || typeof data !== 'object') {
    throw new HomePartnersCarouselDataError('The Home Partners Carousel mutation returned an invalid response.', { code: 'HOME_PARTNERS_CAROUSEL_INVALID_MUTATION_RESPONSE' });
  }
  if (data.ok === false) return data;
  const rawPartners = data.data?.partners || [];
  const mediaMap = await loadCustomIconMedia(supabase, rawPartners);
  const carousel = normalizeSnapshot(data.data, mediaMap);
  return { ok: true, data: normalizeSnapshot({ ...carousel, history: await loadRevisionHistory(supabase, carousel.id) }, mediaMap) };
}

export async function persistHomePartnersCarouselDraft(payload) {
  return runMutation('save_home_partners_carousel_draft', { p_payload: payload, p_expected_updated_at: payload.updatedAt });
}

export async function promoteHomePartnersCarouselDraft({ id, expectedUpdatedAt }) {
  return runMutation('publish_home_partners_carousel_draft', { p_section_id: id, p_expected_updated_at: expectedUpdatedAt });
}
