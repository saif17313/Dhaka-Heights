'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { isAdminAuthError, requireAdmin } from '@/lib/auth/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import { CAREER_ADMIN_ROLES, CAREER_HR_ROLES, CAREER_PAGE_CACHE_TAG, CareerPageDataError, persistCareerPageDraft, promoteCareerPageDraft } from '@/lib/careerPageRepository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validate(input) {
  const errors = {};
  if (!UUID.test(input?.id || '')) errors.id = 'A valid Career page version is required.';
  if (!input?.updatedAt || Number.isNaN(Date.parse(input.updatedAt))) errors.updatedAt = 'Refresh before saving.';
  if (input?.sectionKey !== 'career-page') errors.sectionKey = 'Only Career page content is accepted.';
  const content = input?.content;
  if (!content?.header?.mediaId || !content?.philosophy?.mediaId) errors.media = 'Header and culture images are required.';
  if (!Array.isArray(content?.jobs) || content.jobs.length < 1 || content.jobs.length > 30) errors.jobs = 'Add between 1 and 30 vacancies.';
  const ids = new Set();
  for (const [index, job] of (content?.jobs || []).entries()) {
    if (!UUID.test(job.jobId || '') || ids.has(job.jobId)) errors[`jobs.${index}.jobId`] = 'Every vacancy needs a unique stable ID.';
    ids.add(job.jobId);
    for (const key of ['title', 'department', 'location', 'experience', 'description']) if (!job[key]?.trim()) errors[`jobs.${index}.${key}`] = `${key} is required.`;
  }
  return errors;
}

function failure(error) {
  if (isAdminAuthError(error)) return { ok: false, status: error.status, code: error.code, error: error.message };
  if (error instanceof CareerPageDataError) return { ok: false, status: error.status, code: error.code, error: error.status >= 500 ? 'The Career request could not be completed.' : error.message };
  console.error('Unexpected Career action failure:', error);
  return { ok: false, status: 500, code: 'CAREER_PAGE_ACTION_FAILED', error: 'The Career request could not be completed.' };
}

export async function saveCareerPageDraft(input) {
  try {
    await requireAdmin({ allowedRoles: CAREER_ADMIN_ROLES });
    const fieldErrors = validate(input);
    if (Object.keys(fieldErrors).length) return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'Review the Career fields.', fieldErrors };
    return await persistCareerPageDraft(input);
  } catch (error) { return failure(error); }
}

export async function publishCareerPageDraft(input) {
  try {
    await requireAdmin({ allowedRoles: CAREER_ADMIN_ROLES });
    if (!UUID.test(input?.id || '') || !input?.expectedUpdatedAt) return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'A current saved Career draft is required.' };
    const result = await promoteCareerPageDraft(input);
    if (result.ok) { updateTag(CAREER_PAGE_CACHE_TAG); revalidatePath('/career'); revalidatePath('/admin/careers'); }
    return result;
  } catch (error) { return failure(error); }
}

export async function updateCareerApplication(input) {
  try {
    const { user } = await requireAdmin({ allowedRoles: CAREER_HR_ROLES });
    if (!UUID.test(input?.id || '') || !['new', 'reviewing', 'shortlisted', 'interviewed', 'rejected', 'hired'].includes(input?.status)) return { ok: false, status: 422, error: 'Choose a valid application status.' };
    const notes = typeof input.adminNotes === 'string' ? input.adminNotes.trim() : '';
    if (notes.length > 3000) return { ok: false, status: 422, error: 'Notes must be 3,000 characters or fewer.' };
    const admin = createAdminClient();
    const { data: previous, error: previousError } = await admin.from('career_applications').select('*').eq('id', input.id).single();
    if (previousError) throw previousError;
    const { data, error } = await admin.from('career_applications').update({ status: input.status, admin_notes: notes || null }).eq('id', input.id).select('id,status,admin_notes,updated_at').single();
    if (error) throw error;
    await admin.from('audit_logs').insert({ admin_id: user.id, action: 'update_application', table_name: 'career_applications', record_id: input.id, old_values: previous, new_values: data });
    revalidatePath('/admin/careers/applications');
    return { ok: true, data };
  } catch (error) { return failure(error); }
}
