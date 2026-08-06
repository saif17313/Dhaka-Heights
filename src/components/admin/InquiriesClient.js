'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateInquiry } from '@/lib/contactPageActions';

const STATUSES = ['new', 'contacted', 'qualified', 'closed', 'spam'];
const LABELS = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', closed: 'Closed', spam: 'Spam' };
const TYPE_META = {
  contact: { label: 'Contact Message', icon: 'fa-envelope', badge: 'bg-slate-100 text-slate-700 border-slate-300', accent: '#64748b' },
  project_inquiry: { label: 'Project Inquiry', icon: 'fa-building', badge: 'bg-blue-50 text-blue-700 border-blue-300', accent: '#2563eb' },
  callback_request: { label: 'Callback Request', icon: 'fa-phone', badge: 'bg-purple-50 text-purple-700 border-purple-300', accent: '#7c3aed' },
  layout_request: { label: 'Layout Request', icon: 'fa-file-lines', badge: 'bg-amber-50 text-amber-700 border-amber-300', accent: '#b45309' },
  buyer_lead: { label: 'Buyer Enquiry', icon: 'fa-user-tag', badge: 'bg-emerald-50 text-emerald-700 border-emerald-300', accent: '#059669' },
  landowner_lead: { label: 'Landowner Submission', icon: 'fa-map-location-dot', badge: 'bg-rose-50 text-rose-700 border-rose-300', accent: '#e11d48' },
};
const FALLBACK_TYPE = { label: 'Inquiry', icon: 'fa-inbox', badge: 'bg-slate-100 text-slate-700 border-slate-300', accent: '#64748b' };
const typeMeta = (type) => TYPE_META[type] || FALLBACK_TYPE;

export default function InquiriesClient({ initialInquiries, activeStatus = 'all' }) {
  const router = useRouter();
  const [inquiries, setInquiries] = useState(initialInquiries);
  const [selectedId, setSelectedId] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [notesById, setNotesById] = useState(() => Object.fromEntries(initialInquiries.map((item) => [item.id, item.admin_notes || ''])));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const typeCounts = useMemo(() => inquiries.reduce((counts, item) => ({ ...counts, [item.submission_type]: (counts[item.submission_type] || 0) + 1 }), {}), [inquiries]);
  const visibleTypes = useMemo(() => Object.keys(TYPE_META).filter((type) => typeCounts[type]), [typeCounts]);
  const visibleInquiries = useMemo(() => typeFilter === 'all' ? inquiries : inquiries.filter((item) => item.submission_type === typeFilter), [inquiries, typeFilter]);

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

  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-6"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#B59410]">Sales workflow · private records</p><h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Customer Inquiries Inbox</h1><p className="text-xs text-slate-500">Contact messages, project inquiries, callbacks, layout requests, buyer enquiries, and landowner submissions.</p></div><div className="rounded-xl border bg-slate-50 px-4 py-2 text-xs font-bold">{visibleInquiries.length} of {inquiries.length} records</div></header>
    <div className="space-y-3">
      <nav className="flex flex-wrap gap-2"><Link href="/admin/inquiries" className={`rounded-xl px-3 py-2 text-xs font-bold ${activeStatus === 'all' ? 'bg-[#0B1B3D] text-white' : 'border bg-white'}`}>All</Link>{STATUSES.map((status) => <Link key={status} href={`/admin/inquiries/${status}`} className={`rounded-xl px-3 py-2 text-xs font-bold ${activeStatus === status ? 'bg-[#0B1B3D] text-white' : 'border bg-white'}`}>{LABELS[status]}</Link>)}</nav>
      <nav className="flex flex-wrap items-center gap-2 border-t pt-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Type</span>
        <button type="button" onClick={() => setTypeFilter('all')} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${typeFilter === 'all' ? 'border-[#0B1B3D] bg-[#0B1B3D] text-white' : 'border-slate-300 bg-white text-slate-600'}`}>All types ({inquiries.length})</button>
        {visibleTypes.map((type) => { const meta = typeMeta(type); return (
          <button key={type} type="button" onClick={() => setTypeFilter(type)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${typeFilter === type ? 'text-white' : meta.badge}`} style={typeFilter === type ? { backgroundColor: meta.accent, borderColor: meta.accent } : undefined}>
            <i className={`fa-solid ${meta.icon}`}></i>{meta.label} ({typeCounts[type]})
          </button>
        ); })}
      </nav>
    </div>
    {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
    <section className="space-y-3 rounded-2xl border bg-white p-5">{visibleInquiries.length === 0 ? <p className="py-12 text-center text-xs text-slate-400">No inquiries match this view.</p> : visibleInquiries.map((inquiry) => { const meta = typeMeta(inquiry.submission_type); return <article key={inquiry.id} className="rounded-xl border p-4" style={{ borderLeft: `4px solid ${meta.accent}` }}><div className="flex flex-wrap items-start justify-between gap-3"><div><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${meta.badge}`}><i className={`fa-solid ${meta.icon}`}></i>{meta.label}</span><h2 className="mt-2 font-serif text-base font-bold text-[#0B1B3D]">{inquiry.full_name}</h2><p className="text-xs text-slate-500">{inquiry.email || 'No email'} · {inquiry.phone}</p><p className="mt-1 text-[10px] text-slate-400">{new Date(inquiry.created_at).toLocaleString()}</p></div><div className="flex gap-2"><select value={inquiry.status} disabled={busy === inquiry.id} onChange={(event) => save(inquiry, event.target.value, notesById[inquiry.id] || '')} className="rounded-lg border px-3 py-2 text-xs font-bold">{STATUSES.map((status) => <option key={status} value={status}>{LABELS[status]}</option>)}</select><button type="button" onClick={() => setSelectedId(selectedId === inquiry.id ? null : inquiry.id)} className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white">{selectedId === inquiry.id ? 'Close' : 'View'}</button></div></div>{selectedId === inquiry.id && <div className="mt-4 space-y-3 border-t pt-4"><p className="text-xs font-bold text-slate-700">{inquiry.subject || 'General inquiry'}{inquiry.projects?.name ? ` · ${inquiry.projects.name}` : ''}</p><p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700">{inquiry.message}</p><label><span className="mb-1 block text-[11px] font-bold text-slate-600">Internal notes</span><textarea value={notesById[inquiry.id] || ''} onChange={(event) => setNotesById((current) => ({ ...current, [inquiry.id]: event.target.value }))} rows={4} className="w-full rounded-lg border p-3 text-xs" /></label><button type="button" disabled={busy === inquiry.id} onClick={() => save(inquiry, inquiry.status, notesById[inquiry.id] || '')} className="rounded-lg bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy === inquiry.id ? 'Saving…' : 'Save Notes'}</button></div>}</article>; })}</section>
  </div>;
}
