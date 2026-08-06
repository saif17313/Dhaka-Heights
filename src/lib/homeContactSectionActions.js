'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { isAdminAuthError, requireAdmin } from '@/lib/auth/requireAdmin';
import {
  HOME_CONTACT_CACHE_TAG,
  HomeContactSectionDataError,
  persistHomeContactSectionDraft,
  promoteHomeContactSectionDraft,
} from '@/lib/homeContactSectionRepository';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DETAIL_KEY_PATTERN = /^detail-[a-z0-9-]{1,64}$/;
const OPTION_KEY_PATTERN = /^option-[a-z0-9-]{1,64}$/;
const ICON_PATTERN = /^fa-[a-z0-9-]{1,60}$/;
const VALUE_PATTERN = /^[a-zA-Z0-9_-]{1,60}$/;
const COPY_LIMITS = {
  formHeading: 120, formDescription: 500, nameLabel: 80, emailLabel: 80,
  phoneLabel: 80, sizeLabel: 80, messageLabel: 120, nameError: 180,
  emailError: 180, phoneError: 180, sizeError: 180, submitLabel: 60,
  submittingLabel: 60, successTitle: 120, successBody: 500, closeLabel: 40,
  mapLakeLabel: 80, mapRoadLabel: 80, mapTooltip: 180,
};

function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function isUuid(value) { return typeof value === 'string' && UUID_PATTERN.test(value); }
function validTimestamp(value) { return typeof value === 'string' && !Number.isNaN(Date.parse(value)); }

function validateDraft(input) {
  const fieldErrors = {};
  if (!isObject(input)) return { fieldErrors: { form: 'Contact Section content must be an object.' }, value: null };
  if (!isUuid(input.id)) fieldErrors.id = 'A valid source section ID is required.';
  if (!isUuid(input.pageId)) fieldErrors.pageId = 'A valid Home page ID is required.';
  if (input.sectionKey !== 'contact-section-home') fieldErrors.sectionKey = 'Only the Home Contact Section can be saved here.';
  if (typeof input.isVisible !== 'boolean') fieldErrors.isVisible = 'Section visibility must be true or false.';
  if (!validTimestamp(input.updatedAt)) fieldErrors.updatedAt = 'A valid expected updated timestamp is required.';
  const tagText = text(input.tagText);
  const heading = text(input.heading);
  const description = text(input.description);
  if (!tagText || tagText.length > 80) fieldErrors.tagText = 'Tag is required and must be 80 characters or fewer.';
  if (!heading || heading.length > 140) fieldErrors.heading = 'Heading is required and must be 140 characters or fewer.';
  if (!description || description.length > 500) fieldErrors.description = 'Description is required and must be 500 characters or fewer.';

  const copy = {};
  if (!isObject(input.copy)) fieldErrors.copy = 'Form and map copy is required.';
  for (const [key, limit] of Object.entries(COPY_LIMITS)) {
    copy[key] = text(input.copy?.[key]);
    if (!copy[key] || copy[key].length > limit) fieldErrors[`copy.${key}`] = `Required; use ${limit} characters or fewer.`;
  }

  if (!Array.isArray(input.details) || input.details.length < 1 || input.details.length > 6) fieldErrors.details = 'Add between 1 and 6 contact details.';
  const details = (Array.isArray(input.details) ? input.details : []).map((detail, index) => {
    const prefix = `details.${index}`;
    const value = { itemKey: text(detail?.itemKey), label: text(detail?.label), value: text(detail?.value), iconKey: text(detail?.iconKey), isVisible: detail?.isVisible };
    if (!DETAIL_KEY_PATTERN.test(value.itemKey)) fieldErrors[`${prefix}.itemKey`] = 'Detail key is invalid.';
    if (!value.label || value.label.length > 100) fieldErrors[`${prefix}.label`] = 'Label is required and must be 100 characters or fewer.';
    if (!value.value || value.value.length > 250) fieldErrors[`${prefix}.value`] = 'Value is required and must be 250 characters or fewer.';
    if (!ICON_PATTERN.test(value.iconKey)) fieldErrors[`${prefix}.iconKey`] = 'Use a Font Awesome key such as fa-envelope.';
    if (typeof value.isVisible !== 'boolean') fieldErrors[`${prefix}.isVisible`] = 'Visibility must be true or false.';
    return value;
  });
  if (new Set(details.map((item) => item.itemKey)).size !== details.length) fieldErrors.details = 'Every contact detail must have a unique key.';
  if (details.length && !details.some((item) => item.isVisible)) fieldErrors.details = 'At least one contact detail must be visible.';

  if (!Array.isArray(input.spaceOptions) || input.spaceOptions.length < 1 || input.spaceOptions.length > 10) fieldErrors.spaceOptions = 'Add between 1 and 10 space options.';
  const spaceOptions = (Array.isArray(input.spaceOptions) ? input.spaceOptions : []).map((option, index) => {
    const prefix = `spaceOptions.${index}`;
    const value = { itemKey: text(option?.itemKey), label: text(option?.label), value: text(option?.value), isVisible: option?.isVisible };
    if (!OPTION_KEY_PATTERN.test(value.itemKey)) fieldErrors[`${prefix}.itemKey`] = 'Option key is invalid.';
    if (!value.label || value.label.length > 100) fieldErrors[`${prefix}.label`] = 'Label is required and must be 100 characters or fewer.';
    if (!VALUE_PATTERN.test(value.value)) fieldErrors[`${prefix}.value`] = 'Use 1–60 letters, numbers, underscores, or hyphens.';
    if (typeof value.isVisible !== 'boolean') fieldErrors[`${prefix}.isVisible`] = 'Visibility must be true or false.';
    return value;
  });
  if (new Set(spaceOptions.map((item) => item.itemKey)).size !== spaceOptions.length || new Set(spaceOptions.map((item) => item.value)).size !== spaceOptions.length) fieldErrors.spaceOptions = 'Every space option must have a unique key and value.';
  if (spaceOptions.length && !spaceOptions.some((item) => item.isVisible)) fieldErrors.spaceOptions = 'At least one space option must be visible.';

  return { fieldErrors, value: { id: input.id, pageId: input.pageId, sectionKey: 'contact-section-home', tagText, heading, description, isVisible: input.isVisible, copy, details, spaceOptions, updatedAt: input.updatedAt } };
}

function actionError(error) {
  if (isAdminAuthError(error)) return { ok: false, status: error.status, code: error.code, error: error.message };
  if (error instanceof HomeContactSectionDataError) {
    console.error('Home Contact Section data action failed:', error.code, error.cause?.message || error.message);
    return { ok: false, status: error.status, code: error.code, error: error.status >= 500 ? 'The Home Contact Section request could not be completed.' : error.message };
  }
  console.error('Unexpected Home Contact Section action failure:', error);
  return { ok: false, status: 500, code: 'HOME_CONTACT_SECTION_ACTION_FAILED', error: 'The Home Contact Section request could not be completed.' };
}

export async function saveHomeContactSectionDraft(input) {
  try {
    await requireAdmin();
    const { fieldErrors, value } = validateDraft(input);
    if (Object.keys(fieldErrors).length) return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'Review the highlighted Contact Section fields.', fieldErrors };
    return await persistHomeContactSectionDraft(value);
  } catch (error) { return actionError(error); }
}

export async function publishHomeContactSectionDraft(input) {
  try {
    await requireAdmin();
    if (!isObject(input) || !isUuid(input.id) || !validTimestamp(input.expectedUpdatedAt)) return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'A valid current Contact Section draft is required.' };
    const result = await promoteHomeContactSectionDraft({ id: input.id, expectedUpdatedAt: input.expectedUpdatedAt });
    if (result.ok) { updateTag(HOME_CONTACT_CACHE_TAG); revalidatePath('/'); }
    return result;
  } catch (error) { return actionError(error); }
}
