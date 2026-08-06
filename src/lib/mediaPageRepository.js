import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

export const MEDIA_PAGE_SECTION_KEY = 'media-page';
export const MEDIA_PAGE_CACHE_TAG = 'page:media:published';

export class MediaPageDataError extends Error {
  constructor(message, { status = 500, code = 'MEDIA_PAGE_DATA_ERROR', cause } = {}) { super(message, { cause }); this.name = 'MediaPageDataError'; this.status = status; this.code = code; }
}
function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new MediaPageDataError('Public Supabase configuration is missing.', { status: 503, code: 'PUBLIC_SUPABASE_NOT_CONFIGURED' });
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
function fail(error, message) { if (error) throw new MediaPageDataError(message, { cause: error }); }
function normalizeMedia(row) { return row ? { id: row.id, secureUrl: row.secure_url, displayName: row.display_name, altText: row.alt_text || '', format: row.format, width: row.width, height: row.height } : null; }
function mediaIds(content = {}) { return [...new Set([content.header?.mediaId, ...(content.articles || []).map((item) => item.coverMediaId), ...(content.videos || []).map((item) => item.thumbnailMediaId)].filter(Boolean))]; }
async function hydrate(client, snapshot) {
  const content = snapshot.content ?? snapshot.settings ?? {}, ids = mediaIds(content);
  const { data, error } = ids.length ? await client.from('media_assets').select('id,secure_url,display_name,alt_text,format,width,height').in('id', ids).eq('is_archived', false).eq('resource_type', 'image') : { data: [], error: null };
  fail(error, 'Media Center assets could not be loaded.');
  const map = new Map((data || []).map((item) => [item.id, normalizeMedia(item)]));
  return {
    id: snapshot.id, pageId: snapshot.pageId ?? snapshot.page_id, sectionKey: MEDIA_PAGE_SECTION_KEY, status: snapshot.status,
    versionNumber: Number(snapshot.versionNumber ?? snapshot.version_number ?? 1), isVisible: snapshot.isVisible ?? snapshot.is_visible ?? true,
    content: { ...content, header: { ...(content.header || {}), media: map.get(content.header?.mediaId) || null }, articles: [...(content.articles || [])].sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0)).map((item)=>({ ...item, coverMedia: map.get(item.coverMediaId) || null })), videos: [...(content.videos || [])].sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0)).map((item)=>({ ...item, thumbnailMedia: map.get(item.thumbnailMediaId) || null })) },
    updatedAt: snapshot.updatedAt ?? snapshot.updated_at, updatedBy: snapshot.updatedBy ?? snapshot.updated_by, publishedAt: snapshot.publishedAt ?? snapshot.published_at, publishedBy: snapshot.publishedBy ?? snapshot.published_by, history: snapshot.history || [],
  };
}
async function loadPublished() {
  const client = publicClient();
  const { data: page, error: pageError } = await client.from('pages').select('id').eq('slug', 'media-center').eq('is_published', true).maybeSingle();
  fail(pageError, 'The Media Center page record could not be loaded.');
  if (!page) throw new MediaPageDataError('The Media Center page is not configured.', { status: 503, code: 'MEDIA_PAGE_NOT_CONFIGURED' });
  const { data, error } = await client.from('page_sections').select('id,page_id,status,version_number,settings,is_visible,updated_at,updated_by,published_at,published_by').eq('page_id', page.id).eq('section_key', MEDIA_PAGE_SECTION_KEY).eq('status', 'published').order('version_number', { ascending: false }).limit(1);
  fail(error, 'Published Media Center content could not be loaded.');
  if (!data?.[0]) throw new MediaPageDataError('Published Media Center content is not configured.', { status: 503, code: 'MEDIA_PAGE_CONTENT_NOT_CONFIGURED' });
  return hydrate(client, data[0]);
}
const cachedPublished = unstable_cache(loadPublished, ['published-media-page-v2'], { tags: [MEDIA_PAGE_CACHE_TAG], revalidate: 3600 });
export function getPublishedMediaPage() { return cachedPublished(); }
export async function getPublishedMediaArticle(slug) { const page = await getPublishedMediaPage(); const article = page.isVisible ? page.content.articles.find((item)=>item.slug===slug && item.isVisible!==false) : null; return article ? { page, article } : null; }

export async function getAdminMediaPage() {
  await requireAdmin(); const admin = createAdminClient();
  const { data: page, error: pageError } = await admin.from('pages').select('id').eq('slug', 'media-center').single(); fail(pageError, 'The Media Center page record could not be loaded.');
  let { data: sections, error } = await admin.from('page_sections').select('id').eq('page_id', page.id).eq('section_key', MEDIA_PAGE_SECTION_KEY).eq('status', 'draft').limit(1);
  if (!sections?.length) ({ data: sections, error } = await admin.from('page_sections').select('id').eq('page_id', page.id).eq('section_key', MEDIA_PAGE_SECTION_KEY).eq('status', 'published').order('version_number', { ascending: false }).limit(1));
  fail(error, 'Media Center editor content could not be loaded.');
  if (!sections?.[0]) throw new MediaPageDataError('Media Center editor content is not configured.', { status: 503, code: 'MEDIA_PAGE_CONTENT_NOT_CONFIGURED' });
  const [{ data: snapshot, error: snapshotError }, { data: history, error: historyError }] = await Promise.all([admin.rpc('media_page_snapshot', { p_section_id: sections[0].id }), admin.from('content_revisions').select('id,version_number,change_summary,created_at,created_by').eq('table_name','page_sections').eq('record_id',sections[0].id).order('created_at',{ascending:false}).limit(10)]);
  fail(snapshotError || historyError, 'Media Center editor snapshot could not be loaded.');
  return { ...(await hydrate(admin, snapshot)), history: history || [] };
}
async function mutate(name, args) {
  const client = await createServerSupabaseClient(); const { data, error } = await client.rpc(name, args);
  if (error) { const conflict=['40001','23505'].includes(error.code), invalid=['22023','23502','23503','23514'].includes(error.code); throw new MediaPageDataError('The Media Center mutation failed.', { status: conflict?409:invalid?422:500, code: conflict?'MEDIA_PAGE_CONFLICT':'MEDIA_PAGE_MUTATION_FAILED', cause:error }); }
  if (data?.ok === false) return data; return { ok:true, data:await hydrate(createAdminClient(),data.data) };
}
export function persistMediaPageDraft(payload) { return mutate('save_media_page_draft',{p_payload:payload,p_expected_updated_at:payload.updatedAt}); }
export function promoteMediaPageDraft(input) { return mutate('publish_media_page_draft',{p_section_id:input.id,p_expected_updated_at:input.expectedUpdatedAt}); }
