'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { isAdminAuthError, requireAdmin } from '@/lib/auth/requireAdmin';
import {
  PROJECTS_PAGE_CACHE_TAG,
  ProjectsPageDataError,
  persistProjectsPageDraft,
  promoteProjectsPageDraft,
} from '@/lib/projectsPageRepository';
import { PROJECT_FILTER_GROUPS, PROJECT_FILTER_KEY_PATTERN, normalizeProjectFilterOptions } from '@/lib/projectFilterOptions';
import { extractYouTubeVideoId } from '@/lib/youtube';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validate(input) {
  const errors = {};
  if (!input || typeof input !== 'object') return { form: 'Projects page content is required.' };
  if (!UUID.test(input.id || '')) errors.id = 'A valid Projects page version is required.';
  if (!input.updatedAt || Number.isNaN(Date.parse(input.updatedAt))) errors.updatedAt = 'Refresh before saving.';
  if (input.sectionKey !== 'projects-page') errors.sectionKey = 'Only Projects page content is accepted.';
  if (!input.content || typeof input.content !== 'object') errors.content = 'Structured Projects content is required.';
  const projects = input.content?.projects;
  if (!Array.isArray(projects) || projects.length < 1 || projects.length > 50) errors.projects = 'Add between 1 and 50 projects.';
  if (!input.content?.header?.mediaId) errors.headerMedia = 'Select a Projects page header image.';
  const filterOptions = normalizeProjectFilterOptions(input.content?.listing || {});
  for (const group of PROJECT_FILTER_GROUPS) {
    const options = filterOptions[group.key];
    if (!Array.isArray(options) || options.length < 1 || options.length > 30) {
      errors[`filters.${group.key}`] = `Add between 1 and 30 ${group.title.toLowerCase()} options.`;
      continue;
    }
    const keys = new Set();
    for (const [index, option] of options.entries()) {
      if (!PROJECT_FILTER_KEY_PATTERN.test(option.key || '') || option.key === 'all') errors[`filters.${group.key}.${index}.key`] = 'Use a unique lowercase key.';
      if (!option.label?.trim() || option.label.trim().length > 80) errors[`filters.${group.key}.${index}.label`] = 'A public label of 80 characters or fewer is required.';
      if (keys.has(option.key)) errors[`filters.${group.key}.${index}.key`] = 'Filter keys must be unique.';
      keys.add(option.key);
    }
  }
  const slugs = new Set();
  for (const [index, project] of (projects || []).entries()) {
    if (!UUID.test(project.projectId || '')) errors[`projects.${index}.projectId`] = 'A stable project ID is required.';
    if (!project.name?.trim()) errors[`projects.${index}.name`] = 'Project name is required.';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug || '')) errors[`projects.${index}.slug`] = 'Use a lowercase URL slug.';
    if (slugs.has(project.slug)) errors[`projects.${index}.slug`] = 'Project slugs must be unique.';
    slugs.add(project.slug);
    if (!project.coverMediaId) errors[`projects.${index}.coverMediaId`] = 'Select a cover image.';
    if (!project.coverAlt?.trim()) errors[`projects.${index}.coverAlt`] = 'Cover alt text is required.';
    if (!project.description?.trim()) errors[`projects.${index}.description`] = 'Project description is required.';
    if (project.videoUrl?.trim() && !extractYouTubeVideoId(project.videoUrl.trim())) errors[`projects.${index}.videoUrl`] = 'Enter a valid YouTube video URL.';
    for (const group of PROJECT_FILTER_GROUPS) {
      if (!filterOptions[group.key].some((option) => option.key === project[group.projectField])) {
        errors[`projects.${index}.${group.projectField}`] = `Select a valid ${group.title.toLowerCase()} option.`;
      }
    }
  }
  return errors;
}

function failure(error) {
  if (isAdminAuthError(error)) return { ok: false, status: error.status, code: error.code, error: error.message };
  if (error instanceof ProjectsPageDataError) {
    return {
      ok: false,
      status: error.status,
      code: error.code,
      error: error.status >= 500 ? 'The Projects page request could not be completed.' : error.message,
    };
  }
  console.error('Unexpected Projects page action failure:', error);
  return { ok: false, status: 500, code: 'PROJECTS_PAGE_ACTION_FAILED', error: 'The Projects page request could not be completed.' };
}

export async function saveProjectsPageDraft(input) {
  try {
    await requireAdmin();
    const fieldErrors = validate(input);
    if (Object.keys(fieldErrors).length) {
      return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'Review the Projects page fields.', fieldErrors };
    }
    return await persistProjectsPageDraft(input);
  } catch (error) {
    return failure(error);
  }
}

export async function publishProjectsPageDraft(input) {
  try {
    await requireAdmin();
    if (!UUID.test(input?.id || '') || !input?.expectedUpdatedAt) {
      return { ok: false, status: 422, code: 'VALIDATION_ERROR', error: 'A current saved Projects draft is required.' };
    }
    const result = await promoteProjectsPageDraft(input);
    if (result.ok) {
      updateTag(PROJECTS_PAGE_CACHE_TAG);
      updateTag('home:featured-projects:published');
      revalidatePath('/projects');
      revalidatePath('/project/[id]', 'page');
      revalidatePath('/');
    }
    return result;
  } catch (error) {
    return failure(error);
  }
}
