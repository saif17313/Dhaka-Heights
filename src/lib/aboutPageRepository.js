import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

export const ABOUT_PAGE_SECTION_KEY = 'about-page';
export const ABOUT_PAGE_CACHE_TAG = 'page:about:published';

const DEFAULT_TEAM_SECTION = {
  tag: 'OUR TEAM',
  heading: 'Meet Our Leadership',
  intro: 'Meet the people guiding Dhaka Heights with experience, integrity, and a shared commitment to excellence.',
  modalHeading: 'OUR TEAM',
};

const DEFAULT_TEAM_CATEGORY = {
  itemKey: 'team-category-leadership-management',
  title: 'Leadership and Management',
  description: '',
  sortOrder: 10,
  isVisible: true,
};

export class AboutPageDataError extends Error {
  constructor(message, { status = 500, code = 'ABOUT_PAGE_DATA_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = 'AboutPageDataError';
    this.status = status;
    this.code = code;
  }
}

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new AboutPageDataError('Public Supabase configuration is missing.', {
      status: 503,
      code: 'PUBLIC_SUPABASE_NOT_CONFIGURED',
    });
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function fail(error, message, code = 'ABOUT_PAGE_QUERY_FAILED') {
  if (error) throw new AboutPageDataError(message, { code, cause: error });
}

function media(row) {
  return row
    ? {
        id: row.id,
        secureUrl: row.secure_url ?? row.secureUrl,
        displayName: row.display_name ?? row.displayName,
        altText: row.alt_text ?? row.altText ?? '',
        format: row.format,
      }
    : null;
}

function sort(items = []) {
  return [...items].sort(
    (a, b) => Number(a.sortOrder ?? a.sort_order) - Number(b.sortOrder ?? b.sort_order),
  );
}

function normalize(snapshot) {
  if (!snapshot) return null;
  const rawContent = snapshot.content ?? snapshot.settings ?? {};
  const content = {
    ...rawContent,
    teamSection: { ...DEFAULT_TEAM_SECTION, ...(rawContent.teamSection || {}) },
  };
  const loadedCategories = sort(snapshot.teamCategories || snapshot.team_categories || []);
  const teamCategories = loadedCategories.length
    ? loadedCategories
    : [{ ...DEFAULT_TEAM_CATEGORY }];
  const fallbackCategoryKey = teamCategories[0].itemKey;
  const teamMembers = sort(snapshot.teamMembers || snapshot.team_members || []).map((member) => ({
    ...member,
    categoryKey: member.categoryKey || member.category_key || fallbackCategoryKey,
  }));

  return {
    id: snapshot.id,
    pageId: snapshot.pageId ?? snapshot.page_id,
    sectionKey: ABOUT_PAGE_SECTION_KEY,
    status: snapshot.status,
    versionNumber: Number(snapshot.versionNumber ?? snapshot.version_number ?? 1),
    isVisible: snapshot.isVisible ?? snapshot.is_visible ?? true,
    content,
    media: sort(snapshot.media),
    pillars: sort(snapshot.pillars),
    teamCategories,
    teamMembers,
    concerns: sort(snapshot.concerns),
    accreditations: sort(snapshot.accreditations),
    updatedAt: snapshot.updatedAt ?? snapshot.updated_at,
    updatedBy: snapshot.updatedBy ?? snapshot.updated_by,
    publishedAt: snapshot.publishedAt ?? snapshot.published_at,
    publishedBy: snapshot.publishedBy ?? snapshot.published_by,
    history: snapshot.history || [],
    availableConcerns: snapshot.availableConcerns || [],
  };
}

async function loadPublic() {
  const client = publicClient();
  const { data: page, error: pageError } = await client
    .from('pages')
    .select('id')
    .eq('slug', 'about')
    .eq('is_published', true)
    .maybeSingle();
  fail(pageError, 'The About page record could not be loaded.');
  if (!page) {
    throw new AboutPageDataError('The About page is not configured.', {
      status: 503,
      code: 'ABOUT_PAGE_NOT_CONFIGURED',
    });
  }

  const { data: rows, error: sectionError } = await client
    .from('page_sections')
    .select(
      'id,page_id,status,version_number,settings,is_visible,updated_at,updated_by,published_at,published_by',
    )
    .eq('page_id', page.id)
    .eq('section_key', ABOUT_PAGE_SECTION_KEY)
    .eq('status', 'published')
    .order('version_number', { ascending: false })
    .limit(1);
  fail(sectionError, 'Published About content could not be loaded.');
  const section = rows?.[0];
  if (!section) {
    throw new AboutPageDataError('Published About content is not configured.', {
      status: 503,
      code: 'ABOUT_PAGE_CONTENT_NOT_CONFIGURED',
    });
  }

  const [{ data: items, error: itemError }, { data: selections, error: selectionError }] =
    await Promise.all([
      client
        .from('section_items')
        .select(
          'id,item_key,title,subtitle,body_text,tag_text,icon_key,image_asset_id,image_alt,sort_order,is_visible',
        )
        .eq('section_id', section.id)
        .order('sort_order'),
      client
        .from('section_entity_selections')
        .select('id')
        .eq('section_id', section.id)
        .eq('entity_type', 'concern')
        .limit(1),
    ]);
  fail(itemError || selectionError, 'About page relationships could not be loaded.');

  const imageIds = (items || []).map((item) => item.image_asset_id).filter(Boolean);
  let placements = [];
  if (selections?.[0]) {
    const { data, error } = await client
      .from('section_entity_selection_items')
      .select(
        'id,concern_id,override_title,override_description,override_cover_image_id,override_cta_label,sort_order,is_visible',
      )
      .eq('selection_id', selections[0].id)
      .order('sort_order');
    fail(error, 'About concern placements could not be loaded.');
    placements = data || [];
    imageIds.push(...placements.map((item) => item.override_cover_image_id).filter(Boolean));
  }

  const concernIds = placements.map((item) => item.concern_id);
  const [{ data: assets, error: assetError }, { data: concerns, error: concernError }] =
    await Promise.all([
      imageIds.length
        ? client
            .from('media_assets')
            .select('id,secure_url,display_name,alt_text,format')
            .in('id', [...new Set(imageIds)])
        : Promise.resolve({ data: [], error: null }),
      concernIds.length
        ? client
            .from('concerns')
            .select('id,slug,name,overview')
            .in('id', concernIds)
            .eq('status', 'published')
        : Promise.resolve({ data: [], error: null }),
    ]);
  fail(assetError || concernError, 'About media or concern records could not be loaded.');

  const assetMap = new Map((assets || []).map((item) => [item.id, item]));
  const concernMap = new Map((concerns || []).map((item) => [item.id, item]));

  const mediaItems = (items || [])
    .filter((item) => item.item_key.startsWith('media-'))
    .map((item) => ({
      itemId: item.id,
      role: item.item_key.slice(6),
      mediaId: item.image_asset_id,
      imageAlt: item.image_alt,
      media: media(assetMap.get(item.image_asset_id)),
      sortOrder: item.sort_order,
      isVisible: item.is_visible,
    }));

  const pillars = (items || [])
    .filter((item) => item.item_key.startsWith('pillar-'))
    .map((item) => ({
      itemId: item.id,
      itemKey: item.item_key,
      title: item.title,
      description: item.body_text,
      iconKey: item.icon_key,
      mediaId: item.image_asset_id,
      imageAlt: item.image_alt,
      media: media(assetMap.get(item.image_asset_id)),
      sortOrder: item.sort_order,
      isVisible: item.is_visible,
    }));

  const teamCategories = (items || [])
    .filter((item) => item.item_key.startsWith('team-category-'))
    .map((item) => ({
      itemId: item.id,
      itemKey: item.item_key,
      title: item.title,
      description: item.body_text || '',
      sortOrder: item.sort_order,
      isVisible: item.is_visible,
    }));

  const teamMembers = (items || [])
    .filter(
      (item) => item.item_key.startsWith('team-') && !item.item_key.startsWith('team-category-'),
    )
    .map((item) => ({
      itemId: item.id,
      itemKey: item.item_key,
      categoryKey: item.tag_text,
      name: item.title,
      role: item.subtitle,
      biography: item.body_text,
      mediaId: item.image_asset_id,
      imageAlt: item.image_alt,
      media: media(assetMap.get(item.image_asset_id)),
      sortOrder: item.sort_order,
      isVisible: item.is_visible,
    }));

  const accreditations = (items || [])
    .filter((item) => item.item_key.startsWith('accreditation-'))
    .map((item) => ({
      itemId: item.id,
      itemKey: item.item_key,
      title: item.title,
      iconKey: item.icon_key,
      sortOrder: item.sort_order,
      isVisible: item.is_visible,
    }));

  const concernCards = placements.map((item) => {
    const concern = concernMap.get(item.concern_id);
    return {
      placementId: item.id,
      canonicalId: item.concern_id,
      slug: concern?.slug,
      title: item.override_title || concern?.name,
      description: item.override_description || concern?.overview,
      ctaLabel: item.override_cta_label || 'View Subsidiary',
      mediaId: item.override_cover_image_id,
      imageAlt:
        assetMap.get(item.override_cover_image_id)?.alt_text || item.override_title || concern?.name,
      media: media(assetMap.get(item.override_cover_image_id)),
      sortOrder: item.sort_order,
      isVisible: item.is_visible,
    };
  });

  return normalize({
    ...section,
    content: section.settings,
    media: mediaItems,
    pillars,
    teamCategories,
    teamMembers,
    concerns: concernCards,
    accreditations,
  });
}

const cachedPublic = unstable_cache(loadPublic, ['published-about-page-v3'], {
  tags: [ABOUT_PAGE_CACHE_TAG],
  revalidate: 3600,
});

export async function getPublishedAboutPage() {
  return cachedPublic();
}

export async function getAdminAboutPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: page } = await admin.from('pages').select('id').eq('slug', 'about').single();

  let { data: sections, error } = await admin
    .from('page_sections')
    .select('id')
    .eq('page_id', page.id)
    .eq('section_key', ABOUT_PAGE_SECTION_KEY)
    .eq('status', 'draft')
    .limit(1);
  if (!sections?.length) {
    ({ data: sections, error } = await admin
      .from('page_sections')
      .select('id')
      .eq('page_id', page.id)
      .eq('section_key', ABOUT_PAGE_SECTION_KEY)
      .eq('status', 'published')
      .order('version_number', { ascending: false })
      .limit(1));
  }
  fail(error, 'About editor content could not be loaded.');

  const { data, error: snapshotError } = await admin.rpc('about_page_snapshot', {
    p_section_id: sections?.[0]?.id,
  });
  fail(snapshotError, 'About editor snapshot could not be loaded.');

  const [{ data: history }, { data: available }] = await Promise.all([
    admin
      .from('content_revisions')
      .select('id,version_number,change_summary,created_at,created_by')
      .eq('table_name', 'page_sections')
      .eq('record_id', sections[0].id)
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('concerns')
      .select('id,slug,name,overview,status,sort_order')
      .eq('status', 'published')
      .order('sort_order'),
  ]);

  return normalize({ ...data, history: history || [], availableConcerns: available || [] });
}

async function mutate(name, args) {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc(name, args);
  if (error) {
    throw new AboutPageDataError('The About page mutation failed.', {
      status: ['40001', '23505'].includes(error.code)
        ? 409
        : ['22023', '23502', '23503', '23514'].includes(error.code)
          ? 422
          : 500,
      code: ['40001', '23505'].includes(error.code)
        ? 'ABOUT_PAGE_CONFLICT'
        : 'ABOUT_PAGE_MUTATION_FAILED',
      cause: error,
    });
  }
  if (data?.ok === false) return data;
  return { ok: true, data: normalize(data.data) };
}

export async function persistAboutPageDraft(payload) {
  return mutate('save_about_page_draft', {
    p_payload: payload,
    p_expected_updated_at: payload.updatedAt,
  });
}

export async function promoteAboutPageDraft(input) {
  return mutate('publish_about_page_draft', {
    p_section_id: input.id,
    p_expected_updated_at: input.expectedUpdatedAt,
  });
}
