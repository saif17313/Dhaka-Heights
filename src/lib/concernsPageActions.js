'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { isAdminAuthError, requireAdmin } from '@/lib/auth/requireAdmin';
import { CONCERNS_PAGE_CACHE_TAG, ConcernsPageDataError, persistConcernsPageDraft, promoteConcernsPageDraft } from '@/lib/concernsPageRepository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ICON = /^fa-[a-z0-9-]+$/;

function validate(input) {
  const errors = {};
  if (!UUID.test(input?.id || '')) errors.id = 'A valid Concerns page version is required.';
  if (!input?.updatedAt || Number.isNaN(Date.parse(input.updatedAt))) errors.updatedAt = 'Refresh before saving.';
  if (input?.sectionKey !== 'concerns-page') errors.sectionKey = 'Only Concerns page content is accepted.';
  const concerns = input?.content?.concerns;
  if (!Array.isArray(concerns) || concerns.length < 1 || concerns.length > 30) errors.concerns = 'Add between 1 and 30 concerns.';
  if (!input?.content?.header?.mediaId) errors.headerMedia = 'Select a page header image.';

  const slugCounts = new Map();
  for (const concern of concerns || []) {
    if (concern?.slug) slugCounts.set(concern.slug, (slugCounts.get(concern.slug) || 0) + 1);
  }
  const projectOwnerIndex = new Map();

  for (const [index, concern] of (concerns || []).entries()) {
    const prefix = `concerns.${index}`;
    if (!UUID.test(concern.concernId || '')) errors[`${prefix}.concernId`] = 'A stable concern ID is required.';

    if (!concern.name?.trim()) errors[`${prefix}.name`] = 'Concern name is required.';
    else if (concern.name.trim().length > 140) errors[`${prefix}.name`] = 'Concern name must be 140 characters or fewer.';

    if (!SLUG.test(concern.slug || '')) errors[`${prefix}.slug`] = 'Use a lowercase URL slug (letters, numbers, hyphens).';
    else if ((slugCounts.get(concern.slug) || 0) > 1) errors[`${prefix}.slug`] = 'Concern slugs must be unique.';

    if (!concern.subtitle?.trim()) errors[`${prefix}.subtitle`] = 'Subtitle is required.';
    else if (concern.subtitle.trim().length > 220) errors[`${prefix}.subtitle`] = 'Subtitle must be 220 characters or fewer.';

    if (!concern.overview?.trim()) errors[`${prefix}.overview`] = 'Overview is required.';
    else if (concern.overview.trim().length > 2000) errors[`${prefix}.overview`] = 'Overview must be 2000 characters or fewer.';

    if (!concern.coverMediaId) errors[`${prefix}.coverMediaId`] = 'Select an overview image.';
    if (!concern.coverAlt?.trim()) errors[`${prefix}.coverAlt`] = 'Image alt text is required.';
    else if (concern.coverAlt.trim().length > 180) errors[`${prefix}.coverAlt`] = 'Image alt text must be 180 characters or fewer.';

    if (!Array.isArray(concern.features) || !concern.features.length) errors[`${prefix}.features`] = 'Add at least one capability item.';
    else if (concern.features.length > 12) errors[`${prefix}.features`] = 'Add at most 12 capability items.';
    else {
      concern.features.forEach((feature, featureIndex) => {
        if (!String(feature || '').trim()) errors[`${prefix}.features.${featureIndex}`] = 'This item cannot be empty.';
      });
    }

    if (!Array.isArray(concern.services) || !concern.services.length) errors[`${prefix}.services`] = 'Add at least one service.';
    else if (concern.services.length > 12) errors[`${prefix}.services`] = 'Add at most 12 services.';
    else {
      concern.services.forEach((service, serviceIndex) => {
        const servicePrefix = `${prefix}.services.${serviceIndex}`;
        if (!service?.title?.trim()) errors[`${servicePrefix}.title`] = 'Service title is required.';
        if (!service?.description?.trim()) errors[`${servicePrefix}.description`] = 'Service description is required.';
        if (!ICON.test(service?.icon || '')) errors[`${servicePrefix}.icon`] = 'Use a Font Awesome class, e.g. fa-building.';
      });
    }

    for (const placement of concern.relatedProjects || []) {
      if (!placement?.projectId) continue;
      const owner = projectOwnerIndex.get(placement.projectId);
      if (owner !== undefined && owner !== index) {
        errors[`${prefix}.relatedProjects`] = 'A project can only be featured under one concern at a time.';
      }
      projectOwnerIndex.set(placement.projectId, index);
    }
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
