'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { isAdminAuthError, requireAdmin } from '@/lib/auth/requireAdmin';
import {
  HOME_FEATURED_PROJECTS_CACHE_TAG,
  HomeFeaturedProjectsDataError,
  persistHomeFeaturedProjectsDraft,
  promoteHomeFeaturedProjectsDraft,
} from '@/lib/homeFeaturedProjectsRepository';

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
  if (!isObject(input)) return { fieldErrors: { form: 'Featured Projects content must be an object.' }, value: null };

  if (!isUuid(input.id)) fieldErrors.id = 'A valid source section ID is required.';
  if (!isUuid(input.pageId)) fieldErrors.pageId = 'A valid Home page ID is required.';
  if (input.sectionKey !== 'featured-projects-home') fieldErrors.sectionKey = 'Only the Home Featured Projects section can be saved here.';
  if (typeof input.isVisible !== 'boolean') fieldErrors.isVisible = 'Section visibility must be true or false.';
  if (!validTimestamp(input.updatedAt)) fieldErrors.updatedAt = 'A valid expected updated timestamp is required.';

  const tagText = text(input.tagText);
  const heading = text(input.heading);
  const pageSize = Number(input.pageSize);
  if (!tagText || tagText.length > 80) fieldErrors.tagText = 'Section tag is required and must be 80 characters or fewer.';
  if (!heading || heading.length > 140) fieldErrors.heading = 'Heading is required and must be 140 characters or fewer.';
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 12) fieldErrors.pageSize = 'Page size must be an integer from 1 to 12.';

  if (!Array.isArray(input.projects) || input.projects.length < 1 || input.projects.length > 20) {
    fieldErrors.projects = 'Select between 1 and 20 projects.';
  }
  const sourceProjects = Array.isArray(input.projects) ? input.projects : [];
  const projects = sourceProjects.map((placement, index) => {
    const projectId = placement?.projectId;
    const isVisible = placement?.isVisible;
    if (!isUuid(projectId)) fieldErrors[`projects.${index}.projectId`] = 'Select a valid canonical project.';
    if (typeof isVisible !== 'boolean') fieldErrors[`projects.${index}.isVisible`] = 'Placement visibility must be true or false.';
    return { projectId, isVisible };
  });
  if (new Set(projects.map((placement) => placement.projectId)).size !== projects.length) {
    fieldErrors.projects = 'A project can be selected only once.';
  }
  if (projects.length && !projects.some((placement) => placement.isVisible)) {
    fieldErrors.projects = 'At least one selected project must be visible.';
  }

  return {
    fieldErrors,
    value: {
      id: input.id,
      pageId: input.pageId,
      sectionKey: 'featured-projects-home',
      isVisible: input.isVisible,
      updatedAt: input.updatedAt,
      tagText,
      heading,
      pageSize,
      projects,
    },
  };
}

function actionError(error) {
  if (isAdminAuthError(error)) {
    return { ok: false, status: error.status, code: error.code, error: error.message };
  }
  if (error instanceof HomeFeaturedProjectsDataError) {
    console.error('Home Featured Projects data action failed:', error.code, error.cause?.message || error.message);
    return {
      ok: false,
      status: error.status,
      code: error.code,
      error: error.status >= 500 ? 'The Home Featured Projects request could not be completed.' : error.message,
    };
  }
  console.error('Unexpected Home Featured Projects action failure:', error);
  return { ok: false, status: 500, code: 'HOME_FEATURED_PROJECTS_ACTION_FAILED', error: 'The Home Featured Projects request could not be completed.' };
}

export async function saveHomeFeaturedProjectsDraft(input) {
  try {
    await requireAdmin();
    const { fieldErrors, value } = validateDraft(input);
    if (Object.keys(fieldErrors).length) {
      return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'Review the highlighted Featured Projects fields.', fieldErrors };
    }
    return await persistHomeFeaturedProjectsDraft(value);
  } catch (error) {
    return actionError(error);
  }
}

export async function publishHomeFeaturedProjectsDraft(input) {
  try {
    await requireAdmin();
    if (!isObject(input) || !isUuid(input.id) || !validTimestamp(input.expectedUpdatedAt)) {
      return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'A valid current Featured Projects draft is required.' };
    }
    const result = await promoteHomeFeaturedProjectsDraft({ id: input.id, expectedUpdatedAt: input.expectedUpdatedAt });
    if (result.ok) {
      updateTag(HOME_FEATURED_PROJECTS_CACHE_TAG);
      revalidatePath('/');
    }
    return result;
  } catch (error) {
    return actionError(error);
  }
}
