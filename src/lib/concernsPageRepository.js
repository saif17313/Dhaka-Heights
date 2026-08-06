import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

export const CONCERNS_PAGE_SECTION_KEY = 'concerns-page';
export const CONCERNS_PAGE_CACHE_TAG = 'page:concerns:published';

export class ConcernsPageDataError extends Error {
  constructor(message, { status = 500, code = 'CONCERNS_PAGE_DATA_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = 'ConcernsPageDataError';
    this.status = status;
    this.code = code;
  }
}

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new ConcernsPageDataError('Public Supabase configuration is missing.', { status: 503, code: 'PUBLIC_SUPABASE_NOT_CONFIGURED' });
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

function fail(error, message) {
  if (error) throw new ConcernsPageDataError(message, { cause: error });
}

function media(row) {
  if (!row) return null;
  return { id: row.id, secureUrl: row.secure_url, displayName: row.display_name, altText: row.alt_text || '', format: row.format, width: row.width, height: row.height };
}

function collectMediaIds(content = {}, projects = []) {
  return [...new Set([content.header?.mediaId, ...(content.concerns || []).map((item) => item.coverMediaId), ...projects.map((item) => item.cover_image_id)].filter(Boolean))];
}

async function hydrate(client, snapshot) {
  const content = snapshot.content ?? snapshot.settings ?? {};
  const projectIds = [...new Set((content.concerns || []).flatMap((item) => (item.relatedProjects || []).map((project) => project.projectId)).filter(Boolean))];
  const { data: projects, error: projectError } = projectIds.length
    ? await client.from('projects').select('id,slug,name,badge_text,location_address,project_type,cover_image_id,status').in('id', projectIds).eq('status', 'published')
    : { data: [], error: null };
  fail(projectError, 'Related concern projects could not be loaded.');
  const ids = collectMediaIds(content, projects || []);
  const { data: assets, error: mediaError } = ids.length
    ? await client.from('media_assets').select('id,secure_url,display_name,alt_text,format,width,height').in('id', ids).eq('is_archived', false).eq('resource_type', 'image')
    : { data: [], error: null };
  fail(mediaError, 'Concern page media could not be loaded.');
  const mediaMap = new Map((assets || []).map((item) => [item.id, media(item)]));
  const projectMap = new Map((projects || []).map((item) => [item.id, item]));
  const concerns = [...(content.concerns || [])].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)).map((item) => ({
    ...item,
    coverMedia: mediaMap.get(item.coverMediaId) || null,
    relatedProjects: (item.relatedProjects || []).map((placement) => {
      const project = projectMap.get(placement.projectId);
      if (!project) return null;
      return {
        ...placement,
        id: project.id,
        slug: project.slug,
        name: project.name,
        badgeText: placement.badgeText || project.badge_text,
        locationText: placement.locationText || project.location_address,
        type: placement.type || project.project_type,
        coverMediaId: project.cover_image_id,
        coverMedia: mediaMap.get(project.cover_image_id) || null,
      };
    }).filter(Boolean),
  }));
  return {
    id: snapshot.id,
    pageId: snapshot.pageId ?? snapshot.page_id,
    sectionKey: CONCERNS_PAGE_SECTION_KEY,
    status: snapshot.status,
    versionNumber: Number(snapshot.versionNumber ?? snapshot.version_number ?? 1),
    isVisible: snapshot.isVisible ?? snapshot.is_visible ?? true,
    content: { ...content, header: { ...(content.header || {}), media: mediaMap.get(content.header?.mediaId) || null }, concerns },
    updatedAt: snapshot.updatedAt ?? snapshot.updated_at,
    updatedBy: snapshot.updatedBy ?? snapshot.updated_by,
    publishedAt: snapshot.publishedAt ?? snapshot.published_at,
    publishedBy: snapshot.publishedBy ?? snapshot.published_by,
    history: snapshot.history || [],
  };
}

async function loadPublished() {
  const client = publicClient();
  const { data: page, error: pageError } = await client.from('pages').select('id').eq('slug', 'concern').eq('is_published', true).maybeSingle();
  fail(pageError, 'The Concerns page record could not be loaded.');
  if (!page) throw new ConcernsPageDataError('The Concerns page is not configured.', { status: 503, code: 'CONCERNS_PAGE_NOT_CONFIGURED' });
  const { data, error } = await client.from('page_sections').select('id,page_id,status,version_number,settings,is_visible,updated_at,updated_by,published_at,published_by').eq('page_id', page.id).eq('section_key', CONCERNS_PAGE_SECTION_KEY).eq('status', 'published').order('version_number', { ascending: false }).limit(1);
  fail(error, 'Published Concerns content could not be loaded.');
  if (!data?.[0]) throw new ConcernsPageDataError('Published Concerns content is not configured.', { status: 503, code: 'CONCERNS_PAGE_CONTENT_NOT_CONFIGURED' });
  return hydrate(client, data[0]);
}

const cachedPublished = unstable_cache(loadPublished, ['published-concerns-page-v2'], { tags: [CONCERNS_PAGE_CACHE_TAG], revalidate: 3600 });

export async function getPublishedConcernsPage() { return cachedPublished(); }
export async function getPublishedConcern(slug) {
  const page = await getPublishedConcernsPage();
  const requested = slug === 'dhaka-heights-realty' ? 'dhaka-heights-business-solution' : slug;
  const concern = page.isVisible ? page.content.concerns.find((item) => item.slug === requested && item.isVisible !== false) : null;
  return concern ? { page, concern } : null;
}

export async function getAdminConcernsPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: page, error: pageError } = await admin.from('pages').select('id').eq('slug', 'concern').single();
  fail(pageError, 'The Concerns page record could not be loaded.');
  let { data: sections, error } = await admin.from('page_sections').select('id').eq('page_id', page.id).eq('section_key', CONCERNS_PAGE_SECTION_KEY).eq('status', 'draft').limit(1);
  if (!sections?.length) ({ data: sections, error } = await admin.from('page_sections').select('id').eq('page_id', page.id).eq('section_key', CONCERNS_PAGE_SECTION_KEY).eq('status', 'published').order('version_number', { ascending: false }).limit(1));
  fail(error, 'Concerns editor content could not be loaded.');
  if (!sections?.[0]) throw new ConcernsPageDataError('Concerns editor content is not configured.', { status: 503, code: 'CONCERNS_PAGE_CONTENT_NOT_CONFIGURED' });
  const [{ data: snapshot, error: snapshotError }, { data: history, error: historyError }, { data: projects, error: projectsError }] = await Promise.all([
    admin.rpc('concerns_page_snapshot', { p_section_id: sections[0].id }),
    admin.from('content_revisions').select('id,version_number,change_summary,created_at,created_by').eq('table_name', 'page_sections').eq('record_id', sections[0].id).order('created_at', { ascending: false }).limit(10),
    admin.from('projects').select('id,slug,name,status,sort_order').eq('status', 'published').order('sort_order'),
  ]);
  fail(snapshotError || historyError || projectsError, 'Concerns editor snapshot could not be loaded.');
  const hydrated = await hydrate(admin, snapshot);
  return { ...hydrated, history: history || [], availableProjects: projects || [] };
}

async function mutate(name, args) {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const conflict = ['40001', '23505'].includes(error.code);
    const invalid = ['22023', '23502', '23503', '23514'].includes(error.code);
    throw new ConcernsPageDataError('The Concerns page mutation failed.', { status: conflict ? 409 : invalid ? 422 : 500, code: conflict ? 'CONCERNS_PAGE_CONFLICT' : 'CONCERNS_PAGE_MUTATION_FAILED', cause: error });
  }
  if (data?.ok === false) return data;
  return { ok: true, data: await hydrate(createAdminClient(), data.data) };
}

export function persistConcernsPageDraft(payload) { return mutate('save_concerns_page_draft', { p_payload: payload, p_expected_updated_at: payload.updatedAt }); }
export function promoteConcernsPageDraft(input) { return mutate('publish_concerns_page_draft', { p_section_id: input.id, p_expected_updated_at: input.expectedUpdatedAt }); }
