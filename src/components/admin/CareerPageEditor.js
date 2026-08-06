'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CareerPageClient from '@/components/CareerPageClient';
import MediaLibrary from './MediaLibrary';
import { publishCareerPageDraft, saveCareerPageDraft } from '@/lib/careerPageActions';

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#C5A880] focus:ring-2 focus:ring-[#C5A880]/20';
const LABEL = 'mb-1 block text-[11px] font-bold text-slate-700';
const TABS = ['Page Content', 'Vacancies', 'Preview', 'Advanced'];
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function mappedMedia(asset) { return { id: asset.id, secureUrl: asset.secure_url || asset.secureUrl || asset.url, displayName: asset.display_name || asset.displayName || asset.filename, altText: asset.alt_text || asset.altText || '', format: asset.format, width: asset.width, height: asset.height }; }
function clean(content) { return { ...content, header: Object.fromEntries(Object.entries(content.header || {}).filter(([key]) => key !== 'media')), philosophy: Object.fromEntries(Object.entries(content.philosophy || {}).filter(([key]) => key !== 'media')) }; }
function payload(page) { return { id: page.id, pageId: page.pageId, sectionKey: 'career-page', isVisible: page.isVisible, content: clean(page.content), updatedAt: page.updatedAt }; }
function comparable(page) { return JSON.stringify(payload(page)); }
function normalizeOrder(items) { return items.map((item, index) => ({ ...item, sortOrder: (index + 1) * 10 })); }
function move(items, index, direction) { const destination = index + direction; if (destination < 0 || destination >= items.length) return items; const next = [...items]; [next[index], next[destination]] = [next[destination], next[index]]; return normalizeOrder(next); }
function Field({ label, value, onChange, multiline = false, type = 'text' }) { const Control = multiline ? 'textarea' : 'input'; return <label><span className={LABEL}>{label}</span><Control type={type} rows={multiline ? 4 : undefined} value={value ?? ''} onChange={(event) => onChange(event.target.value)} className={INPUT} /></label>; }

export default function CareerPageEditor({ initialCareerPage }) {
  const router = useRouter();
  const initial = useMemo(() => clone(initialCareerPage), [initialCareerPage]);
  const [page, setPage] = useState(initial);
  const [baseline, setBaseline] = useState(comparable(initial));
  const [tab, setTab] = useState('Page Content');
  const [selectedJob, setSelectedJob] = useState(null);
  const [picker, setPicker] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('neutral');
  const [advanced, setAdvanced] = useState(() => JSON.stringify(payload(initial), null, 2));
  const dirty = comparable(page) !== baseline;
  const update = (patch) => { setPage((current) => ({ ...current, ...patch })); setMessage(''); };
  const setContent = (key, value) => update({ content: { ...page.content, [key]: value } });
  const updateGroup = (group, key, value) => setContent(group, { ...page.content[group], [key]: value });
  const setJobs = (jobs) => setContent('jobs', jobs);
  const updateJob = (index, job) => setJobs(page.content.jobs.map((item, itemIndex) => itemIndex === index ? job : item));
  const choose = (asset) => {
    const media = mappedMedia(asset);
    if (picker === 'header') setContent('header', { ...page.content.header, mediaId: asset.id, media, imageAlt: page.content.header.imageAlt || asset.alt_text || page.content.header.title });
    if (picker === 'philosophy') setContent('philosophy', { ...page.content.philosophy, mediaId: asset.id, media, imageAlt: page.content.philosophy.imageAlt || asset.alt_text || page.content.philosophy.heading });
    setPicker(null);
  };
  const addJob = () => {
    const source = clone(page.content.jobs[0]);
    const job = { ...source, jobId: crypto.randomUUID(), title: 'New Vacancy', department: 'Engineering', tagClass: 'engineering', optionLabel: 'New Vacancy (Engineering)', isVisible: false, sortOrder: (page.content.jobs.length + 1) * 10 };
    setJobs([...page.content.jobs, job]); setSelectedJob(page.content.jobs.length);
  };
  const save = async () => {
    setBusy('save'); setMessage('');
    try {
      const result = await saveCareerPageDraft(payload(page));
      if (!result?.ok) { setTone('error'); setMessage(result?.error || 'Draft save failed.'); return; }
      const saved = { ...clone(result.data), history: page.history };
      setPage(saved); setBaseline(comparable(saved)); setTone('success'); setMessage('Career draft saved. Public content remains unchanged.');
    } finally { setBusy(''); }
  };
  const publish = async () => {
    setBusy('publish'); setMessage('');
    try {
      const result = await publishCareerPageDraft({ id: page.id, expectedUpdatedAt: page.updatedAt });
      if (!result?.ok) { setTone('error'); setMessage(result?.error || 'Publish failed.'); return; }
      const published = { ...clone(result.data), history: page.history };
      setPage(published); setBaseline(comparable(published)); setTone('success'); setMessage('Career page and vacancy catalogue published.'); router.refresh();
    } finally { setBusy(''); }
  };
  const applyAdvanced = () => { try { const parsed = JSON.parse(advanced); setPage((current) => ({ ...current, ...parsed, id: current.id, pageId: current.pageId, updatedAt: current.updatedAt, history: current.history })); setTone('success'); setMessage('Structured content applied locally.'); } catch (error) { setTone('error'); setMessage(`Invalid structured content: ${error.message}`); } };
  const job = selectedJob === null ? null : page.content.jobs[selectedJob];

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#B59410]">Phase 6 · Full-page workflow</p><h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Career Page & Vacancies Editor</h1><p className="text-xs text-slate-500">Version {page.versionNumber} · {page.status} · {dirty ? 'Unsaved changes' : 'Up to date'} · {page.content.jobs.length} vacancies</p></div><div className="flex flex-wrap gap-2"><Link href="/admin/careers/applications" className="rounded-xl border px-4 py-2 text-xs font-bold">Applications</Link><Link href="/admin-preview/career-page" target="_blank" className="rounded-xl border px-4 py-2 text-xs font-bold">Saved Preview</Link><button type="button" onClick={save} disabled={!dirty || busy} className="rounded-xl bg-slate-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy === 'save' ? 'Saving…' : 'Save Draft'}</button><button type="button" onClick={publish} disabled={dirty || busy || page.status !== 'draft'} className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy === 'publish' ? 'Publishing…' : 'Publish'}</button></div></header>
    {message && <div className={`rounded-xl border p-3 text-xs font-semibold ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message}</div>}
    <nav className="flex flex-wrap gap-2">{TABS.map((name) => <button type="button" key={name} onClick={() => { setTab(name); if (name === 'Advanced') setAdvanced(JSON.stringify(payload(page), null, 2)); }} className={`rounded-xl px-4 py-2 text-xs font-bold ${tab === name ? 'bg-[#0B1B3D] text-white' : 'border bg-white text-slate-600'}`}>{name}</button>)}</nav>
    <section className="rounded-2xl border bg-white p-5">
      {tab === 'Page Content' && <div className="space-y-7">
        <div><h2 className="mb-3 font-serif text-lg font-bold">Header and SEO</h2><div className="grid gap-3 md:grid-cols-2"><Field label="Page title" value={page.content.header.title} onChange={(value) => updateGroup('header', 'title', value)} /><Field label="Page subtitle" value={page.content.header.subtitle} onChange={(value) => updateGroup('header', 'subtitle', value)} /><Field label="Breadcrumb" value={page.content.header.breadcrumbLabel} onChange={(value) => updateGroup('header', 'breadcrumbLabel', value)} /><Field label="Header image alt" value={page.content.header.imageAlt} onChange={(value) => updateGroup('header', 'imageAlt', value)} /><Field label="SEO title" value={page.content.seo.title} onChange={(value) => updateGroup('seo', 'title', value)} /><Field label="Canonical URL" value={page.content.seo.canonicalUrl} onChange={(value) => updateGroup('seo', 'canonicalUrl', value)} /><Field multiline label="SEO description" value={page.content.seo.description} onChange={(value) => updateGroup('seo', 'description', value)} /><div>{page.content.header.media?.secureUrl && <img src={page.content.header.media.secureUrl} alt="" className="h-28 w-full rounded-lg object-cover" />}<button type="button" onClick={() => setPicker('header')} className="mt-2 rounded-lg bg-[#0B1B3D] px-3 py-2 text-xs font-bold text-white">Choose header image</button></div></div></div>
        <div><h2 className="mb-3 font-serif text-lg font-bold">Culture and benefits</h2><div className="grid gap-3 md:grid-cols-2"><Field label="Section tag" value={page.content.philosophy.tag} onChange={(value) => updateGroup('philosophy', 'tag', value)} /><Field label="Heading" value={page.content.philosophy.heading} onChange={(value) => updateGroup('philosophy', 'heading', value)} />{page.content.philosophy.paragraphs.map((paragraph, index) => <Field key={index} multiline label={`Paragraph ${index + 1}`} value={paragraph} onChange={(value) => updateGroup('philosophy', 'paragraphs', page.content.philosophy.paragraphs.map((item, itemIndex) => itemIndex === index ? value : item))} />)}<Field label="Culture image alt" value={page.content.philosophy.imageAlt} onChange={(value) => updateGroup('philosophy', 'imageAlt', value)} /><div>{page.content.philosophy.media?.secureUrl && <img src={page.content.philosophy.media.secureUrl} alt="" className="h-28 w-full rounded-lg object-cover" />}<button type="button" onClick={() => setPicker('philosophy')} className="mt-2 rounded-lg bg-[#0B1B3D] px-3 py-2 text-xs font-bold text-white">Choose culture image</button></div></div><div className="mt-4 space-y-2">{page.content.philosophy.benefits.map((benefit, index) => <div key={benefit.id} className="flex gap-2"><input value={benefit.text} onChange={(event) => updateGroup('philosophy', 'benefits', page.content.philosophy.benefits.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))} className={INPUT} /><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={benefit.isVisible !== false} onChange={(event) => updateGroup('philosophy', 'benefits', page.content.philosophy.benefits.map((item, itemIndex) => itemIndex === index ? { ...item, isVisible: event.target.checked } : item))} /> Visible</label></div>)}</div></div>
        <div><h2 className="mb-3 font-serif text-lg font-bold">Vacancy and application copy</h2><div className="grid gap-3 md:grid-cols-3"><Field label="Vacancy tag" value={page.content.jobsSection.tag} onChange={(value) => updateGroup('jobsSection', 'tag', value)} /><Field label="Vacancy heading" value={page.content.jobsSection.heading} onChange={(value) => updateGroup('jobsSection', 'heading', value)} />{Object.entries(page.content.form).map(([key, value]) => typeof value === 'string' ? <Field key={key} multiline={['description', 'successMessage', 'errorMessage'].includes(key)} label={key.replace(/([A-Z])/g, ' $1')} value={value} onChange={(next) => updateGroup('form', key, next)} /> : null)}</div></div>
        <label className="block rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900"><input type="checkbox" checked={page.isVisible} onChange={(event) => update({ isVisible: event.target.checked })} /> Enable the public Career page</label>
      </div>}
      {tab === 'Vacancies' && <div>{job ? <div><button type="button" onClick={() => setSelectedJob(null)} className="mb-3 text-xs font-bold text-[#B59410]">← Back to vacancies</button><div className="grid gap-3 md:grid-cols-3"><Field label="Job title" value={job.title} onChange={(value) => updateJob(selectedJob, { ...job, title: value })} /><Field label="Department tag" value={job.department} onChange={(value) => updateJob(selectedJob, { ...job, department: value })} /><label><span className={LABEL}>Tag style</span><select value={job.tagClass} onChange={(event) => updateJob(selectedJob, { ...job, tagClass: event.target.value })} className={INPUT}><option value="engineering">Engineering</option><option value="operations">Operations</option><option value="design">Design</option></select></label><Field label="Location" value={job.location} onChange={(value) => updateJob(selectedJob, { ...job, location: value })} /><Field label="Experience" value={job.experience} onChange={(value) => updateJob(selectedJob, { ...job, experience: value })} /><Field label="Job type" value={job.jobType} onChange={(value) => updateJob(selectedJob, { ...job, jobType: value })} /><Field label="Application option label" value={job.optionLabel} onChange={(value) => updateJob(selectedJob, { ...job, optionLabel: value })} /><Field type="date" label="Closing date" value={job.closingDate || ''} onChange={(value) => updateJob(selectedJob, { ...job, closingDate: value || null })} /><Field multiline label="Card description" value={job.description} onChange={(value) => updateJob(selectedJob, { ...job, description: value })} /></div><div className="mt-4 grid gap-3 md:grid-cols-2"><Field multiline label="Responsibilities (one per line)" value={(job.responsibilities || []).join('\n')} onChange={(value) => updateJob(selectedJob, { ...job, responsibilities: value.split('\n').map((item) => item.trim()).filter(Boolean) })} /><Field multiline label="Requirements (one per line)" value={(job.requirements || []).join('\n')} onChange={(value) => updateJob(selectedJob, { ...job, requirements: value.split('\n').map((item) => item.trim()).filter(Boolean) })} /></div><label className="mt-3 block text-xs"><input type="checkbox" checked={job.isVisible !== false} onChange={(event) => updateJob(selectedJob, { ...job, isVisible: event.target.checked })} /> Publicly visible</label></div> : <div><div className="mb-4 flex justify-between"><h2 className="font-serif text-lg font-bold">Canonical vacancy catalogue</h2><button type="button" onClick={addJob} className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white">+ Add vacancy</button></div><div className="space-y-2">{page.content.jobs.map((item, index) => <article key={item.jobId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><span className="text-[9px] font-bold uppercase text-[#B59410]">{item.department} · {item.isVisible === false ? 'hidden' : 'visible'}</span><h3 className="font-serif text-sm font-bold">{item.title}</h3></div><div className="flex gap-1"><button type="button" onClick={() => setJobs(move(page.content.jobs, index, -1))} disabled={!index} className="h-8 w-8 rounded-lg border disabled:opacity-30">↑</button><button type="button" onClick={() => setJobs(move(page.content.jobs, index, 1))} disabled={index === page.content.jobs.length - 1} className="h-8 w-8 rounded-lg border disabled:opacity-30">↓</button><button type="button" onClick={() => setSelectedJob(index)} className="rounded-lg bg-slate-700 px-3 text-xs font-bold text-white">Edit</button><button type="button" onClick={() => page.content.jobs.length > 1 && confirm('Remove this vacancy from the next catalogue?') && setJobs(normalizeOrder(page.content.jobs.filter((_, itemIndex) => itemIndex !== index)))} className="rounded-lg border border-red-200 px-3 text-xs font-bold text-red-600">Remove</button></div></article>)}</div></div>}</div>}
      {tab === 'Preview' && <div className="max-h-[800px] overflow-auto rounded-xl border"><CareerPageClient careerPage={page} previewMode /></div>}
      {tab === 'Advanced' && <div><textarea value={advanced} onChange={(event) => setAdvanced(event.target.value)} rows={36} spellCheck={false} className={`${INPUT} font-mono leading-5`} /><button type="button" onClick={applyAdvanced} className="mt-3 rounded-lg bg-slate-700 px-4 py-2 text-xs font-bold text-white">Apply structured content</button></div>}
    </section>
    {page.history?.length > 0 && <section className="rounded-2xl border bg-white p-5"><h2 className="font-serif text-lg font-bold">Revision history</h2>{page.history.map((item) => <div key={item.id} className="mt-2 flex justify-between rounded-lg bg-slate-50 p-3 text-xs"><span>{item.change_summary || 'Saved Career revision'}</span><span>v{item.version_number} · {new Date(item.created_at).toLocaleString()}</span></div>)}</section>}
    {picker && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4"><div className="w-full max-w-7xl"><MediaLibrary isModal resourceTypeFilter="image" onSelectAsset={choose} onCloseModal={() => setPicker(null)} /></div></div>}
  </div>;
}
