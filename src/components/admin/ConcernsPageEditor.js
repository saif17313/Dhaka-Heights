'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ConcernDetailClient from '@/components/ConcernDetailClient';
import FontAwesomeIconPicker from './FontAwesomeIconPicker';
import MediaLibrary from './MediaLibrary';
import { publishConcernsPageDraft, saveConcernsPageDraft } from '@/lib/concernsPageActions';

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-800 outline-none transition focus:border-[#C5A880] focus:ring-2 focus:ring-[#C5A880]/20';
const LABEL = 'mb-1.5 block text-[11px] font-bold text-slate-700';
const TABS = ['Shared Content', 'Concerns', 'Preview', 'Advanced'];
const SHARED_FIELDS = [
  ['aboutBreadcrumb', 'About breadcrumb'],
  ['concernsBreadcrumb', 'Concerns breadcrumb'],
  ['profileTag', 'Profile tag'],
  ['overviewHeading', 'Overview heading'],
  ['servicesTag', 'Services tag'],
  ['servicesHeading', 'Services heading'],
  ['portfolioTag', 'Portfolio tag'],
  ['portfolioHeading', 'Portfolio heading'],
  ['notFoundTitle', 'Not-found title'],
  ['notFoundBody', 'Not-found description'],
  ['returnLabel', 'Return button'],
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stripMedia(content) {
  return {
    ...content,
    header: Object.fromEntries(Object.entries(content.header || {}).filter(([key]) => key !== 'media')),
    concerns: (content.concerns || []).map((item) => ({
      ...Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'coverMedia')),
      relatedProjects: (item.relatedProjects || []).map((project) =>
        Object.fromEntries(Object.entries(project).filter(([key]) => !['coverMedia', 'coverMediaId', 'id', 'slug', 'name'].includes(key))),
      ),
    })),
  };
}

function payload(page) {
  return { id: page.id, pageId: page.pageId, sectionKey: 'concerns-page', isVisible: page.isVisible, content: stripMedia(page.content), updatedAt: page.updatedAt };
}
function comparable(page) {
  return JSON.stringify(payload(page));
}
function orders(items) {
  return items.map((item, index) => ({ ...item, sortOrder: (index + 1) * 10 }));
}
function move(items, index, direction) {
  const destination = index + direction;
  if (destination < 0 || destination >= items.length) return items;
  const next = [...items];
  [next[index], next[destination]] = [next[destination], next[index]];
  return orders(next);
}
function mappedAsset(asset) {
  return {
    id: asset.id,
    secureUrl: asset.secure_url || asset.secureUrl || asset.url,
    displayName: asset.display_name || asset.displayName || asset.filename,
    altText: asset.alt_text || asset.altText || '',
    format: asset.format,
    width: asset.width,
    height: asset.height,
  };
}

// Strips the "concerns.<index>." prefix from server field errors so the
// single-concern form can show only the errors that apply to it.
function scopedErrors(errors, index) {
  const prefix = `concerns.${index}.`;
  const scoped = {};
  for (const [key, value] of Object.entries(errors || {})) {
    if (key.startsWith(prefix)) scoped[key.slice(prefix.length)] = value;
  }
  return scoped;
}

function Field({ label, value, onChange, multiline = false, error = '', placeholder = '' }) {
  const Control = multiline ? 'textarea' : 'input';
  return (
    <label>
      <span className={LABEL}>{label}</span>
      <Control
        rows={multiline ? 4 : undefined}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`${INPUT} ${error ? 'border-red-300' : ''}`}
      />
      {error && <span className="mt-1 block text-[10px] font-semibold text-red-600">{error}</span>}
    </label>
  );
}

function SectionCard({ step, title, hint, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0B1B3D] text-[11px] font-bold text-white">{step}</span>
        <div>
          <h3 className="font-serif text-base font-bold text-[#0B1B3D]">{title}</h3>
          {hint && <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{hint}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function DeleteConcernModal({ concern, onCancel, onConfirm }) {
  const [step, setStep] = useState(1);
  const [confirmText, setConfirmText] = useState('');
  const matches = confirmText.trim() === concern.name.trim();
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-concern-title">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-red-100 bg-red-50 px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600"><i className="fa-solid fa-triangle-exclamation" /></span>
          <h2 id="delete-concern-title" className="font-serif text-base font-bold text-red-700">Remove sister concern</h2>
        </div>
        {step === 1 && (
          <div className="space-y-4 px-5 py-5">
            <p className="text-sm text-slate-700">You&rsquo;re about to remove <span className="font-bold">{concern.name}</span> from the catalogue draft.</p>
            <ul className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <li><i className="fa-solid fa-circle-xmark mr-1.5 text-red-500" />It disappears from the Concern navigation menu and its detail page.</li>
              <li><i className="fa-solid fa-circle-xmark mr-1.5 text-red-500" />This only takes effect on the site once you Save Draft and Publish.</li>
              <li><i className="fa-solid fa-circle-info mr-1.5 text-slate-400" />You can always add it back later with a new entry.</li>
            </ul>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-xs font-bold text-slate-600">Cancel</button>
              <button type="button" onClick={() => setStep(2)} className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white">Continue</button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4 px-5 py-5">
            <p className="text-sm text-slate-700">To confirm, type the concern name below:</p>
            <p className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs font-bold text-slate-800">{concern.name}</p>
            <input
              autoFocus
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="Type the concern name"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-xs font-bold text-slate-600">Cancel</button>
              <button type="button" onClick={() => setStep(1)} className="rounded-lg border px-4 py-2 text-xs font-bold text-slate-600">Back</button>
              <button type="button" onClick={onConfirm} disabled={!matches} className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Remove concern</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConcernForm({ concern, availableProjects, projectUsage, errors, onChange, onChooseCover }) {
  const set = (field, value) => onChange({ ...concern, [field]: value });

  const updateFeature = (index, value) => set('features', concern.features.map((item, itemIndex) => (itemIndex === index ? value : item)));
  const removeFeature = (index) => {
    if (concern.features.length <= 1 || !confirm('Remove this capability item?')) return;
    set('features', concern.features.filter((_, itemIndex) => itemIndex !== index));
  };

  const updateService = (index, patch) => set('services', concern.services.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  const removeService = (index) => {
    if (concern.services.length <= 1 || !confirm('Remove this service?')) return;
    set('services', concern.services.filter((_, itemIndex) => itemIndex !== index));
  };

  const linked = new Set(concern.relatedProjects.map((item) => item.projectId));
  const toggleProject = (project) => {
    if (linked.has(project.id)) {
      set('relatedProjects', concern.relatedProjects.filter((item) => item.projectId !== project.id));
    } else {
      set('relatedProjects', [...concern.relatedProjects, { projectId: project.id, badgeText: '', locationText: '', type: '' }]);
    }
  };
  const updatePlacement = (projectId, patch) =>
    set('relatedProjects', concern.relatedProjects.map((item) => (item.projectId === projectId ? { ...item, ...patch } : item)));

  return (
    <div className="space-y-5">
      <SectionCard step={1} title="Subsidiary Profile" hint="The identity shown at the top of this concern's page and in the CONCERN navigation menu.">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Concern name" value={concern.name} onChange={(value) => set('name', value)} error={errors.name} />
          <Field
            label="URL slug"
            value={concern.slug}
            onChange={(value) => set('slug', value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))}
            error={errors.slug}
          />
          <Field label="Subtitle" value={concern.subtitle} onChange={(value) => set('subtitle', value)} error={errors.subtitle} />
        </div>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          <div className="w-full shrink-0 sm:w-48">
            <div className="aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              {concern.coverMedia?.secureUrl ? (
                <img src={concern.coverMedia.secureUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center px-3 text-center text-[10px] text-slate-400">No image selected</div>
              )}
            </div>
            <button type="button" onClick={onChooseCover} className="mt-2 w-full rounded-lg bg-[#0B1B3D] px-3 py-2 text-[11px] font-bold text-white">
              {concern.coverMedia?.secureUrl ? 'Replace image' : 'Choose image'}
            </button>
            {errors.coverMediaId && <p className="mt-1 text-[10px] font-semibold text-red-600">{errors.coverMediaId}</p>}
          </div>
          <div className="flex-1">
            <Field label="Accessible image description" value={concern.coverAlt} onChange={(value) => set('coverAlt', value)} error={errors.coverAlt} />
          </div>
        </div>
      </SectionCard>

      <SectionCard step={2} title="Scope of Operational Capabilities" hint="The overview paragraph and the capability checklist shown beside it.">
        <Field
          label="Overview"
          value={concern.overview}
          onChange={(value) => set('overview', value)}
          error={errors.overview}
          multiline
          placeholder="Describe the concern and its operating scope."
        />
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className={LABEL}>Capability checklist</span>
            <button
              type="button"
              disabled={concern.features.length >= 12}
              onClick={() => set('features', [...concern.features, ''])}
              className="rounded-lg border px-3 py-1.5 text-[11px] font-bold disabled:opacity-40"
            >
              + Add item
            </button>
          </div>
          {errors.features && <p className="mb-2 text-[10px] font-semibold text-red-600">{errors.features}</p>}
          <div className="space-y-2">
            {concern.features.map((feature, index) => (
              <div key={index}>
                <div className="flex gap-2">
                  <input
                    value={feature}
                    onChange={(event) => updateFeature(index, event.target.value)}
                    placeholder="e.g. Structural engineering & foundation design"
                    className={`${INPUT} ${errors[`features.${index}`] ? 'border-red-300' : ''}`}
                  />
                  <button
                    type="button"
                    disabled={concern.features.length <= 1}
                    onClick={() => removeFeature(index)}
                    className="shrink-0 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    Remove
                  </button>
                </div>
                {errors[`features.${index}`] && <p className="mt-1 text-[10px] font-semibold text-red-600">{errors[`features.${index}`]}</p>}
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard step={3} title="Specializations & Services" hint="Each card on the detail page needs an icon, a title, and a short description.">
        <div className="mb-2 flex items-center justify-between">
          <span className={LABEL}>Service cards</span>
          <button
            type="button"
            disabled={concern.services.length >= 12}
            onClick={() => set('services', [...concern.services, { icon: 'fa-building', title: '', description: '' }])}
            className="rounded-lg border px-3 py-1.5 text-[11px] font-bold disabled:opacity-40"
          >
            + Add service
          </button>
        </div>
        {errors.services && <p className="mb-2 text-[10px] font-semibold text-red-600">{errors.services}</p>}
        <div className="space-y-3">
          {concern.services.map((service, index) => (
            <div key={index} className="rounded-xl bg-slate-50 p-3">
              <div className="grid gap-3 md:grid-cols-3">
                <FontAwesomeIconPicker value={service.icon} onChange={(value) => updateService(index, { icon: value })} error={errors[`services.${index}.icon`]} />
                <Field label="Service title" value={service.title} onChange={(value) => updateService(index, { title: value })} error={errors[`services.${index}.title`]} />
                <Field label="Description" value={service.description} onChange={(value) => updateService(index, { description: value })} error={errors[`services.${index}.description`]} multiline />
              </div>
              <button
                type="button"
                disabled={concern.services.length <= 1}
                onClick={() => removeService(index)}
                className="mt-2 text-xs font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Remove service
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard step={4} title="Portfolio — Featured Projects" hint="Pick from existing published projects. A project can only be featured under one concern at a time.">
        {errors.relatedProjects && <p className="mb-3 text-[11px] font-semibold text-red-600">{errors.relatedProjects}</p>}
        {availableProjects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-xs text-slate-500">No published projects are available to feature yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {availableProjects.map((project) => {
              const isLinked = linked.has(project.id);
              const usedBy = projectUsage.get(project.id);
              const disabled = Boolean(usedBy) && !isLinked;
              const placement = concern.relatedProjects.find((item) => item.projectId === project.id);
              return (
                <div key={project.id} className={`overflow-hidden rounded-xl border ${isLinked ? 'border-[#C5A880] bg-amber-50/40' : disabled ? 'border-slate-200 opacity-60' : 'border-slate-200'}`}>
                  <div className="aspect-video bg-slate-100">
                    {project.coverMedia?.secureUrl ? (
                      <img src={project.coverMedia.secureUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-slate-400">No cover image</div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-bold text-[#0B1B3D]">{project.name}</p>
                    {project.category && <p className="text-[10px] uppercase tracking-wide text-slate-400">{project.category}</p>}
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleProject(project)}
                      className={`mt-2 w-full rounded-lg px-3 py-1.5 text-[11px] font-bold disabled:cursor-not-allowed disabled:opacity-70 ${isLinked ? 'bg-[#0B1B3D] text-white' : 'border border-slate-200 text-slate-600'}`}
                    >
                      {disabled ? `Used by ${usedBy}` : isLinked ? 'Remove from portfolio' : '+ Add to portfolio'}
                    </button>
                    {isLinked && (
                      <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Display overrides (optional)</p>
                        <input
                          value={placement?.badgeText || ''}
                          onChange={(event) => updatePlacement(project.id, { badgeText: event.target.value })}
                          placeholder={project.badgeText || 'Badge text'}
                          className={`${INPUT} text-[11px]`}
                        />
                        <input
                          value={placement?.locationText || ''}
                          onChange={(event) => updatePlacement(project.id, { locationText: event.target.value })}
                          placeholder={project.locationText || 'Location text'}
                          className={`${INPUT} text-[11px]`}
                        />
                        <input
                          value={placement?.type || ''}
                          onChange={(event) => updatePlacement(project.id, { type: event.target.value })}
                          placeholder={project.type || 'Type label'}
                          className={`${INPUT} text-[11px]`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <label className="block rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">
        <input type="checkbox" checked={concern.isVisible !== false} onChange={(event) => set('isVisible', event.target.checked)} /> Publish this concern detail page and navigation entry
      </label>
    </div>
  );
}

export default function ConcernsPageEditor({ initialConcernsPage, initialSlug = '' }) {
  const router = useRouter();
  const initial = useMemo(() => clone(initialConcernsPage), [initialConcernsPage]);
  const [page, setPage] = useState(initial);
  const [baseline, setBaseline] = useState(comparable(initial));
  const [tab, setTab] = useState('Concerns');
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const found = initial.content.concerns.findIndex((item) => item.slug === initialSlug);
    return found >= 0 ? found : null;
  });
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('neutral');
  const [picker, setPicker] = useState(null);
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [errors, setErrors] = useState({});
  const [advanced, setAdvanced] = useState(() => JSON.stringify(payload(initial), null, 2));
  const dirty = comparable(page) !== baseline;

  const update = (patch) => {
    setPage((current) => ({ ...current, ...patch }));
    setMessage('');
  };
  const setConcerns = (concerns) => update({ content: { ...page.content, concerns } });
  const updateConcern = (index, concern) => setConcerns(page.content.concerns.map((item, itemIndex) => (itemIndex === index ? concern : item)));
  const updateShared = (field, value) => update({ content: { ...page.content, labels: { ...page.content.labels, [field]: value } } });
  const chooseMedia = (asset) => {
    const item = page.content.concerns[picker.index];
    updateConcern(picker.index, { ...item, coverMediaId: asset.id, coverMedia: mappedAsset(asset), coverAlt: item.coverAlt || asset.alt_text || item.name });
    setPicker(null);
  };

  const addConcern = () => {
    const concern = {
      concernId: crypto.randomUUID(),
      slug: `new-concern-${Date.now()}`,
      name: 'New Sister Concern',
      subtitle: '',
      overview: '',
      features: [''],
      services: [{ icon: 'fa-building', title: '', description: '' }],
      coverMediaId: null,
      coverAlt: '',
      coverMedia: null,
      relatedProjects: [],
      isVisible: false,
      sortOrder: (page.content.concerns.length + 1) * 10,
    };
    setConcerns([...page.content.concerns, concern]);
    setSelectedIndex(page.content.concerns.length);
    setErrors({});
  };

  const confirmRemoveConcern = () => {
    setConcerns(orders(page.content.concerns.filter((_, itemIndex) => itemIndex !== deleteIndex)));
    setDeleteIndex(null);
    setSelectedIndex(null);
    setTone('success');
    setMessage('Concern removed from the draft. Save and Publish to take it live.');
  };

  const save = async () => {
    setBusy('save');
    setMessage('');
    try {
      const result = await saveConcernsPageDraft(payload(page));
      if (!result?.ok) {
        setTone('error');
        setErrors(result?.fieldErrors || {});
        setMessage(result?.fieldErrors ? 'Some fields need attention — see highlighted errors below.' : result?.error || 'Draft save failed.');
        return;
      }
      const saved = { ...clone(result.data), history: page.history, availableProjects: page.availableProjects };
      setPage(saved);
      setBaseline(comparable(saved));
      setErrors({});
      setTone('success');
      setMessage('Concerns draft saved. Public pages remain unchanged.');
    } finally {
      setBusy('');
    }
  };

  const publish = async () => {
    setBusy('publish');
    setMessage('');
    try {
      const result = await publishConcernsPageDraft({ id: page.id, expectedUpdatedAt: page.updatedAt });
      if (!result?.ok) {
        setTone('error');
        setMessage(result?.error || 'Publish failed.');
        return;
      }
      const published = { ...clone(result.data), history: page.history, availableProjects: page.availableProjects };
      setPage(published);
      setBaseline(comparable(published));
      setTone('success');
      setMessage('Concerns catalogue published and public routes revalidated.');
      router.refresh();
    } finally {
      setBusy('');
    }
  };

  const applyAdvanced = () => {
    try {
      const parsed = JSON.parse(advanced);
      setPage((current) => ({ ...current, ...parsed, id: current.id, pageId: current.pageId, updatedAt: current.updatedAt, history: current.history, availableProjects: current.availableProjects }));
      setTone('success');
      setMessage('Structured content applied locally.');
    } catch (error) {
      setTone('error');
      setMessage(`Invalid structured content: ${error.message}`);
    }
  };

  const selected = selectedIndex !== null ? page.content.concerns[selectedIndex] : null;
  const previewIndex = selectedIndex ?? 0;
  const previewConcern = page.content.concerns[previewIndex];

  const projectUsage = useMemo(() => {
    const map = new Map();
    page.content.concerns.forEach((item, index) => {
      if (index === selectedIndex) return;
      (item.relatedProjects || []).forEach((placement) => {
        if (placement.projectId) map.set(placement.projectId, item.name || 'another concern');
      });
    });
    return map;
  }, [page.content.concerns, selectedIndex]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#B59410]">Phase 4 · Full-page workflow</p>
          <h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Sister Concerns Catalogue Editor</h1>
          <p className="text-xs text-slate-500">
            Version {page.versionNumber} · {page.status} · {dirty ? 'Unsaved changes' : 'Up to date'} · {page.content.concerns.length} concerns
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin-preview/concerns-page?slug=${encodeURIComponent(previewConcern.slug)}`} target="_blank" className="rounded-xl border px-4 py-2 text-xs font-bold">Saved Preview</Link>
          <button type="button" onClick={save} disabled={!dirty || busy} className="rounded-xl bg-slate-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">
            {busy === 'save' ? 'Saving…' : 'Save Draft'}
          </button>
          <button type="button" onClick={publish} disabled={dirty || busy || page.status !== 'draft'} className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">
            {busy === 'publish' ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </header>

      {message && (
        <div className={`rounded-xl border p-3 text-xs font-semibold ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {message}
        </div>
      )}

      <nav className="flex flex-wrap gap-2">
        {TABS.map((name) => (
          <button
            type="button"
            key={name}
            onClick={() => { setTab(name); if (name === 'Advanced') setAdvanced(JSON.stringify(payload(page), null, 2)); }}
            className={`rounded-xl px-4 py-2 text-xs font-bold ${tab === name ? 'bg-[#0B1B3D] text-white' : 'border bg-white text-slate-600'}`}
          >
            {name}
          </button>
        ))}
      </nav>

      <section className={tab === 'Concerns' ? '' : 'rounded-2xl border bg-white p-5'}>
        {tab === 'Shared Content' && (
          <div className="space-y-6">
            <div>
              <h2 className="mb-3 font-serif text-lg font-bold">Shared header media</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {page.content.header.media?.secureUrl && <img src={page.content.header.media.secureUrl} alt="" className="h-36 w-full rounded-xl object-cover" />}
                <div>
                  <Field label="Header image alt" value={page.content.header.imageAlt} onChange={(value) => update({ content: { ...page.content, header: { ...page.content.header, imageAlt: value } } })} />
                  {errors.headerMedia && <p className="mt-1 text-[10px] font-semibold text-red-600">{errors.headerMedia}</p>}
                  <p className="mt-2 text-[10px] text-slate-500">The current public header image remains fixed in this phase; concern overview media is selectable below.</p>
                </div>
              </div>
            </div>
            <div>
              <h2 className="mb-3 font-serif text-lg font-bold">Shared detail-page labels</h2>
              <div className="grid gap-3 md:grid-cols-3">
                {SHARED_FIELDS.map(([key, label]) => (
                  <Field key={key} label={label} value={page.content.labels[key]} onChange={(value) => updateShared(key, value)} multiline={key === 'notFoundBody'} />
                ))}
              </div>
            </div>
            <label className="block rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">
              <input type="checkbox" checked={page.isVisible} onChange={(event) => update({ isVisible: event.target.checked })} /> Enable published Concern detail content
            </label>
          </div>
        )}

        {tab === 'Concerns' && (
          <div>
            {selected === null ? (
              <div className="rounded-2xl border bg-white p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-lg font-bold">Canonical sister concerns</h2>
                    <p className="text-xs text-slate-500">Edits remain draft-only until the full catalogue is saved and published.</p>
                  </div>
                  <button type="button" onClick={addConcern} disabled={page.content.concerns.length >= 30} className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">
                    + Add concern
                  </button>
                </div>
                {errors.concerns && <p className="mb-3 text-xs font-semibold text-red-600">{errors.concerns}</p>}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {page.content.concerns.map((concern, index) => (
                    <article key={concern.concernId} className="overflow-hidden rounded-xl border">
                      <div className="aspect-video bg-slate-100">
                        {concern.coverMedia?.secureUrl ? (
                          <img src={concern.coverMedia.secureUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] text-slate-400">No image selected</div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className={`text-[9px] font-bold uppercase ${concern.isVisible === false ? 'text-slate-400' : 'text-[#B59410]'}`}>
                              {concern.isVisible === false ? 'Hidden' : 'Published'}
                            </span>
                            <h3 className="font-serif text-sm font-bold text-[#0B1B3D]">{concern.name}</h3>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button type="button" onClick={() => setConcerns(move(page.content.concerns, index, -1))} disabled={!index} className="h-8 w-8 rounded-lg border disabled:opacity-30" aria-label="Move up">↑</button>
                            <button type="button" onClick={() => setConcerns(move(page.content.concerns, index, 1))} disabled={index === page.content.concerns.length - 1} className="h-8 w-8 rounded-lg border disabled:opacity-30" aria-label="Move down">↓</button>
                          </div>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {concern.features?.length || 0} capabilities · {concern.services?.length || 0} services · {concern.relatedProjects?.length || 0} projects
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={() => { setSelectedIndex(index); setErrors({}); }} className="flex-1 rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white">Edit details</button>
                          <button
                            type="button"
                            onClick={() => setDeleteIndex(index)}
                            disabled={page.content.concerns.length <= 1}
                            title={page.content.concerns.length <= 1 ? 'At least one concern is required.' : ''}
                            className="rounded-lg border border-red-200 px-3 text-xs font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-4 flex items-center justify-between border-b pb-3">
                  <div>
                    <button type="button" onClick={() => setSelectedIndex(null)} className="text-xs font-bold text-[#B59410]">← Back to catalogue</button>
                    <h2 className="mt-1 font-serif text-lg font-bold">Edit {selected.name}</h2>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">{selected.concernId}</span>
                </div>
                <ConcernForm
                  concern={selected}
                  availableProjects={page.availableProjects}
                  projectUsage={projectUsage}
                  errors={scopedErrors(errors, selectedIndex)}
                  onChange={(concern) => updateConcern(selectedIndex, concern)}
                  onChooseCover={() => setPicker({ index: selectedIndex })}
                />
              </div>
            )}
          </div>
        )}

        {tab === 'Preview' && (
          <div>
            <div className="mb-4 flex items-center gap-3">
              <label className="text-xs font-bold">Preview concern</label>
              <select value={previewIndex} onChange={(event) => setSelectedIndex(Number(event.target.value))} className={INPUT}>
                {page.content.concerns.map((concern, index) => <option value={index} key={concern.concernId}>{concern.name}</option>)}
              </select>
            </div>
            <div className="max-h-[760px] overflow-auto rounded-xl border">
              <ConcernDetailClient key={previewConcern.concernId} concern={previewConcern} concernsPage={page} previewMode />
            </div>
          </div>
        )}

        {tab === 'Advanced' && (
          <div>
            <p className="mb-3 text-xs text-slate-500">Complete structured Concerns payload. Database validation and media ID checks still apply.</p>
            <textarea value={advanced} onChange={(event) => setAdvanced(event.target.value)} rows={34} spellCheck={false} className={`${INPUT} font-mono leading-5`} />
            <button type="button" onClick={applyAdvanced} className="mt-3 rounded-lg bg-slate-700 px-4 py-2 text-xs font-bold text-white">Apply structured content</button>
          </div>
        )}
      </section>

      {page.history?.length > 0 && (
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-serif text-lg font-bold">Revision history</h2>
          {page.history.map((item) => (
            <div key={item.id} className="mt-2 flex justify-between rounded-lg bg-slate-50 p-3 text-xs">
              <span>{item.change_summary || 'Saved Concerns revision'}</span>
              <span>v{item.version_number} · {new Date(item.created_at).toLocaleString()}</span>
            </div>
          ))}
        </section>
      )}

      {picker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-7xl">
            <MediaLibrary isModal resourceTypeFilter="image" onSelectAsset={chooseMedia} onCloseModal={() => setPicker(null)} />
          </div>
        </div>
      )}
      {deleteIndex !== null && <DeleteConcernModal concern={page.content.concerns[deleteIndex]} onCancel={() => setDeleteIndex(null)} onConfirm={confirmRemoveConcern} />}
    </div>
  );
}
