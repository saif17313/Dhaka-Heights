'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProjectsPageClient from '@/components/ProjectsPageClient';
import ProjectDetailClient from '@/components/ProjectDetailClient';
import MediaLibrary from './MediaLibrary';
import { publishProjectsPageDraft, saveProjectsPageDraft } from '@/lib/projectsPageActions';
import {
  PROJECT_FILTER_GROUPS,
  PROJECT_FILTER_KEY_PATTERN,
  createUniqueFilterKey,
  normalizeProjectFilterOptions,
} from '@/lib/projectFilterOptions';
import { extractYouTubeVideoId } from '@/lib/youtube';

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#C5A880] focus:ring-2 focus:ring-[#C5A880]/20';
const LABEL = 'mb-1 block text-[11px] font-bold text-slate-700';
const TABS = ['Page Content', 'Projects', 'Preview', 'Advanced'];
const FILTER_COPY_FIELDS = [['loadingLabel','Loading label'],['statusLabel','Status field label'],['allStatusLabel','All-status option'],['categoryLabel','Category field label'],['allCategoryLabel','All-category option'],['locationLabel','Location field label'],['allLocationLabel','All-location option'],['sizeLabel','Size field label'],['allSizeLabel','All-size option'],['previousLabel','Previous-page label'],['nextLabel','Next-page label']];
const DETAIL_COPY_FIELDS = [['projectsBreadcrumbLabel','Projects breadcrumb'],['notFoundTitle','Not-found title'],['notFoundBody','Not-found description'],['returnLabel','Return button'],['projectNameLabel','Project-name spec'],['locationLabel','Location spec'],['projectTypeLabel','Project-type spec'],['floorsLabel','Floors spec'],['landAreaLabel','Land-area spec'],['heightLabel','Height spec'],['unitSizesLabel','Unit-sizes spec'],['parkingLabel','Parking spec'],['namePlaceholder','Name placeholder'],['phonePlaceholder','Phone placeholder'],['emailPlaceholder','Email placeholder'],['messagePlaceholder','Message placeholder'],['submittingLabel','Submitting label']];
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function stripMedia(content) {
  return {
    ...content,
    header: Object.fromEntries(Object.entries(content.header || {}).filter(([key]) => key !== 'media')),
    projects: (content.projects || []).map((project) => ({
      ...Object.fromEntries(Object.entries(project).filter(([key]) => key !== 'coverMedia')),
      gallery: (project.gallery || []).map((image) => Object.fromEntries(Object.entries(image).filter(([key]) => key !== 'media'))),
    })),
  };
}
function payload(page) { return { id: page.id, pageId: page.pageId, sectionKey: 'projects-page', isVisible: page.isVisible, content: stripMedia(page.content), updatedAt: page.updatedAt }; }
function advancedPayload(page) { return { ...payload(page), content: page.content }; }
function comparable(page) { return JSON.stringify(payload(page)); }
function normalizeOrders(items) { return items.map((item, index) => ({ ...item, sortOrder: (index + 1) * 10 })); }
function move(items, index, direction) { const destination = index + direction; if (destination < 0 || destination >= items.length) return items; const next = [...items]; [next[index], next[destination]] = [next[destination], next[index]]; return normalizeOrders(next); }
function mapAsset(asset) { return { id: asset.id, secureUrl: asset.secure_url || asset.secureUrl || asset.url, displayName: asset.display_name || asset.displayName || asset.filename, altText: asset.alt_text || asset.altText || '', format: asset.format, width: asset.width, height: asset.height }; }
function Field({ label, value, onChange, multiline = false, type = 'text' }) { const Control = multiline ? 'textarea' : 'input'; return <label><span className={LABEL}>{label}</span><Control type={type} rows={multiline ? 4 : undefined} value={value ?? ''} onChange={(event) => onChange(event.target.value)} className={INPUT} /></label>; }
function Select({ label, value, onChange, options }) { return <label><span className={LABEL}>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className={INPUT}>{options.map(([key, text]) => <option value={key} key={key}>{text}</option>)}</select></label>; }

function FilterOptionRow({ option, index, options, usageCount, onCommitKey, onChangeLabel, onDelete }) {
  const [draftKey, setDraftKey] = useState(option.key);

  const normalizedKey = draftKey.trim().toLowerCase().replace(/\s+/g, '-');
  const keyInvalid = !PROJECT_FILTER_KEY_PATTERN.test(normalizedKey) || normalizedKey === 'all';
  const duplicate = options.some((candidate, candidateIndex) => candidateIndex !== index && candidate.key === normalizedKey);
  const keyChanged = normalizedKey !== option.key;

  const commitKey = () => {
    if (!keyChanged || keyInvalid || duplicate) return;
    onCommitKey(normalizedKey);
  };

  return <div className="rounded-lg border border-slate-200 bg-white p-3">
    <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
      <label>
        <span className={LABEL}>Key</span>
        <div className="flex gap-2">
          <input
            value={draftKey}
            onChange={(event) => setDraftKey(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitKey();
              }
            }}
            className={`${INPUT} ${keyInvalid || duplicate ? 'border-red-300' : ''}`}
          />
          <button
            type="button"
            onClick={commitKey}
            disabled={!keyChanged || keyInvalid || duplicate}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 text-[10px] font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
          >Apply</button>
        </div>
      </label>
      <label><span className={LABEL}>Public label</span><input value={option.label} onChange={(event) => onChangeLabel(event.target.value)} className={INPUT} /></label>
      <button type="button" onClick={onDelete} className="mt-5 rounded-lg border border-red-200 px-3 py-2 text-[10px] font-bold text-red-600">Delete</button>
    </div>
    <p className={`mt-1 text-[10px] ${keyInvalid || duplicate ? 'font-semibold text-red-600' : 'text-slate-400'}`}>
      {keyInvalid
        ? 'Use a lowercase URL-safe key such as luxury-hotel. The reserved key “all” is not allowed.'
        : duplicate
          ? 'Keys must be unique inside this filter.'
          : keyChanged
            ? 'Apply the key change to update linked draft projects safely.'
            : `${usageCount} linked project${usageCount === 1 ? '' : 's'}`}
    </p>
  </div>;
}

function FilterOptionsEditor({ listing, projects, onChange }) {
  const filterOptions = normalizeProjectFilterOptions(listing);

  const commitOptionKey = (group, index, nextKey) => {
    const current = filterOptions[group.key][index];
    if (!current || nextKey === current.key) return;
    const nextFilterOptions = {
      ...filterOptions,
      [group.key]: filterOptions[group.key].map((option, optionIndex) => optionIndex === index ? { ...option, key: nextKey } : option),
    };
    const nextProjects = projects.map((project) => project[group.projectField] === current.key ? { ...project, [group.projectField]: nextKey } : project);
    onChange(nextFilterOptions, nextProjects);
  };

  const updateOptionLabel = (group, index, label) => {
    onChange({
      ...filterOptions,
      [group.key]: filterOptions[group.key].map((option, optionIndex) => optionIndex === index ? { ...option, label } : option),
    }, projects);
  };

  const addOption = (group) => {
    const options = filterOptions[group.key];
    if (options.length >= 30) return;
    const key = createUniqueFilterKey(options, `new-${group.key}`);
    onChange({
      ...filterOptions,
      [group.key]: [...options, { key, label: `New ${group.title}` }],
    }, projects);
  };

  const removeOption = (group, index) => {
    const options = filterOptions[group.key];
    if (options.length <= 1) {
      window.alert(`Keep at least one ${group.title.toLowerCase()} option.`);
      return;
    }
    const removed = options[index];
    const remaining = options.filter((_, optionIndex) => optionIndex !== index);
    const replacement = remaining[0];
    const usageCount = projects.filter((project) => project[group.projectField] === removed.key).length;
    const message = usageCount
      ? `"${removed.label}" is assigned to ${usageCount} project(s). Deleting it will reassign those projects to "${replacement.label}". Continue?`
      : `Delete the "${removed.label}" option?`;
    if (!window.confirm(message)) return;
    const nextProjects = usageCount
      ? projects.map((project) => project[group.projectField] === removed.key ? { ...project, [group.projectField]: replacement.key } : project)
      : projects;
    onChange({ ...filterOptions, [group.key]: remaining }, nextProjects);
  };

  return <div className="grid gap-4 xl:grid-cols-2">
    {PROJECT_FILTER_GROUPS.map((group) => <section key={group.key} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-3"><div><h4 className="font-serif text-sm font-bold text-[#0B1B3D]">{group.title} options</h4><p className="text-[10px] text-slate-500">Keys connect projects to this filter. Apply a key change to update linked draft projects atomically.</p></div><button type="button" onClick={() => addOption(group)} disabled={filterOptions[group.key].length >= 30} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[10px] font-bold text-slate-700 disabled:opacity-40">+ Add</button></div>
      <div className="space-y-2">{filterOptions[group.key].map((option, index) => <FilterOptionRow
        key={`${group.key}-${option.key}`}
        option={option}
        index={index}
        options={filterOptions[group.key]}
        usageCount={projects.filter((project) => project[group.projectField] === option.key).length}
        onCommitKey={(nextKey) => commitOptionKey(group, index, nextKey)}
        onChangeLabel={(label) => updateOptionLabel(group, index, label)}
        onDelete={() => removeOption(group, index)}
      />)}</div>
    </section>)}
  </div>;
}

function ProjectForm({ project, filterOptions, onChange, onChooseCover, onChooseGallery, onRemoveGallery }) {
  const set = (field, value) => onChange({ ...project, [field]: value });
  return <div className="space-y-6">
    <div className="grid gap-3 md:grid-cols-3"><Field label="Project name" value={project.name} onChange={(value) => set('name', value)} /><Field label="URL slug" value={project.slug} onChange={(value) => set('slug', value)} /><Field label="Tagline" value={project.tagline} onChange={(value) => set('tagline', value)} /></div>
    <div className="grid gap-3 md:grid-cols-4"><Select label="Lifecycle" value={project.lifecycle} onChange={(value) => set('lifecycle', value)} options={filterOptions.status.map((option) => [option.key, option.label])} /><Select label="Property category" value={project.propertyCategory} onChange={(value) => set('propertyCategory', value)} options={filterOptions.category.map((option) => [option.key, option.label])} /><Select label="Location filter" value={project.locationKey} onChange={(value) => set('locationKey', value)} options={filterOptions.location.map((option) => [option.key, option.label])} /><Select label="Size filter" value={project.sizeCategory} onChange={(value) => set('sizeCategory', value)} options={filterOptions.size.map((option) => [option.key, option.label])} /></div>
    <div className="grid gap-3 md:grid-cols-2"><Field label="Badge text" value={project.badgeText} onChange={(value) => set('badgeText', value)} /><Field label="City/zone" value={project.cityZone} onChange={(value) => set('cityZone', value)} /><Field label="Card location" value={project.cardLocation} onChange={(value) => set('cardLocation', value)} /><Field label="Card size" value={project.cardSize} onChange={(value) => set('cardSize', value)} /><Field label="Project type" value={project.projectType} onChange={(value) => set('projectType', value)} /><Field label="Short description/SEO" value={project.descriptionShort} onChange={(value) => set('descriptionShort', value)} multiline /></div>
    <div className="grid gap-3 md:grid-cols-3"><Field label="Detail status label" value={project.detailCategoryLabel} onChange={(value) => set('detailCategoryLabel', value)} /><Field label="Detail location" value={project.detailLocation} onChange={(value) => set('detailLocation', value)} /><Field label="Detail size" value={project.detailSize} onChange={(value) => set('detailSize', value)} /><Field label="Floor structure" value={project.floors} onChange={(value) => set('floors', value)} /><Field label="Parking" value={project.parking} onChange={(value) => set('parking', value)} /><Field label="Elevators" value={project.elevators} onChange={(value) => set('elevators', value)} /><Field label="Power backup" value={project.power} onChange={(value) => set('power', value)} /><Field label="Land area" value={project.landArea} onChange={(value) => set('landArea', value)} /><Field label="Building height" value={project.buildingHeight} onChange={(value) => set('buildingHeight', value)} /></div>
    <Field label="Full project overview" value={project.description} onChange={(value) => set('description', value)} multiline />
    <div className="rounded-xl border p-4"><h3 className="font-serif text-sm font-bold text-[#0B1B3D]">Cover image</h3><div className="mt-3 flex flex-col gap-4 sm:flex-row">{project.coverMedia?.secureUrl && <img src={project.coverMedia.secureUrl} alt="" className="h-32 w-48 rounded-lg object-cover" />}<div className="flex-1"><Field label="Accessible image description" value={project.coverAlt} onChange={(value) => set('coverAlt', value)} /><button type="button" onClick={onChooseCover} className="mt-3 rounded-lg bg-[#0B1B3D] px-3 py-2 text-xs font-bold text-white">Choose cover image</button></div></div></div>
    <div className="rounded-xl border p-4"><h3 className="font-serif text-sm font-bold text-[#0B1B3D]">Video tour (optional)</h3><p className="text-[10px] text-slate-500">Paste a YouTube link. It renders as a video frame on the project detail page next to the photo gallery.</p><div className="mt-3"><Field label="YouTube video URL" value={project.videoUrl} onChange={(value) => set('videoUrl', value)} /></div>{project.videoUrl?.trim() && !extractYouTubeVideoId(project.videoUrl.trim()) && <p className="mt-2 text-[10px] font-semibold text-red-600">This does not look like a valid YouTube link.</p>}</div>
    <div className="rounded-xl border p-4"><div className="flex items-center justify-between"><div><h3 className="font-serif text-sm font-bold text-[#0B1B3D]">Gallery images</h3><p className="text-[10px] text-slate-500">The cover remains the first thumbnail. Add up to eight additional images.</p></div><button type="button" disabled={project.gallery.length >= 8} onClick={onChooseGallery} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40">+ Gallery image</button></div><div className="mt-4 grid gap-3 md:grid-cols-2">{project.gallery.map((image, index) => <div key={`${image.mediaId}-${index}`} className="rounded-xl bg-slate-50 p-3">{image.media?.secureUrl && <img src={image.media.secureUrl} alt="" className="h-28 w-full rounded-lg object-cover" />}<div className="mt-2"><Field label="Accessible image description" value={image.alt} onChange={(value) => set('gallery', project.gallery.map((item, itemIndex) => itemIndex === index ? { ...item, alt: value } : item))} /></div><div className="mt-2 flex items-center justify-between"><label className="text-xs"><input type="checkbox" checked={image.isVisible !== false} onChange={(event) => set('gallery', project.gallery.map((item, itemIndex) => itemIndex === index ? { ...item, isVisible: event.target.checked } : item))} /> Visible</label><button type="button" onClick={() => onRemoveGallery(index)} className="text-xs font-bold text-red-600">Remove</button></div></div>)}</div></div>
    <label className="block rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900"><input type="checkbox" checked={project.isVisible !== false} onChange={(event) => set('isVisible', event.target.checked)} /> Show this project on the Projects listing page</label>
  </div>;
}

export default function ProjectsPageEditor({ initialProjectsPage }) {
  const router = useRouter();
  const initial = useMemo(() => {
    const next = clone(initialProjectsPage);
    next.content.listing.filterOptions = normalizeProjectFilterOptions(next.content.listing);
    return next;
  }, [initialProjectsPage]);
  const initialIds = useMemo(() => new Set(initial.content.projects.map((project) => project.projectId)), [initial]);
  const [page, setPage] = useState(initial);
  const [baseline, setBaseline] = useState(comparable(initial));
  const [tab, setTab] = useState('Page Content');
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(-1);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('neutral');
  const [picker, setPicker] = useState(null);
  const [advanced, setAdvanced] = useState(() => JSON.stringify(advancedPayload(initial), null, 2));
  const dirty = comparable(page) !== baseline;
  const filterOptions = normalizeProjectFilterOptions(page.content.listing);

  const update = (patch) => { setPage((current) => ({ ...current, ...patch })); setMessage(''); };
  const updateContent = (section, field, value) => update({ content: { ...page.content, [section]: { ...page.content[section], [field]: value } } });
  const setProjects = (projects) => update({ content: { ...page.content, projects } });
  const updateProject = (index, project) => setProjects(page.content.projects.map((item, itemIndex) => itemIndex === index ? project : item));
  const updateFilterOptions = (nextFilterOptions, nextProjects) => update({ content: { ...page.content, listing: { ...page.content.listing, filterOptions: nextFilterOptions }, projects: nextProjects } });
  const addProject = () => {
    const source = page.content.projects[0];
    const project = { ...clone(source), projectId: crypto.randomUUID(), slug: `new-project-${Date.now()}`, name: 'New Project', tagline: 'NEW DHAKA HEIGHTS PROJECT', gallery: [], videoUrl: '', isVisible: false, sortOrder: (page.content.projects.length + 1) * 10 };
    setProjects([...page.content.projects, project]); setSelectedIndex(page.content.projects.length); setTab('Projects');
  };
  const chooseMedia = (asset) => {
    const media = mapAsset(asset);
    if (picker.type === 'header') update({ content: { ...page.content, header: { ...page.content.header, mediaId: asset.id, media } } });
    if (picker.type === 'cover') updateProject(picker.index, { ...page.content.projects[picker.index], coverMediaId: asset.id, coverMedia: media });
    if (picker.type === 'gallery') updateProject(picker.index, { ...page.content.projects[picker.index], gallery: [...page.content.projects[picker.index].gallery, { mediaId: asset.id, media, alt: asset.alt_text || `${page.content.projects[picker.index].name} gallery image`, isVisible: true }] });
    setPicker(null);
  };
  const save = async () => {
    setBusy('save'); setMessage('');
    try {
      const result = await saveProjectsPageDraft(payload(page));
      if (!result?.ok) { setTone('error'); setMessage(result?.error || 'Draft save failed.'); return; }
      const saved = { ...clone(result.data), history: page.history };
      setPage(saved); setBaseline(comparable(saved)); setTone('success'); setMessage('Projects page draft saved. Public content remains unchanged.');
    } finally { setBusy(''); }
  };
  const publish = async () => {
    setBusy('publish'); setMessage('');
    try {
      const result = await publishProjectsPageDraft({ id: page.id, expectedUpdatedAt: page.updatedAt });
      if (!result?.ok) { setTone('error'); setMessage(result?.error || 'Publish failed.'); return; }
      const published = { ...clone(result.data), history: page.history };
      setPage(published); setBaseline(comparable(published)); setTone('success'); setMessage('Projects page and canonical catalogue published and revalidated.'); router.refresh();
    } finally { setBusy(''); }
  };
  const applyAdvanced = () => {
    try {
      const parsed = JSON.parse(advanced);
      setPage((current) => ({ ...current, ...parsed, id: current.id, pageId: current.pageId, updatedAt: current.updatedAt, history: current.history }));
      setTone('success'); setMessage('Structured Projects content applied locally.');
    } catch (error) { setTone('error'); setMessage(`Invalid structured content: ${error.message}`); }
  };

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#B59410]">Phase 3 · Full-page workflow</p><h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Projects Page & Catalogue Editor</h1><p className="text-xs text-slate-500">Version {page.versionNumber} · {page.status} · {dirty ? 'Unsaved changes' : 'Up to date'} · {page.content.projects.length} projects</p></div><div className="flex flex-wrap gap-2"><Link href="/admin-preview/projects-page" target="_blank" className="rounded-xl border px-4 py-2 text-xs font-bold">Saved Preview</Link><button type="button" onClick={save} disabled={!dirty || busy} className="rounded-xl bg-slate-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy === 'save' ? 'Saving…' : 'Save Draft'}</button><button type="button" onClick={publish} disabled={dirty || busy || page.status !== 'draft'} className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy === 'publish' ? 'Publishing…' : 'Publish'}</button></div></header>
    {message && <div className={`rounded-xl border p-3 text-xs font-semibold ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message}</div>}
    <nav className="flex flex-wrap gap-2">{TABS.map((name) => <button type="button" key={name} onClick={() => { setTab(name); if (name === 'Advanced') setAdvanced(JSON.stringify(advancedPayload(page), null, 2)); }} className={`rounded-xl px-4 py-2 text-xs font-bold ${tab === name ? 'bg-[#0B1B3D] text-white' : 'border bg-white text-slate-600'}`}>{name}</button>)}</nav>
    <section className="rounded-2xl border bg-white p-5">
      {tab === 'Page Content' && <div className="space-y-7"><div><h2 className="mb-3 font-serif text-lg font-bold">Portfolio header and SEO</h2><div className="grid gap-3 md:grid-cols-2"><Field label="Page title" value={page.content.header.title} onChange={(value) => updateContent('header', 'title', value)} /><Field label="Page subtitle" value={page.content.header.subtitle} onChange={(value) => updateContent('header', 'subtitle', value)} /><Field label="SEO title" value={page.content.seo.title} onChange={(value) => updateContent('seo', 'title', value)} /><Field label="Canonical URL" value={page.content.seo.canonicalUrl} onChange={(value) => updateContent('seo', 'canonicalUrl', value)} /><Field label="SEO description" value={page.content.seo.description} onChange={(value) => updateContent('seo', 'description', value)} multiline /><div className="rounded-xl border p-3">{page.content.header.media?.secureUrl && <img src={page.content.header.media.secureUrl} alt="" className="h-28 w-full rounded-lg object-cover" />}<Field label="Header image alt" value={page.content.header.imageAlt} onChange={(value) => updateContent('header', 'imageAlt', value)} /><button type="button" onClick={() => setPicker({ type: 'header' })} className="mt-2 rounded-lg bg-[#0B1B3D] px-3 py-2 text-xs font-bold text-white">Choose header image</button></div></div></div>
      <div><h2 className="mb-3 font-serif text-lg font-bold">Listing and filter copy</h2><div className="grid gap-3 md:grid-cols-3"><Field label="Filter title" value={page.content.listing.filterTitle} onChange={(value) => updateContent('listing', 'filterTitle', value)} /><Field label="Reset label" value={page.content.listing.resetLabel} onChange={(value) => updateContent('listing', 'resetLabel', value)} /><Field type="number" label="Projects per page" value={page.content.listing.itemsPerPage} onChange={(value) => updateContent('listing', 'itemsPerPage', Number(value))} /><Field label="Results template" value={page.content.listing.resultsTemplate} onChange={(value) => updateContent('listing', 'resultsTemplate', value)} /><Field label="No-results title" value={page.content.listing.emptyTitle} onChange={(value) => updateContent('listing', 'emptyTitle', value)} /><Field label="No-results reset" value={page.content.listing.emptyResetLabel} onChange={(value) => updateContent('listing', 'emptyResetLabel', value)} /><Field label="No-results description" value={page.content.listing.emptyBody} onChange={(value) => updateContent('listing', 'emptyBody', value)} multiline /></div><h3 className="mb-3 mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">Filter and pagination labels</h3><div className="grid gap-3 md:grid-cols-3">{FILTER_COPY_FIELDS.map(([key,label]) => <Field key={key} label={label} value={page.content.listing[key]} onChange={(value) => updateContent('listing', key, value)} />)}</div><h3 className="mb-3 mt-7 text-xs font-bold uppercase tracking-wider text-slate-500">Dynamic filter options</h3><FilterOptionsEditor listing={page.content.listing} projects={page.content.projects} onChange={updateFilterOptions} /></div>
      <div><h2 className="mb-3 font-serif text-lg font-bold">Project detail and inquiry copy</h2><div className="grid gap-3 md:grid-cols-2"><Field label="Overview title" value={page.content.detail.overviewTitle} onChange={(value) => updateContent('detail', 'overviewTitle', value)} /><Field label="At-a-glance title" value={page.content.detail.atGlanceTitle} onChange={(value) => updateContent('detail', 'atGlanceTitle', value)} /><Field label="Shared supporting paragraph" value={page.content.detail.secondaryDescription} onChange={(value) => updateContent('detail', 'secondaryDescription', value)} multiline /><Field label="Inquiry form description" value={page.content.detail.formDescription} onChange={(value) => updateContent('detail', 'formDescription', value)} multiline /><Field label="Inquiry form title" value={page.content.detail.formTitle} onChange={(value) => updateContent('detail', 'formTitle', value)} /><Field label="Submit label" value={page.content.detail.submitLabel} onChange={(value) => updateContent('detail', 'submitLabel', value)} /><Field label="Success message" value={page.content.detail.successMessage} onChange={(value) => updateContent('detail', 'successMessage', value)} multiline /><Field label="Error message" value={page.content.detail.errorMessage} onChange={(value) => updateContent('detail', 'errorMessage', value)} multiline /></div><h3 className="mb-3 mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">Detail labels and placeholders</h3><div className="grid gap-3 md:grid-cols-3">{DETAIL_COPY_FIELDS.map(([key,label]) => <Field key={key} multiline={key === 'notFoundBody'} label={label} value={page.content.detail[key]} onChange={(value) => updateContent('detail', key, value)} />)}</div></div>
      <label className="block rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900"><input type="checkbox" checked={page.isVisible} onChange={(event) => update({ isVisible: event.target.checked })} /> Enable the public Projects page content</label></div>}
      {tab === 'Projects' && <div className="space-y-4"><div className="flex items-center justify-between"><div><h2 className="font-serif text-lg font-bold">Canonical project catalogue</h2><p className="text-xs text-slate-500">Edits remain draft-only until the whole Projects page is published.</p></div><button type="button" onClick={addProject} disabled={page.content.projects.length >= 50} className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white">+ Add project</button></div>{selectedIndex === null ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{page.content.projects.map((project, index) => <article key={project.projectId} className="rounded-xl border p-3"><img src={project.coverMedia?.secureUrl} alt="" className="h-32 w-full rounded-lg object-cover" /><div className="mt-3 flex items-start justify-between gap-2"><div><span className="text-[9px] font-bold uppercase text-[#B59410]">{project.lifecycle} · {project.isVisible === false ? 'hidden' : 'visible'}</span><h3 className="font-serif text-sm font-bold text-[#0B1B3D]">{project.name}</h3><p className="text-[10px] text-slate-500">{project.cardLocation}</p></div><div className="flex gap-1"><button type="button" onClick={() => setProjects(move(page.content.projects, index, -1))} disabled={!index} className="h-8 w-8 rounded-lg border disabled:opacity-30" aria-label={`Move ${project.name} up`}>↑</button><button type="button" onClick={() => setProjects(move(page.content.projects, index, 1))} disabled={index === page.content.projects.length - 1} className="h-8 w-8 rounded-lg border disabled:opacity-30" aria-label={`Move ${project.name} down`}>↓</button></div></div><div className="mt-3 flex gap-2"><button type="button" onClick={() => setSelectedIndex(index)} className="flex-1 rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white">Edit details</button>{!initialIds.has(project.projectId) && <button type="button" onClick={() => confirm('Remove this new draft project?') && setProjects(normalizeOrders(page.content.projects.filter((_, itemIndex) => itemIndex !== index)))} className="rounded-lg border border-red-200 px-3 text-xs font-bold text-red-600">Remove</button>}</div></article>)}</div> : <div><div className="mb-4 flex items-center justify-between border-b pb-3"><div><button type="button" onClick={() => setSelectedIndex(null)} className="text-xs font-bold text-[#B59410]">← Back to catalogue</button><h2 className="mt-1 font-serif text-lg font-bold">Edit {page.content.projects[selectedIndex].name}</h2></div><span className="font-mono text-[10px] text-slate-400">{page.content.projects[selectedIndex].projectId}</span></div><ProjectForm project={page.content.projects[selectedIndex]} filterOptions={filterOptions} onChange={(project) => updateProject(selectedIndex, project)} onChooseCover={() => setPicker({ type: 'cover', index: selectedIndex })} onChooseGallery={() => setPicker({ type: 'gallery', index: selectedIndex })} onRemoveGallery={(galleryIndex) => updateProject(selectedIndex, { ...page.content.projects[selectedIndex], gallery: page.content.projects[selectedIndex].gallery.filter((_, index) => index !== galleryIndex) })} /></div>}</div>}
      {tab === 'Preview' && <div><div className="mb-4 flex items-center gap-3"><label className="text-xs font-bold">Preview view</label><select value={previewIndex} onChange={(event) => setPreviewIndex(Number(event.target.value))} className={INPUT}><option value={-1}>Projects listing</option>{page.content.projects.map((project, index) => <option value={index} key={project.projectId}>{project.name} detail</option>)}</select></div><div className="max-h-[760px] overflow-auto rounded-xl border">{previewIndex < 0 ? <ProjectsPageClient projectsPage={page} previewMode /> : <ProjectDetailClient key={page.content.projects[previewIndex].projectId} project={page.content.projects[previewIndex]} projectsPage={page} previewMode />}</div></div>}
      {tab === 'Advanced' && <div><p className="mb-3 text-xs text-slate-500">Complete structured Projects payload. Database validation and media ID checks still apply.</p><textarea value={advanced} onChange={(event) => setAdvanced(event.target.value)} rows={34} spellCheck={false} className={`${INPUT} font-mono leading-5`} /><button type="button" onClick={applyAdvanced} className="mt-3 rounded-lg bg-slate-700 px-4 py-2 text-xs font-bold text-white">Apply structured content</button></div>}
    </section>
    {page.history?.length > 0 && <section className="rounded-2xl border bg-white p-5"><h2 className="font-serif text-lg font-bold">Revision history</h2>{page.history.map((item) => <div key={item.id} className="mt-2 flex justify-between rounded-lg bg-slate-50 p-3 text-xs"><span>{item.change_summary || 'Saved Projects page revision'}</span><span>v{item.version_number} · {new Date(item.created_at).toLocaleString()}</span></div>)}</section>}
    {picker && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4"><div className="w-full max-w-7xl"><MediaLibrary isModal resourceTypeFilter="image" onSelectAsset={chooseMedia} onCloseModal={() => setPicker(null)} /></div></div>}
  </div>;
}
