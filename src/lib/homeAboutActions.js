'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { isAdminAuthError, requireAdmin } from '@/lib/auth/requireAdmin';
import {
  HOME_ABOUT_CACHE_TAG,
  HomeAboutDataError,
  persistHomeAboutDraft,
  promoteHomeAboutDraft,
} from '@/lib/homeAboutRepository';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TARGETS = new Set(['_self', '_blank']);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function validTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function validUrl(value) {
  if (/^#[A-Za-z][A-Za-z0-9_-]*$/.test(value)) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function validateLength(errors, key, value, min, max, label) {
  if (value.length < min || value.length > max) {
    errors[key] = `${label} must be between ${min} and ${max} characters.`;
  }
}

function validateImage(errors, key, image) {
  if (!isObject(image) || !isUuid(image.mediaId)) {
    errors[`${key}.mediaId`] = 'Select an existing image.';
  }
  const imageAlt = text(image?.imageAlt);
  validateLength(errors, `${key}.imageAlt`, imageAlt, 1, 180, 'Image alt text');
  return { mediaId: image?.mediaId || null, imageAlt };
}

function validateDraft(input) {
  const fieldErrors = {};
  if (!isObject(input)) return { fieldErrors: { form: 'About content must be an object.' }, value: null };

  if (!isUuid(input.id)) fieldErrors.id = 'A valid source section ID is required.';
  if (!isUuid(input.pageId)) fieldErrors.pageId = 'A valid Home page ID is required.';
  if (input.sectionKey !== 'about-corporate-home') fieldErrors.sectionKey = 'Only the Home About block can be saved here.';
  if (typeof input.isVisible !== 'boolean') fieldErrors.isVisible = 'Section visibility must be true or false.';
  if (!validTimestamp(input.updatedAt)) fieldErrors.updatedAt = 'A valid expected updated timestamp is required.';

  const value = {
    id: input.id,
    pageId: input.pageId,
    sectionKey: 'about-corporate-home',
    isVisible: input.isVisible,
    updatedAt: input.updatedAt,
    tagText: text(input.tagText),
    heading: text(input.heading),
    highlightedHeading: text(input.highlightedHeading),
    leadText: text(input.leadText),
    bodyText: text(input.bodyText),
    primaryCtaLabel: text(input.primaryCtaLabel),
    primaryCtaUrl: text(input.primaryCtaUrl),
    primaryCtaTarget: text(input.primaryCtaTarget) || '_self',
    videoButtonLabel: text(input.videoButtonLabel),
    topImage: validateImage(fieldErrors, 'topImage', input.topImage),
    bottomImage: validateImage(fieldErrors, 'bottomImage', input.bottomImage),
  };

  validateLength(fieldErrors, 'tagText', value.tagText, 1, 100, 'Section tag');
  validateLength(fieldErrors, 'heading', value.heading, 1, 180, 'Heading');
  validateLength(fieldErrors, 'highlightedHeading', value.highlightedHeading, 1, 180, 'Highlighted heading');
  validateLength(fieldErrors, 'leadText', value.leadText, 1, 1000, 'Lead paragraph');
  validateLength(fieldErrors, 'bodyText', value.bodyText, 1, 1000, 'Body paragraph');
  validateLength(fieldErrors, 'primaryCtaLabel', value.primaryCtaLabel, 1, 40, 'Primary CTA label');
  validateLength(fieldErrors, 'videoButtonLabel', value.videoButtonLabel, 1, 40, 'Video button label');
  if (!validUrl(value.primaryCtaUrl)) fieldErrors.primaryCtaUrl = 'Use a #section anchor, internal /path, or https:// URL.';
  if (!TARGETS.has(value.primaryCtaTarget)) fieldErrors.primaryCtaTarget = 'CTA target must be _self or _blank.';

  return { fieldErrors, value };
}

function actionError(error) {
  if (isAdminAuthError(error)) {
    return { ok: false, status: error.status, code: error.code, error: error.message };
  }
  if (error instanceof HomeAboutDataError) {
    console.error('Home About data action failed:', error.code, error.cause?.message || error.message);
    return {
      ok: false,
      status: error.status,
      code: error.code,
      error: error.status >= 500 ? 'The Home About request could not be completed.' : error.message,
    };
  }
  console.error('Unexpected Home About action failure:', error);
  return { ok: false, status: 500, code: 'HOME_ABOUT_ACTION_FAILED', error: 'The Home About request could not be completed.' };
}

export async function saveHomeAboutDraft(input) {
  try {
    await requireAdmin();
    const { fieldErrors, value } = validateDraft(input);
    if (Object.keys(fieldErrors).length) {
      return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'Review the highlighted About fields.', fieldErrors };
    }
    return await persistHomeAboutDraft(value);
  } catch (error) {
    return actionError(error);
  }
}

export async function publishHomeAboutDraft(input) {
  try {
    await requireAdmin();
    if (!isObject(input) || !isUuid(input.id) || !validTimestamp(input.expectedUpdatedAt)) {
      return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'A valid current About draft is required.' };
    }
    const result = await promoteHomeAboutDraft({ id: input.id, expectedUpdatedAt: input.expectedUpdatedAt });
    if (result.ok) {
      updateTag(HOME_ABOUT_CACHE_TAG);
      revalidatePath('/');
    }
    return result;
  } catch (error) {
    return actionError(error);
  }
}
