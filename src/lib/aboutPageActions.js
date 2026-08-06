'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { isAdminAuthError, requireAdmin } from '@/lib/auth/requireAdmin';
import {
  ABOUT_PAGE_CACHE_TAG,
  AboutPageDataError,
  persistAboutPageDraft,
  promoteAboutPageDraft,
} from '@/lib/aboutPageRepository';

const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;

function validate(input) {
  const errors = {};
  if (!input || typeof input !== 'object') return { form: 'About page content is required.' };
  if (!UUID.test(input.id || '')) errors.id = 'A valid About version is required.';
  if (!input.updatedAt || Number.isNaN(Date.parse(input.updatedAt))) {
    errors.updatedAt = 'Refresh before saving.';
  }
  if (input.sectionKey !== 'about-page') errors.sectionKey = 'Only About page content is accepted.';
  if (!input.content || typeof input.content !== 'object') {
    errors.content = 'Structured About content is required.';
  }
  for (const key of ['media', 'pillars', 'concerns', 'accreditations']) {
    if (!Array.isArray(input[key]) || !input[key].length) {
      errors[key] = `${key} must contain visible content.`;
    }
  }
  const categoryKeys = new Set();
  if (!Array.isArray(input.teamCategories) || !input.teamCategories.length) {
    errors.teamCategories = 'At least one team category is required.';
  } else {
    for (const [index, category] of input.teamCategories.entries()) {
      const prefix = `teamCategories.${index}`;
      if (!category?.itemKey || categoryKeys.has(category.itemKey)) {
        errors[`${prefix}.itemKey`] = 'Each team category requires a unique stable key.';
      }
      categoryKeys.add(category?.itemKey);
      if (!String(category?.title || '').trim()) {
        errors[`${prefix}.title`] = 'Category heading is required.';
      }
    }
  }
  if (!Array.isArray(input.teamMembers)) {
    errors.teamMembers = 'Team members must be a list.';
  } else {
    const keys = new Set();
    for (const [index, member] of input.teamMembers.entries()) {
      const prefix = `teamMembers.${index}`;
      if (!member?.itemKey || keys.has(member.itemKey)) {
        errors[`${prefix}.itemKey`] = 'Each team member requires a unique stable key.';
      }
      keys.add(member?.itemKey);
      if (!member?.categoryKey || !categoryKeys.has(member.categoryKey)) {
        errors[`${prefix}.categoryKey`] = 'Select a valid team category.';
      }
      if (!String(member?.name || '').trim()) errors[`${prefix}.name`] = 'Member name is required.';
      if (!String(member?.role || '').trim()) errors[`${prefix}.role`] = 'Designation is required.';
      if (member?.mediaId && !UUID.test(member.mediaId)) {
        errors[`${prefix}.mediaId`] = 'Select a valid portrait from the Media Library.';
      }
      if (member?.isVisible && !member?.mediaId) {
        errors[`${prefix}.mediaId`] = 'A visible team member requires a portrait.';
      }
      if (member?.isVisible && !String(member?.biography || '').trim()) {
        errors[`${prefix}.biography`] = 'A visible team member requires a biography.';
      }
      if (member?.isVisible && !String(member?.imageAlt || '').trim()) {
        errors[`${prefix}.imageAlt`] = 'A visible team member requires portrait alt text.';
      }
    }
  }
  if (!input.content?.teamSection || typeof input.content.teamSection !== 'object') {
    errors.teamSection = 'Team section settings are required.';
  }
  return errors;
}

function failure(error) {
  if (isAdminAuthError(error)) {
    return { ok: false, status: error.status, code: error.code, error: error.message };
  }
  if (error instanceof AboutPageDataError) {
    return {
      ok: false,
      status: error.status,
      code: error.code,
      error: error.status >= 500 ? 'The About page request could not be completed.' : error.message,
    };
  }
  console.error('Unexpected About page action failure:', error);
  return {
    ok: false,
    status: 500,
    code: 'ABOUT_PAGE_ACTION_FAILED',
    error: 'The About page request could not be completed.',
  };
}

export async function saveAboutPageDraft(input) {
  try {
    await requireAdmin();
    const fieldErrors = validate(input);
    if (Object.keys(fieldErrors).length) {
      return {
        ok: false,
        status: 422,
        code: 'VALIDATION_ERROR',
        error: 'Review the About page fields.',
        fieldErrors,
      };
    }
    return await persistAboutPageDraft(input);
  } catch (error) {
    return failure(error);
  }
}

export async function publishAboutPageDraft(input) {
  try {
    await requireAdmin();
    if (!UUID.test(input?.id || '') || !input?.expectedUpdatedAt) {
      return {
        ok: false,
        status: 422,
        code: 'VALIDATION_ERROR',
        error: 'A current saved About draft is required.',
      };
    }
    const result = await promoteAboutPageDraft(input);
    if (result.ok) {
      updateTag(ABOUT_PAGE_CACHE_TAG);
      revalidatePath('/about');
    }
    return result;
  } catch (error) {
    return failure(error);
  }
}
