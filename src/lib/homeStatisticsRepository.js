import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

export const HOME_STATISTICS_SECTION_KEY = 'statistics-counter';
export const HOME_STATISTICS_CACHE_TAG = 'home:statistics:published';

export class HomeStatisticsDataError extends Error {
  constructor(message, { status = 500, code = 'HOME_STATISTICS_DATA_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = 'HomeStatisticsDataError';
    this.status = status;
    this.code = code;
  }
}

function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new HomeStatisticsDataError('Public Supabase configuration is missing.', {
      status: 503,
      code: 'PUBLIC_SUPABASE_NOT_CONFIGURED',
    });
  }

  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

function queryError(error, message, code = 'HOME_STATISTICS_QUERY_FAILED') {
  if (!error) return;
  throw new HomeStatisticsDataError(message, { status: 500, code, cause: error });
}

function normalizeMetric(metric, index = 0) {
  return {
    itemId: metric.itemId ?? metric.id ?? null,
    itemKey: metric.itemKey ?? metric.item_key ?? `metric-${index + 1}`,
    value: Number(metric.value ?? metric.numeric_value ?? 0),
    suffix: metric.suffix ?? metric.value_suffix ?? '',
    label: metric.label ?? metric.title ?? '',
    supportingText: metric.supportingText ?? metric.body_text ?? '',
    iconKey: metric.iconKey ?? metric.icon_key ?? '',
    sortOrder: Number(metric.sortOrder ?? metric.sort_order ?? (index + 1) * 10),
    isVisible: metric.isVisible ?? metric.is_visible ?? true,
  };
}

function normalizeSnapshot(snapshot) {
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    pageId: snapshot.pageId ?? snapshot.page_id,
    sectionKey: snapshot.sectionKey ?? snapshot.section_key ?? HOME_STATISTICS_SECTION_KEY,
    status: snapshot.status,
    versionNumber: Number(snapshot.versionNumber ?? snapshot.version_number ?? 1),
    isVisible: snapshot.isVisible ?? snapshot.is_visible ?? true,
    updatedAt: snapshot.updatedAt ?? snapshot.updated_at ?? null,
    updatedBy: snapshot.updatedBy ?? snapshot.updated_by ?? null,
    publishedAt: snapshot.publishedAt ?? snapshot.published_at ?? null,
    publishedBy: snapshot.publishedBy ?? snapshot.published_by ?? null,
    metrics: (snapshot.metrics || []).map(normalizeMetric).sort((a, b) => a.sortOrder - b.sortOrder),
    history: (snapshot.history || []).map((revision) => ({
      id: revision.id,
      revisionNumber: Number(revision.revisionNumber ?? revision.version_number ?? 0),
      summary: revision.summary ?? revision.change_summary ?? 'Saved Home Statistics revision',
      createdAt: revision.createdAt ?? revision.created_at ?? null,
      createdBy: revision.createdBy ?? revision.created_by ?? null,
    })),
  };
}

async function loadRevisionHistory(supabase, sectionId) {
  const { data, error } = await supabase
    .from('content_revisions')
    .select('id, version_number, change_summary, created_at, created_by')
    .eq('table_name', 'page_sections')
    .eq('record_id', sectionId)
    .order('created_at', { ascending: false })
    .limit(10);
  queryError(error, 'The Home Statistics revision history could not be loaded.');
  return data || [];
}

async function loadHomeStatistics(supabase, { status }) {
  const { data: page, error: pageError } = await supabase
    .from('pages')
    .select('id')
    .eq('slug', 'home')
    .eq('is_published', true)
    .maybeSingle();
  queryError(pageError, 'The Home page could not be loaded.', 'HOME_PAGE_QUERY_FAILED');
  if (!page) {
    throw new HomeStatisticsDataError('The Home page is not configured.', {
      status: 503,
      code: 'HOME_PAGE_NOT_CONFIGURED',
    });
  }

  const { data: sections, error: sectionError } = await supabase
    .from('page_sections')
    .select('id,page_id,section_key,status,version_number,is_visible,updated_at,updated_by,published_at,published_by')
    .eq('page_id', page.id)
    .eq('section_key', HOME_STATISTICS_SECTION_KEY)
    .eq('status', status)
    .order('version_number', { ascending: false })
    .limit(1);
  queryError(sectionError, 'The Home Statistics section could not be loaded.');
  const section = sections?.[0];
  if (!section) return null;

  const { data: metrics, error: metricError } = await supabase
    .from('section_items')
    .select('id,item_key,title,body_text,icon_key,numeric_value,value_suffix,sort_order,is_visible')
    .eq('section_id', section.id)
    .order('sort_order');
  queryError(metricError, 'The Home Statistics metrics could not be loaded.');

  return normalizeSnapshot({ ...section, metrics: metrics || [] });
}

const getCachedPublishedHomeStatistics = unstable_cache(
  async () => {
    const statistics = await loadHomeStatistics(createPublicClient(), { status: 'published' });
    if (!statistics) {
      throw new HomeStatisticsDataError('The published Home Statistics section is not configured.', {
        status: 503,
        code: 'HOME_STATISTICS_NOT_CONFIGURED',
      });
    }
    if (statistics.isVisible && statistics.metrics.length === 0) {
      throw new HomeStatisticsDataError('The published Home Statistics section has no visible metrics.', {
        status: 503,
        code: 'HOME_STATISTICS_ITEMS_NOT_CONFIGURED',
      });
    }
    return statistics;
  },
  ['home-statistics-published-v1'],
  { tags: [HOME_STATISTICS_CACHE_TAG], revalidate: 3600 }
);

export async function getPublishedHomeStatistics() {
  return getCachedPublishedHomeStatistics();
}

export async function getAdminHomeStatistics() {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  let statistics = await loadHomeStatistics(supabase, { status: 'draft' });
  if (!statistics) statistics = await loadHomeStatistics(supabase, { status: 'published' });
  if (!statistics) {
    throw new HomeStatisticsDataError('The Home Statistics section is not configured.', {
      status: 503,
      code: 'HOME_STATISTICS_NOT_CONFIGURED',
    });
  }
  return normalizeSnapshot({
    ...statistics,
    history: await loadRevisionHistory(supabase, statistics.id),
  });
}

async function runMutation(name, args) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const validationCodes = new Set(['22023', '22P02', '23502', '23503', '23514']);
    const isConflict = error.code === '40001' || error.code === '23505';
    throw new HomeStatisticsDataError('The Home Statistics mutation could not be completed.', {
      status: isConflict ? 409 : validationCodes.has(error.code) ? 422 : 500,
      code: isConflict ? 'HOME_STATISTICS_CONFLICT' : validationCodes.has(error.code) ? 'VALIDATION_ERROR' : 'HOME_STATISTICS_MUTATION_FAILED',
      cause: error,
    });
  }
  if (!data || typeof data !== 'object') {
    throw new HomeStatisticsDataError('The Home Statistics mutation returned an invalid response.', {
      code: 'HOME_STATISTICS_INVALID_MUTATION_RESPONSE',
    });
  }
  if (data.ok === false) return data;
  const statistics = normalizeSnapshot(data.data);
  return {
    ok: true,
    data: normalizeSnapshot({
      ...statistics,
      history: await loadRevisionHistory(supabase, statistics.id),
    }),
  };
}

export async function persistHomeStatisticsDraft(payload) {
  return runMutation('save_home_statistics_draft', {
    p_payload: payload,
    p_expected_updated_at: payload.updatedAt,
  });
}

export async function promoteHomeStatisticsDraft({ id, expectedUpdatedAt }) {
  return runMutation('publish_home_statistics_draft', {
    p_section_id: id,
    p_expected_updated_at: expectedUpdatedAt,
  });
}
