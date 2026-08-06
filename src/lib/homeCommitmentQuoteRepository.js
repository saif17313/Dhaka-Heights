import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

export const HOME_COMMITMENT_QUOTE_SECTION_KEY = 'commitment-quote';
export const HOME_COMMITMENT_QUOTE_CACHE_TAG = 'home:commitment-quote:published';

export class HomeCommitmentQuoteDataError extends Error {
  constructor(message, { status = 500, code = 'HOME_COMMITMENT_QUOTE_DATA_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = 'HomeCommitmentQuoteDataError';
    this.status = status;
    this.code = code;
  }
}

function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new HomeCommitmentQuoteDataError('Public Supabase configuration is missing.', {
      status: 503,
      code: 'PUBLIC_SUPABASE_NOT_CONFIGURED',
    });
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

function queryError(error, message, code = 'HOME_COMMITMENT_QUOTE_QUERY_FAILED') {
  if (error) throw new HomeCommitmentQuoteDataError(message, { status: 500, code, cause: error });
}

function normalizeSnapshot(snapshot) {
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    pageId: snapshot.pageId ?? snapshot.page_id,
    sectionKey: snapshot.sectionKey ?? snapshot.section_key ?? HOME_COMMITMENT_QUOTE_SECTION_KEY,
    status: snapshot.status,
    versionNumber: Number(snapshot.versionNumber ?? snapshot.version_number ?? 1),
    isVisible: snapshot.isVisible ?? snapshot.is_visible ?? true,
    quoteText: snapshot.quoteText ?? snapshot.description ?? '',
    attribution: snapshot.attribution ?? snapshot.subheading ?? '',
    updatedAt: snapshot.updatedAt ?? snapshot.updated_at ?? null,
    updatedBy: snapshot.updatedBy ?? snapshot.updated_by ?? null,
    publishedAt: snapshot.publishedAt ?? snapshot.published_at ?? null,
    publishedBy: snapshot.publishedBy ?? snapshot.published_by ?? null,
    history: (snapshot.history || []).map((revision) => ({
      id: revision.id,
      revisionNumber: Number(revision.revisionNumber ?? revision.version_number ?? 0),
      summary: revision.summary ?? revision.change_summary ?? 'Saved Home Commitment Quote revision',
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
  queryError(error, 'The Commitment Quote revision history could not be loaded.');
  return data || [];
}

async function loadHomeCommitmentQuote(supabase, { status }) {
  const { data: page, error: pageError } = await supabase
    .from('pages')
    .select('id')
    .eq('slug', 'home')
    .eq('is_published', true)
    .maybeSingle();
  queryError(pageError, 'The Home page could not be loaded.', 'HOME_PAGE_QUERY_FAILED');
  if (!page) {
    throw new HomeCommitmentQuoteDataError('The Home page is not configured.', {
      status: 503,
      code: 'HOME_PAGE_NOT_CONFIGURED',
    });
  }

  const { data: sections, error } = await supabase
    .from('page_sections')
    .select('id,page_id,section_key,status,version_number,is_visible,description,subheading,updated_at,updated_by,published_at,published_by')
    .eq('page_id', page.id)
    .eq('section_key', HOME_COMMITMENT_QUOTE_SECTION_KEY)
    .eq('status', status)
    .order('version_number', { ascending: false })
    .limit(1);
  queryError(error, 'The Home Commitment Quote could not be loaded.');
  return normalizeSnapshot(sections?.[0] || null);
}

const getCachedPublishedHomeCommitmentQuote = unstable_cache(
  async () => {
    const quote = await loadHomeCommitmentQuote(createPublicClient(), { status: 'published' });
    if (!quote) {
      throw new HomeCommitmentQuoteDataError('The published Home Commitment Quote is not configured.', {
        status: 503,
        code: 'HOME_COMMITMENT_QUOTE_NOT_CONFIGURED',
      });
    }
    return quote;
  },
  ['home-commitment-quote-published-v1'],
  { tags: [HOME_COMMITMENT_QUOTE_CACHE_TAG], revalidate: 3600 }
);

export async function getPublishedHomeCommitmentQuote() {
  return getCachedPublishedHomeCommitmentQuote();
}

export async function getAdminHomeCommitmentQuote() {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  let quote = await loadHomeCommitmentQuote(supabase, { status: 'draft' });
  if (!quote) quote = await loadHomeCommitmentQuote(supabase, { status: 'published' });
  if (!quote) {
    throw new HomeCommitmentQuoteDataError('The Home Commitment Quote is not configured.', {
      status: 503,
      code: 'HOME_COMMITMENT_QUOTE_NOT_CONFIGURED',
    });
  }
  return normalizeSnapshot({
    ...quote,
    history: await loadRevisionHistory(supabase, quote.id),
  });
}

async function runMutation(name, args) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const validationCodes = new Set(['22023', '22P02', '23502', '23503', '23514']);
    const isConflict = error.code === '40001' || error.code === '23505';
    throw new HomeCommitmentQuoteDataError('The Commitment Quote mutation could not be completed.', {
      status: isConflict ? 409 : validationCodes.has(error.code) ? 422 : 500,
      code: isConflict ? 'HOME_COMMITMENT_QUOTE_CONFLICT' : validationCodes.has(error.code) ? 'VALIDATION_ERROR' : 'HOME_COMMITMENT_QUOTE_MUTATION_FAILED',
      cause: error,
    });
  }
  if (!data || typeof data !== 'object') {
    throw new HomeCommitmentQuoteDataError('The Commitment Quote mutation returned an invalid response.', {
      code: 'HOME_COMMITMENT_QUOTE_INVALID_MUTATION_RESPONSE',
    });
  }
  if (data.ok === false) return data;
  const quote = normalizeSnapshot(data.data);
  return {
    ok: true,
    data: normalizeSnapshot({
      ...quote,
      history: await loadRevisionHistory(supabase, quote.id),
    }),
  };
}

export async function persistHomeCommitmentQuoteDraft(payload) {
  return runMutation('save_home_commitment_quote_draft', {
    p_payload: payload,
    p_expected_updated_at: payload.updatedAt,
  });
}

export async function promoteHomeCommitmentQuoteDraft({ id, expectedUpdatedAt }) {
  return runMutation('publish_home_commitment_quote_draft', {
    p_section_id: id,
    p_expected_updated_at: expectedUpdatedAt,
  });
}
