'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { isAdminAuthError, requireAdmin } from '@/lib/auth/requireAdmin';
import { CONCERNS_PAGE_CACHE_TAG, ConcernsPageDataError, persistConcernsPageDraft, promoteConcernsPageDraft } from '@/lib/concernsPageRepository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validate(input) {
  const errors = {};
  if (!UUID.test(input?.id || '')) errors.id = 'A valid Concerns page version is required.';
  if (!input?.updatedAt || Number.isNaN(Date.parse(input.updatedAt))) errors.updatedAt = 'Refresh before saving.';
  if (input?.sectionKey !== 'concerns-page') errors.sectionKey = 'Only Concerns page content is accepted.';
  const concerns = input?.content?.concerns;
  if (!Array.isArray(concerns) || concerns.length < 1 || concerns.length > 30) errors.concerns = 'Add between 1 and 30 concerns.';
  if (!input?.content?.header?.mediaId) errors.headerMedia = 'Select a page header image.';
  const slugs = new Set();
  for (const [index, concern] of (concerns || []).entries()) {
    if (!UUID.test(concern.concernId || '')) errors[`concerns.${index}.concernId`] = 'A stable concern ID is required.';
    if (!concern.name?.trim()) errors[`concerns.${index}.name`] = 'Concern name is required.';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(concern.slug || '')) errors[`concerns.${index}.slug`] = 'Use a lowercase URL slug.';
    if (slugs.has(concern.slug)) errors[`concerns.${index}.slug`] = 'Concern slugs must be unique.';
    slugs.add(concern.slug);
    if (!concern.overview?.trim()) errors[`concerns.${index}.overview`] = 'Overview is required.';
    if (!concern.coverMediaId) errors[`concerns.${index}.coverMediaId`] = 'Select an overview image.';
    if (!concern.coverAlt?.trim()) errors[`concerns.${index}.coverAlt`] = 'Image alt text is required.';
    if (!Array.isArray(concern.features) || !concern.features.length) errors[`concerns.${index}.features`] = 'Add at least one feature.';
    if (!Array.isArray(concern.services) || !concern.services.length) errors[`concerns.${index}.services`] = 'Add at least one service.';
  }
  return errors;
}
function failure(error) {
  if (isAdminAuthError(error)) return { ok: false, status: error.status, code: error.code, error: error.message };
  if (error instanceof ConcernsPageDataError) return { ok: false, status: error.status, code: error.code, error: error.status >= 500 ? 'The Concerns page request could not be completed.' : error.message };
  console.error('Unexpected Concerns page action failure:', error);
  return { ok: false, status: 500, code: 'CONCERNS_PAGE_ACTION_FAILED', error: 'The Concerns page request could not be completed.' };
}
export async function saveConcernsPageDraft(input) {
  try {
    await requireAdmin();
    const fieldErrors = validate(input);
    if (Object.keys(fieldErrors).length) return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'Review the Concerns page fields.', fieldErrors };
    return await persistConcernsPageDraft(input);
  } catch (error) { return failure(error); }
}
export async function publishConcernsPageDraft(input) {
  try {
    await requireAdmin();
    if (!UUID.test(input?.id || '') || !input?.expectedUpdatedAt) return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'A current saved Concerns draft is required.' };
    const result = await promoteConcernsPageDraft(input);
    if (result.ok) {
      updateTag(CONCERNS_PAGE_CACHE_TAG);
      updateTag('page:about:published');
      updateTag('site:shell:published');
      revalidatePath('/concern/[slug]', 'page');
      revalidatePath('/about');
      revalidatePath('/');
    }
    return result;
  } catch (error) { return failure(error); }
}
