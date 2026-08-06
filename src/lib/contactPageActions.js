'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { isAdminAuthError, requireAdmin } from '@/lib/auth/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import { CONTACT_ADMIN_ROLES, CONTACT_PAGE_CACHE_TAG, ContactPageDataError, INQUIRY_ADMIN_ROLES, persistContactPageDraft, promoteContactPageDraft } from '@/lib/contactPageRepository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = ['new', 'contacted', 'qualified', 'closed', 'spam'];

function validate(input) {
  const errors = {};
  if (!UUID.test(input?.id || '')) errors.id = 'A valid Contact page version is required.';
  if (!input?.updatedAt || Number.isNaN(Date.parse(input.updatedAt))) errors.updatedAt = 'Refresh before saving.';
  if (input?.sectionKey !== 'contact-page') errors.sectionKey = 'Only Contact page content is accepted.';
  const content = input?.content;
  if (!content || typeof content !== 'object') errors.content = 'Contact content is required.';
  if (!Array.isArray(content?.infoCards) || content.infoCards.length < 1 || content.infoCards.length > 8) errors.infoCards = 'Add between 1 and 8 contact cards.';
  if (!Array.isArray(content?.subjectOptions) || content.subjectOptions.length < 1 || content.subjectOptions.length > 12) errors.subjectOptions = 'Add between 1 and 12 inquiry subjects.';
  if (!content?.header?.title?.trim() || !content?.form?.heading?.trim() || !content?.map?.iframeUrl?.startsWith('https://')) errors.copy = 'Header, form, and HTTPS map settings are required.';
  return errors;
}

function failure(error) {
  if (isAdminAuthError(error)) return { ok: false, status: error.status, code: error.code, error: error.message };
  if (error instanceof ContactPageDataError) return { ok: false, status: error.status, code: error.code, error: error.status >= 500 ? 'The Contact request could not be completed.' : error.message };
  console.error('Unexpected Contact action failure:', error);
  return { ok: false, status: 500, code: 'CONTACT_PAGE_ACTION_FAILED', error: 'The Contact request could not be completed.' };
}

export async function saveContactPageDraft(input) {
  try {
    await requireAdmin({ allowedRoles: CONTACT_ADMIN_ROLES });
    const fieldErrors = validate(input);
    if (Object.keys(fieldErrors).length) return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'Review the Contact fields.', fieldErrors };
    return await persistContactPageDraft(input);
  } catch (error) { return failure(error); }
}

export async function publishContactPageDraft(input) {
  try {
    await requireAdmin({ allowedRoles: CONTACT_ADMIN_ROLES });
    if (!UUID.test(input?.id || '') || !input?.expectedUpdatedAt) return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'A current saved Contact draft is required.' };
    const result = await promoteContactPageDraft(input);
    if (result.ok) { updateTag(CONTACT_PAGE_CACHE_TAG); revalidatePath('/contact'); revalidatePath('/admin/pages/contact'); }
    return result;
  } catch (error) { return failure(error); }
}

export async function updateInquiry(input) {
  try {
    const { user } = await requireAdmin({ allowedRoles: INQUIRY_ADMIN_ROLES });
    if (!UUID.test(input?.id || '') || !STATUSES.includes(input?.status)) return { ok: false, status: 422, error: 'Choose a valid inquiry status.' };
    const notes = typeof input.adminNotes === 'string' ? input.adminNotes.trim() : '';
    if (notes.length > 3000) return { ok: false, status: 422, error: 'Notes must be 3,000 characters or fewer.' };
    const admin = createAdminClient();
    const { data: previous, error: previousError } = await admin.from('inquiries').select('*').eq('id', input.id).single();
    if (previousError) throw previousError;
    const { data, error } = await admin.from('inquiries').update({ status: input.status, admin_notes: notes || null }).eq('id', input.id).select('id,status,admin_notes,updated_at').single();
    if (error) throw error;
    await admin.from('audit_logs').insert({ admin_id: user.id, action: 'update_inquiry', table_name: 'inquiries', record_id: input.id, old_values: previous, new_values: data });
    revalidatePath('/admin/inquiries');
    return { ok: true, data };
  } catch (error) { return failure(error); }
}
