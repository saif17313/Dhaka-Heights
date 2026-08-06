import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

export const SITE_SHELL_CACHE_TAG = 'site:shell:published';

export class SiteShellDataError extends Error {
  constructor(message, { status = 500, code = 'SITE_SHELL_DATA_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = 'SiteShellDataError';
    this.status = status;
    this.code = code;
  }
}

function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new SiteShellDataError('Public Supabase configuration is missing.', { status: 503, code: 'PUBLIC_SUPABASE_NOT_CONFIGURED' });
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

function fail(error, message, code = 'SITE_SHELL_QUERY_FAILED') {
  if (error) throw new SiteShellDataError(message, { code, cause: error });
}

function sort(items = []) { return [...items].sort((a, b) => Number(a.sortOrder ?? a.sort_order) - Number(b.sortOrder ?? b.sort_order)); }

function media(row) {
  if (!row) return null;
  return { id: row.id, secureUrl: row.secure_url ?? row.secureUrl, displayName: row.display_name ?? row.displayName, altText: row.alt_text ?? row.altText ?? '', format: row.format };
}

function normalize(snapshot) {
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    status: snapshot.status,
    versionNumber: Number(snapshot.versionNumber ?? snapshot.version_number ?? 1),
    brand: snapshot.brand || {}, metadata: snapshot.metadata || {}, preloader: snapshot.preloader || {},
    mobileDrawer: snapshot.mobileDrawer || snapshot.mobile_drawer || {},
    quickInquiry: snapshot.quickInquiry || snapshot.quick_inquiry || {}, footer: snapshot.footer || {},
    navigation: sort(snapshot.navigation).map((item) => ({ ...item, children: sort(item.children) })),
    footerGroups: sort(snapshot.footerGroups || snapshot.footer_groups).map((group) => ({ ...group, links: sort(group.links) })),
    socialLinks: sort(snapshot.socialLinks || snapshot.social_links),
    updatedAt: snapshot.updatedAt ?? snapshot.updated_at,
    updatedBy: snapshot.updatedBy ?? snapshot.updated_by,
    publishedAt: snapshot.publishedAt ?? snapshot.published_at,
    publishedBy: snapshot.publishedBy ?? snapshot.published_by,
    history: snapshot.history || [],
  };
}

async function loadPublicShell() {
  const supabase = createPublicClient();
  const { data: rows, error } = await supabase.from('site_settings')
    .select('id,status,version_number,settings,logo_asset_id,favicon_asset_id,seo_og_image_id,updated_at,updated_by,published_at,published_by')
    .eq('status', 'published').order('version_number', { ascending: false }).limit(1);
  fail(error, 'The published Site Shell could not be loaded.');
  const row = rows?.[0];
  if (!row) throw new SiteShellDataError('The published Site Shell is not configured.', { status: 503, code: 'SITE_SHELL_NOT_CONFIGURED' });

  const [{ data: assets, error: assetsError }, { data: nav, error: navError }, { data: groups, error: groupsError }, { data: links, error: linksError }, { data: socials, error: socialError }, { data: concerns, error: concernError }] = await Promise.all([
    supabase.from('media_assets').select('id,secure_url,display_name,alt_text,format').in('id', [row.logo_asset_id, row.favicon_asset_id, row.seo_og_image_id].filter(Boolean)),
    supabase.from('navigation_items').select('id,parent_id,item_key,label,mobile_label,url,target,mobile_mode,sort_order,is_visible').eq('site_settings_id', row.id).order('sort_order'),
    supabase.from('footer_groups').select('id,group_key,title,sort_order,is_visible').eq('site_settings_id', row.id).order('sort_order'),
    supabase.from('footer_links').select('id,group_id,link_key,label,url,target,sort_order,is_visible').order('sort_order'),
    supabase.from('social_links').select('id,item_key,platform_name,url,icon_key,target,sort_order,is_visible').eq('site_settings_id', row.id).order('sort_order'),
    supabase.from('concerns').select('id,name,slug,sort_order').eq('status', 'published').order('sort_order'),
  ]);
  fail(assetsError || navError || groupsError || linksError || socialError || concernError, 'The published Site Shell relationships could not be loaded.');
  const byId = new Map((assets || []).map((item) => [item.id, item]));
  const navRows = nav || [];
  const navigation = navRows.filter((item) => !item.parent_id).map((item) => ({
    id: item.id, itemKey: item.item_key, label: item.label, mobileLabel: item.mobile_label, url: item.url,
    target: item.target, mobileMode: item.mobile_mode, sortOrder: item.sort_order, isVisible: item.is_visible,
    children: item.item_key === 'nav-concern'
      ? (concerns || []).map((concern, index) => ({ id: concern.id, itemKey: `nav-concern-${concern.slug}`, label: concern.name, mobileLabel: concern.name, url: `/concern/${concern.slug}`, target: '_self', sortOrder: concern.sort_order ?? (index + 1) * 10, isVisible: true }))
      : navRows.filter((child) => child.parent_id === item.id).map((child) => ({ id: child.id, itemKey: child.item_key, label: child.label, mobileLabel: child.mobile_label, url: child.url, target: child.target, mobileMode: child.mobile_mode, sortOrder: child.sort_order, isVisible: child.is_visible })),
  }));
  const footerGroups = (groups || []).map((group) => ({ id: group.id, groupKey: group.group_key, title: group.title, sortOrder: group.sort_order, isVisible: group.is_visible, links: (links || []).filter((link) => link.group_id === group.id).map((link) => ({ id: link.id, linkKey: link.link_key, label: link.label, url: link.url, target: link.target, sortOrder: link.sort_order, isVisible: link.is_visible })) }));
  const settings = row.settings || {};
  return normalize({ ...row, ...settings, brand: { ...(settings.brand || {}), logoMediaId: row.logo_asset_id, faviconMediaId: row.favicon_asset_id, logoMedia: media(byId.get(row.logo_asset_id)), faviconMedia: media(byId.get(row.favicon_asset_id)) }, metadata: { ...(settings.metadata || {}), ogImageMediaId: row.seo_og_image_id, ogImageMedia: media(byId.get(row.seo_og_image_id)) }, navigation, footerGroups, socialLinks: (socials || []).map((item) => ({ id: item.id, itemKey: item.item_key, platformName: item.platform_name, url: item.url, iconKey: item.icon_key, target: item.target, sortOrder: item.sort_order, isVisible: item.is_visible })) });
}

const cachedPublicShell = unstable_cache(loadPublicShell, ['published-site-shell-v1'], { tags: [SITE_SHELL_CACHE_TAG], revalidate: 3600 });
export async function getPublishedSiteShell() { return cachedPublicShell(); }

export async function getAdminSiteShell() {
  await requireAdmin();
  const admin = createAdminClient();
  let { data: rows, error } = await admin.from('site_settings').select('id,status,version_number').eq('status', 'draft').order('version_number', { ascending: false }).limit(1);
  fail(error, 'The Site Shell draft could not be loaded.');
  if (!rows?.length) ({ data: rows, error } = await admin.from('site_settings').select('id,status,version_number').eq('status', 'published').order('version_number', { ascending: false }).limit(1));
  fail(error, 'The Site Shell could not be loaded.');
  if (!rows?.[0]) throw new SiteShellDataError('The Site Shell is not configured.', { status: 503, code: 'SITE_SHELL_NOT_CONFIGURED' });
  const { data, error: snapshotError } = await admin.rpc('site_shell_snapshot', { p_settings_id: rows[0].id });
  fail(snapshotError, 'The Site Shell snapshot could not be loaded.');
  const { data: history, error: historyError } = await admin.from('content_revisions').select('id,version_number,change_summary,created_at,created_by').eq('table_name', 'site_settings').eq('record_id', rows[0].id).order('created_at', { ascending: false }).limit(10);
  fail(historyError, 'The Site Shell history could not be loaded.');
  return normalize({ ...data, history: history || [] });
}

async function mutation(name, args) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new SiteShellDataError('The Site Shell mutation failed.', { status: ['40001', '23505'].includes(error.code) ? 409 : ['22023', '23502', '23503', '23514'].includes(error.code) ? 422 : 500, code: ['40001', '23505'].includes(error.code) ? 'SITE_SHELL_CONFLICT' : 'SITE_SHELL_MUTATION_FAILED', cause: error });
  if (data?.ok === false) return data;
  const snapshot = normalize(data.data);
  const admin = createAdminClient();
  const { data: history } = await admin.from('content_revisions').select('id,version_number,change_summary,created_at,created_by').eq('table_name', 'site_settings').eq('record_id', snapshot.id).order('created_at', { ascending: false }).limit(10);
  return { ok: true, data: normalize({ ...snapshot, history: history || [] }) };
}

export async function persistSiteShellDraft(payload) { return mutation('save_site_shell_draft', { p_payload: payload, p_expected_updated_at: payload.updatedAt }); }
export async function promoteSiteShellDraft({ id, expectedUpdatedAt }) { return mutation('publish_site_shell_draft', { p_settings_id: id, p_expected_updated_at: expectedUpdatedAt }); }
