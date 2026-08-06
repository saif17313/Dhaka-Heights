'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ContactPageClient from '@/components/ContactPageClient';
import { publishContactPageDraft, saveContactPageDraft } from '@/lib/contactPageActions';

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#C5A880] focus:ring-2 focus:ring-[#C5A880]/20';
const LABEL = 'mb-1 block text-[11px] font-bold text-slate-700';
const TABS = ['Page Content', 'Info Cards', 'Form & Map', 'Preview', 'Advanced'];
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function payload(page) { return { id: page.id, pageId: page.pageId, sectionKey: 'contact-page', isVisible: page.isVisible, content: page.content, updatedAt: page.updatedAt }; }
function comparable(page) { return JSON.stringify(payload(page)); }
function normalizeOrder(items) { return items.map((item, index) => ({ ...item, sortOrder: (index + 1) * 10 })); }
function move(items, index, direction) { const destination = index + direction; if (destination < 0 || destination >= items.length) return items; const next = [...items]; [next[index], next[destination]] = [next[destination], next[index]]; return normalizeOrder(next); }
function Field({ label, value, onChange, multiline = false, type = 'text' }) { const Control = multiline ? 'textarea' : 'input'; return <label><span className={LABEL}>{label}</span><Control type={type} rows={multiline ? 4 : undefined} value={value ?? ''} onChange={(event) => onChange(event.target.value)} className={INPUT} /></label>; }

export default function ContactPageEditor({ initialContactPage }) {
  const router = useRouter();
  const initial = useMemo(() => clone(initialContactPage), [initialContactPage]);
  const [page, setPage] = useState(initial);
  const [baseline, setBaseline] = useState(comparable(initial));
  const [tab, setTab] = useState('Page Content');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('neutral');
  const [advanced, setAdvanced] = useState(() => JSON.stringify(payload(initial), null, 2));
  const dirty = comparable(page) !== baseline;
  const update = (patch) => { setPage((current) => ({ ...current, ...patch })); setMessage(''); };
  const setContent = (key, value) => update({ content: { ...page.content, [key]: value } });
  const updateGroup = (group, key, value) => setContent(group, { ...page.content[group], [key]: value });
  const setCards = (items) => setContent('infoCards', items);
  const setOptions = (items) => setContent('subjectOptions', items);
  const updateCard = (index, patch) => setCards(page.content.infoCards.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const updateOption = (index, patch) => setOptions(page.content.subjectOptions.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  const save = async () => {
    setBusy('save'); setMessage('');
    try {
      const result = await saveContactPageDraft(payload(page));
      if (!result?.ok) { setTone('error'); setMessage(result?.error || 'Draft save failed.'); return; }
      const saved = { ...clone(result.data), history: page.history };
      setPage(saved); setBaseline(comparable(saved)); setTone('success'); setMessage('Contact draft saved. Public content remains unchanged.');
    } finally { setBusy(''); }
  };
  const publish = async () => {
    setBusy('publish'); setMessage('');
    try {
      const result = await publishContactPageDraft({ id: page.id, expectedUpdatedAt: page.updatedAt });
      if (!result?.ok) { setTone('error'); setMessage(result?.error || 'Publish failed.'); return; }
      const published = { ...clone(result.data), history: page.history };
      setPage(published); setBaseline(comparable(published)); setTone('success'); setMessage('Contact page published.'); router.refresh();
    } finally { setBusy(''); }
  };
  const applyAdvanced = () => { try { const parsed = JSON.parse(advanced); setPage((current) => ({ ...current, ...parsed, id: current.id, pageId: current.pageId, updatedAt: current.updatedAt, history: current.history })); setTone('success'); setMessage('Structured content applied locally.'); } catch (error) { setTone('error'); setMessage(`Invalid structured content: ${error.message}`); } };
  const addCard = () => setCards([...page.content.infoCards, { itemId: crypto.randomUUID(), iconClass: 'fa-solid fa-circle-info', title: 'New Contact Method', body: 'Add contact information.', ctaLabel: '', ctaUrl: '', ctaTarget: '_self', ctaIconClass: '', sortOrder: (page.content.infoCards.length + 1) * 10, isVisible: false }]);
  const addOption = () => setOptions([...page.content.subjectOptions, { itemId: crypto.randomUUID(), value: `subject-${page.content.subjectOptions.length + 1}`, label: 'New Inquiry Subject', sortOrder: (page.content.subjectOptions.length + 1) * 10, isVisible: false }]);

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#B59410]">Phase 7 · Full-page workflow</p><h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Contact Page Editor</h1><p className="text-xs text-slate-500">Version {page.versionNumber} · {page.status} · {dirty ? 'Unsaved changes' : 'Up to date'}</p></div><div className="flex flex-wrap gap-2"><Link href="/admin/inquiries" className="rounded-xl border px-4 py-2 text-xs font-bold">Inquiry Inbox</Link><Link href="/admin-preview/contact-page" target="_blank" className="rounded-xl border px-4 py-2 text-xs font-bold">Saved Preview</Link><button type="button" onClick={save} disabled={!dirty || busy} className="rounded-xl bg-slate-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy === 'save' ? 'Saving…' : 'Save Draft'}</button><button type="button" onClick={publish} disabled={dirty || busy || page.status !== 'draft'} className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy === 'publish' ? 'Publishing…' : 'Publish'}</button></div></header>
    {message && <div className={`rounded-xl border p-3 text-xs font-semibold ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message}</div>}
    <nav className="flex flex-wrap gap-2">{TABS.map((name) => <button type="button" key={name} onClick={() => { setTab(name); if (name === 'Advanced') setAdvanced(JSON.stringify(payload(page), null, 2)); }} className={`rounded-xl px-4 py-2 text-xs font-bold ${tab === name ? 'bg-[#0B1B3D] text-white' : 'border bg-white text-slate-600'}`}>{name}</button>)}</nav>
    <section className="rounded-2xl border bg-white p-5">
      {tab === 'Page Content' && <div className="space-y-5"><h2 className="font-serif text-lg font-bold">Header and SEO</h2><div className="grid gap-3 md:grid-cols-2"><Field label="Page title" value={page.content.header.title} onChange={(value) => updateGroup('header', 'title', value)} /><Field label="Page subtitle" value={page.content.header.subtitle} onChange={(value) => updateGroup('header', 'subtitle', value)} /><Field label="Breadcrumb" value={page.content.header.breadcrumbLabel} onChange={(value) => updateGroup('header', 'breadcrumbLabel', value)} /><Field label="SEO title" value={page.content.seo.title} onChange={(value) => updateGroup('seo', 'title', value)} /><Field multiline label="SEO description" value={page.content.seo.description} onChange={(value) => updateGroup('seo', 'description', value)} /><Field label="Canonical URL" value={page.content.seo.canonicalUrl} onChange={(value) => updateGroup('seo', 'canonicalUrl', value)} /></div><label className="block rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900"><input type="checkbox" checked={page.isVisible} onChange={(event) => update({ isVisible: event.target.checked })} /> Enable the public Contact page</label></div>}
      {tab === 'Info Cards' && <div><div className="mb-4 flex justify-between"><h2 className="font-serif text-lg font-bold">Contact information cards</h2><button type="button" onClick={addCard} className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white">+ Add card</button></div><div className="space-y-4">{page.content.infoCards.map((card, index) => <article key={card.itemId} className="rounded-xl border p-4"><div className="grid gap-3 md:grid-cols-3"><Field label="Title" value={card.title} onChange={(value) => updateCard(index, { title: value })} /><Field label="Icon classes" value={card.iconClass} onChange={(value) => updateCard(index, { iconClass: value })} /><Field multiline label="Body (new lines supported)" value={card.body} onChange={(value) => updateCard(index, { body: value })} /><Field label="CTA label (optional)" value={card.ctaLabel} onChange={(value) => updateCard(index, { ctaLabel: value })} /><Field label="CTA HTTPS URL" value={card.ctaUrl} onChange={(value) => updateCard(index, { ctaUrl: value })} /><label><span className={LABEL}>CTA target</span><select className={INPUT} value={card.ctaTarget} onChange={(event) => updateCard(index, { ctaTarget: event.target.value })}><option value="_self">Same tab</option><option value="_blank">New tab</option></select></label><Field label="CTA icon classes" value={card.ctaIconClass} onChange={(value) => updateCard(index, { ctaIconClass: value })} /></div><div className="mt-3 flex flex-wrap items-center gap-2"><label className="text-xs"><input type="checkbox" checked={card.isVisible !== false} onChange={(event) => updateCard(index, { isVisible: event.target.checked })} /> Visible</label><button type="button" onClick={() => setCards(move(page.content.infoCards, index, -1))} disabled={!index} className="h-8 w-8 rounded-lg border disabled:opacity-30">↑</button><button type="button" onClick={() => setCards(move(page.content.infoCards, index, 1))} disabled={index === page.content.infoCards.length - 1} className="h-8 w-8 rounded-lg border disabled:opacity-30">↓</button><button type="button" onClick={() => page.content.infoCards.length > 1 && confirm('Remove this contact card from the next version?') && setCards(normalizeOrder(page.content.infoCards.filter((_, itemIndex) => itemIndex !== index)))} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600">Remove</button></div></article>)}</div></div>}
      {tab === 'Form & Map' && <div className="space-y-7"><div><h2 className="mb-3 font-serif text-lg font-bold">Message form</h2><div className="grid gap-3 md:grid-cols-3">{Object.entries(page.content.form).map(([key, value]) => <Field key={key} multiline={['description', 'successMessage', 'errorMessage'].includes(key)} label={key.replace(/([A-Z])/g, ' $1')} value={value} onChange={(next) => updateGroup('form', key, next)} />)}</div></div><div><div className="mb-3 flex justify-between"><h2 className="font-serif text-lg font-bold">Inquiry subjects</h2><button type="button" onClick={addOption} className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white">+ Add subject</button></div><div className="space-y-2">{page.content.subjectOptions.map((option, index) => <div key={option.itemId} className="grid items-end gap-2 rounded-xl border p-3 md:grid-cols-[1fr_1fr_auto]"><Field label="Stored value" value={option.value} onChange={(value) => updateOption(index, { value })} /><Field label="Public label" value={option.label} onChange={(value) => updateOption(index, { label: value })} /><div className="flex gap-1 pb-1"><label className="px-2 text-xs"><input type="checkbox" checked={option.isVisible !== false} onChange={(event) => updateOption(index, { isVisible: event.target.checked })} /> Visible</label><button type="button" onClick={() => setOptions(move(page.content.subjectOptions, index, -1))} disabled={!index} className="h-8 w-8 rounded border disabled:opacity-30">↑</button><button type="button" onClick={() => setOptions(move(page.content.subjectOptions, index, 1))} disabled={index === page.content.subjectOptions.length - 1} className="h-8 w-8 rounded border disabled:opacity-30">↓</button><button type="button" onClick={() => page.content.subjectOptions.length > 1 && confirm('Remove this inquiry subject?') && setOptions(normalizeOrder(page.content.subjectOptions.filter((_, itemIndex) => itemIndex !== index)))} className="rounded border border-red-200 px-2 text-xs text-red-600">Remove</button></div></div>)}</div></div><div><h2 className="mb-3 font-serif text-lg font-bold">Map</h2><div className="grid gap-3 md:grid-cols-2">{Object.entries(page.content.map).map(([key, value]) => <Field key={key} multiline={key === 'description' || key === 'iframeUrl'} label={key.replace(/([A-Z])/g, ' $1')} value={value} onChange={(next) => updateGroup('map', key, next)} />)}</div></div></div>}
      {tab === 'Preview' && <div className="max-h-[800px] overflow-auto rounded-xl border"><ContactPageClient contactPage={page} previewMode /></div>}
      {tab === 'Advanced' && <div><textarea value={advanced} onChange={(event) => setAdvanced(event.target.value)} rows={36} spellCheck={false} className={`${INPUT} font-mono leading-5`} /><button type="button" onClick={applyAdvanced} className="mt-3 rounded-lg bg-slate-700 px-4 py-2 text-xs font-bold text-white">Apply structured content</button></div>}
    </section>
    {page.history?.length > 0 && <section className="rounded-2xl border bg-white p-5"><h2 className="font-serif text-lg font-bold">Revision history</h2>{page.history.map((item) => <div key={item.id} className="mt-2 flex justify-between rounded-lg bg-slate-50 p-3 text-xs"><span>{item.change_summary || 'Saved Contact revision'}</span><span>v{item.version_number} · {new Date(item.created_at).toLocaleString()}</span></div>)}</section>}
  </div>;
}
