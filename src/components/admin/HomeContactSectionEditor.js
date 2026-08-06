'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ContactForm from '@/components/ContactForm';
import { publishHomeContactSectionDraft, saveHomeContactSectionDraft } from '@/lib/homeContactSectionActions';

const INPUT_CLASS = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none transition focus:border-[#C5A880] focus:ring-2 focus:ring-[#C5A880]/20';
const LABEL_CLASS = 'mb-1 block text-[11px] font-bold text-slate-700';
const ICON_PATTERN = /^fa-[a-z0-9-]{1,60}$/;
const VALUE_PATTERN = /^[a-zA-Z0-9_-]{1,60}$/;
const COPY_GROUPS = [
  { title: 'Form introduction', fields: [
    ['formHeading', 'Form heading', 120], ['formDescription', 'Form description', 500, true],
  ] },
  { title: 'Field labels', fields: [
    ['nameLabel', 'Name label', 80], ['emailLabel', 'Email label', 80], ['phoneLabel', 'Phone label', 80],
    ['sizeLabel', 'Space-size label', 80], ['messageLabel', 'Requirements label', 120],
  ] },
  { title: 'Validation messages', fields: [
    ['nameError', 'Name validation', 180], ['emailError', 'Email validation', 180],
    ['phoneError', 'Phone validation', 180], ['sizeError', 'Space-size validation', 180],
  ] },
  { title: 'Submit and success state', fields: [
    ['submitLabel', 'Submit label', 60], ['submittingLabel', 'Submitting label', 60],
    ['successTitle', 'Success title', 120], ['successBody', 'Success message', 500, true], ['closeLabel', 'Close label', 40],
  ] },
  { title: 'Map labels', fields: [
    ['mapLakeLabel', 'Lake label', 80], ['mapRoadLabel', 'Road label', 80], ['mapTooltip', 'Location tooltip', 180],
  ] },
];

function normalizeDetail(detail, index) { return { itemId: detail?.itemId || null, itemKey: detail?.itemKey || `detail-${index + 1}`, label: detail?.label || '', value: detail?.value || '', iconKey: detail?.iconKey || 'fa-location-dot', sortOrder: (index + 1) * 10, isVisible: detail?.isVisible !== false }; }
function normalizeOption(option, index) { return { itemId: option?.itemId || null, itemKey: option?.itemKey || `option-${index + 1}`, label: option?.label || '', value: option?.value || '', sortOrder: (index + 1) * 10, isVisible: option?.isVisible !== false }; }
function normalizeContact(source) {
  if (!source) return null;
  const contact = source.data || source.contactSection || source;
  return {
    id: contact.id || null, pageId: contact.pageId || null, sectionKey: contact.sectionKey || 'contact-section-home',
    status: contact.status || 'draft', versionNumber: Number(contact.versionNumber) || 1,
    tagText: contact.tagText || '', heading: contact.heading || '', description: contact.description || '',
    isVisible: contact.isVisible !== false, copy: { ...(contact.copy || {}) },
    details: (contact.details || []).map(normalizeDetail), spaceOptions: (contact.spaceOptions || []).map(normalizeOption),
    updatedAt: contact.updatedAt || null, updatedBy: contact.updatedBy || null,
    history: (contact.history || []).map((revision) => ({ id: revision.id, revisionNumber: Number(revision.revisionNumber) || 0, summary: revision.summary || 'Saved Home Contact Section revision', createdAt: revision.createdAt || null, createdBy: revision.createdBy || null })),
  };
}
function toPayload(contact) {
  return {
    id: contact.id, pageId: contact.pageId, sectionKey: 'contact-section-home', tagText: contact.tagText.trim(),
    heading: contact.heading.trim(), description: contact.description.trim(), isVisible: contact.isVisible,
    copy: Object.fromEntries(Object.entries(contact.copy).map(([key, value]) => [key, String(value || '').trim()])),
    details: contact.details.map((item) => ({ itemKey: item.itemKey, label: item.label.trim(), value: item.value.trim(), iconKey: item.iconKey.trim(), isVisible: item.isVisible })),
    spaceOptions: contact.spaceOptions.map((item) => ({ itemKey: item.itemKey, label: item.label.trim(), value: item.value.trim(), isVisible: item.isVisible })),
    updatedAt: contact.updatedAt,
  };
}
function comparable(contact) { return contact ? JSON.stringify(toPayload(contact)) : ''; }
function newKey(prefix) { return `${prefix}-${globalThis.crypto.randomUUID()}`; }
function FieldError({ children }) { return children ? <p className="mt-1 text-[10px] font-semibold text-red-600">{children}</p> : null; }
function timestampLabel(value) { return value ? new Date(value).toLocaleString() : 'Not recorded'; }
function actorLabel(value) { return value ? `Admin ${value.slice(0, 8)}` : 'System'; }
function reorder(items, index, direction) { const destination = index + direction; if (destination < 0 || destination >= items.length) return items; const next = [...items]; [next[index], next[destination]] = [next[destination], next[index]]; return next.map((item, itemIndex) => ({ ...item, sortOrder: (itemIndex + 1) * 10 })); }

function validateContact(contact) {
  const errors = {};
  if (!contact.tagText.trim() || contact.tagText.trim().length > 80) errors.tagText = 'Required; use 80 characters or fewer.';
  if (!contact.heading.trim() || contact.heading.trim().length > 140) errors.heading = 'Required; use 140 characters or fewer.';
  if (!contact.description.trim() || contact.description.trim().length > 500) errors.description = 'Required; use 500 characters or fewer.';
  COPY_GROUPS.flatMap((group) => group.fields).forEach(([key, , limit]) => { if (!String(contact.copy[key] || '').trim() || String(contact.copy[key]).trim().length > limit) errors[`copy.${key}`] = `Required; use ${limit} characters or fewer.`; });
  if (contact.details.length < 1 || contact.details.length > 6 || !contact.details.some((item) => item.isVisible)) errors.details = 'Add 1–6 details with at least one visible.';
  contact.details.forEach((item, index) => { if (!item.label.trim() || item.label.trim().length > 100) errors[`details.${index}.label`] = 'Required; 100 characters maximum.'; if (!item.value.trim() || item.value.trim().length > 250) errors[`details.${index}.value`] = 'Required; 250 characters maximum.'; if (!ICON_PATTERN.test(item.iconKey.trim())) errors[`details.${index}.iconKey`] = 'Use a Font Awesome key such as fa-envelope.'; });
  if (contact.spaceOptions.length < 1 || contact.spaceOptions.length > 10 || !contact.spaceOptions.some((item) => item.isVisible)) errors.spaceOptions = 'Add 1–10 options with at least one visible.';
  contact.spaceOptions.forEach((item, index) => { if (!item.label.trim() || item.label.trim().length > 100) errors[`spaceOptions.${index}.label`] = 'Required; 100 characters maximum.'; if (!VALUE_PATTERN.test(item.value.trim())) errors[`spaceOptions.${index}.value`] = 'Use letters, numbers, underscores, or hyphens.'; });
  return errors;
}

function ItemControls({ label, index, count, onMove, onDuplicate, onRemove, disableDuplicate }) {
  return <div className="flex items-center gap-1"><button type="button" onClick={() => onMove(index, -1)} disabled={index === 0} aria-label={`Move ${label} up`} className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30"><i className="fa-solid fa-arrow-up"></i></button><button type="button" onClick={() => onMove(index, 1)} disabled={index === count - 1} aria-label={`Move ${label} down`} className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30"><i className="fa-solid fa-arrow-down"></i></button><button type="button" onClick={() => onDuplicate(index)} disabled={disableDuplicate} aria-label={`Duplicate ${label}`} className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30"><i className="fa-solid fa-copy"></i></button><button type="button" onClick={() => onRemove(index)} disabled={count <= 1} aria-label={`Remove ${label}`} className="h-8 w-8 rounded-lg border border-red-200 bg-white text-red-600 disabled:opacity-30"><i className="fa-solid fa-trash"></i></button></div>;
}

export default function HomeContactSectionEditor({ initialContactSection, initialError = '' }) {
  const router = useRouter();
  const normalizedInitial = useMemo(() => normalizeContact(initialContactSection), [initialContactSection]);
  const [contact, setContact] = useState(normalizedInitial);
  const [baseline, setBaseline] = useState(() => comparable(normalizedInitial));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(initialError);
  const [tone, setTone] = useState(initialError ? 'error' : 'neutral');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const dirty = contact ? comparable(contact) !== baseline : false;

  useEffect(() => { if (!dirty) return undefined; const warn = (event) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  const update = (patch) => { setContact((current) => ({ ...current, ...patch })); setMessage(''); setConflict(false); };
  const updateCopy = (key, value) => update({ copy: { ...contact.copy, [key]: value } });
  const updateDetail = (index, patch) => update({ details: contact.details.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });
  const updateOption = (index, patch) => update({ spaceOptions: contact.spaceOptions.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });
  const addDetail = () => { if (contact.details.length < 6) update({ details: [...contact.details, normalizeDetail({ itemKey: newKey('detail'), label: 'New Contact Detail', value: 'Add contact information', iconKey: 'fa-location-dot', isVisible: true }, contact.details.length)] }); };
  const addOption = () => { if (contact.spaceOptions.length < 10) update({ spaceOptions: [...contact.spaceOptions, normalizeOption({ itemKey: newKey('option'), label: 'New Space Option', value: `option_${contact.spaceOptions.length + 1}`, isVisible: true }, contact.spaceOptions.length)] }); };
  const duplicateDetail = (index) => { if (contact.details.length >= 6) return; const copy = { ...contact.details[index], itemId: null, itemKey: newKey('detail'), label: `${contact.details[index].label} Copy` }; const items = [...contact.details]; items.splice(index + 1, 0, copy); update({ details: items }); };
  const duplicateOption = (index) => { if (contact.spaceOptions.length >= 10) return; const copy = { ...contact.spaceOptions[index], itemId: null, itemKey: newKey('option'), label: `${contact.spaceOptions[index].label} Copy`, value: `${contact.spaceOptions[index].value}_copy` }; const items = [...contact.spaceOptions]; items.splice(index + 1, 0, copy); update({ spaceOptions: items }); };
  const removeDetail = (index) => { if (contact.details.length > 1 && window.confirm(`Remove "${contact.details[index].label}" from this draft?`)) update({ details: contact.details.filter((_, itemIndex) => itemIndex !== index) }); };
  const removeOption = (index) => { if (contact.spaceOptions.length > 1 && window.confirm(`Remove "${contact.spaceOptions[index].label}" from this draft?`)) update({ spaceOptions: contact.spaceOptions.filter((_, itemIndex) => itemIndex !== index) }); };
  const applyFailure = (result, fallback) => { setErrors(result.fieldErrors || {}); setConflict(result.status === 409 || String(result.code || '').includes('CONFLICT')); setTone('error'); setMessage(result.error || fallback); };
  const handleSave = async () => {
    const clientErrors = validateContact(contact); setErrors(clientErrors);
    if (Object.keys(clientErrors).length) { setTone('error'); setMessage('Fix the highlighted fields before saving.'); return; }
    setSaving(true);
    try { const result = await saveHomeContactSectionDraft(toPayload(contact)); if (!result?.ok) return applyFailure(result || {}, 'The Contact Section draft could not be saved.'); const saved = normalizeContact(result.data); setContact(saved); setBaseline(comparable(saved)); setErrors({}); setTone('success'); setMessage('Draft saved. The published Home page has not changed.'); }
    catch (error) { setTone('error'); setMessage(error instanceof Error ? error.message : 'The Contact Section draft could not be saved.'); }
    finally { setSaving(false); }
  };
  const handlePublish = async () => {
    setPublishing(true);
    try { const result = await publishHomeContactSectionDraft({ id: contact.id, expectedUpdatedAt: contact.updatedAt }); if (!result?.ok) return applyFailure(result || {}, 'The Contact Section draft could not be published.'); const published = normalizeContact(result.data); setContact(published); setBaseline(comparable(published)); setErrors({}); setTone('success'); setMessage('Contact Section published and the public Home cache was refreshed.'); router.refresh(); }
    catch (error) { setTone('error'); setMessage(error instanceof Error ? error.message : 'The Contact Section draft could not be published.'); }
    finally { setPublishing(false); }
  };

  if (!contact) return <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm"><h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Contact Section editor unavailable</h1><p className="mt-2 text-sm text-slate-600">{initialError || 'No saved Contact Section version was returned.'}</p><button type="button" onClick={() => router.refresh()} className="mt-5 rounded-xl bg-[#0B1B3D] px-5 py-2 text-xs font-bold text-white">Retry loading</button></div>;

  return <div className="w-full space-y-6">
    <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center"><div><div className="mb-2 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${contact.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{contact.status}</span><span className="font-mono text-[10px] text-slate-400">key: contact-section-home · version {contact.versionNumber}</span>{dirty && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">Unsaved changes</span>}</div><h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Home Contact Section</h1><p className="mt-1 text-xs font-medium text-slate-500">Manage public contact copy, details, map labels, form options, validation, and success text.</p><p className="mt-2 text-[10px] text-slate-400">Last saved: {timestampLabel(contact.updatedAt)} by {actorLabel(contact.updatedBy)}</p></div><div className="flex flex-wrap gap-2"><Link href="/admin-preview/home/contact-section-home" target="_blank" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">Saved version preview</Link><button type="button" onClick={handleSave} disabled={!dirty || saving || publishing} className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save Draft'}</button><button type="button" onClick={handlePublish} disabled={dirty || contact.status !== 'draft' || saving || publishing} className="rounded-xl bg-[#B59410] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{publishing ? 'Publishing…' : 'Publish'}</button></div></div>{message && <div className={`mt-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-semibold ${tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}><span>{message}</span>{conflict && <button type="button" onClick={() => router.refresh()} className="underline">Reload latest</button>}</div>}</header>

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12"><div className="space-y-6 xl:col-span-7">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="grid gap-4 sm:grid-cols-2"><div><label className={LABEL_CLASS}>Section tag</label><input value={contact.tagText} maxLength={80} onChange={(event) => update({ tagText: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors.tagText}</FieldError></div><div><label className={LABEL_CLASS}>Heading</label><input value={contact.heading} maxLength={140} onChange={(event) => update({ heading: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors.heading}</FieldError></div><div className="sm:col-span-2"><label className={LABEL_CLASS}>Introduction</label><textarea value={contact.description} maxLength={500} rows={3} onChange={(event) => update({ description: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors.description}</FieldError></div></div><label className="mt-4 flex items-center gap-2 text-[11px] font-bold text-slate-600"><input type="checkbox" checked={contact.isVisible} onChange={(event) => update({ isVisible: event.target.checked })} className="h-4 w-4 accent-[#B59410]" />Show complete Contact Section</label></section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 pb-3"><div><h2 className="font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Contact details</h2><p className="mt-1 text-[10px] text-slate-400">Headquarters, hotline, email, and other public details.</p></div><button type="button" onClick={addDetail} disabled={contact.details.length >= 6} className="rounded-xl bg-[#0B1B3D] px-3 py-2 text-[10px] font-bold text-white disabled:opacity-40">Add detail</button></div><FieldError>{errors.details}</FieldError><div className="mt-4 space-y-4">{contact.details.map((item, index) => <article key={item.itemKey} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"><div className="mb-3 flex items-center justify-between"><span className="font-mono text-[9px] text-slate-400">{item.itemKey}</span><ItemControls label={item.label} index={index} count={contact.details.length} onMove={(itemIndex, direction) => update({ details: reorder(contact.details, itemIndex, direction) })} onDuplicate={duplicateDetail} onRemove={removeDetail} disableDuplicate={contact.details.length >= 6} /></div><div className="grid gap-3 sm:grid-cols-2"><div><label className={LABEL_CLASS}>Label</label><input value={item.label} maxLength={100} onChange={(event) => updateDetail(index, { label: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors[`details.${index}.label`]}</FieldError></div><div><label className={LABEL_CLASS}>Icon key</label><input value={item.iconKey} maxLength={63} onChange={(event) => updateDetail(index, { iconKey: event.target.value })} className={`${INPUT_CLASS} font-mono`} /><FieldError>{errors[`details.${index}.iconKey`]}</FieldError></div><div className="sm:col-span-2"><label className={LABEL_CLASS}>Displayed value</label><textarea value={item.value} maxLength={250} rows={2} onChange={(event) => updateDetail(index, { value: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors[`details.${index}.value`]}</FieldError></div></div><label className="mt-3 flex items-center gap-2 text-[11px] font-bold text-slate-600"><input type="checkbox" checked={item.isVisible} onChange={(event) => updateDetail(index, { isVisible: event.target.checked })} className="h-4 w-4 accent-[#B59410]" />Show this detail</label></article>)}</div></section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 pb-3"><div><h2 className="font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Space options</h2><p className="mt-1 text-[10px] text-slate-400">Visible choices in the Required Space Size select.</p></div><button type="button" onClick={addOption} disabled={contact.spaceOptions.length >= 10} className="rounded-xl bg-[#0B1B3D] px-3 py-2 text-[10px] font-bold text-white disabled:opacity-40">Add option</button></div><FieldError>{errors.spaceOptions}</FieldError><div className="mt-4 space-y-4">{contact.spaceOptions.map((item, index) => <article key={item.itemKey} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"><div className="mb-3 flex items-center justify-between"><span className="font-mono text-[9px] text-slate-400">{item.itemKey}</span><ItemControls label={item.label} index={index} count={contact.spaceOptions.length} onMove={(itemIndex, direction) => update({ spaceOptions: reorder(contact.spaceOptions, itemIndex, direction) })} onDuplicate={duplicateOption} onRemove={removeOption} disableDuplicate={contact.spaceOptions.length >= 10} /></div><div className="grid gap-3 sm:grid-cols-2"><div><label className={LABEL_CLASS}>Displayed label</label><input value={item.label} maxLength={100} onChange={(event) => updateOption(index, { label: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors[`spaceOptions.${index}.label`]}</FieldError></div><div><label className={LABEL_CLASS}>Stored value</label><input value={item.value} maxLength={60} onChange={(event) => updateOption(index, { value: event.target.value })} className={`${INPUT_CLASS} font-mono`} /><FieldError>{errors[`spaceOptions.${index}.value`]}</FieldError></div></div><label className="mt-3 flex items-center gap-2 text-[11px] font-bold text-slate-600"><input type="checkbox" checked={item.isVisible} onChange={(event) => updateOption(index, { isVisible: event.target.checked })} className="h-4 w-4 accent-[#B59410]" />Show this option</label></article>)}</div></section>

      {COPY_GROUPS.map((group) => <section key={group.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="border-b border-slate-100 pb-3 font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">{group.title}</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{group.fields.map(([key, label, limit, multiline]) => <div key={key} className={multiline ? 'sm:col-span-2' : ''}><label className={LABEL_CLASS}>{label}</label>{multiline ? <textarea value={contact.copy[key] || ''} maxLength={limit} rows={3} onChange={(event) => updateCopy(key, event.target.value)} className={INPUT_CLASS} /> : <input value={contact.copy[key] || ''} maxLength={limit} onChange={(event) => updateCopy(key, event.target.value)} className={INPUT_CLASS} />}<FieldError>{errors[`copy.${key}`]}</FieldError></div>)}</div></section>)}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="border-b border-slate-100 pb-3 font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Revision history</h2>{contact.history.length ? <ol className="mt-3 divide-y divide-slate-100">{contact.history.map((revision) => <li key={revision.id} className="flex justify-between gap-3 py-3"><div><p className="text-xs font-bold text-slate-700">{revision.summary}</p><p className="mt-1 text-[10px] text-slate-400">{actorLabel(revision.createdBy)}</p></div><div className="text-right"><p className="font-mono text-[10px] font-bold text-[#8A6D08]">revision {revision.revisionNumber || '—'}</p><p className="mt-1 text-[10px] text-slate-400">{timestampLabel(revision.createdAt)}</p></div></li>)}</ol> : <p className="mt-3 text-xs text-slate-500">No saved revisions yet.</p>}</section>
    </div><aside className="xl:col-span-5"><div className="sticky top-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-4"><h2 className="font-serif text-xs font-bold uppercase tracking-wider text-[#0B1B3D]">Unsaved local preview</h2><p className="mt-1 text-[10px] text-slate-400">Uses the public Contact component; submission is disabled in preview.</p></div><div className="max-h-[75vh] overflow-auto"><div style={{ minWidth: 900 }}><ContactForm contactSection={contact} previewMode /></div></div>{dirty && <p className="border-t border-slate-100 p-3 text-[10px] font-semibold text-blue-700">Preview includes unsaved form values.</p>}{!contact.isVisible && <p className="border-t border-slate-100 p-3 text-[10px] font-semibold text-amber-700">The section is disabled, so the preview is empty.</p>}</div></aside></div>
  </div>;
}
