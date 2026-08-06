'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MediaGrid from '@/components/MediaGrid';
import { publishHomeMediaHighlightsDraft, saveHomeMediaHighlightsDraft } from '@/lib/homeMediaHighlightsActions';

const INPUT_CLASS = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none transition focus:border-[#C5A880] focus:ring-2 focus:ring-[#C5A880]/20';
const LABEL_CLASS = 'mb-1 block text-[11px] font-bold text-slate-700';

function normalizePost(post) {
  if (!post) return null;
  return {
    id: post.id,
    slug: post.slug || '',
    title: post.title || '',
    category: post.category || '',
    publishedDate: post.publishedDate || '',
    excerpt: post.excerpt || '',
    status: post.status || 'published',
    coverMediaId: post.coverMediaId || null,
    coverMedia: post.coverMedia || null,
  };
}

function normalizePlacement(placement, index) {
  const mediaPost = normalizePost(placement?.mediaPost);
  const overrideTitle = placement?.overrideTitle || null;
  const overrideDescription = placement?.overrideDescription || null;
  const overrideCategory = placement?.overrideCategory || null;
  const overrideCoverMediaId = placement?.overrideCoverMediaId || null;
  const overrideCtaLabel = placement?.overrideCtaLabel || null;
  const overrideCtaUrl = placement?.overrideCtaUrl || null;
  return {
    placementId: placement?.placementId || null,
    mediaPostId: placement?.mediaPostId || mediaPost?.id || null,
    sortOrder: (index + 1) * 10,
    isVisible: placement?.isVisible !== false,
    overrideTitle,
    overrideDescription,
    overrideCategory,
    overrideCoverMediaId,
    overrideCtaLabel,
    overrideCtaUrl,
    title: overrideTitle || mediaPost?.title || '',
    summary: overrideDescription || mediaPost?.excerpt || '',
    category: overrideCategory || mediaPost?.category || '',
    publishedDate: mediaPost?.publishedDate || '',
    ctaLabel: overrideCtaLabel || 'Read Article',
    ctaUrl: overrideCtaUrl || (mediaPost?.slug ? `/media-center/${mediaPost.slug}` : '/media-center'),
    coverMedia: placement?.coverMedia || mediaPost?.coverMedia || null,
    mediaPost,
  };
}

function normalizeHighlights(source) {
  if (!source) return null;
  const highlights = source.data || source.mediaHighlights || source;
  return {
    id: highlights.id || null,
    pageId: highlights.pageId || null,
    sectionKey: highlights.sectionKey || 'media-highlights-home',
    status: highlights.status || 'draft',
    versionNumber: Number(highlights.versionNumber) || 1,
    isVisible: highlights.isVisible !== false,
    tagText: highlights.tagText || '',
    heading: highlights.heading || '',
    viewAllLabel: highlights.viewAllLabel || '',
    viewAllUrl: highlights.viewAllUrl || '',
    articles: (highlights.articles || []).map(normalizePlacement),
    updatedAt: highlights.updatedAt || null,
    updatedBy: highlights.updatedBy || null,
    publishedAt: highlights.publishedAt || null,
    publishedBy: highlights.publishedBy || null,
    history: (highlights.history || []).map((revision) => ({
      id: revision.id,
      revisionNumber: Number(revision.revisionNumber) || 0,
      summary: revision.summary || 'Saved Home Media Highlights revision',
      createdAt: revision.createdAt || null,
      createdBy: revision.createdBy || null,
    })),
  };
}

function toPayload(highlights) {
  return {
    id: highlights.id,
    pageId: highlights.pageId,
    sectionKey: 'media-highlights-home',
    isVisible: highlights.isVisible,
    updatedAt: highlights.updatedAt,
    tagText: highlights.tagText.trim(),
    heading: highlights.heading.trim(),
    viewAllLabel: highlights.viewAllLabel.trim(),
    viewAllUrl: highlights.viewAllUrl.trim(),
    articles: highlights.articles.map((article) => ({
      mediaPostId: article.mediaPostId,
      isVisible: article.isVisible,
      overrideTitle: article.overrideTitle,
      overrideDescription: article.overrideDescription,
      overrideCategory: article.overrideCategory,
      overrideCoverMediaId: article.overrideCoverMediaId,
      overrideCtaLabel: article.overrideCtaLabel,
      overrideCtaUrl: article.overrideCtaUrl,
    })),
  };
}

const comparable = (highlights) => highlights ? JSON.stringify(toPayload(highlights)) : '';
function validUrl(value) {
  if (/^#[A-Za-z][A-Za-z0-9_-]*$/.test(value)) return true;
  if (/^\/(?!\/)/.test(value)) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}
function validateHighlights(highlights) {
  const errors = {};
  if (!highlights.tagText.trim() || highlights.tagText.trim().length > 80) errors.tagText = 'Section tag is required and must be 80 characters or fewer.';
  if (!highlights.heading.trim() || highlights.heading.trim().length > 140) errors.heading = 'Heading is required and must be 140 characters or fewer.';
  if (!highlights.viewAllLabel.trim() || highlights.viewAllLabel.trim().length > 40) errors.viewAllLabel = 'View All label is required and must be 40 characters or fewer.';
  if (!validUrl(highlights.viewAllUrl.trim())) errors.viewAllUrl = 'Use a #section anchor, internal /path, or https:// URL.';
  if (highlights.articles.length < 1 || highlights.articles.length > 12) errors.articles = 'Select between 1 and 12 media posts.';
  if (!highlights.articles.some((article) => article.isVisible)) errors.articles = 'At least one selected media post must be visible.';
  if (highlights.articles.some((article) => !article.mediaPostId || !article.coverMedia?.secureUrl)) errors.articles = 'Every placement requires a canonical published media post with an active cover.';
  return errors;
}

function FieldError({ children }) { return children ? <p className="mt-1 text-[10px] font-semibold text-red-600">{children}</p> : null; }
const timestampLabel = (value) => value ? new Date(value).toLocaleString() : 'Not recorded';
const actorLabel = (value) => value ? `Admin ${value.slice(0, 8)}` : 'System';

export default function HomeMediaHighlightsEditor({ initialMediaHighlights, mediaPostCatalog = [], initialError = '' }) {
  const router = useRouter();
  const normalizedInitial = useMemo(() => normalizeHighlights(initialMediaHighlights), [initialMediaHighlights]);
  const catalog = useMemo(() => mediaPostCatalog.map(normalizePost).filter(Boolean), [mediaPostCatalog]);
  const [highlights, setHighlights] = useState(normalizedInitial);
  const [baseline, setBaseline] = useState(() => comparable(normalizedInitial));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(initialError);
  const [tone, setTone] = useState(initialError ? 'error' : 'neutral');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [search, setSearch] = useState('');
  const dirty = highlights ? comparable(highlights) !== baseline : false;
  const selectedIds = useMemo(() => new Set((highlights?.articles || []).map((article) => article.mediaPostId)), [highlights]);
  const availablePosts = catalog.filter((post) => !selectedIds.has(post.id) && (!search.trim() || `${post.title} ${post.category}`.toLowerCase().includes(search.trim().toLowerCase())));

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (patch) => { setHighlights((current) => ({ ...current, ...patch })); setMessage(''); setConflict(false); };
  const updatePlacement = (index, patch) => update({ articles: highlights.articles.map((article, articleIndex) => articleIndex === index ? { ...article, ...patch } : article) });
  const movePlacement = (index, direction) => {
    const destination = index + direction;
    if (destination < 0 || destination >= highlights.articles.length) return;
    const articles = [...highlights.articles];
    [articles[index], articles[destination]] = [articles[destination], articles[index]];
    update({ articles: articles.map((article, articleIndex) => ({ ...article, sortOrder: (articleIndex + 1) * 10 })) });
  };
  const addPost = (post) => {
    if (selectedIds.has(post.id) || highlights.articles.length >= 12 || !post.coverMedia?.secureUrl) return;
    update({ articles: [...highlights.articles, normalizePlacement({ mediaPostId: post.id, mediaPost: post, coverMedia: post.coverMedia, isVisible: true }, highlights.articles.length)] });
  };
  const removePost = (index) => {
    const article = highlights.articles[index];
    if (!window.confirm(`Remove “${article.title}” from this Home placement draft? The canonical media post will not be deleted.`)) return;
    update({ articles: highlights.articles.filter((_, articleIndex) => articleIndex !== index) });
  };
  const applyFailure = (result, fallback) => { setErrors(result.fieldErrors || {}); setConflict(result.status === 409 || String(result.code || '').includes('CONFLICT')); setTone('error'); setMessage(result.error || fallback); };

  const handleSave = async () => {
    const clientErrors = validateHighlights(highlights); setErrors(clientErrors);
    if (Object.keys(clientErrors).length) { setTone('error'); setMessage('Fix the highlighted fields before saving.'); return; }
    setSaving(true);
    try {
      const result = await saveHomeMediaHighlightsDraft(toPayload(highlights));
      if (!result?.ok) return applyFailure(result || {}, 'The Media Highlights draft could not be saved.');
      const saved = normalizeHighlights(result.data); setHighlights(saved); setBaseline(comparable(saved)); setErrors({}); setTone('success'); setMessage('Draft saved. The published Home page has not changed.');
    } catch (error) { setTone('error'); setMessage(error instanceof Error ? error.message : 'The Media Highlights draft could not be saved.'); }
    finally { setSaving(false); }
  };
  const handlePublish = async () => {
    setPublishing(true);
    try {
      const result = await publishHomeMediaHighlightsDraft({ id: highlights.id, expectedUpdatedAt: highlights.updatedAt });
      if (!result?.ok) return applyFailure(result || {}, 'The Media Highlights draft could not be published.');
      const published = normalizeHighlights(result.data); setHighlights(published); setBaseline(comparable(published)); setErrors({}); setTone('success'); setMessage('Media Highlights published and the public Home cache was refreshed.'); router.refresh();
    } catch (error) { setTone('error'); setMessage(error instanceof Error ? error.message : 'The Media Highlights draft could not be published.'); }
    finally { setPublishing(false); }
  };

  if (!highlights) return <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm"><h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Media Highlights editor unavailable</h1><p className="mt-2 text-sm text-slate-600">{initialError || 'No saved Media Highlights version was returned.'}</p><button type="button" onClick={() => router.refresh()} className="mt-5 rounded-xl bg-[#0B1B3D] px-5 py-2 text-xs font-bold text-white">Retry loading</button></div>;

  return (
    <div className="w-full space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
          <div><div className="mb-2 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${highlights.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{highlights.status}</span><span className="font-mono text-[10px] text-slate-400">key: media-highlights-home · version {highlights.versionNumber}</span>{dirty && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">Unsaved changes</span>}</div><h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Home Media Highlights</h1><p className="mt-1 text-xs font-medium text-slate-500">Select and order canonical published media posts without duplicating their records.</p><p className="mt-2 text-[10px] text-slate-400">Last saved: {timestampLabel(highlights.updatedAt)} by {actorLabel(highlights.updatedBy)}</p></div>
          <div className="flex flex-wrap gap-2"><Link href="/admin-preview/home/media-highlights-home" target="_blank" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">Saved version preview</Link><button type="button" onClick={handleSave} disabled={!dirty || saving || publishing} className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save Draft'}</button><button type="button" onClick={handlePublish} disabled={dirty || highlights.status !== 'draft' || saving || publishing} className="rounded-xl bg-[#B59410] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{publishing ? 'Publishing…' : 'Publish'}</button></div>
        </div>
        {message && <div className={`mt-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-semibold ${tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}><span>{message}</span>{conflict && <button type="button" onClick={() => router.refresh()} className="underline">Reload latest</button>}</div>}
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-7">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="border-b border-slate-100 pb-3 font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Section settings</h2>
            <label className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4"><span><span className="block text-xs font-bold text-slate-700">Section visible</span><span className="text-[10px] text-slate-400">Hide the complete Media Highlights block when disabled.</span></span><input type="checkbox" checked={highlights.isVisible} onChange={(event) => update({ isVisible: event.target.checked })} className="h-4 w-4 accent-[#B59410]" /></label>
            <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><label className={LABEL_CLASS}>Section tag</label><input value={highlights.tagText} maxLength={80} onChange={(event) => update({ tagText: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors.tagText}</FieldError></div><div><label className={LABEL_CLASS}>Heading</label><input value={highlights.heading} maxLength={140} onChange={(event) => update({ heading: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors.heading}</FieldError></div><div><label className={LABEL_CLASS}>View All label</label><input value={highlights.viewAllLabel} maxLength={40} onChange={(event) => update({ viewAllLabel: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors.viewAllLabel}</FieldError></div><div><label className={LABEL_CLASS}>View All URL</label><input value={highlights.viewAllUrl} onChange={(event) => update({ viewAllUrl: event.target.value })} className={`${INPUT_CLASS} font-mono`} /><FieldError>{errors.viewAllUrl}</FieldError></div></div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3"><div><h2 className="font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Selected posts ({highlights.articles.length})</h2><p className="mt-1 text-[10px] text-slate-400">Ordering and visibility are Home placements; removing one never deletes its canonical post.</p></div><Link href="/admin/articles" className="text-[10px] font-bold text-[#8A6D08] underline">Manage canonical posts</Link></div>
            <FieldError>{errors.articles}</FieldError>
            <div className="mt-4 space-y-3">{highlights.articles.map((article, index) => <article key={article.mediaPostId} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:flex-row sm:items-center"><img src={article.coverMedia?.secureUrl} alt={article.title} className="h-20 w-24 rounded-xl object-cover" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[9px] font-bold text-[#8A6D08]">{String(index + 1).padStart(2, '0')}</span><span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700">{article.category}</span></div><h3 className="mt-1 line-clamp-2 text-xs font-bold text-[#0B1B3D]">{article.title}</h3><p className="mt-1 text-[10px] text-slate-500">{article.publishedDate}</p><label className="mt-2 flex items-center gap-2 text-[10px] font-bold text-slate-600"><input type="checkbox" checked={article.isVisible} onChange={(event) => updatePlacement(index, { isVisible: event.target.checked })} className="h-3.5 w-3.5 accent-[#B59410]" />Show on Home</label></div><div className="flex items-center gap-1"><button type="button" onClick={() => movePlacement(index, -1)} disabled={index === 0} aria-label={`Move ${article.title} up`} className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30"><i className="fa-solid fa-arrow-up"></i></button><button type="button" onClick={() => movePlacement(index, 1)} disabled={index === highlights.articles.length - 1} aria-label={`Move ${article.title} down`} className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30"><i className="fa-solid fa-arrow-down"></i></button><button type="button" onClick={() => removePost(index)} aria-label={`Remove ${article.title}`} className="h-8 w-8 rounded-lg border border-red-200 bg-white text-red-600"><i className="fa-solid fa-trash"></i></button></div></article>)}</div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Available canonical posts</h2><p className="mt-1 text-[10px] text-slate-400">Only published posts with active Cloudinary covers can be added.</p></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search posts…" className={`${INPUT_CLASS} sm:max-w-64`} /></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">{availablePosts.map((post) => <article key={post.id} className="flex gap-3 rounded-xl border border-slate-200 p-3"><img src={post.coverMedia?.secureUrl} alt={post.title} className="h-16 w-20 rounded-lg object-cover" /><div className="min-w-0 flex-1"><p className="line-clamp-2 text-xs font-bold text-[#0B1B3D]">{post.title}</p><p className="mt-1 text-[9px] text-slate-500">{post.category} · {post.publishedDate}</p><button type="button" disabled={!post.coverMedia?.secureUrl || highlights.articles.length >= 12} onClick={() => addPost(post)} className="mt-2 rounded-lg bg-[#0B1B3D] px-2.5 py-1 text-[9px] font-bold text-white disabled:opacity-30">Add to Home</button></div></article>)}</div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="border-b border-slate-100 pb-3 font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Revision history</h2>{highlights.history.length ? <ol className="mt-3 divide-y divide-slate-100">{highlights.history.map((revision) => <li key={revision.id} className="flex justify-between gap-3 py-3"><div><p className="text-xs font-bold text-slate-700">{revision.summary}</p><p className="mt-1 text-[10px] text-slate-400">{actorLabel(revision.createdBy)}</p></div><div className="text-right"><p className="font-mono text-[10px] font-bold text-[#8A6D08]">revision {revision.revisionNumber || '—'}</p><p className="mt-1 text-[10px] text-slate-400">{timestampLabel(revision.createdAt)}</p></div></li>)}</ol> : <p className="mt-3 text-xs text-slate-500">No saved revisions yet.</p>}</section>
        </div>

        <aside className="xl:col-span-5"><div className="sticky top-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-4"><h2 className="font-serif text-xs font-bold uppercase tracking-wider text-[#0B1B3D]">Unsaved local preview</h2><p className="mt-1 text-[10px] text-slate-400">Uses the same public Media component and does not expose draft data.</p></div><div className="max-h-[780px] overflow-auto"><MediaGrid mediaHighlights={highlights} previewMode /></div>{dirty && <p className="border-t border-slate-100 p-3 text-[10px] font-semibold text-blue-700">Preview includes unsaved form values.</p>}{!highlights.isVisible && <p className="border-t border-slate-100 p-3 text-[10px] font-semibold text-amber-700">The section is disabled, so the preview is empty.</p>}</div></aside>
      </div>
    </div>
  );
}
