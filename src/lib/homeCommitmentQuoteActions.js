'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { isAdminAuthError, requireAdmin } from '@/lib/auth/requireAdmin';
import {
  HOME_COMMITMENT_QUOTE_CACHE_TAG,
  HomeCommitmentQuoteDataError,
  persistHomeCommitmentQuoteDraft,
  promoteHomeCommitmentQuoteDraft,
} from '@/lib/homeCommitmentQuoteRepository';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function validateDraft(input) {
  const fieldErrors = {};
  if (!isObject(input)) return { fieldErrors: { form: 'Commitment Quote content must be an object.' }, value: null };
  if (!isUuid(input.id)) fieldErrors.id = 'A valid source section ID is required.';
  if (!isUuid(input.pageId)) fieldErrors.pageId = 'A valid Home page ID is required.';
  if (input.sectionKey !== 'commitment-quote') fieldErrors.sectionKey = 'Only the Home Commitment Quote can be saved here.';
  if (typeof input.isVisible !== 'boolean') fieldErrors.isVisible = 'Section visibility must be true or false.';
  if (!validTimestamp(input.updatedAt)) fieldErrors.updatedAt = 'A valid expected updated timestamp is required.';

  const value = {
    id: input.id,
    pageId: input.pageId,
    sectionKey: 'commitment-quote',
    isVisible: input.isVisible,
    updatedAt: input.updatedAt,
    quoteText: text(input.quoteText),
    attribution: text(input.attribution),
  };

  if (value.quoteText.length < 1 || value.quoteText.length > 500) fieldErrors.quoteText = 'Quotation must be between 1 and 500 characters.';
  if (value.attribution.length < 1 || value.attribution.length > 180) fieldErrors.attribution = 'Attribution must be between 1 and 180 characters.';
  return { fieldErrors, value };
}

function actionError(error) {
  if (isAdminAuthError(error)) return { ok: false, status: error.status, code: error.code, error: error.message };
  if (error instanceof HomeCommitmentQuoteDataError) {
    console.error('Home Commitment Quote action failed:', error.code, error.cause?.message || error.message);
    return {
      ok: false,
      status: error.status,
      code: error.code,
      error: error.status >= 500 ? 'The Home Commitment Quote request could not be completed.' : error.message,
    };
  }
  console.error('Unexpected Home Commitment Quote action failure:', error);
  return { ok: false, status: 500, code: 'HOME_COMMITMENT_QUOTE_ACTION_FAILED', error: 'The Home Commitment Quote request could not be completed.' };
}

export async function saveHomeCommitmentQuoteDraft(input) {
  try {
    await requireAdmin();
    const { fieldErrors, value } = validateDraft(input);
    if (Object.keys(fieldErrors).length) {
      return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'Review the highlighted Commitment Quote fields.', fieldErrors };
    }
    return await persistHomeCommitmentQuoteDraft(value);
  } catch (error) {
    return actionError(error);
  }
}

export async function publishHomeCommitmentQuoteDraft(input) {
  try {
    await requireAdmin();
    if (!isObject(input) || !isUuid(input.id) || !validTimestamp(input.expectedUpdatedAt)) {
      return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'A valid current Commitment Quote draft is required.' };
    }
    const result = await promoteHomeCommitmentQuoteDraft({ id: input.id, expectedUpdatedAt: input.expectedUpdatedAt });
    if (result.ok) {
      updateTag(HOME_COMMITMENT_QUOTE_CACHE_TAG);
      revalidatePath('/');
    }
    return result;
  } catch (error) {
    return actionError(error);
  }
}
