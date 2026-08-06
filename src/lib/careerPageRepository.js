import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

export const CAREER_PAGE_SECTION_KEY = 'career-page';
export const CAREER_PAGE_CACHE_TAG = 'page:career:published';
export const CAREER_ADMIN_ROLES = ['super_admin', 'content_editor', 'hr_manager'];
export const CAREER_HR_ROLES = ['super_admin', 'hr_manager'];

export class CareerPageDataError extends Error {
  constructor(message, { status = 500, code = 'CAREER_PAGE_DATA_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = 'CareerPageDataError';
    this.status = status;
    this.code = code;
  }
}

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new CareerPageDataError('Public Supabase configuration is missing.', { status: 503, code: 'PUBLIC_SUPABASE_NOT_CONFIGURED' });
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

function fail(error, message) {
  if (error) throw new CareerPageDataError(message, { cause: error });
}

function normalizeMedia(row) {
  return row ? { id: row.id, secureUrl: row.secure_url, displayName: row.display_name, altText: row.alt_text || '', format: row.format, width: row.width, height: row.height } : null;
}

async function hydrate(client, snapshot) {
  const content = snapshot.content ?? snapshot.settings ?? {};
  const ids = [...new Set([content.header?.mediaId, content.philosophy?.mediaId].filter(Boolean))];
  const { data, error } = ids.length
    ? await client.from('media_assets').select('id,secure_url,display_name,alt_text,format,width,height').in('id', ids).eq('is_archived', false).eq('resource_type', 'image')
    : { data: [], error: null };
  fail(error, 'Career page assets could not be loaded.');
  const media = new Map((data || []).map((item) => [item.id, normalizeMedia(item)]));
  return {
    id: snapshot.id,
    pageId: snapshot.pageId ?? snapshot.page_id,
    sectionKey: CAREER_PAGE_SECTION_KEY,
    status: snapshot.status,
    versionNumber: Number(snapshot.versionNumber ?? snapshot.version_number ?? 1),
    isVisible: snapshot.isVisible ?? snapshot.is_visible ?? true,
    content: {
      ...content,
      header: { ...(content.header || {}), media: media.get(content.header?.mediaId) || null },
      philosophy: { ...(content.philosophy || {}), media: media.get(content.philosophy?.mediaId) || null },
      jobs: [...(content.jobs || [])].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
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
  const { data: page, error: pageError } = await client.from('pages').select('id').eq('slug', 'career').eq('is_published', true).maybeSingle();
  fail(pageError, 'The Career page record could not be loaded.');
  if (!page) throw new CareerPageDataError('The Career page is not configured.', { status: 503, code: 'CAREER_PAGE_NOT_CONFIGURED' });
  const { data, error } = await client.from('page_sections').select('id,page_id,status,version_number,settings,is_visible,updated_at,updated_by,published_at,published_by').eq('page_id', page.id).eq('section_key', CAREER_PAGE_SECTION_KEY).eq('status', 'published').order('version_number', { ascending: false }).limit(1);
  fail(error, 'Published Career content could not be loaded.');
  if (!data?.[0]) throw new CareerPageDataError('Published Career content is not configured.', { status: 503, code: 'CAREER_PAGE_CONTENT_NOT_CONFIGURED' });
  return hydrate(client, data[0]);
}

const cachedPublished = unstable_cache(loadPublished, ['published-career-page-v2'], { tags: [CAREER_PAGE_CACHE_TAG], revalidate: 3600 });
export function getPublishedCareerPage() { return cachedPublished(); }

export async function getAdminCareerPage() {
  await requireAdmin({ allowedRoles: CAREER_ADMIN_ROLES });
  const admin = createAdminClient();
  const { data: page, error: pageError } = await admin.from('pages').select('id').eq('slug', 'career').single();
  fail(pageError, 'The Career page record could not be loaded.');
  let { data: sections, error } = await admin.from('page_sections').select('id').eq('page_id', page.id).eq('section_key', CAREER_PAGE_SECTION_KEY).eq('status', 'draft').limit(1);
  if (!sections?.length) ({ data: sections, error } = await admin.from('page_sections').select('id').eq('page_id', page.id).eq('section_key', CAREER_PAGE_SECTION_KEY).eq('status', 'published').order('version_number', { ascending: false }).limit(1));
  fail(error, 'Career editor content could not be loaded.');
  if (!sections?.[0]) throw new CareerPageDataError('Career editor content is not configured.', { status: 503, code: 'CAREER_PAGE_CONTENT_NOT_CONFIGURED' });
  const [{ data: snapshot, error: snapshotError }, { data: history, error: historyError }] = await Promise.all([
    admin.rpc('career_page_snapshot', { p_section_id: sections[0].id }),
    admin.from('content_revisions').select('id,version_number,change_summary,created_at,created_by').eq('table_name', 'page_sections').eq('record_id', sections[0].id).order('created_at', { ascending: false }).limit(10),
  ]);
  fail(snapshotError || historyError, 'Career editor snapshot could not be loaded.');
  return { ...(await hydrate(admin, snapshot)), history: history || [] };
}

async function mutate(name, args) {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const conflict = ['40001', '23505'].includes(error.code);
    const invalid = ['22023', '23502', '23503', '23514'].includes(error.code);
    throw new CareerPageDataError('The Career mutation failed.', { status: conflict ? 409 : invalid ? 422 : 500, code: conflict ? 'CAREER_PAGE_CONFLICT' : 'CAREER_PAGE_MUTATION_FAILED', cause: error });
  }
  if (data?.ok === false) return data;
  return { ok: true, data: await hydrate(createAdminClient(), data.data) };
}

export function persistCareerPageDraft(payload) { return mutate('save_career_page_draft', { p_payload: payload, p_expected_updated_at: payload.updatedAt }); }
export function promoteCareerPageDraft(input) { return mutate('publish_career_page_draft', { p_section_id: input.id, p_expected_updated_at: input.expectedUpdatedAt }); }

export async function getAdminCareerApplications() {
  await requireAdmin({ allowedRoles: CAREER_HR_ROLES });
  const admin = createAdminClient();
  const { data, error } = await admin.from('career_applications').select('id,job_opening_id,full_name,email,phone,cover_letter,resume_storage_path,resume_original_filename,status,admin_notes,created_at,updated_at,job_openings(title)').order('created_at', { ascending: false });
  fail(error, 'Career applications could not be loaded.');
  return data || [];
}
