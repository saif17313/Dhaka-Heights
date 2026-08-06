'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { isAdminAuthError, requireAdmin } from '@/lib/auth/requireAdmin';
import {
  HOME_STATISTICS_CACHE_TAG,
  HomeStatisticsDataError,
  persistHomeStatisticsDraft,
  promoteHomeStatisticsDraft,
} from '@/lib/homeStatisticsRepository';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ITEM_KEY_PATTERN = /^metric-[a-z0-9-]{1,64}$/;
const ICON_PATTERN = /^fa-[a-z0-9-]{1,60}$/;

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

function hasAtMostTwoDecimals(value) {
  return Math.abs(value * 100 - Math.round(value * 100)) < Number.EPSILON * 100;
}

function validateDraft(input) {
  const fieldErrors = {};
  if (!isObject(input)) return { fieldErrors: { form: 'Statistics content must be an object.' }, value: null };

  if (!isUuid(input.id)) fieldErrors.id = 'A valid source section ID is required.';
  if (!isUuid(input.pageId)) fieldErrors.pageId = 'A valid Home page ID is required.';
  if (input.sectionKey !== 'statistics-counter') fieldErrors.sectionKey = 'Only the Home Statistics section can be saved here.';
  if (typeof input.isVisible !== 'boolean') fieldErrors.isVisible = 'Section visibility must be true or false.';
  if (!validTimestamp(input.updatedAt)) fieldErrors.updatedAt = 'A valid expected updated timestamp is required.';
  if (!Array.isArray(input.metrics) || input.metrics.length < 1 || input.metrics.length > 8) {
    fieldErrors.metrics = 'Add between 1 and 8 metrics.';
  }

  const sourceMetrics = Array.isArray(input.metrics) ? input.metrics : [];
  const metrics = sourceMetrics.map((metric, index) => {
    const prefix = `metrics.${index}`;
    const value = Number(metric?.value);
    const normalized = {
      itemKey: text(metric?.itemKey),
      value,
      suffix: text(metric?.suffix),
      label: text(metric?.label),
      supportingText: text(metric?.supportingText),
      iconKey: text(metric?.iconKey),
      isVisible: metric?.isVisible,
    };

    if (!ITEM_KEY_PATTERN.test(normalized.itemKey)) fieldErrors[`${prefix}.itemKey`] = 'Metric key is invalid.';
    if (!Number.isFinite(value) || value < 0 || value > 1000000000 || !hasAtMostTwoDecimals(value)) {
      fieldErrors[`${prefix}.value`] = 'Value must be between 0 and 1,000,000,000 with at most two decimal places.';
    }
    if (normalized.suffix.length > 10) fieldErrors[`${prefix}.suffix`] = 'Suffix must be 10 characters or fewer.';
    if (!normalized.label || normalized.label.length > 80) fieldErrors[`${prefix}.label`] = 'Label is required and must be 80 characters or fewer.';
    if (!normalized.supportingText || normalized.supportingText.length > 160) fieldErrors[`${prefix}.supportingText`] = 'Supporting text is required and must be 160 characters or fewer.';
    if (!ICON_PATTERN.test(normalized.iconKey)) fieldErrors[`${prefix}.iconKey`] = 'Use a Font Awesome key such as fa-building.';
    if (typeof normalized.isVisible !== 'boolean') fieldErrors[`${prefix}.isVisible`] = 'Metric visibility must be true or false.';
    return normalized;
  });

  if (new Set(metrics.map((metric) => metric.itemKey)).size !== metrics.length) {
    fieldErrors.metrics = 'Every metric must have a unique key.';
  }
  if (metrics.length && !metrics.some((metric) => metric.isVisible)) {
    fieldErrors.metrics = 'At least one metric must be visible.';
  }

  return {
    fieldErrors,
    value: {
      id: input.id,
      pageId: input.pageId,
      sectionKey: 'statistics-counter',
      isVisible: input.isVisible,
      updatedAt: input.updatedAt,
      metrics,
    },
  };
}

function actionError(error) {
  if (isAdminAuthError(error)) {
    return { ok: false, status: error.status, code: error.code, error: error.message };
  }
  if (error instanceof HomeStatisticsDataError) {
    console.error('Home Statistics data action failed:', error.code, error.cause?.message || error.message);
    return {
      ok: false,
      status: error.status,
      code: error.code,
      error: error.status >= 500 ? 'The Home Statistics request could not be completed.' : error.message,
    };
  }
  console.error('Unexpected Home Statistics action failure:', error);
  return { ok: false, status: 500, code: 'HOME_STATISTICS_ACTION_FAILED', error: 'The Home Statistics request could not be completed.' };
}

export async function saveHomeStatisticsDraft(input) {
  try {
    await requireAdmin();
    const { fieldErrors, value } = validateDraft(input);
    if (Object.keys(fieldErrors).length) {
      return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'Review the highlighted metric fields.', fieldErrors };
    }
    return await persistHomeStatisticsDraft(value);
  } catch (error) {
    return actionError(error);
  }
}

export async function publishHomeStatisticsDraft(input) {
  try {
    await requireAdmin();
    if (!isObject(input) || !isUuid(input.id) || !validTimestamp(input.expectedUpdatedAt)) {
      return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'A valid current Statistics draft is required.' };
    }
    const result = await promoteHomeStatisticsDraft({ id: input.id, expectedUpdatedAt: input.expectedUpdatedAt });
    if (result.ok) {
      updateTag(HOME_STATISTICS_CACHE_TAG);
      revalidatePath('/');
    }
    return result;
  } catch (error) {
    return actionError(error);
  }
}
