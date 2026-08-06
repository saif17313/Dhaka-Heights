'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateInquiry } from '@/lib/contactPageActions';
import { STATUSES, STATUS_LABELS, typeMeta } from '@/lib/inquiryTypes';
import { downloadInquiriesExcel, downloadInquiriesPdf } from '@/lib/adminExport';

export default function InquiriesClient({ initialInquiries, activeStatus = 'all' }) {
  const router = useRouter();
  const [inquiries, setInquiries] = useState(initialInquiries);
  const [selectedId, setSelectedId] = useState(null);
  const [notesById, setNotesById] = useState(() => Object.fromEntries(initialInquiries.map((item) => [item.id, item.admin_notes || ''])));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');

  const save = async (inquiry, status, adminNotes) => {
    setBusy(inquiry.id); setError('');
    try {
      const result = await updateInquiry({ id: inquiry.id, status, adminNotes });
      if (!result?.ok) { setError(result?.error || 'Inquiry update failed.'); return; }
      setInquiries((items) => {
        const updated = items.map((item) => item.id === inquiry.id ? { ...item, ...result.data } : item);
        return activeStatus !== 'all' && status !== activeStatus ? updated.filter((item) => item.id !== inquiry.id) : updated;
      });
      router.refresh();
    } finally { setBusy(''); }
  };

  const statusLabel = activeStatus === 'all' ? 'All' : STATUS_LABELS[activeStatus] || activeStatus;

  const runExport = async (format) => {
    if (exporting || inquiries.length === 0) return;
    setExporting(format); setError('');
    try {
      if (format === 'excel') await downloadInquiriesExcel(inquiries, { statusLabel, typeLabel: 'All Types' });
      else await downloadInquiriesPdf(inquiries, { statusLabel, typeLabel: 'All Types' });
    } catch {
      setError('Export failed. Please try again.');
    } finally {
      setExporting('');
    }
  };

  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-6"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#B59410]">Sales workflow · private records</p><h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Customer Inquiries Inbox</h1><p className="text-xs text-slate-500">Contact messages, project inquiries, callbacks, layout requests, buyer enquiries, and landowner submissions.</p></div><div className="flex flex-wrap items-center gap-2"><div className="rounded-xl border bg-slate-50 px-4 py-2 text-xs font-bold">{inquiries.length} records</div><button type="button" disabled={!!exporting || inquiries.length === 0} onClick={() => runExport('excel')} className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 disabled:opacity-40"><i className="fa-solid fa-file-excel"></i>{exporting === 'excel' ? 'Preparing…' : 'Download Excel'}</button><button type="button" disabled={!!exporting || inquiries.length === 0} onClick={() => runExport('pdf')} className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 disabled:opacity-40"><i className="fa-solid fa-file-pdf"></i>{exporting === 'pdf' ? 'Preparing…' : 'Download PDF'}</button></div></header>
    <nav className="flex flex-wrap gap-2"><Link href="/admin/inquiries" className={`rounded-xl px-3 py-2 text-xs font-bold ${activeStatus === 'all' ? 'bg-[#0B1B3D] text-white' : 'border bg-white'}`}>All</Link>{STATUSES.map((status) => <Link key={status} href={`/admin/inquiries/${status}`} className={`rounded-xl px-3 py-2 text-xs font-bold ${activeStatus === status ? 'bg-[#0B1B3D] text-white' : 'border bg-white'}`}>{STATUS_LABELS[status]}</Link>)}</nav>
    {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
    <section className="space-y-3 rounded-2xl border bg-white p-5">{inquiries.length === 0 ? <p className="py-12 text-center text-xs text-slate-400">No inquiries match this view.</p> : inquiries.map((inquiry) => <article key={inquiry.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-[9px] font-bold uppercase tracking-wider text-[#B59410]">{typeMeta(inquiry.submission_type).label}</span><h2 className="font-serif text-base font-bold text-[#0B1B3D]">{inquiry.full_name}</h2><p className="text-xs text-slate-500">{inquiry.email || 'No email'} · {inquiry.phone}</p><p className="mt-1 text-[10px] text-slate-400">{new Date(inquiry.created_at).toLocaleString()}</p></div><div className="flex gap-2"><select value={inquiry.status} disabled={busy === inquiry.id} onChange={(event) => save(inquiry, event.target.value, notesById[inquiry.id] || '')} className="rounded-lg border px-3 py-2 text-xs font-bold">{STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select><button type="button" onClick={() => setSelectedId(selectedId === inquiry.id ? null : inquiry.id)} className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white">{selectedId === inquiry.id ? 'Close' : 'View'}</button></div></div>{selectedId === inquiry.id && <div className="mt-4 space-y-3 border-t pt-4"><p className="text-xs font-bold text-slate-700">{inquiry.subject || 'General inquiry'}{inquiry.projects?.name ? ` · ${inquiry.projects.name}` : ''}</p><p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700">{inquiry.message}</p><label><span className="mb-1 block text-[11px] font-bold text-slate-600">Internal notes</span><textarea value={notesById[inquiry.id] || ''} onChange={(event) => setNotesById((current) => ({ ...current, [inquiry.id]: event.target.value }))} rows={4} className="w-full rounded-lg border p-3 text-xs" /></label><button type="button" disabled={busy === inquiry.id} onClick={() => save(inquiry, inquiry.status, notesById[inquiry.id] || '')} className="rounded-lg bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy === inquiry.id ? 'Saving…' : 'Save Notes'}</button></div>}</article>)}</section>
  </div>;
}
