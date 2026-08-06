'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AboutSection from '@/components/AboutSection';
import MediaLibrary from '@/components/admin/MediaLibrary';
import { publishHomeAboutDraft, saveHomeAboutDraft } from '@/lib/homeAboutActions';

const INPUT_CLASS = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none transition focus:border-[#C5A880] focus:ring-2 focus:ring-[#C5A880]/20';
const LABEL_CLASS = 'mb-1 block text-[11px] font-bold text-slate-700';

function normalizeMedia(media) {
  if (!media) return null;
  return {
    id: media.id || null,
    secureUrl: media.secureUrl || media.secure_url || media.url || '',
    displayName: media.displayName || media.display_name || media.original_filename || '',
    altText: media.altText || media.alt_text || '',
    width: media.width || null,
    height: media.height || null,
  };
}

function normalizeImage(image) {
  return {
    itemId: image?.itemId || null,
    mediaId: image?.mediaId || image?.media?.id || null,
    imageAlt: image?.imageAlt || '',
    media: normalizeMedia(image?.media),
  };
}

function normalizeAbout(source) {
  if (!source) return null;
  const about = source.data || source.about || source;
  return {
    id: about.id || null,
    pageId: about.pageId || null,
    sectionKey: about.sectionKey || 'about-corporate-home',
    status: about.status || 'draft',
    versionNumber: Number(about.versionNumber) || 1,
    isVisible: about.isVisible !== false,
    tagText: about.tagText || '',
    heading: about.heading || '',
    highlightedHeading: about.highlightedHeading || '',
    leadText: about.leadText || '',
    bodyText: about.bodyText || '',
    primaryCtaLabel: about.primaryCtaLabel || '',
    primaryCtaUrl: about.primaryCtaUrl || '',
    primaryCtaTarget: about.primaryCtaTarget || '_self',
    videoButtonLabel: about.videoButtonLabel || '',
    topImage: normalizeImage(about.topImage),
    bottomImage: normalizeImage(about.bottomImage),
    updatedAt: about.updatedAt || null,
    updatedBy: about.updatedBy || null,
    publishedAt: about.publishedAt || null,
    publishedBy: about.publishedBy || null,
    history: (about.history || []).map((revision) => ({
      id: revision.id,
      revisionNumber: Number(revision.revisionNumber) || 0,
      summary: revision.summary || 'Saved Home About revision',
      createdAt: revision.createdAt || null,
      createdBy: revision.createdBy || null,
    })),
  };
}

function toPayload(about) {
  return {
    id: about.id,
    pageId: about.pageId,
    sectionKey: 'about-corporate-home',
    isVisible: about.isVisible,
    updatedAt: about.updatedAt,
    tagText: about.tagText.trim(),
    heading: about.heading.trim(),
    highlightedHeading: about.highlightedHeading.trim(),
    leadText: about.leadText.trim(),
    bodyText: about.bodyText.trim(),
    primaryCtaLabel: about.primaryCtaLabel.trim(),
    primaryCtaUrl: about.primaryCtaUrl.trim(),
    primaryCtaTarget: about.primaryCtaTarget,
    videoButtonLabel: about.videoButtonLabel.trim(),
    topImage: { mediaId: about.topImage.mediaId, imageAlt: about.topImage.imageAlt.trim() },
    bottomImage: { mediaId: about.bottomImage.mediaId, imageAlt: about.bottomImage.imageAlt.trim() },
  };
}

function comparable(about) {
  return about ? JSON.stringify(toPayload(about)) : '';
}

function validUrl(value) {
  if (/^#[A-Za-z][A-Za-z0-9_-]*$/.test(value)) return true;
  if (/^\/(?!\/)/.test(value)) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function validateAbout(about) {
  const errors = {};
  const checks = [
    ['tagText', 100, 'Section tag'],
    ['heading', 180, 'Heading'],
    ['highlightedHeading', 180, 'Highlighted heading'],
    ['leadText', 1000, 'Lead paragraph'],
    ['bodyText', 1000, 'Body paragraph'],
    ['primaryCtaLabel', 40, 'Primary CTA label'],
    ['videoButtonLabel', 40, 'Video button label'],
  ];
  for (const [key, max, label] of checks) {
    const value = about[key].trim();
    if (!value || value.length > max) errors[key] = `${label} is required and must be ${max} characters or fewer.`;
  }
  if (!validUrl(about.primaryCtaUrl.trim())) errors.primaryCtaUrl = 'Use a #section anchor, internal /path, or https:// URL.';
  for (const key of ['topImage', 'bottomImage']) {
    if (!about[key].mediaId) errors[`${key}.mediaId`] = 'Select an image.';
    const alt = about[key].imageAlt.trim();
    if (!alt || alt.length > 180) errors[`${key}.imageAlt`] = 'Alt text is required and must be 180 characters or fewer.';
  }
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

function MediaField({ label, image, error, altError, onSelect, onChangeAlt }) {
  const url = image.media?.secureUrl || '';
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-[#0B1B3D]">{label}</h3>
        {image.mediaId && <span className="font-mono text-[9px] text-slate-400">{image.mediaId}</span>}
      </div>
      <div className={`flex min-h-28 items-center gap-4 rounded-xl border bg-white p-3 ${error ? 'border-red-300' : 'border-slate-200'}`}>
        <div className="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-300">
          {url ? <img src={url} alt={image.imageAlt} className="h-full w-full object-cover" /> : <i className="fa-solid fa-image text-2xl"></i>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-slate-700">{image.media?.displayName || 'No image selected'}</p>
          {image.media?.width && image.media?.height && <p className="mt-1 text-[10px] text-slate-400">{image.media.width} × {image.media.height}px</p>}
          <button type="button" onClick={onSelect} className="mt-3 rounded-lg bg-[#0B1B3D] px-3 py-1.5 text-[10px] font-bold text-white">
            <i className="fa-solid fa-photo-film mr-1.5 text-[#C5A880]"></i>{url ? 'Replace image' : 'Select image'}
          </button>
        </div>
      </div>
      <FieldError>{error}</FieldError>
      <div>
        <label className={LABEL_CLASS}>Image alt text <span className="text-red-500">*</span></label>
        <input value={image.imageAlt} maxLength={180} onChange={(event) => onChangeAlt(event.target.value)} className={INPUT_CLASS} />
        <FieldError>{altError}</FieldError>
      </div>
    </div>
  );
}

export default function HomeAboutEditor({ initialAbout, initialError = '' }) {
  const router = useRouter();
  const normalizedInitial = useMemo(() => normalizeAbout(initialAbout), [initialAbout]);
  const [about, setAbout] = useState(normalizedInitial);
  const [baseline, setBaseline] = useState(() => comparable(normalizedInitial));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(initialError);
  const [tone, setTone] = useState(initialError ? 'error' : 'neutral');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [mediaPicker, setMediaPicker] = useState(null);
  const dirty = about ? comparable(about) !== baseline : false;

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (patch) => {
    setAbout((current) => ({ ...current, ...patch }));
    setMessage('');
    setConflict(false);
  };

  const updateImage = (key, patch) => {
    setAbout((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
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
    const clientErrors = validateAbout(about);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) {
      setTone('error');
      setMessage('Fix the highlighted fields before saving.');
      return;
    }
    setSaving(true);
    try {
      const result = await saveHomeAboutDraft(toPayload(about));
      if (!result?.ok) return applyFailure(result || {}, 'The About draft could not be saved.');
      const saved = normalizeAbout(result.data);
      setAbout(saved);
      setBaseline(comparable(saved));
      setErrors({});
      setTone('success');
      setMessage('Draft saved. The published Home page has not changed.');
    } catch (error) {
      setTone('error');
      setMessage(error instanceof Error ? error.message : 'The About draft could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const result = await publishHomeAboutDraft({ id: about.id, expectedUpdatedAt: about.updatedAt });
      if (!result?.ok) return applyFailure(result || {}, 'The About draft could not be published.');
      const published = normalizeAbout(result.data);
      setAbout(published);
      setBaseline(comparable(published));
      setErrors({});
      setTone('success');
      setMessage('About Corporate Block published and the public Home cache was refreshed.');
      router.refresh();
    } catch (error) {
      setTone('error');
      setMessage(error instanceof Error ? error.message : 'The About draft could not be published.');
    } finally {
      setPublishing(false);
    }
  };

  const handleMediaSelect = (asset) => {
    if (!mediaPicker) return;
    const media = normalizeMedia(asset);
    updateImage(mediaPicker, {
      mediaId: media.id,
      media,
      imageAlt: about[mediaPicker].imageAlt || media.altText || '',
    });
    setMediaPicker(null);
  };

  if (!about) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">About Corporate Block editor unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">{initialError || 'No saved About version was returned.'}</p>
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
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${about.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{about.status}</span>
              <span className="font-mono text-[10px] text-slate-400">key: about-corporate-home · version {about.versionNumber}</span>
              {dirty && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">Unsaved changes</span>}
            </div>
            <h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Home About Corporate Block</h1>
            <p className="mt-1 text-xs font-medium text-slate-500">Edit the existing corporate introduction and two-image parallax composition.</p>
            <p className="mt-2 text-[10px] text-slate-400">Last saved: {timestampLabel(about.updatedAt)} by {actorLabel(about.updatedBy)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin-preview/home/about-corporate-home" target="_blank" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">Saved version preview</Link>
            <button type="button" onClick={handleSave} disabled={!dirty || saving || publishing} className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save Draft'}</button>
            <button type="button" onClick={handlePublish} disabled={dirty || about.status !== 'draft' || saving || publishing} className="rounded-xl bg-[#B59410] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{publishing ? 'Publishing…' : 'Publish'}</button>
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
              <span><span className="block text-xs font-bold text-slate-700">Section visible</span><span className="text-[10px] text-slate-400">Hide the complete block when disabled.</span></span>
              <input type="checkbox" checked={about.isVisible} onChange={(event) => update({ isVisible: event.target.checked })} className="h-4 w-4 accent-[#B59410]" />
            </label>
            <div className="mt-4 space-y-4">
              {[
                ['tagText', 'Section tag', 100],
                ['heading', 'Heading', 180],
                ['highlightedHeading', 'Highlighted heading', 180],
              ].map(([key, label, max]) => (
                <div key={key}><label className={LABEL_CLASS}>{label} <span className="text-red-500">*</span></label><input value={about[key]} maxLength={max} onChange={(event) => update({ [key]: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors[key]}</FieldError></div>
              ))}
              <div><label className={LABEL_CLASS}>Lead paragraph <span className="text-red-500">*</span></label><textarea value={about.leadText} maxLength={1000} rows={5} onChange={(event) => update({ leadText: event.target.value })} className={`${INPUT_CLASS} resize-y leading-relaxed`} /><FieldError>{errors.leadText}</FieldError></div>
              <div><label className={LABEL_CLASS}>Body paragraph <span className="text-red-500">*</span></label><textarea value={about.bodyText} maxLength={1000} rows={5} onChange={(event) => update({ bodyText: event.target.value })} className={`${INPUT_CLASS} resize-y leading-relaxed`} /><FieldError>{errors.bodyText}</FieldError></div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="border-b border-slate-100 pb-3 font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Actions</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-12">
              <div className="sm:col-span-4"><label className={LABEL_CLASS}>Primary CTA label</label><input value={about.primaryCtaLabel} maxLength={40} onChange={(event) => update({ primaryCtaLabel: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors.primaryCtaLabel}</FieldError></div>
              <div className="sm:col-span-5"><label className={LABEL_CLASS}>Primary CTA URL</label><input value={about.primaryCtaUrl} onChange={(event) => update({ primaryCtaUrl: event.target.value })} className={`${INPUT_CLASS} font-mono`} /><FieldError>{errors.primaryCtaUrl}</FieldError></div>
              <div className="sm:col-span-3"><label className={LABEL_CLASS}>Target</label><select value={about.primaryCtaTarget} onChange={(event) => update({ primaryCtaTarget: event.target.value })} className={INPUT_CLASS}><option value="_self">Same tab</option><option value="_blank">New tab</option></select></div>
              <div className="sm:col-span-6"><label className={LABEL_CLASS}>Video button label</label><input value={about.videoButtonLabel} maxLength={40} onChange={(event) => update({ videoButtonLabel: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors.videoButtonLabel}</FieldError></div>
              <p className="self-end text-[10px] text-slate-400 sm:col-span-6">The video modal action remains fixed to preserve current behavior.</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="border-b border-slate-100 pb-3 font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Composition images</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <MediaField label="Top facade image" image={about.topImage} error={errors['topImage.mediaId']} altError={errors['topImage.imageAlt']} onSelect={() => setMediaPicker('topImage')} onChangeAlt={(imageAlt) => updateImage('topImage', { imageAlt })} />
              <MediaField label="Bottom interior image" image={about.bottomImage} error={errors['bottomImage.mediaId']} altError={errors['bottomImage.imageAlt']} onSelect={() => setMediaPicker('bottomImage')} onChangeAlt={(imageAlt) => updateImage('bottomImage', { imageAlt })} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="border-b border-slate-100 pb-3 font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Revision history</h2>
            {about.history.length ? <ol className="mt-3 divide-y divide-slate-100">{about.history.map((revision) => <li key={revision.id} className="flex justify-between gap-3 py-3"><div><p className="text-xs font-bold text-slate-700">{revision.summary}</p><p className="mt-1 text-[10px] text-slate-400">{actorLabel(revision.createdBy)}</p></div><div className="text-right"><p className="font-mono text-[10px] font-bold text-[#8A6D08]">revision {revision.revisionNumber || '—'}</p><p className="mt-1 text-[10px] text-slate-400">{timestampLabel(revision.createdAt)}</p></div></li>)}</ol> : <p className="mt-3 text-xs text-slate-500">No saved revisions yet.</p>}
          </section>
        </div>

        <aside className="xl:col-span-5">
          <div className="sticky top-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4"><h2 className="font-serif text-xs font-bold uppercase tracking-wider text-[#0B1B3D]">Unsaved local preview</h2><p className="mt-1 text-[10px] text-slate-400">Uses the same public About component and does not expose draft data.</p></div>
            <div className="max-h-[780px] overflow-auto"><AboutSection about={about} onPlayVideo={() => {}} previewMode /></div>
            {dirty && <p className="border-t border-slate-100 p-3 text-[10px] font-semibold text-blue-700">Preview includes unsaved form values.</p>}
            {!about.isVisible && <p className="border-t border-slate-100 p-3 text-[10px] font-semibold text-amber-700">The section is disabled, so the preview is empty.</p>}
          </div>
        </aside>
      </div>

      {mediaPicker && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-7xl"><MediaLibrary isModal resourceTypeFilter="image" onSelectAsset={handleMediaSelect} onCloseModal={() => setMediaPicker(null)} /></div>
        </div>
      )}
    </div>
  );
}
