import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

export const HOME_FEATURED_PROJECTS_SECTION_KEY = 'featured-projects-home';
export const HOME_FEATURED_PROJECTS_CACHE_TAG = 'home:featured-projects:published';

export class HomeFeaturedProjectsDataError extends Error {
  constructor(message, { status = 500, code = 'HOME_FEATURED_PROJECTS_DATA_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = 'HomeFeaturedProjectsDataError';
    this.status = status;
    this.code = code;
  }
}

function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new HomeFeaturedProjectsDataError('Public Supabase configuration is missing.', {
      status: 503,
      code: 'PUBLIC_SUPABASE_NOT_CONFIGURED',
    });
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

function queryError(error, message, code = 'HOME_FEATURED_PROJECTS_QUERY_FAILED') {
  if (!error) return;
  throw new HomeFeaturedProjectsDataError(message, { status: 500, code, cause: error });
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

function normalizeProject(project) {
  if (!project) return null;
  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    category: project.category,
    badgeText: project.badgeText ?? project.badge_text ?? '',
    location: project.location ?? project.location_address ?? '',
    size: project.size ?? project.size_summary ?? '',
    projectType: project.projectType ?? project.project_type ?? '',
    status: project.status,
    coverMediaId: project.coverMediaId ?? project.cover_image_id ?? null,
    coverMedia: normalizeMedia(project.coverMedia),
    sortOrder: Number(project.sortOrder ?? project.sort_order ?? 10),
  };
}

function normalizePlacement(placement, index = 0) {
  return {
    placementId: placement.placementId ?? placement.id ?? null,
    projectId: placement.projectId ?? placement.project_id ?? placement.project?.id ?? null,
    sortOrder: Number(placement.sortOrder ?? placement.sort_order ?? (index + 1) * 10),
    isVisible: placement.isVisible ?? placement.is_visible ?? true,
    project: normalizeProject(placement.project),
  };
}

function normalizeSnapshot(snapshot) {
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    pageId: snapshot.pageId ?? snapshot.page_id,
    sectionKey: snapshot.sectionKey ?? snapshot.section_key ?? HOME_FEATURED_PROJECTS_SECTION_KEY,
    status: snapshot.status,
    versionNumber: Number(snapshot.versionNumber ?? snapshot.version_number ?? 1),
    isVisible: snapshot.isVisible ?? snapshot.is_visible ?? true,
    tagText: snapshot.tagText ?? snapshot.tag_text ?? '',
    heading: snapshot.heading ?? '',
    pageSize: Number(snapshot.pageSize ?? snapshot.settings?.page_size ?? 6),
    updatedAt: snapshot.updatedAt ?? snapshot.updated_at ?? null,
    updatedBy: snapshot.updatedBy ?? snapshot.updated_by ?? null,
    publishedAt: snapshot.publishedAt ?? snapshot.published_at ?? null,
    publishedBy: snapshot.publishedBy ?? snapshot.published_by ?? null,
    projects: (snapshot.projects || []).map(normalizePlacement).sort((a, b) => a.sortOrder - b.sortOrder),
    history: (snapshot.history || []).map((revision) => ({
      id: revision.id,
      revisionNumber: Number(revision.revisionNumber ?? revision.version_number ?? 0),
      summary: revision.summary ?? revision.change_summary ?? 'Saved Home Featured Projects revision',
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
  queryError(error, 'The Home Featured Projects revision history could not be loaded.');
  return data || [];
}

async function loadProjectRows(supabase, projectIds) {
  if (!projectIds.length) return [];
  const { data: projects, error: projectError } = await supabase
    .from('projects')
    .select('id,slug,name,category,badge_text,location_address,size_summary,project_type,cover_image_id,status,sort_order')
    .in('id', projectIds);
  queryError(projectError, 'The canonical Home projects could not be loaded.');

  const mediaIds = [...new Set((projects || []).map((project) => project.cover_image_id).filter(Boolean))];
  const mediaById = new Map();
  if (mediaIds.length) {
    const { data: mediaRows, error: mediaError } = await supabase
      .from('media_assets')
      .select('id,secure_url,display_name,original_filename,alt_text,width,height,is_archived')
      .in('id', mediaIds);
    queryError(mediaError, 'The canonical project covers could not be loaded.');
    for (const media of mediaRows || []) mediaById.set(media.id, normalizeMedia(media));
  }

  return (projects || []).map((project) => normalizeProject({
    ...project,
    coverMedia: mediaById.get(project.cover_image_id) || null,
  })).sort((a, b) => a.sortOrder - b.sortOrder);
}

async function loadHomeFeaturedProjects(supabase, { status }) {
  const { data: page, error: pageError } = await supabase
    .from('pages')
    .select('id')
    .eq('slug', 'home')
    .eq('is_published', true)
    .maybeSingle();
  queryError(pageError, 'The Home page could not be loaded.', 'HOME_PAGE_QUERY_FAILED');
  if (!page) {
    throw new HomeFeaturedProjectsDataError('The Home page is not configured.', {
      status: 503,
      code: 'HOME_PAGE_NOT_CONFIGURED',
    });
  }

  const { data: sections, error: sectionError } = await supabase
    .from('page_sections')
    .select('id,page_id,section_key,status,version_number,is_visible,tag_text,heading,settings,updated_at,updated_by,published_at,published_by')
    .eq('page_id', page.id)
    .eq('section_key', HOME_FEATURED_PROJECTS_SECTION_KEY)
    .eq('status', status)
    .order('version_number', { ascending: false })
    .limit(1);
  queryError(sectionError, 'The Home Featured Projects section could not be loaded.');
  const section = sections?.[0];
  if (!section) return null;

  const { data: selections, error: selectionError } = await supabase
    .from('section_entity_selections')
    .select('id')
    .eq('section_id', section.id)
    .eq('entity_type', 'project')
    .limit(1);
  queryError(selectionError, 'The Home project selection could not be loaded.');
  const selection = selections?.[0];
  if (!selection) return normalizeSnapshot({ ...section, projects: [] });

  const { data: items, error: itemError } = await supabase
    .from('section_entity_selection_items')
    .select('id,project_id,sort_order,is_visible')
    .eq('selection_id', selection.id)
    .order('sort_order');
  queryError(itemError, 'The Home project placements could not be loaded.');

  const projects = await loadProjectRows(supabase, (items || []).map((item) => item.project_id).filter(Boolean));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  return normalizeSnapshot({
    ...section,
    projects: (items || []).map((item) => ({ ...item, project: projectById.get(item.project_id) || null })),
  });
}

const getCachedPublishedHomeFeaturedProjects = unstable_cache(
  async () => {
    const featured = await loadHomeFeaturedProjects(createPublicClient(), { status: 'published' });
    if (!featured) {
      throw new HomeFeaturedProjectsDataError('The published Home Featured Projects section is not configured.', {
        status: 503,
        code: 'HOME_FEATURED_PROJECTS_NOT_CONFIGURED',
      });
    }
    if (featured.isVisible && (!featured.projects.length || featured.projects.some((placement) => !placement.project?.coverMedia?.secureUrl))) {
      throw new HomeFeaturedProjectsDataError('Published Home Featured Projects contains incomplete canonical project data.', {
        status: 503,
        code: 'HOME_FEATURED_PROJECTS_INCOMPLETE',
      });
    }
    return featured;
  },
  ['home-featured-projects-published-v1'],
  { tags: [HOME_FEATURED_PROJECTS_CACHE_TAG], revalidate: 3600 }
);

export async function getPublishedHomeFeaturedProjects() {
  return getCachedPublishedHomeFeaturedProjects();
}

export async function getAdminHomeFeaturedProjects() {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  let featured = await loadHomeFeaturedProjects(supabase, { status: 'draft' });
  if (!featured) featured = await loadHomeFeaturedProjects(supabase, { status: 'published' });
  if (!featured) {
    throw new HomeFeaturedProjectsDataError('The Home Featured Projects section is not configured.', {
      status: 503,
      code: 'HOME_FEATURED_PROJECTS_NOT_CONFIGURED',
    });
  }
  return normalizeSnapshot({ ...featured, history: await loadRevisionHistory(supabase, featured.id) });
}

export async function getAdminProjectCatalog() {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('status', 'published')
    .order('sort_order');
  queryError(error, 'The project catalog could not be loaded.');
  return loadProjectRows(supabase, (data || []).map((project) => project.id));
}

async function runMutation(name, args) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const validationCodes = new Set(['22023', '22P02', '23502', '23503', '23514']);
    const isConflict = error.code === '40001' || error.code === '23505';
    throw new HomeFeaturedProjectsDataError('The Home Featured Projects mutation could not be completed.', {
      status: isConflict ? 409 : validationCodes.has(error.code) ? 422 : 500,
      code: isConflict ? 'HOME_FEATURED_PROJECTS_CONFLICT' : validationCodes.has(error.code) ? 'VALIDATION_ERROR' : 'HOME_FEATURED_PROJECTS_MUTATION_FAILED',
      cause: error,
    });
  }
  if (!data || typeof data !== 'object') {
    throw new HomeFeaturedProjectsDataError('The Home Featured Projects mutation returned an invalid response.', {
      code: 'HOME_FEATURED_PROJECTS_INVALID_MUTATION_RESPONSE',
    });
  }
  if (data.ok === false) return data;
  const featured = normalizeSnapshot(data.data);
  return {
    ok: true,
    data: normalizeSnapshot({ ...featured, history: await loadRevisionHistory(supabase, featured.id) }),
  };
}

export async function persistHomeFeaturedProjectsDraft(payload) {
  return runMutation('save_home_featured_projects_draft', {
    p_payload: payload,
    p_expected_updated_at: payload.updatedAt,
  });
}

export async function promoteHomeFeaturedProjectsDraft({ id, expectedUpdatedAt }) {
  return runMutation('publish_home_featured_projects_draft', {
    p_section_id: id,
    p_expected_updated_at: expectedUpdatedAt,
  });
}
