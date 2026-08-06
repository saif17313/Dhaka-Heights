'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { isAdminAuthError, requireAdmin } from '@/lib/auth/requireAdmin';
import {
  HOME_MEDIA_HIGHLIGHTS_CACHE_TAG,
  HomeMediaHighlightsDataError,
  persistHomeMediaHighlightsDraft,
  promoteHomeMediaHighlightsDraft,
} from '@/lib/homeMediaHighlightsRepository';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value) => typeof value === 'string' ? value.trim() : '';
const optionalText = (value) => text(value) || null;
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isUuid = (value) => typeof value === 'string' && UUID_PATTERN.test(value);
const validTimestamp = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));
function validUrl(value) {
  if (/^#[A-Za-z][A-Za-z0-9_-]*$/.test(value)) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function validateDraft(input) {
  const fieldErrors = {};
  if (!isObject(input)) return { fieldErrors: { form: 'Media Highlights content must be an object.' }, value: null };
  if (!isUuid(input.id)) fieldErrors.id = 'A valid source section ID is required.';
  if (!isUuid(input.pageId)) fieldErrors.pageId = 'A valid Home page ID is required.';
  if (input.sectionKey !== 'media-highlights-home') fieldErrors.sectionKey = 'Only Home Media Highlights can be saved here.';
  if (typeof input.isVisible !== 'boolean') fieldErrors.isVisible = 'Section visibility must be true or false.';
  if (!validTimestamp(input.updatedAt)) fieldErrors.updatedAt = 'A valid expected updated timestamp is required.';

  const tagText = text(input.tagText);
  const heading = text(input.heading);
  const viewAllLabel = text(input.viewAllLabel);
  const viewAllUrl = text(input.viewAllUrl);
  if (!tagText || tagText.length > 80) fieldErrors.tagText = 'Section tag is required and must be 80 characters or fewer.';
  if (!heading || heading.length > 140) fieldErrors.heading = 'Heading is required and must be 140 characters or fewer.';
  if (!viewAllLabel || viewAllLabel.length > 40) fieldErrors.viewAllLabel = 'View All label is required and must be 40 characters or fewer.';
  if (!validUrl(viewAllUrl)) fieldErrors.viewAllUrl = 'Use a #section anchor, internal /path, or https:// URL.';

  if (!Array.isArray(input.articles) || input.articles.length < 1 || input.articles.length > 12) fieldErrors.articles = 'Select between 1 and 12 media posts.';
  const articles = (Array.isArray(input.articles) ? input.articles : []).map((placement, index) => {
    const value = {
      mediaPostId: placement?.mediaPostId,
      isVisible: placement?.isVisible,
      overrideTitle: optionalText(placement?.overrideTitle),
      overrideDescription: optionalText(placement?.overrideDescription),
      overrideCategory: optionalText(placement?.overrideCategory),
      overrideCoverMediaId: optionalText(placement?.overrideCoverMediaId),
      overrideCtaLabel: optionalText(placement?.overrideCtaLabel),
      overrideCtaUrl: optionalText(placement?.overrideCtaUrl),
    };
    if (!isUuid(value.mediaPostId)) fieldErrors[`articles.${index}.mediaPostId`] = 'Select a valid canonical media post.';
    if (typeof value.isVisible !== 'boolean') fieldErrors[`articles.${index}.isVisible`] = 'Placement visibility must be true or false.';
    if (value.overrideTitle && value.overrideTitle.length > 220) fieldErrors[`articles.${index}.overrideTitle`] = 'Title override must be 220 characters or fewer.';
    if (value.overrideDescription && value.overrideDescription.length > 1000) fieldErrors[`articles.${index}.overrideDescription`] = 'Description override must be 1000 characters or fewer.';
    if (value.overrideCategory && value.overrideCategory.length > 80) fieldErrors[`articles.${index}.overrideCategory`] = 'Category override must be 80 characters or fewer.';
    if (value.overrideCoverMediaId && !isUuid(value.overrideCoverMediaId)) fieldErrors[`articles.${index}.overrideCoverMediaId`] = 'Cover override must reference a valid media asset.';
    if (value.overrideCtaLabel && value.overrideCtaLabel.length > 40) fieldErrors[`articles.${index}.overrideCtaLabel`] = 'CTA label override must be 40 characters or fewer.';
    if (value.overrideCtaUrl && !validUrl(value.overrideCtaUrl)) fieldErrors[`articles.${index}.overrideCtaUrl`] = 'CTA URL override is invalid.';
    return value;
  });
  if (new Set(articles.map((article) => article.mediaPostId)).size !== articles.length) fieldErrors.articles = 'A media post can be selected only once.';
  if (articles.length && !articles.some((article) => article.isVisible)) fieldErrors.articles = 'At least one selected media post must be visible.';

  return { fieldErrors, value: { id: input.id, pageId: input.pageId, sectionKey: 'media-highlights-home', isVisible: input.isVisible, updatedAt: input.updatedAt, tagText, heading, viewAllLabel, viewAllUrl, articles } };
}

function actionError(error) {
  if (isAdminAuthError(error)) return { ok: false, status: error.status, code: error.code, error: error.message };
  if (error instanceof HomeMediaHighlightsDataError) {
    console.error('Home Media Highlights action failed:', error.code, error.cause?.message || error.message);
    return { ok: false, status: error.status, code: error.code, error: error.status >= 500 ? 'The Home Media Highlights request could not be completed.' : error.message };
  }
  console.error('Unexpected Home Media Highlights action failure:', error);
  return { ok: false, status: 500, code: 'HOME_MEDIA_HIGHLIGHTS_ACTION_FAILED', error: 'The Home Media Highlights request could not be completed.' };
}

export async function saveHomeMediaHighlightsDraft(input) {
  try {
    await requireAdmin();
    const { fieldErrors, value } = validateDraft(input);
    if (Object.keys(fieldErrors).length) return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'Review the highlighted Media Highlights fields.', fieldErrors };
    return await persistHomeMediaHighlightsDraft(value);
  } catch (error) { return actionError(error); }
}

export async function publishHomeMediaHighlightsDraft(input) {
  try {
    await requireAdmin();
    if (!isObject(input) || !isUuid(input.id) || !validTimestamp(input.expectedUpdatedAt)) return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'A valid current Media Highlights draft is required.' };
    const result = await promoteHomeMediaHighlightsDraft({ id: input.id, expectedUpdatedAt: input.expectedUpdatedAt });
    if (result.ok) { updateTag(HOME_MEDIA_HIGHLIGHTS_CACHE_TAG); revalidatePath('/'); }
    return result;
  } catch (error) { return actionError(error); }
}
