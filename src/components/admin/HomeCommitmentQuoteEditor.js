'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CommitmentQuote from '@/components/CommitmentQuote';
import { publishHomeCommitmentQuoteDraft, saveHomeCommitmentQuoteDraft } from '@/lib/homeCommitmentQuoteActions';

const INPUT_CLASS = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none transition focus:border-[#C5A880] focus:ring-2 focus:ring-[#C5A880]/20';
const LABEL_CLASS = 'mb-1 block text-[11px] font-bold text-slate-700';

function normalizeQuote(source) {
  if (!source) return null;
  const quote = source.data || source.quote || source;
  return {
    id: quote.id || null,
    pageId: quote.pageId || null,
    sectionKey: quote.sectionKey || 'commitment-quote',
    status: quote.status || 'draft',
    versionNumber: Number(quote.versionNumber) || 1,
    isVisible: quote.isVisible !== false,
    quoteText: quote.quoteText || '',
    attribution: quote.attribution || '',
    updatedAt: quote.updatedAt || null,
    updatedBy: quote.updatedBy || null,
    publishedAt: quote.publishedAt || null,
    publishedBy: quote.publishedBy || null,
    history: (quote.history || []).map((revision) => ({
      id: revision.id,
      revisionNumber: Number(revision.revisionNumber) || 0,
      summary: revision.summary || 'Saved Home Commitment Quote revision',
      createdAt: revision.createdAt || null,
      createdBy: revision.createdBy || null,
    })),
  };
}

function toPayload(quote) {
  return {
    id: quote.id,
    pageId: quote.pageId,
    sectionKey: 'commitment-quote',
    isVisible: quote.isVisible,
    updatedAt: quote.updatedAt,
    quoteText: quote.quoteText.trim(),
    attribution: quote.attribution.trim(),
  };
}

function comparable(quote) {
  return quote ? JSON.stringify(toPayload(quote)) : '';
}

function validateQuote(quote) {
  const errors = {};
  const quoteText = quote.quoteText.trim();
  const attribution = quote.attribution.trim();
  if (!quoteText || quoteText.length > 500) errors.quoteText = 'Quotation is required and must be 500 characters or fewer.';
  if (!attribution || attribution.length > 180) errors.attribution = 'Attribution is required and must be 180 characters or fewer.';
  return errors;
}

function FieldError({ children }) {
  return children ? <p className="mt-1 text-[10px] font-semibold text-red-600">{children}</p> : null;
}

function timestampLabel(value) {
  return value ? new Date(value).toLocaleString() : 'Not recorded';
}

function actorLabel(value) {
  return value ? `Admin ${value.slice(0, 8)}` : 'System';
}

export default function HomeCommitmentQuoteEditor({ initialQuote, initialError = '' }) {
  const router = useRouter();
  const normalizedInitial = useMemo(() => normalizeQuote(initialQuote), [initialQuote]);
  const [quote, setQuote] = useState(normalizedInitial);
  const [baseline, setBaseline] = useState(() => comparable(normalizedInitial));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(initialError);
  const [tone, setTone] = useState(initialError ? 'error' : 'neutral');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const dirty = quote ? comparable(quote) !== baseline : false;

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (patch) => {
    setQuote((current) => ({ ...current, ...patch }));
    setMessage('');
    setConflict(false);
  };

  const applyFailure = (result, fallback) => {
    setErrors(result.fieldErrors || {});
    setConflict(result.status === 409 || String(result.code || '').includes('CONFLICT'));
    setTone('error');
    setMessage(result.error || fallback);
  };

  const handleSave = async () => {
    const clientErrors = validateQuote(quote);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) {
      setTone('error');
      setMessage('Fix the highlighted fields before saving.');
      return;
    }
    setSaving(true);
    try {
      const result = await saveHomeCommitmentQuoteDraft(toPayload(quote));
      if (!result?.ok) return applyFailure(result || {}, 'The Commitment Quote draft could not be saved.');
      const saved = normalizeQuote(result.data);
      setQuote(saved);
      setBaseline(comparable(saved));
      setErrors({});
      setTone('success');
      setMessage('Draft saved. The published Home page has not changed.');
    } catch (error) {
      setTone('error');
      setMessage(error instanceof Error ? error.message : 'The Commitment Quote draft could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const result = await publishHomeCommitmentQuoteDraft({ id: quote.id, expectedUpdatedAt: quote.updatedAt });
      if (!result?.ok) return applyFailure(result || {}, 'The Commitment Quote draft could not be published.');
      const published = normalizeQuote(result.data);
      setQuote(published);
      setBaseline(comparable(published));
      setErrors({});
      setTone('success');
      setMessage('Commitment Quote published and the public Home cache was refreshed.');
      router.refresh();
    } catch (error) {
      setTone('error');
      setMessage(error instanceof Error ? error.message : 'The Commitment Quote draft could not be published.');
    } finally {
      setPublishing(false);
    }
  };

  if (!quote) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Commitment Quote editor unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">{initialError || 'No saved Commitment Quote version was returned.'}</p>
        <button type="button" onClick={() => router.refresh()} className="mt-5 rounded-xl bg-[#0B1B3D] px-5 py-2 text-xs font-bold text-white">Retry loading</button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${quote.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{quote.status}</span>
              <span className="font-mono text-[10px] text-slate-400">key: commitment-quote · version {quote.versionNumber}</span>
              {dirty && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">Unsaved changes</span>}
            </div>
            <h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Home Commitment Quote</h1>
            <p className="mt-1 text-xs font-medium text-slate-500">Edit the existing quotation and board attribution without changing its visual design.</p>
            <p className="mt-2 text-[10px] text-slate-400">Last saved: {timestampLabel(quote.updatedAt)} by {actorLabel(quote.updatedBy)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin-preview/home/commitment-quote" target="_blank" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">Saved version preview</Link>
            <button type="button" onClick={handleSave} disabled={!dirty || saving || publishing} className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save Draft'}</button>
            <button type="button" onClick={handlePublish} disabled={dirty || quote.status !== 'draft' || saving || publishing} className="rounded-xl bg-[#B59410] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{publishing ? 'Publishing…' : 'Publish'}</button>
          </div>
        </div>
        {message && (
          <div className={`mt-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-semibold ${tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
            <span>{message}</span>
            {conflict && <button type="button" onClick={() => router.refresh()} className="underline">Reload latest</button>}
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-7">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="border-b border-slate-100 pb-3 font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Content</h2>
            <label className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span><span className="block text-xs font-bold text-slate-700">Section visible</span><span className="text-[10px] text-slate-400">Hide the complete quote block when disabled.</span></span>
              <input type="checkbox" checked={quote.isVisible} onChange={(event) => update({ isVisible: event.target.checked })} className="h-4 w-4 accent-[#B59410]" />
            </label>
            <div className="mt-4 space-y-4">
              <div>
                <div className="flex items-center justify-between"><label className={LABEL_CLASS}>Quotation <span className="text-red-500">*</span></label><span className="text-[10px] text-slate-400">{quote.quoteText.length}/500</span></div>
                <textarea value={quote.quoteText} maxLength={500} rows={6} onChange={(event) => update({ quoteText: event.target.value })} className={`${INPUT_CLASS} resize-y leading-relaxed`} />
                <FieldError>{errors.quoteText}</FieldError>
              </div>
              <div>
                <div className="flex items-center justify-between"><label className={LABEL_CLASS}>Attribution <span className="text-red-500">*</span></label><span className="text-[10px] text-slate-400">{quote.attribution.length}/180</span></div>
                <input value={quote.attribution} maxLength={180} onChange={(event) => update({ attribution: event.target.value })} className={INPUT_CLASS} />
                <FieldError>{errors.attribution}</FieldError>
              </div>
              <p className="rounded-xl bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-500">Quotation marks, attribution dash, quote icon, ornaments, colors, typography, and spacing are fixed presentation behavior.</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="border-b border-slate-100 pb-3 font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Revision history</h2>
            {quote.history.length ? <ol className="mt-3 divide-y divide-slate-100">{quote.history.map((revision) => <li key={revision.id} className="flex justify-between gap-3 py-3"><div><p className="text-xs font-bold text-slate-700">{revision.summary}</p><p className="mt-1 text-[10px] text-slate-400">{actorLabel(revision.createdBy)}</p></div><div className="text-right"><p className="font-mono text-[10px] font-bold text-[#8A6D08]">revision {revision.revisionNumber || '—'}</p><p className="mt-1 text-[10px] text-slate-400">{timestampLabel(revision.createdAt)}</p></div></li>)}</ol> : <p className="mt-3 text-xs text-slate-500">No saved revisions yet.</p>}
          </section>
        </div>

        <aside className="xl:col-span-5">
          <div className="sticky top-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4"><h2 className="font-serif text-xs font-bold uppercase tracking-wider text-[#0B1B3D]">Unsaved local preview</h2><p className="mt-1 text-[10px] text-slate-400">Uses the same public Commitment Quote component and does not expose draft data.</p></div>
            <div className="overflow-auto"><CommitmentQuote commitmentQuote={quote} previewMode /></div>
            {dirty && <p className="border-t border-slate-100 p-3 text-[10px] font-semibold text-blue-700">Preview includes unsaved form values.</p>}
            {!quote.isVisible && <p className="border-t border-slate-100 p-3 text-[10px] font-semibold text-amber-700">The section is disabled, so the preview is empty.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
