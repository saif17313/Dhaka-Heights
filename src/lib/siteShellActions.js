'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { isAdminAuthError, requireAdmin } from '@/lib/auth/requireAdmin';
import { SITE_SHELL_CACHE_TAG, SiteShellDataError, persistSiteShellDraft, promoteSiteShellDraft } from '@/lib/siteShellRepository';

const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
function isObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function validate(input) {
  const errors = {};
  if (!isObject(input)) return { form: 'Site Shell content is required.' };
  if (!UUID.test(input.id || '')) errors.id = 'A valid Site Shell source is required.';
  if (!input.updatedAt || Number.isNaN(Date.parse(input.updatedAt))) errors.updatedAt = 'Refresh this editor before saving.';
  for (const key of ['brand', 'metadata', 'preloader', 'mobileDrawer', 'quickInquiry', 'footer']) if (!isObject(input[key])) errors[key] = `${key} settings are required.`;
  for (const key of ['navigation', 'footerGroups', 'socialLinks']) if (!Array.isArray(input[key]) || !input[key].length) errors[key] = `${key} must contain at least one item.`;
  if (!input.brand?.logoMediaId || !input.brand?.faviconMediaId || !input.metadata?.ogImageMediaId) errors.media = 'Logo, favicon, and social sharing image are required.';
  if (!/^https:\/\//.test(input.metadata?.canonicalUrl || '')) errors.canonicalUrl = 'Canonical URL must start with https://.';
  const duration = Number(input.preloader?.durationMs);
  if (!Number.isInteger(duration) || duration < 500 || duration > 5000) errors.durationMs = 'Preloader duration must be 500–5000 ms.';
  return errors;
}
function actionError(error) {
  if (isAdminAuthError(error)) return { ok: false, status: error.status, code: error.code, error: error.message };
  if (error instanceof SiteShellDataError) return { ok: false, status: error.status, code: error.code, error: error.status >= 500 ? 'The Site Shell request could not be completed.' : error.message };
  console.error('Unexpected Site Shell action failure:', error);
  return { ok: false, status: 500, code: 'SITE_SHELL_ACTION_FAILED', error: 'The Site Shell request could not be completed.' };
}
export async function saveSiteShellDraft(input) {
  try {
    await requireAdmin();
    const fieldErrors = validate(input);
    if (Object.keys(fieldErrors).length) return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'Review the highlighted Site Shell fields.', fieldErrors };
    return await persistSiteShellDraft(input);
  } catch (error) { return actionError(error); }
}
export async function publishSiteShellDraft(input) {
  try {
    await requireAdmin();
    if (!UUID.test(input?.id || '') || !input?.expectedUpdatedAt) return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'A current saved draft is required.' };
    const result = await promoteSiteShellDraft(input);
    if (result.ok) { updateTag(SITE_SHELL_CACHE_TAG); revalidatePath('/', 'layout'); }
    return result;
  } catch (error) { return actionError(error); }
}
