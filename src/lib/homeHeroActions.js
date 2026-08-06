'use server';

import { revalidatePath, updateTag } from 'next/cache';
import {
  isAdminAuthError,
  requireAdmin,
} from '@/lib/auth/requireAdmin';
import {
  HOME_HERO_CACHE_TAG,
  HomeHeroDataError,
  persistHomeHeroDraft,
  promoteHomeHeroDraft,
} from '@/lib/homeHeroRepository';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ANCHOR_PATTERN = /^#[A-Za-z][A-Za-z0-9_-]*$/;
const TARGETS = new Set(['_self', '_blank']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function validTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function validCtaUrl(value) {
  if (!value) return true;
  if (ANCHOR_PATTERN.test(value)) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function addLengthError(errors, key, value, min, max, label) {
  if (value.length < min || value.length > max) {
    errors[key] = `${label} must be between ${min} and ${max} characters.`;
  }
}

function validateCta(errors, prefix, label, url, target) {
  if (label.length > 40) {
    errors[`${prefix}Label`] = 'CTA label must be 40 characters or fewer.';
  }

  if (Boolean(label) !== Boolean(url)) {
    errors[`${prefix}${label ? 'Url' : 'Label'}`] = 'CTA label and URL must be provided together.';
  }

  if (url && !validCtaUrl(url)) {
    errors[`${prefix}Url`] = 'Use a #section anchor, an internal /path, or an https:// URL.';
  }

  if (!TARGETS.has(target)) {
    errors[`${prefix}Target`] = 'CTA target must be _self or _blank.';
  }
}

function validateDraft(input) {
  const fieldErrors = {};

  if (!isPlainObject(input)) {
    return {
      fieldErrors: { form: 'Hero content must be an object.' },
      value: null,
    };
  }

  if (!isUuid(input.id)) fieldErrors.id = 'A valid source section ID is required.';
  if (!isUuid(input.pageId)) fieldErrors.pageId = 'A valid Home page ID is required.';
  if (input.sectionKey !== 'hero-slider') {
    fieldErrors.sectionKey = 'Only the hero-slider section can be saved here.';
  }
  if (typeof input.isVisible !== 'boolean') {
    fieldErrors.isVisible = 'Section visibility must be true or false.';
  }
  if (!Number.isInteger(input.autoplayMs) || input.autoplayMs < 3000 || input.autoplayMs > 15000) {
    fieldErrors.autoplayMs = 'Autoplay must be an integer between 3000 and 15000 milliseconds.';
  }
  if (!validTimestamp(input.updatedAt)) {
    fieldErrors.updatedAt = 'A valid expected updated timestamp is required.';
  }

  if (!Array.isArray(input.slides) || input.slides.length < 1 || input.slides.length > 10) {
    fieldErrors.slides = 'Hero must contain between 1 and 10 slides.';
  }

  const slides = Array.isArray(input.slides)
    ? input.slides.slice(0, 10).map((source, index) => {
        const prefix = `slides.${index}.`;
        const slide = isPlainObject(source) ? source : {};
        if (!isPlainObject(source)) fieldErrors[`${prefix}form`] = 'Slide must be an object.';

        const eyebrow = text(slide.eyebrow);
        const title = text(slide.title);
        const description = text(slide.description);
        const primaryCtaLabel = text(slide.primaryCtaLabel);
        const primaryCtaUrl = text(slide.primaryCtaUrl);
        const primaryCtaTarget = text(slide.primaryCtaTarget) || '_self';
        const secondaryCtaLabel = text(slide.secondaryCtaLabel);
        const secondaryCtaUrl = text(slide.secondaryCtaUrl);
        const secondaryCtaTarget = text(slide.secondaryCtaTarget) || '_self';
        const imageAlt = text(slide.imageAlt);

        if (slide.id !== null && slide.id !== undefined && !isUuid(slide.id)) {
          fieldErrors[`${prefix}id`] = 'Slide ID must be a UUID or null.';
        }
        addLengthError(fieldErrors, `${prefix}eyebrow`, eyebrow, 1, 80, 'Eyebrow');
        addLengthError(fieldErrors, `${prefix}title`, title, 1, 140, 'Title');
        addLengthError(fieldErrors, `${prefix}description`, description, 1, 500, 'Description');
        addLengthError(fieldErrors, `${prefix}imageAlt`, imageAlt, 1, 180, 'Image alt text');
        validateCta(
          fieldErrors,
          `${prefix}primaryCta`,
          primaryCtaLabel,
          primaryCtaUrl,
          primaryCtaTarget
        );
        validateCta(
          fieldErrors,
          `${prefix}secondaryCta`,
          secondaryCtaLabel,
          secondaryCtaUrl,
          secondaryCtaTarget
        );

        if (!isUuid(slide.desktopMediaId)) {
          fieldErrors[`${prefix}desktopMediaId`] = 'Select an existing desktop image.';
        }
        if (slide.mobileMediaId && !isUuid(slide.mobileMediaId)) {
          fieldErrors[`${prefix}mobileMediaId`] = 'Mobile media must be a valid image ID or empty.';
        }
        if (typeof slide.isVisible !== 'boolean') {
          fieldErrors[`${prefix}isVisible`] = 'Slide visibility must be true or false.';
        }

        return {
          id: isUuid(slide.id) ? slide.id : null,
          eyebrow,
          title,
          description,
          primaryCtaLabel,
          primaryCtaUrl,
          primaryCtaTarget,
          secondaryCtaLabel,
          secondaryCtaUrl,
          secondaryCtaTarget,
          desktopMediaId: slide.desktopMediaId || null,
          mobileMediaId: slide.mobileMediaId || null,
          imageAlt,
          sortOrder: (index + 1) * 10,
          isVisible: slide.isVisible,
        };
      })
    : [];

  if (slides.length > 0 && !slides.some((slide) => slide.isVisible === true)) {
    fieldErrors.slides = 'At least one slide must be visible.';
  }

  return {
    fieldErrors,
    value: {
      id: input.id,
      pageId: input.pageId,
      sectionKey: 'hero-slider',
      isVisible: input.isVisible,
      autoplayMs: input.autoplayMs,
      updatedAt: input.updatedAt,
      slides,
    },
  };
}

function validatePublish(input) {
  const fieldErrors = {};
  if (!isPlainObject(input)) {
    return { fieldErrors: { form: 'Publish input must be an object.' }, value: null };
  }

  if (!isUuid(input.id)) fieldErrors.id = 'A valid draft ID is required.';
  if (!validTimestamp(input.expectedUpdatedAt)) {
    fieldErrors.expectedUpdatedAt = 'A valid expected updated timestamp is required.';
  }

  return {
    fieldErrors,
    value: { id: input.id, expectedUpdatedAt: input.expectedUpdatedAt },
  };
}

function actionError(error) {
  if (isAdminAuthError(error)) {
    return {
      ok: false,
      status: error.status,
      code: error.code,
      error: error.message,
    };
  }

  if (error instanceof HomeHeroDataError) {
    console.error('Home Hero data action failed:', error.code, error.cause?.message || error.message);
    return {
      ok: false,
      status: error.status,
      code: error.code,
      error: error.status >= 500
        ? 'The Home Hero request could not be completed.'
        : error.message,
    };
  }

  console.error('Unexpected Home Hero action failure:', error);
  return {
    ok: false,
    status: 500,
    code: 'HOME_HERO_ACTION_FAILED',
    error: 'The Home Hero request could not be completed.',
  };
}

export async function saveHomeHeroDraft(input) {
  try {
    await requireAdmin();
    const { fieldErrors, value } = validateDraft(input);

    if (Object.keys(fieldErrors).length > 0) {
      return {
        ok: false,
        status: 422,
        code: 'VALIDATION_ERROR',
        error: 'Review the highlighted Hero fields.',
        fieldErrors,
      };
    }

    return await persistHomeHeroDraft(value);
  } catch (error) {
    return actionError(error);
  }
}

export async function publishHomeHeroDraft(input) {
  try {
    await requireAdmin();
    const { fieldErrors, value } = validatePublish(input);

    if (Object.keys(fieldErrors).length > 0) {
      return {
        ok: false,
        status: 422,
        code: 'VALIDATION_ERROR',
        error: 'A valid current Hero draft is required.',
        fieldErrors,
      };
    }

    const result = await promoteHomeHeroDraft(value);
    if (result.ok) {
      updateTag(HOME_HERO_CACHE_TAG);
      revalidatePath('/');
    }

    return result;
  } catch (error) {
    return actionError(error);
  }
}
