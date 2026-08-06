'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PartnersCarousel from '@/components/PartnersCarousel';
import { publishHomePartnersCarouselDraft, saveHomePartnersCarouselDraft } from '@/lib/homePartnersCarouselActions';
import MediaLibrary from './MediaLibrary';

const INPUT_CLASS = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none transition focus:border-[#C5A880] focus:ring-2 focus:ring-[#C5A880]/20';
const LABEL_CLASS = 'mb-1 block text-[11px] font-bold text-slate-700';
const ICON_PATTERN = /^fa-[a-z0-9-]{1,60}$/;
const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function mappedAsset(asset) {
  if (!asset) return null;
  return {
    id: asset.id,
    secureUrl: asset.secure_url || asset.secureUrl || asset.url || '',
    displayName: asset.display_name || asset.displayName || asset.original_filename || asset.filename || '',
    altText: asset.alt_text || asset.altText || '',
    format: asset.format || '',
    width: asset.width || null,
    height: asset.height || null,
  };
}

function optimizedIconUrl(url) {
  if (!url || !url.includes('/upload/')) return url;
  return url.replace('/upload/', '/upload/f_auto,q_auto,c_fit,w_96,h_96/');
}

function normalizePartner(partner, index) {
  const customIconMediaId = partner?.customIconMediaId || partner?.custom_icon_asset_id || null;
  return {
    itemId: partner?.itemId || null,
    itemKey: partner?.itemKey || `partner-${index + 1}`,
    name: partner?.name || '',
    category: partner?.category || '',
    iconMode: partner?.iconMode || partner?.iconLibrary || (customIconMediaId ? 'custom' : 'fontawesome'),
    iconKey: partner?.iconKey || 'fa-building',
    customIconMediaId,
    customIconMedia: mappedAsset(partner?.customIconMedia),
    accentColor: partner?.accentColor || '#c5a880',
    sortOrder: (index + 1) * 10,
    isVisible: partner?.isVisible !== false,
  };
}

function normalizeCarousel(source) {
  if (!source) return null;
  const carousel = source.data || source.partnersCarousel || source;
  return {
    id: carousel.id || null,
    pageId: carousel.pageId || null,
    sectionKey: carousel.sectionKey || 'partners-carousel',
    status: carousel.status || 'draft',
    versionNumber: Number(carousel.versionNumber) || 1,
    heading: carousel.heading || '',
    isVisible: carousel.isVisible !== false,
    partners: (carousel.partners || []).map(normalizePartner),
    updatedAt: carousel.updatedAt || null,
    updatedBy: carousel.updatedBy || null,
    publishedAt: carousel.publishedAt || null,
    publishedBy: carousel.publishedBy || null,
    history: (carousel.history || []).map((revision) => ({
      id: revision.id,
      revisionNumber: Number(revision.revisionNumber) || 0,
      summary: revision.summary || 'Saved Home Partners Carousel revision',
      createdAt: revision.createdAt || null,
      createdBy: revision.createdBy || null,
    })),
  };
}

function toPayload(carousel) {
  return {
    id: carousel.id,
    pageId: carousel.pageId,
    sectionKey: 'partners-carousel',
    heading: carousel.heading.trim(),
    isVisible: carousel.isVisible,
    updatedAt: carousel.updatedAt,
    partners: carousel.partners.map((partner) => ({
      itemKey: partner.itemKey,
      name: partner.name.trim(),
      category: partner.category.trim(),
      iconMode: partner.iconMode,
      iconKey: partner.iconKey.trim(),
      customIconMediaId: partner.iconMode === 'custom' ? partner.customIconMediaId : null,
      accentColor: partner.accentColor.trim().toLowerCase(),
      isVisible: partner.isVisible,
    })),
  };
}

function comparable(carousel) { return carousel ? JSON.stringify(toPayload(carousel)) : ''; }
function newItemKey() { return `partner-${globalThis.crypto.randomUUID()}`; }
function FieldError({ children }) { return children ? <p className="mt-1 text-[10px] font-semibold text-red-600">{children}</p> : null; }
function timestampLabel(value) { return value ? new Date(value).toLocaleString() : 'Not recorded'; }
function actorLabel(value) { return value ? `Admin ${value.slice(0, 8)}` : 'System'; }

function validateCarousel(carousel) {
  const errors = {};
  if (!carousel.heading.trim() || carousel.heading.trim().length > 120) errors.heading = 'Heading is required and must be 120 characters or fewer.';
  if (carousel.partners.length < 1 || carousel.partners.length > 20) errors.partners = 'Add between 1 and 20 partners.';
  if (!carousel.partners.some((partner) => partner.isVisible)) errors.partners = 'At least one partner must be visible.';
  carousel.partners.forEach((partner, index) => {
    const prefix = `partners.${index}`;
    if (!partner.name.trim() || partner.name.trim().length > 80) errors[`${prefix}.name`] = 'Name is required and must be 80 characters or fewer.';
    if (!partner.category.trim() || partner.category.trim().length > 80) errors[`${prefix}.category`] = 'Category is required and must be 80 characters or fewer.';
    if (!['fontawesome', 'custom'].includes(partner.iconMode)) errors[`${prefix}.iconMode`] = 'Select a supported icon source.';
    if (partner.iconMode === 'fontawesome' && !ICON_PATTERN.test(partner.iconKey.trim())) errors[`${prefix}.iconKey`] = 'Use a Font Awesome key such as fa-building.';
    if (partner.iconMode === 'custom' && !partner.customIconMediaId) errors[`${prefix}.customIconMediaId`] = 'Choose or upload an image icon.';
    if (!COLOR_PATTERN.test(partner.accentColor.trim())) errors[`${prefix}.accentColor`] = 'Use a six-digit hex colour.';
  });
  return errors;
}

function PartnerIconPreview({ partner }) {
  const color = COLOR_PATTERN.test(partner.accentColor) ? partner.accentColor : '#c5a880';
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl text-white" style={{ backgroundColor: color }}>
      {partner.iconMode === 'custom' && partner.customIconMedia?.secureUrl
        ? <img src={optimizedIconUrl(partner.customIconMedia.secureUrl)} alt="" className="h-[26px] w-[26px] object-contain" aria-hidden="true" />
        : <i className={`fa-solid ${ICON_PATTERN.test(partner.iconKey) ? partner.iconKey : 'fa-circle-question'}`} aria-hidden="true"></i>}
    </span>
  );
}

export default function HomePartnersCarouselEditor({ initialPartnersCarousel, initialError = '' }) {
  const router = useRouter();
  const normalizedInitial = useMemo(() => normalizeCarousel(initialPartnersCarousel), [initialPartnersCarousel]);
  const [carousel, setCarousel] = useState(normalizedInitial);
  const [baseline, setBaseline] = useState(() => comparable(normalizedInitial));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(initialError);
  const [tone, setTone] = useState(initialError ? 'error' : 'neutral');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [pickerIndex, setPickerIndex] = useState(null);
  const dirty = carousel ? comparable(carousel) !== baseline : false;

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (patch) => { setCarousel((current) => ({ ...current, ...patch })); setMessage(''); setConflict(false); };
  const updatePartner = (index, patch) => {
    setCarousel((current) => ({ ...current, partners: current.partners.map((partner, partnerIndex) => partnerIndex === index ? { ...partner, ...patch } : partner) }));
    setMessage(''); setConflict(false);
  };
  const normalizeOrder = (partners) => partners.map((partner, index) => ({ ...partner, sortOrder: (index + 1) * 10 }));
  const movePartner = (index, direction) => {
    const destination = index + direction;
    if (destination < 0 || destination >= carousel.partners.length) return;
    const partners = [...carousel.partners];
    [partners[index], partners[destination]] = [partners[destination], partners[index]];
    update({ partners: normalizeOrder(partners) });
  };
  const addPartner = () => {
    if (carousel.partners.length >= 20) return;
    update({ partners: normalizeOrder([...carousel.partners, normalizePartner({ itemKey: newItemKey(), name: 'New Partner', category: 'Partner Category', iconMode: 'fontawesome', iconKey: 'fa-building', accentColor: '#c5a880', isVisible: true }, carousel.partners.length)]) });
  };
  const duplicatePartner = (index) => {
    if (carousel.partners.length >= 20) return;
    const source = carousel.partners[index];
    const copy = { ...source, itemId: null, itemKey: newItemKey(), name: `${source.name} Copy` };
    const partners = [...carousel.partners];
    partners.splice(index + 1, 0, copy);
    update({ partners: normalizeOrder(partners) });
  };
  const removePartner = (index) => {
    if (carousel.partners.length <= 1) return;
    if (!window.confirm(`Remove "${carousel.partners[index].name}" from this Partners Carousel draft?`)) return;
    update({ partners: normalizeOrder(carousel.partners.filter((_, partnerIndex) => partnerIndex !== index)) });
  };
  const chooseCustomIcon = (asset) => {
    if (pickerIndex === null) return;
    updatePartner(pickerIndex, {
      iconMode: 'custom',
      customIconMediaId: asset.id,
      customIconMedia: mappedAsset(asset),
    });
    setPickerIndex(null);
  };
  const applyFailure = (result, fallback) => {
    setErrors(result.fieldErrors || {});
    setConflict(result.status === 409 || String(result.code || '').includes('CONFLICT'));
    setTone('error'); setMessage(result.error || fallback);
  };
  const handleSave = async () => {
    const clientErrors = validateCarousel(carousel);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) { setTone('error'); setMessage('Fix the highlighted fields before saving.'); return; }
    setSaving(true);
    try {
      const result = await saveHomePartnersCarouselDraft(toPayload(carousel));
      if (!result?.ok) return applyFailure(result || {}, 'The Partners Carousel draft could not be saved.');
      const saved = normalizeCarousel(result.data);
      setCarousel(saved); setBaseline(comparable(saved)); setErrors({}); setTone('success');
      setMessage('Draft saved. The published Home page has not changed.');
    } catch (error) { setTone('error'); setMessage(error instanceof Error ? error.message : 'The Partners Carousel draft could not be saved.'); }
    finally { setSaving(false); }
  };
  const handlePublish = async () => {
    setPublishing(true);
    try {
      const result = await publishHomePartnersCarouselDraft({ id: carousel.id, expectedUpdatedAt: carousel.updatedAt });
      if (!result?.ok) return applyFailure(result || {}, 'The Partners Carousel draft could not be published.');
      const published = normalizeCarousel(result.data);
      setCarousel(published); setBaseline(comparable(published)); setErrors({}); setTone('success');
      setMessage('Partners Carousel published and the public Home cache was refreshed.'); router.refresh();
    } catch (error) { setTone('error'); setMessage(error instanceof Error ? error.message : 'The Partners Carousel draft could not be published.'); }
    finally { setPublishing(false); }
  };

  if (!carousel) return <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm"><h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Partners Carousel editor unavailable</h1><p className="mt-2 text-sm text-slate-600">{initialError || 'No saved Partners Carousel version was returned.'}</p><button type="button" onClick={() => router.refresh()} className="mt-5 rounded-xl bg-[#0B1B3D] px-5 py-2 text-xs font-bold text-white">Retry loading</button></div>;

  return (
    <div className="w-full space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${carousel.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{carousel.status}</span>
              <span className="font-mono text-[10px] text-slate-400">key: partners-carousel · version {carousel.versionNumber}</span>
              {dirty && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">Unsaved changes</span>}
            </div>
            <h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Home Partners Carousel</h1>
            <p className="mt-1 text-xs font-medium text-slate-500">Manage 1–20 canonical records; the continuous duplicate loop is generated only when rendered.</p>
            <p className="mt-2 text-[10px] text-slate-400">Last saved: {timestampLabel(carousel.updatedAt)} by {actorLabel(carousel.updatedBy)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin-preview/home/partners-carousel" target="_blank" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">Saved version preview</Link>
            <button type="button" onClick={handleSave} disabled={!dirty || saving || publishing} className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save Draft'}</button>
            <button type="button" onClick={handlePublish} disabled={dirty || carousel.status !== 'draft' || saving || publishing} className="rounded-xl bg-[#B59410] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{publishing ? 'Publishing…' : 'Publish'}</button>
          </div>
        </div>
        {message && <div className={`mt-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-semibold ${tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}><span>{message}</span>{conflict && <button type="button" onClick={() => router.refresh()} className="underline">Reload latest</button>}</div>}
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-7">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div><label className={LABEL_CLASS}>Section heading</label><input value={carousel.heading} maxLength={120} onChange={(event) => update({ heading: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors.heading}</FieldError></div>
              <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-bold text-slate-700"><input type="checkbox" checked={carousel.isVisible} onChange={(event) => update({ isVisible: event.target.checked })} className="h-4 w-4 accent-[#B59410]" />Section visible</label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div><h2 className="font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Partner records</h2><p className="mt-1 text-[10px] text-slate-400">Order is normalized to 10, 20, 30… when saved.</p></div>
              <button type="button" onClick={addPartner} disabled={carousel.partners.length >= 20} className="rounded-xl bg-[#0B1B3D] px-3 py-2 text-[10px] font-bold text-white disabled:opacity-40"><i className="fa-solid fa-plus mr-1.5"></i>Add partner</button>
            </div>
            <FieldError>{errors.partners}</FieldError>
            <div className="mt-4 space-y-4">{carousel.partners.map((partner, index) => {
              const prefix = `partners.${index}`;
              return <article key={partner.itemKey} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3"><PartnerIconPreview partner={partner} /><div><h3 className="text-xs font-bold text-[#0B1B3D]">Partner {index + 1}</h3><p className="font-mono text-[9px] text-slate-400">{partner.itemKey}</p></div></div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => movePartner(index, -1)} disabled={index === 0} aria-label={`Move ${partner.name} up`} className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30"><i className="fa-solid fa-arrow-up"></i></button>
                    <button type="button" onClick={() => movePartner(index, 1)} disabled={index === carousel.partners.length - 1} aria-label={`Move ${partner.name} down`} className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30"><i className="fa-solid fa-arrow-down"></i></button>
                    <button type="button" onClick={() => duplicatePartner(index)} disabled={carousel.partners.length >= 20} aria-label={`Duplicate ${partner.name}`} className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30"><i className="fa-solid fa-copy"></i></button>
                    <button type="button" onClick={() => removePartner(index)} disabled={carousel.partners.length <= 1} aria-label={`Remove ${partner.name}`} className="h-8 w-8 rounded-lg border border-red-200 bg-white text-red-600 disabled:opacity-30"><i className="fa-solid fa-trash"></i></button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className={LABEL_CLASS}>Partner name</label><input value={partner.name} maxLength={80} onChange={(event) => updatePartner(index, { name: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors[`${prefix}.name`]}</FieldError></div>
                  <div><label className={LABEL_CLASS}>Category</label><input value={partner.category} maxLength={80} onChange={(event) => updatePartner(index, { category: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors[`${prefix}.category`]}</FieldError></div>
                  <div>
                    <label className={LABEL_CLASS}>Icon source</label>
                    <select
                      value={partner.iconMode}
                      onChange={(event) => updatePartner(index, { iconMode: event.target.value })}
                      className={INPUT_CLASS}
                    >
                      <option value="fontawesome">Font Awesome code</option>
                      <option value="custom">Uploaded icon / logo</option>
                    </select>
                    <FieldError>{errors[`${prefix}.iconMode`]}</FieldError>
                  </div>
                  <div><label className={LABEL_CLASS}>Accent colour</label><div className="flex gap-2"><input type="color" value={COLOR_PATTERN.test(partner.accentColor) ? partner.accentColor : '#c5a880'} onChange={(event) => updatePartner(index, { accentColor: event.target.value })} className="h-9 w-12 rounded-lg border border-slate-200 bg-white p-1" /><input value={partner.accentColor} maxLength={7} onChange={(event) => updatePartner(index, { accentColor: event.target.value })} className={`${INPUT_CLASS} font-mono`} /></div><FieldError>{errors[`${prefix}.accentColor`]}</FieldError></div>
                </div>

                {partner.iconMode === 'fontawesome' ? (
                  <div className="mt-4"><label className={LABEL_CLASS}>Font Awesome icon</label><input value={partner.iconKey} maxLength={63} onChange={(event) => updatePartner(index, { iconKey: event.target.value })} className={`${INPUT_CLASS} font-mono`} /><FieldError>{errors[`${prefix}.iconKey`]}</FieldError></div>
                ) : (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          {partner.customIconMedia?.secureUrl
                            ? <img src={optimizedIconUrl(partner.customIconMedia.secureUrl)} alt="" className="h-12 w-12 object-contain" />
                            : <i className="fa-solid fa-image text-xl text-slate-300" aria-hidden="true"></i>}
                        </span>
                        <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-700">{partner.customIconMedia?.displayName || 'No uploaded icon selected'}</p><p className="mt-1 text-[10px] text-slate-400">{partner.customIconMedia?.width && partner.customIconMedia?.height ? `${partner.customIconMedia.width} × ${partner.customIconMedia.height}px` : 'Choose an image from the media library.'}</p></div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setPickerIndex(index)} className="rounded-lg bg-[#0B1B3D] px-3 py-2 text-[10px] font-bold text-white">Choose / upload icon</button>
                        {partner.customIconMediaId && <button type="button" onClick={() => updatePartner(index, { customIconMediaId: null, customIconMedia: null })} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-[10px] font-bold text-red-600">Remove icon</button>}
                      </div>
                    </div>
                    <p className="mt-3 text-[10px] leading-4 text-slate-500">Recommended: square SVG or transparent PNG, at least 96 × 96 px. The public carousel automatically delivers an optimized 96 × 96 asset and renders it inside the existing 34 × 34 icon area.</p>
                    <FieldError>{errors[`${prefix}.customIconMediaId`]}</FieldError>
                  </div>
                )}

                <label className="mt-4 flex items-center gap-2 text-[11px] font-bold text-slate-600"><input type="checkbox" checked={partner.isVisible} onChange={(event) => updatePartner(index, { isVisible: event.target.checked })} className="h-4 w-4 accent-[#B59410]" />Show this partner</label>
              </article>;
            })}</div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="border-b border-slate-100 pb-3 font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Revision history</h2>
            {carousel.history.length ? <ol className="mt-3 divide-y divide-slate-100">{carousel.history.map((revision) => <li key={revision.id} className="flex justify-between gap-3 py-3"><div><p className="text-xs font-bold text-slate-700">{revision.summary}</p><p className="mt-1 text-[10px] text-slate-400">{actorLabel(revision.createdBy)}</p></div><div className="text-right"><p className="font-mono text-[10px] font-bold text-[#8A6D08]">revision {revision.revisionNumber || '—'}</p><p className="mt-1 text-[10px] text-slate-400">{timestampLabel(revision.createdAt)}</p></div></li>)}</ol> : <p className="mt-3 text-xs text-slate-500">No saved revisions yet.</p>}
          </section>
        </div>

        <aside className="xl:col-span-5"><div className="sticky top-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-4"><h2 className="font-serif text-xs font-bold uppercase tracking-wider text-[#0B1B3D]">Unsaved local preview</h2><p className="mt-1 text-[10px] text-slate-400">Uses the public carousel component with animation paused.</p></div><div className="overflow-hidden"><PartnersCarousel partnersCarousel={carousel} previewMode /></div>{dirty && <p className="border-t border-slate-100 p-3 text-[10px] font-semibold text-blue-700">Preview includes unsaved form values.</p>}{!carousel.isVisible && <p className="border-t border-slate-100 p-3 text-[10px] font-semibold text-amber-700">The section is disabled, so the preview is empty.</p>}</div></aside>
      </div>

      {pickerIndex !== null && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-7xl">
            <MediaLibrary
              isModal
              resourceTypeFilter="image"
              initialFolder="dhaka-heights/dev/icons"
              onSelectAsset={chooseCustomIcon}
              onCloseModal={() => setPickerIndex(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
