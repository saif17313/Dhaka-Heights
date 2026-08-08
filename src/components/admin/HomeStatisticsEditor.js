'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Metrics from '@/components/Metrics';
import FontAwesomeIconPicker from './FontAwesomeIconPicker';
import { publishHomeStatisticsDraft, saveHomeStatisticsDraft } from '@/lib/homeStatisticsActions';

const INPUT_CLASS = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none transition focus:border-[#C5A880] focus:ring-2 focus:ring-[#C5A880]/20';
const LABEL_CLASS = 'mb-1 block text-[11px] font-bold text-slate-700';
const ICON_PATTERN = /^fa-[a-z0-9-]{1,60}$/;

function normalizeMetric(metric, index) {
  return {
    itemId: metric?.itemId || null,
    itemKey: metric?.itemKey || `metric-${index + 1}`,
    value: Number(metric?.value ?? 0),
    suffix: metric?.suffix || '',
    label: metric?.label || '',
    supportingText: metric?.supportingText || '',
    iconKey: metric?.iconKey || 'fa-building',
    sortOrder: (index + 1) * 10,
    isVisible: metric?.isVisible !== false,
  };
}

function normalizeStatistics(source) {
  if (!source) return null;
  const statistics = source.data || source.statistics || source;
  return {
    id: statistics.id || null,
    pageId: statistics.pageId || null,
    sectionKey: statistics.sectionKey || 'statistics-counter',
    status: statistics.status || 'draft',
    versionNumber: Number(statistics.versionNumber) || 1,
    isVisible: statistics.isVisible !== false,
    metrics: (statistics.metrics || []).map(normalizeMetric),
    updatedAt: statistics.updatedAt || null,
    updatedBy: statistics.updatedBy || null,
    publishedAt: statistics.publishedAt || null,
    publishedBy: statistics.publishedBy || null,
    history: (statistics.history || []).map((revision) => ({
      id: revision.id,
      revisionNumber: Number(revision.revisionNumber) || 0,
      summary: revision.summary || 'Saved Home Statistics revision',
      createdAt: revision.createdAt || null,
      createdBy: revision.createdBy || null,
    })),
  };
}

function toPayload(statistics) {
  return {
    id: statistics.id,
    pageId: statistics.pageId,
    sectionKey: 'statistics-counter',
    isVisible: statistics.isVisible,
    updatedAt: statistics.updatedAt,
    metrics: statistics.metrics.map((metric) => ({
      itemKey: metric.itemKey,
      value: Number(metric.value),
      suffix: metric.suffix.trim(),
      label: metric.label.trim(),
      supportingText: metric.supportingText.trim(),
      iconKey: metric.iconKey.trim(),
      isVisible: metric.isVisible,
    })),
  };
}

function comparable(statistics) {
  return statistics ? JSON.stringify(toPayload(statistics)) : '';
}

function newItemKey() {
  return `metric-${globalThis.crypto.randomUUID()}`;
}

function validateStatistics(statistics) {
  const errors = {};
  if (statistics.metrics.length < 1 || statistics.metrics.length > 8) {
    errors.metrics = 'Add between 1 and 8 metrics.';
  }
  if (!statistics.metrics.some((metric) => metric.isVisible)) {
    errors.metrics = 'At least one metric must be visible.';
  }
  statistics.metrics.forEach((metric, index) => {
    const prefix = `metrics.${index}`;
    const value = Number(metric.value);
    if (!Number.isFinite(value) || value < 0 || value > 1000000000 || Math.abs(value * 100 - Math.round(value * 100)) > Number.EPSILON * 100) {
      errors[`${prefix}.value`] = 'Use a non-negative value with at most two decimal places.';
    }
    if (metric.suffix.trim().length > 10) errors[`${prefix}.suffix`] = 'Use 10 characters or fewer.';
    if (!metric.label.trim() || metric.label.trim().length > 80) errors[`${prefix}.label`] = 'Label is required and must be 80 characters or fewer.';
    if (!metric.supportingText.trim() || metric.supportingText.trim().length > 160) errors[`${prefix}.supportingText`] = 'Supporting text is required and must be 160 characters or fewer.';
    if (!ICON_PATTERN.test(metric.iconKey.trim())) errors[`${prefix}.iconKey`] = 'Use a Font Awesome key such as fa-building.';
  });
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

export default function HomeStatisticsEditor({ initialStatistics, initialError = '' }) {
  const router = useRouter();
  const normalizedInitial = useMemo(() => normalizeStatistics(initialStatistics), [initialStatistics]);
  const [statistics, setStatistics] = useState(normalizedInitial);
  const [baseline, setBaseline] = useState(() => comparable(normalizedInitial));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(initialError);
  const [tone, setTone] = useState(initialError ? 'error' : 'neutral');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const dirty = statistics ? comparable(statistics) !== baseline : false;

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (patch) => {
    setStatistics((current) => ({ ...current, ...patch }));
    setMessage('');
    setConflict(false);
  };

  const updateMetric = (index, patch) => {
    setStatistics((current) => ({
      ...current,
      metrics: current.metrics.map((metric, metricIndex) => metricIndex === index ? { ...metric, ...patch } : metric),
    }));
    setMessage('');
    setConflict(false);
  };

  const moveMetric = (index, direction) => {
    const destination = index + direction;
    if (destination < 0 || destination >= statistics.metrics.length) return;
    const metrics = [...statistics.metrics];
    [metrics[index], metrics[destination]] = [metrics[destination], metrics[index]];
    update({ metrics: metrics.map((metric, metricIndex) => ({ ...metric, sortOrder: (metricIndex + 1) * 10 })) });
  };

  const addMetric = () => {
    if (statistics.metrics.length >= 8) return;
    update({
      metrics: [...statistics.metrics, normalizeMetric({
        itemKey: newItemKey(), value: 0, suffix: '+', label: 'New Metric',
        supportingText: 'Add supporting text', iconKey: 'fa-building', isVisible: true,
      }, statistics.metrics.length)],
    });
  };

  const duplicateMetric = (index) => {
    if (statistics.metrics.length >= 8) return;
    const copy = { ...statistics.metrics[index], itemId: null, itemKey: newItemKey(), label: `${statistics.metrics[index].label} Copy` };
    const metrics = [...statistics.metrics];
    metrics.splice(index + 1, 0, copy);
    update({ metrics: metrics.map((metric, metricIndex) => ({ ...metric, sortOrder: (metricIndex + 1) * 10 })) });
  };

  const removeMetric = (index) => {
    if (statistics.metrics.length <= 1) return;
    if (!window.confirm(`Remove “${statistics.metrics[index].label}” from this Statistics draft?`)) return;
    update({ metrics: statistics.metrics.filter((_, metricIndex) => metricIndex !== index) });
  };

  const applyFailure = (result, fallback) => {
    setErrors(result.fieldErrors || {});
    setConflict(result.status === 409 || String(result.code || '').includes('CONFLICT'));
    setTone('error');
    setMessage(result.error || fallback);
  };

  const handleSave = async () => {
    const clientErrors = validateStatistics(statistics);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) {
      setTone('error');
      setMessage('Fix the highlighted fields before saving.');
      return;
    }
    setSaving(true);
    try {
      const result = await saveHomeStatisticsDraft(toPayload(statistics));
      if (!result?.ok) return applyFailure(result || {}, 'The Statistics draft could not be saved.');
      const saved = normalizeStatistics(result.data);
      setStatistics(saved);
      setBaseline(comparable(saved));
      setErrors({});
      setTone('success');
      setMessage('Draft saved. The published Home page has not changed.');
    } catch (error) {
      setTone('error');
      setMessage(error instanceof Error ? error.message : 'The Statistics draft could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const result = await publishHomeStatisticsDraft({ id: statistics.id, expectedUpdatedAt: statistics.updatedAt });
      if (!result?.ok) return applyFailure(result || {}, 'The Statistics draft could not be published.');
      const published = normalizeStatistics(result.data);
      setStatistics(published);
      setBaseline(comparable(published));
      setErrors({});
      setTone('success');
      setMessage('Statistics Counter published and the public Home cache was refreshed.');
      router.refresh();
    } catch (error) {
      setTone('error');
      setMessage(error instanceof Error ? error.message : 'The Statistics draft could not be published.');
    } finally {
      setPublishing(false);
    }
  };

  if (!statistics) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Statistics Counter editor unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">{initialError || 'No saved Statistics version was returned.'}</p>
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
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statistics.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{statistics.status}</span>
              <span className="font-mono text-[10px] text-slate-400">key: statistics-counter · version {statistics.versionNumber}</span>
              {dirty && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">Unsaved changes</span>}
            </div>
            <h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Home Statistics Counter</h1>
            <p className="mt-1 text-xs font-medium text-slate-500">Manage numeric values, suffixes, labels, supporting copy, icons, order, and visibility.</p>
            <p className="mt-2 text-[10px] text-slate-400">Last saved: {timestampLabel(statistics.updatedAt)} by {actorLabel(statistics.updatedBy)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin-preview/home/statistics-counter" target="_blank" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">Saved version preview</Link>
            <button type="button" onClick={handleSave} disabled={!dirty || saving || publishing} className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save Draft'}</button>
            <button type="button" onClick={handlePublish} disabled={dirty || statistics.status !== 'draft' || saving || publishing} className="rounded-xl bg-[#B59410] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{publishing ? 'Publishing…' : 'Publish'}</button>
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
            <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span><span className="block text-xs font-bold text-slate-700">Section visible</span><span className="text-[10px] text-slate-400">Hide the complete Statistics block when disabled.</span></span>
              <input type="checkbox" checked={statistics.isVisible} onChange={(event) => update({ isVisible: event.target.checked })} className="h-4 w-4 accent-[#B59410]" />
            </label>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div><h2 className="font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Metric items</h2><p className="mt-1 text-[10px] text-slate-400">Order is normalized to 10, 20, 30… when saved.</p></div>
              <button type="button" onClick={addMetric} disabled={statistics.metrics.length >= 8} className="rounded-xl bg-[#0B1B3D] px-3 py-2 text-[10px] font-bold text-white disabled:opacity-40"><i className="fa-solid fa-plus mr-1.5"></i>Add metric</button>
            </div>
            <FieldError>{errors.metrics}</FieldError>
            <div className="mt-4 space-y-4">
              {statistics.metrics.map((metric, index) => {
                const prefix = `metrics.${index}`;
                return (
                  <article key={metric.itemKey} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0B1B3D] text-[#C5A880]"><i className={`fa-solid ${ICON_PATTERN.test(metric.iconKey) ? metric.iconKey : 'fa-circle-question'}`}></i></span>
                        <div><h3 className="text-xs font-bold text-[#0B1B3D]">Metric {index + 1}</h3><p className="font-mono text-[9px] text-slate-400">{metric.itemKey}</p></div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => moveMetric(index, -1)} disabled={index === 0} aria-label={`Move ${metric.label} up`} className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30"><i className="fa-solid fa-arrow-up"></i></button>
                        <button type="button" onClick={() => moveMetric(index, 1)} disabled={index === statistics.metrics.length - 1} aria-label={`Move ${metric.label} down`} className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30"><i className="fa-solid fa-arrow-down"></i></button>
                        <button type="button" onClick={() => duplicateMetric(index)} disabled={statistics.metrics.length >= 8} aria-label={`Duplicate ${metric.label}`} className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30"><i className="fa-solid fa-copy"></i></button>
                        <button type="button" onClick={() => removeMetric(index)} disabled={statistics.metrics.length <= 1} aria-label={`Remove ${metric.label}`} className="h-8 w-8 rounded-lg border border-red-200 bg-white text-red-600 disabled:opacity-30"><i className="fa-solid fa-trash"></i></button>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-12">
                      <div className="sm:col-span-4"><label className={LABEL_CLASS}>Numeric value</label><input type="number" min="0" max="1000000000" step="0.01" value={metric.value} onChange={(event) => updateMetric(index, { value: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors[`${prefix}.value`]}</FieldError></div>
                      <div className="sm:col-span-2"><label className={LABEL_CLASS}>Suffix</label><input value={metric.suffix} maxLength={10} onChange={(event) => updateMetric(index, { suffix: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors[`${prefix}.suffix`]}</FieldError></div>
                      <div className="sm:col-span-6"><FontAwesomeIconPicker value={metric.iconKey} onChange={(value) => updateMetric(index, { iconKey: value })} error={errors[`${prefix}.iconKey`]} /></div>
                      <div className="sm:col-span-6"><label className={LABEL_CLASS}>Label</label><input value={metric.label} maxLength={80} onChange={(event) => updateMetric(index, { label: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors[`${prefix}.label`]}</FieldError></div>
                      <div className="sm:col-span-6"><label className={LABEL_CLASS}>Supporting text</label><input value={metric.supportingText} maxLength={160} onChange={(event) => updateMetric(index, { supportingText: event.target.value })} className={INPUT_CLASS} /><FieldError>{errors[`${prefix}.supportingText`]}</FieldError></div>
                    </div>
                    <label className="mt-4 flex items-center gap-2 text-[11px] font-bold text-slate-600"><input type="checkbox" checked={metric.isVisible} onChange={(event) => updateMetric(index, { isVisible: event.target.checked })} className="h-4 w-4 accent-[#B59410]" />Show this metric</label>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="border-b border-slate-100 pb-3 font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Revision history</h2>
            {statistics.history.length ? <ol className="mt-3 divide-y divide-slate-100">{statistics.history.map((revision) => <li key={revision.id} className="flex justify-between gap-3 py-3"><div><p className="text-xs font-bold text-slate-700">{revision.summary}</p><p className="mt-1 text-[10px] text-slate-400">{actorLabel(revision.createdBy)}</p></div><div className="text-right"><p className="font-mono text-[10px] font-bold text-[#8A6D08]">revision {revision.revisionNumber || '—'}</p><p className="mt-1 text-[10px] text-slate-400">{timestampLabel(revision.createdAt)}</p></div></li>)}</ol> : <p className="mt-3 text-xs text-slate-500">No saved revisions yet.</p>}
          </section>
        </div>

        <aside className="xl:col-span-5">
          <div className="sticky top-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4"><h2 className="font-serif text-xs font-bold uppercase tracking-wider text-[#0B1B3D]">Unsaved local preview</h2><p className="mt-1 text-[10px] text-slate-400">Uses the same public Statistics component and does not expose draft data.</p></div>
            <div className="overflow-auto"><Metrics statistics={statistics} previewMode /></div>
            {dirty && <p className="border-t border-slate-100 p-3 text-[10px] font-semibold text-blue-700">Preview includes unsaved form values.</p>}
            {!statistics.isVisible && <p className="border-t border-slate-100 p-3 text-[10px] font-semibold text-amber-700">The section is disabled, so the preview is empty.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
