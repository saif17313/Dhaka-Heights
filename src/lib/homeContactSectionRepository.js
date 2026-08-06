import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

export const HOME_CONTACT_SECTION_KEY = 'contact-section-home';
export const HOME_CONTACT_CACHE_TAG = 'home:contact-section:published';

export class HomeContactSectionDataError extends Error {
  constructor(message, { status = 500, code = 'HOME_CONTACT_SECTION_DATA_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = 'HomeContactSectionDataError';
    this.status = status;
    this.code = code;
  }
}

function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new HomeContactSectionDataError('Public Supabase configuration is missing.', { status: 503, code: 'PUBLIC_SUPABASE_NOT_CONFIGURED' });
  }
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
}

function queryError(error, message, code = 'HOME_CONTACT_SECTION_QUERY_FAILED') {
  if (error) throw new HomeContactSectionDataError(message, { status: 500, code, cause: error });
}

function normalizeDetail(detail, index = 0) {
  return {
    itemId: detail.itemId ?? detail.id ?? null,
    itemKey: detail.itemKey ?? detail.item_key ?? `detail-${index + 1}`,
    label: detail.label ?? detail.title ?? '',
    value: detail.value ?? detail.body_text ?? '',
    iconKey: detail.iconKey ?? detail.icon_key ?? '',
    sortOrder: Number(detail.sortOrder ?? detail.sort_order ?? (index + 1) * 10),
    isVisible: detail.isVisible ?? detail.is_visible ?? true,
  };
}

function normalizeOption(option, index = 0) {
  return {
    itemId: option.itemId ?? option.id ?? null,
    itemKey: option.itemKey ?? option.item_key ?? `option-${index + 1}`,
    label: option.label ?? option.title ?? '',
    value: option.value ?? option.primary_cta_url ?? '',
    sortOrder: Number(option.sortOrder ?? option.sort_order ?? (index + 1) * 10),
    isVisible: option.isVisible ?? option.is_visible ?? true,
  };
}

function normalizeCopy(copy = {}) {
  return {
    formHeading: copy.formHeading ?? copy.form_heading ?? '',
    formDescription: copy.formDescription ?? copy.form_description ?? '',
    nameLabel: copy.nameLabel ?? copy.name_label ?? '',
    emailLabel: copy.emailLabel ?? copy.email_label ?? '',
    phoneLabel: copy.phoneLabel ?? copy.phone_label ?? '',
    sizeLabel: copy.sizeLabel ?? copy.size_label ?? '',
    messageLabel: copy.messageLabel ?? copy.message_label ?? '',
    nameError: copy.nameError ?? copy.name_error ?? '',
    emailError: copy.emailError ?? copy.email_error ?? '',
    phoneError: copy.phoneError ?? copy.phone_error ?? '',
    sizeError: copy.sizeError ?? copy.size_error ?? '',
    submitLabel: copy.submitLabel ?? copy.submit_label ?? '',
    submittingLabel: copy.submittingLabel ?? copy.submitting_label ?? '',
    successTitle: copy.successTitle ?? copy.success_title ?? '',
    successBody: copy.successBody ?? copy.success_body ?? '',
    closeLabel: copy.closeLabel ?? copy.close_label ?? '',
    mapLakeLabel: copy.mapLakeLabel ?? copy.map_lake_label ?? '',
    mapRoadLabel: copy.mapRoadLabel ?? copy.map_road_label ?? '',
    mapTooltip: copy.mapTooltip ?? copy.map_tooltip ?? '',
  };
}

function normalizeSnapshot(snapshot) {
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    pageId: snapshot.pageId ?? snapshot.page_id,
    sectionKey: snapshot.sectionKey ?? snapshot.section_key ?? HOME_CONTACT_SECTION_KEY,
    status: snapshot.status,
    versionNumber: Number(snapshot.versionNumber ?? snapshot.version_number ?? 1),
    tagText: snapshot.tagText ?? snapshot.tag_text ?? '',
    heading: snapshot.heading ?? '',
    description: snapshot.description ?? '',
    isVisible: snapshot.isVisible ?? snapshot.is_visible ?? true,
    copy: normalizeCopy(snapshot.copy ?? snapshot.settings),
    details: (snapshot.details || []).map(normalizeDetail).sort((a, b) => a.sortOrder - b.sortOrder),
    spaceOptions: (snapshot.spaceOptions || []).map(normalizeOption).sort((a, b) => a.sortOrder - b.sortOrder),
    updatedAt: snapshot.updatedAt ?? snapshot.updated_at ?? null,
    updatedBy: snapshot.updatedBy ?? snapshot.updated_by ?? null,
    publishedAt: snapshot.publishedAt ?? snapshot.published_at ?? null,
    publishedBy: snapshot.publishedBy ?? snapshot.published_by ?? null,
    history: (snapshot.history || []).map((revision) => ({
      id: revision.id,
      revisionNumber: Number(revision.revisionNumber ?? revision.version_number ?? 0),
      summary: revision.summary ?? revision.change_summary ?? 'Saved Home Contact Section revision',
      createdAt: revision.createdAt ?? revision.created_at ?? null,
      createdBy: revision.createdBy ?? revision.created_by ?? null,
    })),
  };
}

async function loadRevisionHistory(supabase, sectionId) {
  const { data, error } = await supabase.from('content_revisions')
    .select('id, version_number, change_summary, created_at, created_by')
    .eq('table_name', 'page_sections').eq('record_id', sectionId)
    .order('created_at', { ascending: false }).limit(10);
  queryError(error, 'The Home Contact Section revision history could not be loaded.');
  return data || [];
}

async function loadHomeContactSection(supabase, { status }) {
  const { data: page, error: pageError } = await supabase.from('pages').select('id')
    .eq('slug', 'home').eq('is_published', true).maybeSingle();
  queryError(pageError, 'The Home page could not be loaded.', 'HOME_PAGE_QUERY_FAILED');
  if (!page) throw new HomeContactSectionDataError('The Home page is not configured.', { status: 503, code: 'HOME_PAGE_NOT_CONFIGURED' });

  const { data: sections, error: sectionError } = await supabase.from('page_sections')
    .select('id,page_id,section_key,status,version_number,tag_text,heading,description,settings,is_visible,updated_at,updated_by,published_at,published_by')
    .eq('page_id', page.id).eq('section_key', HOME_CONTACT_SECTION_KEY).eq('status', status)
    .order('version_number', { ascending: false }).limit(1);
  queryError(sectionError, 'The Home Contact Section could not be loaded.');
  const section = sections?.[0];
  if (!section) return null;

  const { data: items, error: itemError } = await supabase.from('section_items')
    .select('id,item_key,title,body_text,icon_key,primary_cta_url,sort_order,is_visible')
    .eq('section_id', section.id).order('sort_order');
  queryError(itemError, 'The Home Contact Section items could not be loaded.');
  const details = (items || []).filter((item) => item.item_key?.startsWith('detail-'));
  const spaceOptions = (items || []).filter((item) => item.item_key?.startsWith('option-'));
  return normalizeSnapshot({ ...section, details, spaceOptions });
}

const getCachedPublishedHomeContactSection = unstable_cache(
  async () => {
    const contact = await loadHomeContactSection(createPublicClient(), { status: 'published' });
    if (!contact) throw new HomeContactSectionDataError('The published Home Contact Section is not configured.', { status: 503, code: 'HOME_CONTACT_SECTION_NOT_CONFIGURED' });
    if (contact.isVisible && (!contact.details.some((item) => item.isVisible) || !contact.spaceOptions.some((item) => item.isVisible))) {
      throw new HomeContactSectionDataError('The published Home Contact Section has incomplete visible items.', { status: 503, code: 'HOME_CONTACT_SECTION_ITEMS_NOT_CONFIGURED' });
    }
    return contact;
  },
  ['home-contact-section-published-v1'],
  { tags: [HOME_CONTACT_CACHE_TAG], revalidate: 3600 }
);

export async function getPublishedHomeContactSection() { return getCachedPublishedHomeContactSection(); }

export async function getAdminHomeContactSection() {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  let contact = await loadHomeContactSection(supabase, { status: 'draft' });
  if (!contact) contact = await loadHomeContactSection(supabase, { status: 'published' });
  if (!contact) throw new HomeContactSectionDataError('The Home Contact Section is not configured.', { status: 503, code: 'HOME_CONTACT_SECTION_NOT_CONFIGURED' });
  return normalizeSnapshot({ ...contact, history: await loadRevisionHistory(supabase, contact.id) });
}

async function runMutation(name, args) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const validationCodes = new Set(['22023', '22P02', '23502', '23503', '23514']);
    const isConflict = error.code === '40001' || error.code === '23505';
    throw new HomeContactSectionDataError('The Home Contact Section mutation could not be completed.', {
      status: isConflict ? 409 : validationCodes.has(error.code) ? 422 : 500,
      code: isConflict ? 'HOME_CONTACT_SECTION_CONFLICT' : validationCodes.has(error.code) ? 'VALIDATION_ERROR' : 'HOME_CONTACT_SECTION_MUTATION_FAILED',
      cause: error,
    });
  }
  if (!data || typeof data !== 'object') throw new HomeContactSectionDataError('The Home Contact Section mutation returned an invalid response.', { code: 'HOME_CONTACT_SECTION_INVALID_MUTATION_RESPONSE' });
  if (data.ok === false) return data;
  const contact = normalizeSnapshot(data.data);
  return { ok: true, data: normalizeSnapshot({ ...contact, history: await loadRevisionHistory(supabase, contact.id) }) };
}

export async function persistHomeContactSectionDraft(payload) {
  return runMutation('save_home_contact_section_draft', { p_payload: payload, p_expected_updated_at: payload.updatedAt });
}

export async function promoteHomeContactSectionDraft({ id, expectedUpdatedAt }) {
  return runMutation('publish_home_contact_section_draft', { p_section_id: id, p_expected_updated_at: expectedUpdatedAt });
}
