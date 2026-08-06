import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

export const PROJECTS_PAGE_SECTION_KEY = 'projects-page';
export const PROJECTS_PAGE_CACHE_TAG = 'page:projects:published';

export class ProjectsPageDataError extends Error {
  constructor(message, { status = 500, code = 'PROJECTS_PAGE_DATA_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = 'ProjectsPageDataError';
    this.status = status;
    this.code = code;
  }
}

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new ProjectsPageDataError('Public Supabase configuration is missing.', {
      status: 503,
      code: 'PUBLIC_SUPABASE_NOT_CONFIGURED',
    });
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function fail(error, message, code = 'PROJECTS_PAGE_QUERY_FAILED') {
  if (error) throw new ProjectsPageDataError(message, { code, cause: error });
}

function normalizeMedia(row) {
  if (!row) return null;
  return {
    id: row.id,
    secureUrl: row.secure_url ?? row.secureUrl,
    displayName: row.display_name ?? row.displayName,
    altText: row.alt_text ?? row.altText ?? '',
    format: row.format,
    width: row.width,
    height: row.height,
  };
}

function collectMediaIds(content = {}) {
  const ids = [content.header?.mediaId];
  for (const project of content.projects || []) {
    ids.push(project.coverMediaId);
    for (const image of project.gallery || []) ids.push(image.mediaId);
  }
  return [...new Set(ids.filter(Boolean))];
}

async function loadMedia(client, content) {
  const ids = collectMediaIds(content);
  if (!ids.length) return new Map();
  const { data, error } = await client
    .from('media_assets')
    .select('id,secure_url,display_name,alt_text,format,width,height,is_archived,resource_type')
    .in('id', ids)
    .eq('is_archived', false)
    .eq('resource_type', 'image');
  fail(error, 'Projects page media could not be loaded.');
  return new Map((data || []).map((item) => [item.id, normalizeMedia(item)]));
}

function normalize(snapshot, mediaMap = new Map()) {
  if (!snapshot) return null;
  const source = snapshot.content ?? snapshot.settings ?? {};
  const projects = [...(source.projects || [])]
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    .map((project) => ({
      ...project,
      coverMedia: mediaMap.get(project.coverMediaId) || project.coverMedia || null,
      gallery: (project.gallery || []).map((image) => ({
        ...image,
        media: mediaMap.get(image.mediaId) || image.media || null,
      })),
    }));
  return {
    id: snapshot.id,
    pageId: snapshot.pageId ?? snapshot.page_id,
    sectionKey: PROJECTS_PAGE_SECTION_KEY,
    status: snapshot.status,
    versionNumber: Number(snapshot.versionNumber ?? snapshot.version_number ?? 1),
    isVisible: snapshot.isVisible ?? snapshot.is_visible ?? true,
    content: {
      ...source,
      header: {
        ...(source.header || {}),
        media: mediaMap.get(source.header?.mediaId) || source.header?.media || null,
      },
      projects,
    },
    updatedAt: snapshot.updatedAt ?? snapshot.updated_at,
    updatedBy: snapshot.updatedBy ?? snapshot.updated_by,
    publishedAt: snapshot.publishedAt ?? snapshot.published_at,
    publishedBy: snapshot.publishedBy ?? snapshot.published_by,
    history: snapshot.history || [],
  };
}

async function loadPublished() {
  const client = publicClient();
  const { data: page, error: pageError } = await client
    .from('pages')
    .select('id')
    .eq('slug', 'projects')
    .eq('is_published', true)
    .maybeSingle();
  fail(pageError, 'The Projects page record could not be loaded.');
  if (!page) {
    throw new ProjectsPageDataError('The Projects page is not configured.', {
      status: 503,
      code: 'PROJECTS_PAGE_NOT_CONFIGURED',
    });
  }
  const { data: sections, error } = await client
    .from('page_sections')
    .select('id,page_id,status,version_number,settings,is_visible,updated_at,updated_by,published_at,published_by')
    .eq('page_id', page.id)
    .eq('section_key', PROJECTS_PAGE_SECTION_KEY)
    .eq('status', 'published')
    .order('version_number', { ascending: false })
    .limit(1);
  fail(error, 'Published Projects content could not be loaded.');
  const section = sections?.[0];
  if (!section) {
    throw new ProjectsPageDataError('Published Projects content is not configured.', {
      status: 503,
      code: 'PROJECTS_PAGE_CONTENT_NOT_CONFIGURED',
    });
  }
  const mediaMap = await loadMedia(client, section.settings);
  return normalize(section, mediaMap);
}

const cachedPublished = unstable_cache(loadPublished, ['published-projects-page-v1'], {
  tags: [PROJECTS_PAGE_CACHE_TAG],
  revalidate: 3600,
});

export async function getPublishedProjectsPage() {
  return cachedPublished();
}

export async function getPublishedProject(slug) {
  const page = await getPublishedProjectsPage();
  const project = page.content.projects.find((item) => item.slug === slug);
  return project ? { page, project } : null;
}

export async function getAdminProjectsPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: page, error: pageError } = await admin.from('pages').select('id').eq('slug', 'projects').single();
  fail(pageError, 'The Projects page record could not be loaded.');
  let { data: sections, error } = await admin
    .from('page_sections')
    .select('id')
    .eq('page_id', page.id)
    .eq('section_key', PROJECTS_PAGE_SECTION_KEY)
    .eq('status', 'draft')
    .limit(1);
  if (!sections?.length) {
    ({ data: sections, error } = await admin
      .from('page_sections')
      .select('id')
      .eq('page_id', page.id)
      .eq('section_key', PROJECTS_PAGE_SECTION_KEY)
      .eq('status', 'published')
      .order('version_number', { ascending: false })
      .limit(1));
  }
  fail(error, 'Projects editor content could not be loaded.');
  if (!sections?.[0]) {
    throw new ProjectsPageDataError('Projects editor content is not configured.', {
      status: 503,
      code: 'PROJECTS_PAGE_CONTENT_NOT_CONFIGURED',
    });
  }
  const [{ data: snapshot, error: snapshotError }, { data: history, error: historyError }] = await Promise.all([
    admin.rpc('projects_page_snapshot', { p_section_id: sections[0].id }),
    admin
      .from('content_revisions')
      .select('id,version_number,change_summary,created_at,created_by')
      .eq('table_name', 'page_sections')
      .eq('record_id', sections[0].id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);
  fail(snapshotError || historyError, 'Projects editor snapshot could not be loaded.');
  const mediaMap = await loadMedia(admin, snapshot.content);
  return normalize({ ...snapshot, history: history || [] }, mediaMap);
}

async function mutate(name, args) {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const conflict = ['40001', '23505'].includes(error.code);
    const invalid = ['22023', '23502', '23503', '23514'].includes(error.code);
    throw new ProjectsPageDataError('The Projects page mutation failed.', {
      status: conflict ? 409 : invalid ? 422 : 500,
      code: conflict ? 'PROJECTS_PAGE_CONFLICT' : 'PROJECTS_PAGE_MUTATION_FAILED',
      cause: error,
    });
  }
  if (data?.ok === false) return data;
  const admin = createAdminClient();
  const mediaMap = await loadMedia(admin, data.data.content);
  return { ok: true, data: normalize(data.data, mediaMap) };
}

export async function persistProjectsPageDraft(payload) {
  return mutate('save_projects_page_draft', {
    p_payload: payload,
    p_expected_updated_at: payload.updatedAt,
  });
}

export async function promoteProjectsPageDraft(input) {
  return mutate('publish_projects_page_draft', {
    p_section_id: input.id,
    p_expected_updated_at: input.expectedUpdatedAt,
  });
}
