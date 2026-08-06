'use client';

import { useState } from 'react';
import Link from 'next/link';
import { updateCareerApplication } from '@/lib/careerPageActions';

const STATUSES = ['new', 'reviewing', 'shortlisted', 'interviewed', 'rejected', 'hired'];
export default function CareerApplicationsClient({ initialApplications }) {
  const [applications, setApplications] = useState(initialApplications);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const download = async (path) => {
    setMessage(''); const response = await fetch(`/api/admin/career/resume-link?path=${encodeURIComponent(path)}`); const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.signedUrl) { setMessage(result.error || 'Could not generate a secure resume link.'); return; }
    window.open(result.signedUrl, '_blank', 'noopener,noreferrer');
  };
  const save = async (application) => {
    setBusy(application.id); setMessage('');
    try {
      const result = await updateCareerApplication({ id: application.id, status: application.status, adminNotes: application.admin_notes || '' });
      if (!result.ok) { setMessage(result.error || 'Application update failed.'); return; }
      setApplications((current) => current.map((item) => item.id === application.id ? { ...item, ...result.data } : item)); setMessage('Application workflow updated.');
    } finally { setBusy(''); }
  };
  const update = (id, patch) => setApplications((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  return <div className="space-y-6"><header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-6"><div><p className="text-[10px] font-bold uppercase tracking-wider text-[#B59410]">Private resume workflow</p><h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Applicant CV Submissions</h1><p className="text-xs text-slate-500">Review applicants, securely download resumes, and update hiring status.</p></div><Link href="/admin/careers" className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white">Manage Vacancies</Link></header>{message && <p className="rounded-xl border bg-white p-3 text-xs font-semibold">{message}</p>}<section className="space-y-3 rounded-2xl border bg-white p-6"><h2 className="border-b pb-3 text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">Applicant Submissions ({applications.length})</h2>{applications.length === 0 ? <div className="py-12 text-center text-xs text-slate-400">No job applications received yet.</div> : applications.map((application) => <article key={application.id} className="space-y-3 rounded-2xl border p-5"><div className="flex flex-wrap justify-between gap-3 border-b pb-3"><div><h3 className="font-bold text-[#0B1B3D]">{application.full_name}</h3><p className="text-xs text-slate-500">{application.email} · {application.phone}</p><p className="text-[11px] text-slate-400">{application.job_openings?.title || 'General Application'} · {new Date(application.created_at).toLocaleString()}</p></div><button type="button" onClick={() => download(application.resume_storage_path)} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-[#B59410]">Download CV</button></div>{application.cover_letter && <p className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed">{application.cover_letter}</p>}<div className="grid gap-3 md:grid-cols-[180px_1fr_auto]"><select value={application.status} onChange={(event) => update(application.id, { status: event.target.value })} className="rounded-xl border px-3 py-2 text-xs">{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select><textarea rows={2} value={application.admin_notes || ''} onChange={(event) => update(application.id, { admin_notes: event.target.value })} placeholder="Private HR notes" className="rounded-xl border px-3 py-2 text-xs" /><button type="button" disabled={busy === application.id} onClick={() => save(application)} className="rounded-xl bg-slate-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy === application.id ? 'Saving…' : 'Save'}</button></div><p className="text-[10px] text-slate-400">File: {application.resume_original_filename}</p></article>)}</section></div>;
}
