'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import HeroSlider from '@/components/HeroSlider';
import MediaLibrary from '@/components/admin/MediaLibrary';
import { publishHomeHeroDraft, saveHomeHeroDraft } from '@/lib/homeHeroActions';

const INPUT_CLASS = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none transition focus:border-[#C5A880] focus:ring-2 focus:ring-[#C5A880]/20';
const LABEL_CLASS = 'mb-1 block text-[11px] font-bold text-slate-700';

function createClientKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `slide-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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

function normalizeHero(source) {
  if (!source) return null;
  const hero = source.data || source.hero || source;

  return {
    id: hero.id || null,
    pageId: hero.pageId || null,
    sectionKey: hero.sectionKey || 'hero-slider',
    status: hero.status || 'draft',
    versionNumber: hero.versionNumber || 1,
    isVisible: hero.isVisible !== false,
    autoplayMs: Number(hero.autoplayMs) || 6000,
    updatedAt: hero.updatedAt || null,
    updatedBy: hero.updatedBy || null,
    publishedAt: hero.publishedAt || null,
    publishedBy: hero.publishedBy || null,
    history: (hero.history || []).map((revision) => ({
      id: revision.id || createClientKey(),
      revisionNumber: Number(revision.revisionNumber) || 0,
      summary: revision.summary || 'Saved Home Hero revision',
      createdAt: revision.createdAt || null,
      createdBy: revision.createdBy || null,
    })),
    slides: (hero.slides || []).map((slide, index) => ({
      id: slide.id || null,
      clientKey: slide.clientKey || slide.id || createClientKey(),
      eyebrow: slide.eyebrow || '',
      title: slide.title || '',
      description: slide.description || '',
      primaryCtaLabel: slide.primaryCtaLabel || '',
      primaryCtaUrl: slide.primaryCtaUrl || '',
      primaryCtaTarget: slide.primaryCtaTarget || '_self',
      secondaryCtaLabel: slide.secondaryCtaLabel || '',
      secondaryCtaUrl: slide.secondaryCtaUrl || '',
      secondaryCtaTarget: slide.secondaryCtaTarget || '_self',
      desktopMediaId: slide.desktopMediaId || slide.desktopMedia?.id || null,
      mobileMediaId: slide.mobileMediaId || slide.mobileMedia?.id || null,
      imageAlt: slide.imageAlt || '',
      sortOrder: Number(slide.sortOrder) || (index + 1) * 10,
      isVisible: slide.isVisible !== false,
      desktopMedia: normalizeMedia(slide.desktopMedia),
      mobileMedia: normalizeMedia(slide.mobileMedia),
    })),
  };
}

function newSlide() {
  return {
    id: null,
    clientKey: createClientKey(),
    eyebrow: '',
    title: '',
    description: '',
    primaryCtaLabel: '',
    primaryCtaUrl: '',
    primaryCtaTarget: '_self',
    secondaryCtaLabel: '',
    secondaryCtaUrl: '',
    secondaryCtaTarget: '_self',
    desktopMediaId: null,
    mobileMediaId: null,
    imageAlt: '',
    sortOrder: 10,
    isVisible: true,
    desktopMedia: null,
    mobileMedia: null,
  };
}

function toPayload(hero) {
  return {
    id: hero.id,
    pageId: hero.pageId,
    sectionKey: 'hero-slider',
    isVisible: hero.isVisible,
    autoplayMs: Number(hero.autoplayMs),
    updatedAt: hero.updatedAt,
    expectedUpdatedAt: hero.updatedAt,
    slides: hero.slides.map((slide, index) => ({
      id: slide.id,
      eyebrow: slide.eyebrow.trim(),
      title: slide.title.trim(),
      description: slide.description.trim(),
      primaryCtaLabel: slide.primaryCtaLabel.trim(),
      primaryCtaUrl: slide.primaryCtaUrl.trim(),
      primaryCtaTarget: slide.primaryCtaTarget,
      secondaryCtaLabel: slide.secondaryCtaLabel.trim(),
      secondaryCtaUrl: slide.secondaryCtaUrl.trim(),
      secondaryCtaTarget: slide.secondaryCtaTarget,
      desktopMediaId: slide.desktopMediaId,
      mobileMediaId: slide.mobileMediaId,
      imageAlt: slide.imageAlt.trim(),
      sortOrder: (index + 1) * 10,
      isVisible: slide.isVisible,
    })),
  };
}

function comparable(hero) {
  if (!hero) return '';
  const payload = toPayload(hero);
  delete payload.expectedUpdatedAt;
  return JSON.stringify(payload);
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

function validateHero(hero) {
  const errors = {};
  const autoplay = Number(hero.autoplayMs);

  if (!Number.isInteger(autoplay) || autoplay < 3000 || autoplay > 15000) {
    errors.autoplayMs = 'Use a whole number from 3000 to 15000 milliseconds.';
  }

  if (hero.slides.length < 1 || hero.slides.length > 10) {
    errors.slides = 'Hero Slider requires between 1 and 10 slides.';
  }

  if (!hero.slides.some((slide) => slide.isVisible)) {
    errors.slides = 'At least one slide must be visible.';
  }

  hero.slides.forEach((slide, index) => {
    const prefix = `slides.${index}`;

    if (!slide.eyebrow.trim() || slide.eyebrow.trim().length > 80) {
      errors[`${prefix}.eyebrow`] = 'Eyebrow is required and must be 80 characters or fewer.';
    }
    if (!slide.title.trim() || slide.title.trim().length > 140) {
      errors[`${prefix}.title`] = 'Title is required and must be 140 characters or fewer.';
    }
    if (!slide.description.trim() || slide.description.trim().length > 500) {
      errors[`${prefix}.description`] = 'Description is required and must be 500 characters or fewer.';
    }
    if (!slide.desktopMediaId) {
      errors[`${prefix}.desktopMediaId`] = 'Select a desktop image.';
    }
    if (!slide.imageAlt.trim() || slide.imageAlt.trim().length > 180) {
      errors[`${prefix}.imageAlt`] = 'Alt text is required and must be 180 characters or fewer.';
    }

    ['primary', 'secondary'].forEach((kind) => {
      const label = slide[`${kind}CtaLabel`].trim();
      const url = slide[`${kind}CtaUrl`].trim();

      if ((label && !url) || (!label && url)) {
        errors[`${prefix}.${kind}Cta`] = 'CTA label and URL must be supplied together.';
      } else if (label.length > 40) {
        errors[`${prefix}.${kind}Cta`] = 'CTA label must be 40 characters or fewer.';
      } else if (url && !validUrl(url)) {
        errors[`${prefix}.${kind}Cta`] = 'Use a #section anchor, internal /path, or https:// URL.';
      }
    });
  });

  return errors;
}

function unwrapAction(result) {
  if (!result) return { ok: false, error: 'The server returned no result.' };
  if (result.ok === false) return result;
  return { ok: true, data: result.data || result.hero || result };
}

function mediaPreviewUrl(media) {
  return media?.secureUrl || media?.secure_url || media?.url || '';
}

function actorLabel(actorId) {
  if (!actorId) return 'System';
  return `Admin ${actorId.slice(0, 8)}`;
}

function timestampLabel(value) {
  return value ? new Date(value).toLocaleString() : 'Not recorded';
}

function FieldError({ children }) {
  if (!children) return null;
  return <p className="mt-1 text-[10px] font-semibold text-red-600">{children}</p>;
}

function MediaField({ label, required, media, error, onSelect, onRemove }) {
  const url = mediaPreviewUrl(media);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="text-[11px] font-bold text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {media?.id && <span className="font-mono text-[9px] text-slate-400">{media.id}</span>}
      </div>
      <div className={`flex min-h-24 items-center gap-3 rounded-xl border p-3 ${error ? 'border-red-300 bg-red-50/40' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-300">
          {url ? (
            <img src={url} alt={media?.altText || media?.displayName || ''} className="h-full w-full object-cover" />
          ) : (
            <i className="fa-solid fa-image text-xl"></i>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-slate-700">{media?.displayName || 'No image selected'}</p>
          {media?.width && media?.height && (
            <p className="mt-0.5 text-[10px] text-slate-400">{media.width} × {media.height}px</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={onSelect} className="rounded-lg bg-[#0B1B3D] px-3 py-1.5 text-[10px] font-bold text-white hover:bg-[#122754]">
              <i className="fa-solid fa-photo-film mr-1.5 text-[#C5A880]"></i>
              {media ? 'Replace' : 'Select media'}
            </button>
            {media && (
              <button type="button" onClick={onRemove} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:border-red-200 hover:text-red-600">
                Remove reference
              </button>
            )}
          </div>
        </div>
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}

export default function HomeHeroEditor({ initialHero, initialError = '' }) {
  const router = useRouter();
  const normalizedInitial = useMemo(() => normalizeHero(initialHero), [initialHero]);
  const [hero, setHero] = useState(normalizedInitial);
  const [baseline, setBaseline] = useState(() => comparable(normalizedInitial));
  const [errors, setErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState(initialError);
  const [statusTone, setStatusTone] = useState(initialError ? 'error' : 'neutral');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [previewViewport, setPreviewViewport] = useState('desktop');
  const [mediaPicker, setMediaPicker] = useState(null);
  const [draggedSlideKey, setDraggedSlideKey] = useState(null);

  const dirty = hero ? comparable(hero) !== baseline : false;

  useEffect(() => {
    if (!dirty) return undefined;

    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [dirty]);

  const updateHero = (patch) => {
    setHero((current) => ({ ...current, ...patch }));
    setStatusMessage('');
    setConflict(false);
  };

  const updateSlide = (index, patch) => {
    setHero((current) => ({
      ...current,
      slides: current.slides.map((slide, slideIndex) => (
        slideIndex === index ? { ...slide, ...patch } : slide
      )),
    }));
    setStatusMessage('');
    setConflict(false);
  };

  const moveSlide = (index, direction) => {
    const target = index + direction;
    if (!hero || target < 0 || target >= hero.slides.length) return;

    const slides = [...hero.slides];
    [slides[index], slides[target]] = [slides[target], slides[index]];
    updateHero({
      slides: slides.map((slide, slideIndex) => ({ ...slide, sortOrder: (slideIndex + 1) * 10 })),
    });
  };

  const dropSlideAt = (targetIndex, transferKey) => {
    if (!hero) return;
    const sourceKey = draggedSlideKey || transferKey;
    const sourceIndex = hero.slides.findIndex((slide) => slide.clientKey === sourceKey);
    if (sourceIndex < 0 || sourceIndex === targetIndex) {
      setDraggedSlideKey(null);
      return;
    }

    const slides = [...hero.slides];
    const [movedSlide] = slides.splice(sourceIndex, 1);
    slides.splice(targetIndex, 0, movedSlide);
    updateHero({
      slides: slides.map((slide, slideIndex) => ({ ...slide, sortOrder: (slideIndex + 1) * 10 })),
    });
    setDraggedSlideKey(null);
  };

  const addSlide = () => {
    if (!hero || hero.slides.length >= 10) return;
    updateHero({
      slides: [...hero.slides, { ...newSlide(), sortOrder: (hero.slides.length + 1) * 10 }],
    });
  };

  const duplicateSlide = (index) => {
    if (!hero || hero.slides.length >= 10) return;
    const source = hero.slides[index];
    const duplicate = {
      ...source,
      id: null,
      clientKey: createClientKey(),
      title: `${source.title} Copy`.slice(0, 140),
      desktopMedia: source.desktopMedia ? { ...source.desktopMedia } : null,
      mobileMedia: source.mobileMedia ? { ...source.mobileMedia } : null,
    };
    const slides = [...hero.slides];
    slides.splice(index + 1, 0, duplicate);
    updateHero({
      slides: slides.map((slide, slideIndex) => ({ ...slide, sortOrder: (slideIndex + 1) * 10 })),
    });
  };

  const removeSlide = (index) => {
    if (!hero || hero.slides.length <= 1) {
      setStatusTone('error');
      setStatusMessage('Hero Slider must retain at least one slide.');
      return;
    }
    if (!window.confirm(`Remove slide ${index + 1}? The media assets will remain in the library.`)) return;

    updateHero({
      slides: hero.slides
        .filter((_, slideIndex) => slideIndex !== index)
        .map((slide, slideIndex) => ({ ...slide, sortOrder: (slideIndex + 1) * 10 })),
    });
  };

  const applyServerFailure = (result, fallback) => {
    const isConflict = result.status === 409 || String(result.code || '').includes('CONFLICT') || result.code === 'STALE_WRITE';
    setErrors(result.fieldErrors || {});
    setConflict(isConflict);
    setStatusTone('error');
    setStatusMessage(result.error || result.message || fallback);
  };

  const handleSave = async () => {
    if (!hero) return;
    const clientErrors = validateHero(hero);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      setStatusTone('error');
      setStatusMessage('Fix the highlighted fields before saving the draft.');
      return;
    }

    setSaving(true);
    setConflict(false);
    setStatusMessage('');

    try {
      const result = unwrapAction(await saveHomeHeroDraft(toPayload(hero)));
      if (!result.ok) {
        applyServerFailure(result, 'The Hero draft could not be saved.');
        return;
      }

      const savedHero = normalizeHero(result.data);
      setHero(savedHero);
      setBaseline(comparable(savedHero));
      setErrors({});
      setStatusTone('success');
      setStatusMessage('Draft saved. The published Home page has not changed.');
    } catch (error) {
      setStatusTone('error');
      setStatusMessage(error instanceof Error ? error.message : 'The Hero draft could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!hero || dirty || !hero.id) return;
    setPublishing(true);
    setConflict(false);
    setStatusMessage('');

    try {
      const result = unwrapAction(await publishHomeHeroDraft({
        id: hero.id,
        sectionId: hero.id,
        expectedUpdatedAt: hero.updatedAt,
      }));

      if (!result.ok) {
        applyServerFailure(result, 'The Hero draft could not be published.');
        return;
      }

      const publishedHero = normalizeHero(result.data);
      setHero(publishedHero);
      setBaseline(comparable(publishedHero));
      setErrors({});
      setStatusTone('success');
      setStatusMessage('Hero Slider published and the public Home cache was refreshed.');
      router.refresh();
    } catch (error) {
      setStatusTone('error');
      setStatusMessage(error instanceof Error ? error.message : 'The Hero draft could not be published.');
    } finally {
      setPublishing(false);
    }
  };

  const handleMediaSelect = (asset) => {
    if (!mediaPicker) return;
    const media = normalizeMedia(asset);
    const isDesktop = mediaPicker.kind === 'desktop';
    updateSlide(mediaPicker.slideIndex, isDesktop
      ? { desktopMediaId: media.id, desktopMedia: media, imageAlt: hero.slides[mediaPicker.slideIndex].imageAlt || media.altText || '' }
      : { mobileMediaId: media.id, mobileMedia: media });
    setMediaPicker(null);
  };

  if (!hero) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <i className="fa-solid fa-triangle-exclamation text-3xl text-red-500"></i>
        <h1 className="mt-3 font-serif text-2xl font-bold text-[#0B1B3D]">Hero Slider editor unavailable</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">
          {initialError || 'No draft or published Hero Slider version was returned.'}
        </p>
        <button type="button" onClick={() => router.refresh()} className="mt-5 rounded-xl bg-[#0B1B3D] px-5 py-2 text-xs font-bold text-white">
          Retry loading
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${hero.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {hero.status}
              </span>
              <span className="font-mono text-[10px] text-slate-400">key: hero-slider · version {hero.versionNumber}</span>
              {dirty && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">Unsaved changes</span>}
            </div>
            <h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Home Hero Slider</h1>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Edit the published website’s existing five-slide composition without changing its visual system.
            </p>
            <p className="mt-2 text-[10px] text-slate-400">
              Last saved: {timestampLabel(hero.updatedAt)} by {actorLabel(hero.updatedBy)}
            </p>
            {hero.publishedAt && (
              <p className="mt-1 text-[10px] text-slate-400">
                Published: {timestampLabel(hero.publishedAt)} by {actorLabel(hero.publishedBy)}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin-preview/home/hero-slider" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:border-[#C5A880]">
              <i className="fa-solid fa-up-right-from-square mr-1.5 text-[#B59410]"></i>
              Saved version preview
            </Link>
            <button type="button" onClick={handleSave} disabled={saving || publishing || !dirty} className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#122754] disabled:cursor-not-allowed disabled:opacity-45">
              <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'} mr-1.5 text-[#C5A880]`}></i>
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button type="button" onClick={handlePublish} disabled={saving || publishing || dirty || !hero.id || hero.status === 'published'} className="rounded-xl bg-[#B59410] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#9F7E0C] disabled:cursor-not-allowed disabled:opacity-45">
              <i className={`fa-solid ${publishing ? 'fa-spinner fa-spin' : 'fa-paper-plane'} mr-1.5`}></i>
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className={`mt-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-semibold ${statusTone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : statusTone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
            <span>{statusMessage}</span>
            {conflict && (
              <button type="button" onClick={() => router.refresh()} className="shrink-0 underline underline-offset-2">
                Reload latest
              </button>
            )}
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-7">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="border-b border-slate-100 pb-3 font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Section settings</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span>
                  <span className="block text-xs font-bold text-slate-700">Section visible</span>
                  <span className="mt-0.5 block text-[10px] text-slate-400">Hide the complete Hero when disabled.</span>
                </span>
                <input type="checkbox" checked={hero.isVisible} onChange={(event) => updateHero({ isVisible: event.target.checked })} className="h-4 w-4 accent-[#B59410]" />
              </label>
              <div>
                <label className={LABEL_CLASS} htmlFor="hero-autoplay">Autoplay interval (milliseconds)</label>
                <input id="hero-autoplay" type="number" min="3000" max="15000" step="500" value={hero.autoplayMs} onChange={(event) => updateHero({ autoplayMs: event.target.value })} className={INPUT_CLASS} />
                <FieldError>{errors.autoplayMs}</FieldError>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Revision history</h2>
                <p className="mt-1 text-[10px] text-slate-400">Latest saved changes for this content version.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                {hero.history.length} shown
              </span>
            </div>

            {hero.history.length > 0 ? (
              <ol className="mt-3 divide-y divide-slate-100">
                {hero.history.map((revision) => (
                  <li key={revision.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-xs font-bold text-slate-700">{revision.summary}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{actorLabel(revision.createdBy)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[10px] font-bold text-[#8A6D08]">revision {revision.revisionNumber || '—'}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{timestampLabel(revision.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">No saved revision history is available yet.</p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Slider items</h2>
                <p className="mt-1 text-[10px] text-slate-400">{hero.slides.length} of 10 slides · order is saved in increments of 10</p>
              </div>
              <button type="button" onClick={addSlide} disabled={hero.slides.length >= 10} className="rounded-xl border border-[#C5A880]/50 bg-amber-50 px-3 py-2 text-xs font-bold text-[#8A6D08] disabled:opacity-40">
                <i className="fa-solid fa-plus mr-1.5"></i>Add slide
              </button>
            </div>
            <FieldError>{errors.slides}</FieldError>

            <div className="mt-4 space-y-4">
              {hero.slides.map((slide, index) => {
                const prefix = `slides.${index}`;
                return (
                  <details
                    key={slide.clientKey}
                    open={index === 0}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      dropSlideAt(index, event.dataTransfer.getData('text/plain'));
                    }}
                    className={`group rounded-2xl border border-slate-200 bg-slate-50/60 open:bg-white ${draggedSlideKey === slide.clientKey ? 'opacity-60 ring-2 ring-[#C5A880]' : ''}`}
                  >
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0B1B3D] text-xs font-bold text-[#C5A880]">{index + 1}</span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[#0B1B3D]">{slide.title || 'Untitled slide'}</p>
                          <p className="mt-0.5 text-[10px] text-slate-400">order {slide.sortOrder} · {slide.isVisible ? 'visible' : 'hidden'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1" onClick={(event) => event.preventDefault()}>
                        <button
                          type="button"
                          draggable
                          title="Drag to reorder. Keyboard users can use the Up and Down buttons."
                          aria-label={`Drag slide ${index + 1} to reorder`}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', slide.clientKey);
                            setDraggedSlideKey(slide.clientKey);
                          }}
                          onDragEnd={() => setDraggedSlideKey(null)}
                          className="flex h-8 w-8 cursor-grab items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 active:cursor-grabbing"
                        >
                          <i className="fa-solid fa-grip-vertical"></i>
                        </button>
                        <button type="button" onClick={() => moveSlide(index, -1)} disabled={index === 0} aria-label={`Move slide ${index + 1} up`} className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-30"><i className="fa-solid fa-arrow-up"></i></button>
                        <button type="button" onClick={() => moveSlide(index, 1)} disabled={index === hero.slides.length - 1} aria-label={`Move slide ${index + 1} down`} className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-30"><i className="fa-solid fa-arrow-down"></i></button>
                        <button type="button" onClick={() => duplicateSlide(index)} disabled={hero.slides.length >= 10} aria-label={`Duplicate slide ${index + 1}`} className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-30"><i className="fa-solid fa-copy"></i></button>
                        <button type="button" onClick={() => removeSlide(index)} aria-label={`Remove slide ${index + 1}`} className="h-8 w-8 rounded-lg border border-red-100 bg-white text-red-500"><i className="fa-solid fa-trash"></i></button>
                        <i className="fa-solid fa-chevron-down ml-1 text-[10px] text-slate-400 transition group-open:rotate-180"></i>
                      </div>
                    </summary>

                    <div className="space-y-5 border-t border-slate-100 p-4">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                        <input type="checkbox" checked={slide.isVisible} onChange={(event) => updateSlide(index, { isVisible: event.target.checked })} className="h-4 w-4 accent-[#B59410]" />
                        Display this slide
                      </label>

                      <div>
                        <label className={LABEL_CLASS}>Eyebrow <span className="text-red-500">*</span></label>
                        <input value={slide.eyebrow} maxLength={80} onChange={(event) => updateSlide(index, { eyebrow: event.target.value })} className={INPUT_CLASS} />
                        <div className="mt-1 flex justify-between"><FieldError>{errors[`${prefix}.eyebrow`]}</FieldError><span className="text-[9px] text-slate-400">{slide.eyebrow.length}/80</span></div>
                      </div>

                      <div>
                        <label className={LABEL_CLASS}>Title <span className="text-red-500">*</span></label>
                        <input value={slide.title} maxLength={140} onChange={(event) => updateSlide(index, { title: event.target.value })} className={INPUT_CLASS} />
                        <div className="mt-1 flex justify-between"><FieldError>{errors[`${prefix}.title`]}</FieldError><span className="text-[9px] text-slate-400">{slide.title.length}/140</span></div>
                      </div>

                      <div>
                        <label className={LABEL_CLASS}>Description <span className="text-red-500">*</span></label>
                        <textarea value={slide.description} maxLength={500} rows={4} onChange={(event) => updateSlide(index, { description: event.target.value })} className={`${INPUT_CLASS} resize-y leading-relaxed`} />
                        <div className="mt-1 flex justify-between"><FieldError>{errors[`${prefix}.description`]}</FieldError><span className="text-[9px] text-slate-400">{slide.description.length}/500</span></div>
                      </div>

                      {['primary', 'secondary'].map((kind) => (
                        <fieldset key={kind} className="rounded-xl border border-slate-200 p-4">
                          <legend className="px-2 text-[10px] font-bold uppercase tracking-wider text-[#8A6D08]">{kind} CTA</legend>
                          <div className="grid gap-3 sm:grid-cols-12">
                            <div className="sm:col-span-4">
                              <label className={LABEL_CLASS}>Label</label>
                              <input value={slide[`${kind}CtaLabel`]} maxLength={40} onChange={(event) => updateSlide(index, { [`${kind}CtaLabel`]: event.target.value })} className={INPUT_CLASS} />
                            </div>
                            <div className="sm:col-span-5">
                              <label className={LABEL_CLASS}>URL</label>
                              <input value={slide[`${kind}CtaUrl`]} onChange={(event) => updateSlide(index, { [`${kind}CtaUrl`]: event.target.value })} placeholder="#projects or /about" className={`${INPUT_CLASS} font-mono`} />
                            </div>
                            <div className="sm:col-span-3">
                              <label className={LABEL_CLASS}>Target</label>
                              <select value={slide[`${kind}CtaTarget`]} onChange={(event) => updateSlide(index, { [`${kind}CtaTarget`]: event.target.value })} className={INPUT_CLASS}>
                                <option value="_self">Same tab</option>
                                <option value="_blank">New tab</option>
                              </select>
                            </div>
                          </div>
                          <FieldError>
                            {errors[`${prefix}.${kind}Cta`] ||
                              errors[`${prefix}.${kind}CtaLabel`] ||
                              errors[`${prefix}.${kind}CtaUrl`] ||
                              errors[`${prefix}.${kind}CtaTarget`]}
                          </FieldError>
                        </fieldset>
                      ))}

                      <MediaField label="Desktop image" required media={slide.desktopMedia} error={errors[`${prefix}.desktopMediaId`]} onSelect={() => setMediaPicker({ slideIndex: index, kind: 'desktop' })} onRemove={() => updateSlide(index, { desktopMediaId: null, desktopMedia: null })} />
                      <MediaField label="Mobile image" media={slide.mobileMedia} onSelect={() => setMediaPicker({ slideIndex: index, kind: 'mobile' })} onRemove={() => updateSlide(index, { mobileMediaId: null, mobileMedia: null })} />

                      <div>
                        <label className={LABEL_CLASS}>Image alt text <span className="text-red-500">*</span></label>
                        <input value={slide.imageAlt} maxLength={180} onChange={(event) => updateSlide(index, { imageAlt: event.target.value })} className={INPUT_CLASS} />
                        <div className="mt-1 flex justify-between"><FieldError>{errors[`${prefix}.imageAlt`]}</FieldError><span className="text-[9px] text-slate-400">{slide.imageAlt.length}/180</span></div>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-4 xl:col-span-5">
          <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-serif text-xs font-bold uppercase tracking-wider text-[#0B1B3D]">Unsaved local preview</h2>
                <p className="mt-0.5 text-[10px] text-slate-400">This does not expose the draft publicly.</p>
              </div>
              <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
                {['desktop', 'mobile'].map((viewport) => (
                  <button key={viewport} type="button" onClick={() => setPreviewViewport(viewport)} className={`rounded-lg px-2.5 py-1 text-[10px] font-bold capitalize ${previewViewport === viewport ? 'bg-white text-[#0B1B3D] shadow-sm' : 'text-slate-500'}`}>
                    <i className={`fa-solid ${viewport === 'desktop' ? 'fa-desktop' : 'fa-mobile-screen'} mr-1`}></i>{viewport}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-700 bg-[#07132B]">
              <div className={`mx-auto transition-all ${previewViewport === 'mobile' ? 'max-w-[390px]' : 'w-full'}`}>
                <HeroSlider hero={hero} previewMode previewViewport={previewViewport} />
              </div>
            </div>
            {dirty && <p className="mt-3 text-[10px] font-semibold text-blue-700">Preview includes unsaved form values.</p>}
            {!hero.isVisible && <p className="mt-3 text-[10px] font-semibold text-amber-700">The section is disabled, so the preview is intentionally empty.</p>}
          </div>
        </aside>
      </div>

      {mediaPicker && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-7xl">
            <MediaLibrary
              isModal
              resourceTypeFilter="image"
              onSelectAsset={handleMediaSelect}
              onCloseModal={() => setMediaPicker(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
