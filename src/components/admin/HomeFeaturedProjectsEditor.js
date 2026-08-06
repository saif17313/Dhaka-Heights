'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProjectsGrid from '@/components/ProjectsGrid';
import { publishHomeFeaturedProjectsDraft, saveHomeFeaturedProjectsDraft } from '@/lib/homeFeaturedProjectsActions';

const INPUT_CLASS = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none transition focus:border-[#C5A880] focus:ring-2 focus:ring-[#C5A880]/20';
const LABEL_CLASS = 'mb-1 block text-[11px] font-bold text-slate-700';

function normalizeProject(project) {
  if (!project) return null;
  return {
    id: project.id,
    slug: project.slug || '',
    name: project.name || '',
    category: project.category || 'ongoing',
    badgeText: project.badgeText || '',
    location: project.location || '',
    size: project.size || '',
    projectType: project.projectType || '',
    status: project.status || 'published',
    coverMediaId: project.coverMediaId || null,
    coverMedia: project.coverMedia || null,
    sortOrder: Number(project.sortOrder) || 10,
  };
}

function normalizePlacement(placement, index) {
  return {
    placementId: placement?.placementId || null,
    projectId: placement?.projectId || placement?.project?.id || null,
    sortOrder: (index + 1) * 10,
    isVisible: placement?.isVisible !== false,
    project: normalizeProject(placement?.project),
  };
}

function normalizeFeatured(source) {
  if (!source) return null;
  const featured = source.data || source.featuredProjects || source;
  return {
    id: featured.id || null,
    pageId: featured.pageId || null,
    sectionKey: featured.sectionKey || 'featured-projects-home',
    status: featured.status || 'draft',
    versionNumber: Number(featured.versionNumber) || 1,
    isVisible: featured.isVisible !== false,
    tagText: featured.tagText || '',
    heading: featured.heading || '',
    pageSize: Number(featured.pageSize) || 6,
    projects: (featured.projects || []).map(normalizePlacement),
    updatedAt: featured.updatedAt || null,
    updatedBy: featured.updatedBy || null,
    publishedAt: featured.publishedAt || null,
    publishedBy: featured.publishedBy || null,
    history: (featured.history || []).map((revision) => ({
      id: revision.id,
      revisionNumber: Number(revision.revisionNumber) || 0,
      summary: revision.summary || 'Saved Home Featured Projects revision',
      createdAt: revision.createdAt || null,
      createdBy: revision.createdBy || null,
    })),
  };
}

function toPayload(featured) {
  return {
    id: featured.id,
    pageId: featured.pageId,
    sectionKey: 'featured-projects-home',
    isVisible: featured.isVisible,
    updatedAt: featured.updatedAt,
    tagText: featured.tagText.trim(),
    heading: featured.heading.trim(),
    pageSize: Number(featured.pageSize),
    projects: featured.projects.map((placement) => ({
      projectId: placement.projectId,
      isVisible: placement.isVisible,
    })),
  };
}

function comparable(featured) {
  return featured ? JSON.stringify(toPayload(featured)) : '';
}

function validateFeatured(featured) {
  const errors = {};
  if (!featured.tagText.trim() || featured.tagText.trim().length > 80) errors.tagText = 'Section tag is required and must be 80 characters or fewer.';
  if (!featured.heading.trim() || featured.heading.trim().length > 140) errors.heading = 'Heading is required and must be 140 characters or fewer.';
  const pageSize = Number(featured.pageSize);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 12) errors.pageSize = 'Page size must be an integer from 1 to 12.';
  if (featured.projects.length < 1 || featured.projects.length > 20) errors.projects = 'Select between 1 and 20 projects.';
  if (!featured.projects.some((placement) => placement.isVisible)) errors.projects = 'At least one selected project must be visible.';
  if (featured.projects.some((placement) => !placement.projectId || !placement.project?.coverMedia?.secureUrl)) errors.projects = 'Every placement requires a canonical project with an active cover.';
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

function ProjectPreview({ featured }) {
  const [filter, setFilter] = useState('all');
  return <ProjectsGrid featuredProjects={featured} activeFilter={filter} onFilterChange={setFilter} previewMode />;
}

export default function HomeFeaturedProjectsEditor({ initialFeaturedProjects, projectCatalog = [], initialError = '' }) {
  const router = useRouter();
  const normalizedInitial = useMemo(() => normalizeFeatured(initialFeaturedProjects), [initialFeaturedProjects]);
  const catalog = useMemo(() => projectCatalog.map(normalizeProject).filter(Boolean), [projectCatalog]);
  const [featured, setFeatured] = useState(normalizedInitial);
  const [baseline, setBaseline] = useState(() => comparable(normalizedInitial));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(initialError);
  const [tone, setTone] = useState(initialError ? 'error' : 'neutral');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [search, setSearch] = useState('');
  const dirty = featured ? comparable(featured) !== baseline : false;

  const selectedIds = useMemo(() => new Set((featured?.projects || []).map((placement) => placement.projectId)), [featured]);
  const availableProjects = catalog.filter((project) => !selectedIds.has(project.id) && (
    !search.trim() || `${project.name} ${project.location} ${project.category}`.toLowerCase().includes(search.trim().toLowerCase())
  ));

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (patch) => {
    setFeatured((current) => ({ ...current, ...patch }));
    setMessage('');
    setConflict(false);
  };

  const updatePlacement = (index, patch) => {
    update({ projects: featured.projects.map((placement, placementIndex) => placementIndex === index ? { ...placement, ...patch } : placement) });
  };

  const movePlacement = (index, direction) => {
    const destination = index + direction;
    if (destination < 0 || destination >= featured.projects.length) return;
    const projects = [...featured.projects];
    [projects[index], projects[destination]] = [projects[destination], projects[index]];
    update({ projects: projects.map((placement, placementIndex) => ({ ...placement, sortOrder: (placementIndex + 1) * 10 })) });
  };

  const addProject = (project) => {
    if (selectedIds.has(project.id) || featured.projects.length >= 20) return;
    update({ projects: [...featured.projects, normalizePlacement({ projectId: project.id, project, isVisible: true }, featured.projects.length)] });
  };

  const removeProject = (index) => {
    const placement = featured.projects[index];
    if (!window.confirm(`Remove “${placement.project.name}” from this Home placement draft? The canonical project will not be deleted.`)) return;
    update({ projects: featured.projects.filter((_, placementIndex) => placementIndex !== index) });
  };

  const applyFailure = (result, fallback) => {
    setErrors(result.fieldErrors || {});
    setConflict(result.status === 409 || String(result.code || '').includes('CONFLICT'));
    setTone('error');
    setMessage(result.error || fallback);
  };

  const handleSave = async () => {
    const clientErrors = validateFeatured(featured);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) {
      setTone('error');
      setMessage('Fix the highlighted fields before saving.');
      return;
    }
    setSaving(true);
    try {
      const result = await saveHomeFeaturedProjectsDraft(toPayload(featured));
      if (!result?.ok) return applyFailure(result || {}, 'The Featured Projects draft could not be saved.');
      const saved = normalizeFeatured(result.data);
      setFeatured(saved);
      setBaseline(comparable(saved));
      setErrors({});
      setTone('success');
      setMessage('Draft saved. Canonical project records and the published Home page have not changed.');
    } catch (error) {
      setTone('error');
      setMessage(error instanceof Error ? error.message : 'The Featured Projects draft could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const result = await publishHomeFeaturedProjectsDraft({ id: featured.id, expectedUpdatedAt: featured.updatedAt });
      if (!result?.ok) return applyFailure(result || {}, 'The Featured Projects draft could not be published.');
      const published = normalizeFeatured(result.data);
      setFeatured(published);
      setBaseline(comparable(published));
      setErrors({});
      setTone('success');
      setMessage('Featured Projects published and the public Home cache was refreshed.');
      router.refresh();
    } catch (error) {
      setTone('error');
      setMessage(error instanceof Error ? error.message : 'The Featured Projects draft could not be published.');
    } finally {
      setPublishing(false);
    }
  };

  if (!featured) {
    return <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm"><h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Featured Projects editor unavailable</h1><p className="mt-2 text-sm text-slate-600">{initialError || 'No saved Featured Projects version was returned.'}</p><button type="button" onClick={() => router.refresh()} className="mt-5 rounded-xl bg-[#0B1B3D] px-5 py-2 text-xs font-bold text-white">Retry loading</button></div>;
  }

  return (
    <div className="w-full space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${featured.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{featured.status}</span><span className="font-mono text-[10px] text-slate-400">key: featured-projects-home · version {featured.versionNumber}</span>{dirty && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">Unsaved changes</span>}</div>
            <h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Home Featured Projects</h1>
            <p className="mt-1 text-xs font-medium text-slate-500">Select and order canonical published projects without duplicating their card content.</p>
            <p className="mt-2 text-[10px] text-slate-400">Last saved: {timestampLabel(featured.updatedAt)} by {actorLabel(featured.updatedBy)}</p>
          </div>
          <div className="flex flex-wrap gap-2"><Link href="/admin-preview/home/featured-projects-home" target="_blank" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">Saved version preview</Link><button type="button" onClick={handleSave} disabled={!dirty || saving || publishing} className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save Draft'}</button><button type="button" onClick={handlePublish} disabled={dirty || featured.status !== 'draft' || saving || publishing} className="rounded-xl bg-[#B59410] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{publishing ? 'Publishing…' : 'Publish'}</button></div>
        </div>
        {message && <div className={`mt-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-semibold ${tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}><span>{message}</span>{conflict && <button type="button" onClick={() => router.refresh()} className="underline">Reload latest</button>}</div>}
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-7">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="border-b border-slate-100 pb-3 font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Section settings</h2>
            <label className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4"><span><span className="block text-xs font-bold text-slate-700">Section visible</span><span className="text-[10px] text-slate-400">Hide the complete Featured Projects block when disabled.</span></span><input type="checkbox" checked={featured.isVisible} onChange={(event) => update({ isVisible: event.target.checked })} className="h-4 w-4 accent-[#B59410]" /></label>
            <div className="mt-4 grid gap-4 sm:grid-cols-12"><div className="sm:col-span-4"><label className={LABEL_CLASS}>Section tag</label><input value={featured.tagText} maxLength={80} onChange={(event) => update({ tagText: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors.tagText}</FieldError></div><div className="sm:col-span-6"><label className={LABEL_CLASS}>Heading</label><input value={featured.heading} maxLength={140} onChange={(event) => update({ heading: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors.heading}</FieldError></div><div className="sm:col-span-2"><label className={LABEL_CLASS}>Cards/page</label><input type="number" min="1" max="12" value={featured.pageSize} onChange={(event) => update({ pageSize: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors.pageSize}</FieldError></div></div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3"><div><h2 className="font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Selected projects ({featured.projects.length})</h2><p className="mt-1 text-[10px] text-slate-400">Arrow controls provide accessible ordering; removing a placement never deletes its project.</p></div><Link href="/admin/projects" className="text-[10px] font-bold text-[#8A6D08] underline">Manage canonical projects</Link></div>
            <FieldError>{errors.projects}</FieldError>
            <div className="mt-4 space-y-3">{featured.projects.map((placement, index) => <article key={placement.projectId} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:flex-row sm:items-center"><img src={placement.project.coverMedia?.secureUrl} alt={placement.project.name} className="h-20 w-24 rounded-xl object-cover" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[9px] font-bold text-[#8A6D08]">{String(index + 1).padStart(2, '0')}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${placement.project.category === 'completed' ? 'bg-emerald-100 text-emerald-700' : placement.project.category === 'upcoming' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{placement.project.category}</span></div><h3 className="mt-1 truncate text-xs font-bold text-[#0B1B3D]">{placement.project.name}</h3><p className="mt-1 truncate text-[10px] text-slate-500">{placement.project.location}</p><label className="mt-2 flex items-center gap-2 text-[10px] font-bold text-slate-600"><input type="checkbox" checked={placement.isVisible} onChange={(event) => updatePlacement(index, { isVisible: event.target.checked })} className="h-3.5 w-3.5 accent-[#B59410]" />Show on Home</label></div><div className="flex items-center gap-1"><button type="button" onClick={() => movePlacement(index, -1)} disabled={index === 0} aria-label={`Move ${placement.project.name} up`} className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30"><i className="fa-solid fa-arrow-up"></i></button><button type="button" onClick={() => movePlacement(index, 1)} disabled={index === featured.projects.length - 1} aria-label={`Move ${placement.project.name} down`} className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30"><i className="fa-solid fa-arrow-down"></i></button><button type="button" onClick={() => removeProject(index)} aria-label={`Remove ${placement.project.name}`} className="h-8 w-8 rounded-lg border border-red-200 bg-white text-red-600"><i className="fa-solid fa-trash"></i></button></div></article>)}</div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Available canonical projects</h2><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects…" className={`${INPUT_CLASS} mt-3`} />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">{availableProjects.map((project) => <article key={project.id} className="flex gap-3 rounded-xl border border-slate-200 p-3"><img src={project.coverMedia?.secureUrl} alt={project.name} className="h-16 w-20 rounded-lg object-cover" /><div className="min-w-0 flex-1"><h3 className="truncate text-[11px] font-bold text-[#0B1B3D]">{project.name}</h3><p className="mt-1 text-[9px] uppercase text-slate-400">{project.category}</p><button type="button" onClick={() => addProject(project)} className="mt-2 rounded-lg bg-[#0B1B3D] px-2.5 py-1 text-[9px] font-bold text-white"><i className="fa-solid fa-plus mr-1"></i>Add</button></div></article>)}{!availableProjects.length && <p className="text-xs text-slate-500">No unselected projects match this search.</p>}</div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="border-b border-slate-100 pb-3 font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Revision history</h2>{featured.history.length ? <ol className="mt-3 divide-y divide-slate-100">{featured.history.map((revision) => <li key={revision.id} className="flex justify-between gap-3 py-3"><div><p className="text-xs font-bold text-slate-700">{revision.summary}</p><p className="mt-1 text-[10px] text-slate-400">{actorLabel(revision.createdBy)}</p></div><div className="text-right"><p className="font-mono text-[10px] font-bold text-[#8A6D08]">revision {revision.revisionNumber || '—'}</p><p className="mt-1 text-[10px] text-slate-400">{timestampLabel(revision.createdAt)}</p></div></li>)}</ol> : <p className="mt-3 text-xs text-slate-500">No saved revisions yet.</p>}</section>
        </div>

        <aside className="xl:col-span-5"><div className="sticky top-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-4"><h2 className="font-serif text-xs font-bold uppercase tracking-wider text-[#0B1B3D]">Unsaved local preview</h2><p className="mt-1 text-[10px] text-slate-400">Uses the same public project cards and canonical project values.</p></div><div className="max-h-[820px] overflow-auto"><ProjectPreview featured={featured} /></div>{dirty && <p className="border-t border-slate-100 p-3 text-[10px] font-semibold text-blue-700">Preview includes unsaved placement changes.</p>}{!featured.isVisible && <p className="border-t border-slate-100 p-3 text-[10px] font-semibold text-amber-700">The section is disabled, so the preview is empty.</p>}</div></aside>
      </div>
    </div>
  );
}
