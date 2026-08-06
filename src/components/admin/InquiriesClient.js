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
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-6"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#B59410]">Sales [...]</div></header>
    <nav className="flex flex-wrap gap-2"><Link href="/admin/inquiries" className={`rounded-xl px-3 py-2 text-xs font-bold ${activeStatus === 'all' ? 'bg-[#0B1B3D] text-white' : 'border bg-white'}[...]`}</nav>
    {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
    <section className="space-y-3 rounded-2xl border bg-white p-5">{inquiries.length === 0 ? <p className="py-12 text-center text-xs text-slate-400">No inquiries match this view.</p> : inquiries.m[...]}</section>
  </div>;
}
