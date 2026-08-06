'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { isAdminAuthError, requireAdmin } from '@/lib/auth/requireAdmin';
import {
  HOME_PARTNERS_CAROUSEL_CACHE_TAG,
  HomePartnersCarouselDataError,
  persistHomePartnersCarouselDraft,
  promoteHomePartnersCarouselDraft,
} from '@/lib/homePartnersCarouselRepository';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ITEM_KEY_PATTERN = /^partner-[a-z0-9-]{1,64}$/;
const ICON_PATTERN = /^fa-[a-z0-9-]{1,60}$/;
const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function isUuid(value) { return typeof value === 'string' && UUID_PATTERN.test(value); }
function validTimestamp(value) { return typeof value === 'string' && !Number.isNaN(Date.parse(value)); }

function validateDraft(input) {
  const fieldErrors = {};
  if (!isObject(input)) return { fieldErrors: { form: 'Partners Carousel content must be an object.' }, value: null };
  if (!isUuid(input.id)) fieldErrors.id = 'A valid source section ID is required.';
  if (!isUuid(input.pageId)) fieldErrors.pageId = 'A valid Home page ID is required.';
  if (input.sectionKey !== 'partners-carousel') fieldErrors.sectionKey = 'Only the Home Partners Carousel can be saved here.';
  if (typeof input.isVisible !== 'boolean') fieldErrors.isVisible = 'Section visibility must be true or false.';
  if (!validTimestamp(input.updatedAt)) fieldErrors.updatedAt = 'A valid expected updated timestamp is required.';
  const heading = text(input.heading);
  if (!heading || heading.length > 120) fieldErrors.heading = 'Heading is required and must be 120 characters or fewer.';
  if (!Array.isArray(input.partners) || input.partners.length < 1 || input.partners.length > 20) fieldErrors.partners = 'Add between 1 and 20 partners.';

  const partners = (Array.isArray(input.partners) ? input.partners : []).map((partner, index) => {
    const prefix = `partners.${index}`;
    const normalized = {
      itemKey: text(partner?.itemKey),
      name: text(partner?.name),
      category: text(partner?.category),
      iconMode: text(partner?.iconMode) || 'fontawesome',
      iconKey: text(partner?.iconKey),
      customIconMediaId: text(partner?.customIconMediaId) || null,
      accentColor: text(partner?.accentColor).toLowerCase(),
      isVisible: partner?.isVisible,
    };
    if (!ITEM_KEY_PATTERN.test(normalized.itemKey)) fieldErrors[`${prefix}.itemKey`] = 'Partner key is invalid.';
    if (!normalized.name || normalized.name.length > 80) fieldErrors[`${prefix}.name`] = 'Name is required and must be 80 characters or fewer.';
    if (!normalized.category || normalized.category.length > 80) fieldErrors[`${prefix}.category`] = 'Category is required and must be 80 characters or fewer.';
    if (!['fontawesome', 'custom'].includes(normalized.iconMode)) fieldErrors[`${prefix}.iconMode`] = 'Select a supported icon source.';
    if (normalized.iconMode === 'fontawesome' && !ICON_PATTERN.test(normalized.iconKey)) fieldErrors[`${prefix}.iconKey`] = 'Use a Font Awesome key such as fa-building.';
    if (normalized.iconMode === 'custom' && !isUuid(normalized.customIconMediaId)) fieldErrors[`${prefix}.customIconMediaId`] = 'Choose a valid uploaded image icon.';
    if (normalized.iconMode !== 'custom') normalized.customIconMediaId = null;
    if (!COLOR_PATTERN.test(normalized.accentColor)) fieldErrors[`${prefix}.accentColor`] = 'Use a six-digit hex colour such as #c5a880.';
    if (typeof normalized.isVisible !== 'boolean') fieldErrors[`${prefix}.isVisible`] = 'Partner visibility must be true or false.';
    return normalized;
  });
  if (new Set(partners.map((partner) => partner.itemKey)).size !== partners.length) fieldErrors.partners = 'Every partner must have a unique key.';
  if (partners.length && !partners.some((partner) => partner.isVisible)) fieldErrors.partners = 'At least one partner must be visible.';
  return { fieldErrors, value: { id: input.id, pageId: input.pageId, sectionKey: 'partners-carousel', heading, isVisible: input.isVisible, updatedAt: input.updatedAt, partners } };
}

function actionError(error) {
  if (isAdminAuthError(error)) return { ok: false, status: error.status, code: error.code, error: error.message };
  if (error instanceof HomePartnersCarouselDataError) {
    console.error('Home Partners Carousel data action failed:', error.code, error.cause?.message || error.message);
    return { ok: false, status: error.status, code: error.code, error: error.status >= 500 ? 'The Home Partners Carousel request could not be completed.' : error.message };
  }
  console.error('Unexpected Home Partners Carousel action failure:', error);
  return { ok: false, status: 500, code: 'HOME_PARTNERS_CAROUSEL_ACTION_FAILED', error: 'The Home Partners Carousel request could not be completed.' };
}

export async function saveHomePartnersCarouselDraft(input) {
  try {
    await requireAdmin();
    const { fieldErrors, value } = validateDraft(input);
    if (Object.keys(fieldErrors).length) return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'Review the highlighted partner fields.', fieldErrors };
    return await persistHomePartnersCarouselDraft(value);
  } catch (error) { return actionError(error); }
}

export async function publishHomePartnersCarouselDraft(input) {
  try {
    await requireAdmin();
    if (!isObject(input) || !isUuid(input.id) || !validTimestamp(input.expectedUpdatedAt)) {
      return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'A valid current Partners Carousel draft is required.' };
    }
    const result = await promoteHomePartnersCarouselDraft({ id: input.id, expectedUpdatedAt: input.expectedUpdatedAt });
    if (result.ok) {
      updateTag(HOME_PARTNERS_CAROUSEL_CACHE_TAG);
      revalidatePath('/');
    }
    return result;
  } catch (error) { return actionError(error); }
}
