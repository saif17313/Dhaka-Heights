import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

export const CONTACT_PAGE_SECTION_KEY = 'contact-page';
export const CONTACT_PAGE_CACHE_TAG = 'page:contact:published';
export const CONTACT_ADMIN_ROLES = ['super_admin', 'content_editor', 'sales_manager'];
export const INQUIRY_ADMIN_ROLES = ['super_admin', 'sales_manager'];

export class ContactPageDataError extends Error {
  constructor(message, { status = 500, code = 'CONTACT_PAGE_DATA_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = 'ContactPageDataError';
    this.status = status;
    this.code = code;
  }
}

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new ContactPageDataError('Public Supabase configuration is missing.', { status: 503, code: 'PUBLIC_SUPABASE_NOT_CONFIGURED' });
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

function fail(error, message) {
  if (error) throw new ContactPageDataError(message, { cause: error });
}

function normalize(snapshot) {
  const content = snapshot.content ?? snapshot.settings ?? {};
  return {
    id: snapshot.id,
    pageId: snapshot.pageId ?? snapshot.page_id,
    sectionKey: CONTACT_PAGE_SECTION_KEY,
    status: snapshot.status,
    versionNumber: Number(snapshot.versionNumber ?? snapshot.version_number ?? 1),
    isVisible: snapshot.isVisible ?? snapshot.is_visible ?? true,
    content: {
      ...content,
      infoCards: [...(content.infoCards || [])].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
      subjectOptions: [...(content.subjectOptions || [])].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
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
  const { data: page, error: pageError } = await client.from('pages').select('id').eq('slug', 'contact').eq('is_published', true).maybeSingle();
  fail(pageError, 'The Contact page record could not be loaded.');
  if (!page) throw new ContactPageDataError('The Contact page is not configured.', { status: 503, code: 'CONTACT_PAGE_NOT_CONFIGURED' });
  const { data, error } = await client.from('page_sections').select('id,page_id,status,version_number,settings,is_visible,updated_at,updated_by,published_at,published_by').eq('page_id', page.id).eq('section_key', CONTACT_PAGE_SECTION_KEY).eq('status', 'published').order('version_number', { ascending: false }).limit(1);
  fail(error, 'Published Contact content could not be loaded.');
  if (!data?.[0]) throw new ContactPageDataError('Published Contact content is not configured.', { status: 503, code: 'CONTACT_PAGE_CONTENT_NOT_CONFIGURED' });
  return normalize(data[0]);
}

const cachedPublished = unstable_cache(loadPublished, ['published-contact-page-v1'], { tags: [CONTACT_PAGE_CACHE_TAG], revalidate: 3600 });
export function getPublishedContactPage() { return cachedPublished(); }

export async function getAdminContactPage() {
  await requireAdmin({ allowedRoles: CONTACT_ADMIN_ROLES });
  const admin = createAdminClient();
  const { data: page, error: pageError } = await admin.from('pages').select('id').eq('slug', 'contact').single();
  fail(pageError, 'The Contact page record could not be loaded.');
  let { data: sections, error } = await admin.from('page_sections').select('id').eq('page_id', page.id).eq('section_key', CONTACT_PAGE_SECTION_KEY).eq('status', 'draft').limit(1);
  if (!sections?.length) ({ data: sections, error } = await admin.from('page_sections').select('id').eq('page_id', page.id).eq('section_key', CONTACT_PAGE_SECTION_KEY).eq('status', 'published').order('version_number', { ascending: false }).limit(1));
  fail(error, 'Contact editor content could not be loaded.');
  if (!sections?.[0]) throw new ContactPageDataError('Contact editor content is not configured.', { status: 503, code: 'CONTACT_PAGE_CONTENT_NOT_CONFIGURED' });
  const [{ data: snapshot, error: snapshotError }, { data: history, error: historyError }] = await Promise.all([
    admin.rpc('contact_page_snapshot', { p_section_id: sections[0].id }),
    admin.from('content_revisions').select('id,version_number,change_summary,created_at,created_by').eq('table_name', 'page_sections').eq('record_id', sections[0].id).order('created_at', { ascending: false }).limit(10),
  ]);
  fail(snapshotError || historyError, 'Contact editor snapshot could not be loaded.');
  return { ...normalize(snapshot), history: history || [] };
}

async function mutate(name, args) {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const conflict = ['40001', '23505'].includes(error.code);
    const invalid = ['22023', '23502', '23503', '23514'].includes(error.code);
    throw new ContactPageDataError('The Contact mutation failed.', { status: conflict ? 409 : invalid ? 422 : 500, code: conflict ? 'CONTACT_PAGE_CONFLICT' : 'CONTACT_PAGE_MUTATION_FAILED', cause: error });
  }
  if (data?.ok === false) return data;
  return { ok: true, data: normalize(data.data) };
}

export function persistContactPageDraft(payload) { return mutate('save_contact_page_draft', { p_payload: payload, p_expected_updated_at: payload.updatedAt }); }
export function promoteContactPageDraft(input) { return mutate('publish_contact_page_draft', { p_section_id: input.id, p_expected_updated_at: input.expectedUpdatedAt }); }

export async function getAdminInquiries({ status = 'all' } = {}) {
  await requireAdmin({ allowedRoles: INQUIRY_ADMIN_ROLES });
  const admin = createAdminClient();
  let query = admin.from('inquiries').select('id,submission_type,full_name,email,phone,subject,project_id,message,status,admin_notes,assigned_to,created_at,updated_at,projects(name)').order('created_at', { ascending: false });
  if (status !== 'all') query = query.eq('status', status);
  const { data, error } = await query;
  fail(error, 'Customer inquiries could not be loaded.');
  return data || [];
}
