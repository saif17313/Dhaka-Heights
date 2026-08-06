'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { changeCustomerReviewStatus, deleteCustomerReview } from '@/lib/customerReviewsActions';

const INPUT = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-[#C5A880] focus:ring-2 focus:ring-[#C5A880]/20';

function statusClass(status) {
  if (status === 'published') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'archived') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

function PreviewType({ review }) {
  if (!review.selectedPreview) return <span className="text-slate-400">Text only</span>;
  return review.selectedPreview.mediaType === 'youtube'
    ? <span><i className="fa-brands fa-youtube text-red-500" /> Video</span>
    : <span><i className="fa-regular fa-image text-[#B59410]" /> Photo</span>;
}

export default function CustomerReviewsAdminList({ result, initialFilters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialFilters.search || '');
  const [status, setStatus] = useState(initialFilters.status || '');
  const [customerType, setCustomerType] = useState(initialFilters.customerType || '');
  const [sort, setSort] = useState(initialFilters.sort || 'serial');
  const [message, setMessage] = useState('');

  const navigate = (nextPage = 1) => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (status) params.set('status', status);
    if (customerType) params.set('customerType', customerType);
    if (sort !== 'serial') params.set('sort', sort);
    if (nextPage > 1) params.set('page', String(nextPage));
    router.push(`/admin/media/customer-reviews${params.toString() ? `?${params}` : ''}`);
  };

  const updateStatus = (review, nextStatus) => {
    setMessage('');
    startTransition(async () => {
      const response = await changeCustomerReviewStatus({ id: review.id, status: nextStatus });
      if (!response?.ok) setMessage(response?.error || 'Status update failed.');
      else {
        setMessage(`${review.customerName} is now ${nextStatus}.`);
        router.refresh();
      }
    });
  };

  const remove = (review) => {
    if (!window.confirm(`Permanently delete ${review.customerName}'s customer review? Related review media records will also be removed.`)) return;
    setMessage('');
    startTransition(async () => {
      const response = await deleteCustomerReview({ id: review.id });
      if (!response?.ok) setMessage(response?.error || 'Delete failed.');
      else {
        setMessage('Customer review deleted. Shared Media Library assets were preserved.');
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#B59410]">Media & Articles</p>
          <h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Customer Reviews</h1>
          <p className="mt-1 text-xs text-slate-500">Manage written reviews, customer profiles, photos, YouTube videos, preview media, publication status, and serial order.</p>
        </div>
        <Link href="/admin/media/customer-reviews/new" className="rounded-xl bg-[#0B1B3D] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#132b5c]">
          <i className="fa-solid fa-plus mr-2" /> Add Customer Review
        </Link>
      </header>

      {message && <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-700">{message}</div>}

      <form onSubmit={(event) => { event.preventDefault(); navigate(1); }} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(220px,1fr)_180px_180px_180px_auto]">
        <input className={INPUT} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, project, location…" />
        <select className={INPUT} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select className={INPUT} value={customerType} onChange={(event) => setCustomerType(event.target.value)}>
          <option value="">All customer types</option>
          <option>Apartment Buyer</option>
          <option>Landowner</option>
          <option>Investor</option>
          <option>Other</option>
        </select>
        <select className={INPUT} value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="serial">Serial order</option>
          <option value="review-date">Review date</option>
          <option value="created-date">Created date</option>
        </select>
        <div className="flex gap-2">
          <button type="submit" className="rounded-xl bg-[#C5A880] px-4 py-2 text-xs font-bold text-[#0B1B3D]">Apply</button>
          <button type="button" onClick={() => { setSearch(''); setStatus(''); setCustomerType(''); setSort('serial'); router.push('/admin/media/customer-reviews'); }} className="rounded-xl border px-3 py-2 text-xs font-bold text-slate-600">Reset</button>
        </div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-serif text-lg font-bold text-[#0B1B3D]">Review Catalogue</h2>
          <span className="text-xs font-medium text-slate-400">{result.total} record{result.total === 1 ? '' : 's'}</span>
        </div>

        {result.reviews.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <i className="fa-regular fa-comments mb-3 text-3xl text-slate-300" />
            <h3 className="font-serif text-lg font-bold text-[#0B1B3D]">No customer reviews found</h3>
            <p className="mt-1 text-xs text-slate-500">Create a review or adjust the search filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-4 py-3">Type / Project</th>
                  <th className="px-4 py-3">Preview</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Serial</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.reviews.map((review) => (
                  <tr key={review.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {review.profileImage?.secureUrl ? <img src={review.profileImage.secureUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0B1B3D] font-bold text-white">{review.customerName.slice(0, 1)}</span>}
                        <span><strong className="block text-sm text-[#0B1B3D]">{review.customerName}</strong><small className="text-slate-500">{review.customerDesignation || review.customerLocation || 'Customer'}</small></span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-600"><strong className="block text-slate-700">{review.customerType || '—'}</strong>{review.relatedProject || '—'}</td>
                    <td className="px-4 py-4 font-semibold text-slate-600"><PreviewType review={review} /></td>
                    <td className="px-4 py-4 text-[#B59410]">{review.rating ? `${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}` : '—'}</td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${statusClass(review.status)}`}>{review.status}</span></td>
                    <td className="px-4 py-4 font-mono text-slate-600">{review.sortOrder}</td>
                    <td className="px-4 py-4 text-slate-500">{new Date(review.updatedAt).toLocaleDateString()}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1.5">
                        {review.status === 'published' && <Link href={`/media-center/customer-reviews/${review.slug}`} target="_blank" className="rounded-lg border px-2.5 py-1.5 font-bold text-slate-600" title="Public page"><i className="fa-solid fa-arrow-up-right-from-square" /></Link>}
                        <Link href={`/admin/media/customer-reviews/${review.id}?preview=1`} className="rounded-lg border px-2.5 py-1.5 font-bold text-slate-600">Preview</Link>
                        <Link href={`/admin/media/customer-reviews/${review.id}`} className="rounded-lg bg-[#0B1B3D] px-3 py-1.5 font-bold text-white">Edit</Link>
                        {review.status !== 'published' ? <button disabled={pending} type="button" onClick={() => updateStatus(review, 'published')} className="rounded-lg border border-emerald-200 px-2.5 py-1.5 font-bold text-emerald-700">Publish</button> : <button disabled={pending} type="button" onClick={() => updateStatus(review, 'draft')} className="rounded-lg border px-2.5 py-1.5 font-bold text-slate-600">Unpublish</button>}
                        {review.status !== 'archived' && <button disabled={pending} type="button" onClick={() => updateStatus(review, 'archived')} className="rounded-lg border px-2.5 py-1.5 font-bold text-slate-600" title="Archive"><i className="fa-solid fa-box-archive" /></button>}
                        <button disabled={pending} type="button" onClick={() => remove(review)} className="rounded-lg border border-red-200 px-2.5 py-1.5 font-bold text-red-600" title="Delete"><i className="fa-solid fa-trash" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {result.totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Customer Reviews pagination">
          <button type="button" disabled={result.page === 1} onClick={() => navigate(result.page - 1)} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold disabled:opacity-40">Previous</button>
          {Array.from({ length: result.totalPages }, (_, index) => index + 1).map((pageNumber) => (
            <button type="button" key={pageNumber} onClick={() => navigate(pageNumber)} className={`h-9 w-9 rounded-lg text-xs font-bold ${pageNumber === result.page ? 'bg-[#0B1B3D] text-white' : 'border bg-white text-slate-600'}`}>{pageNumber}</button>
          ))}
          <button type="button" disabled={result.page === result.totalPages} onClick={() => navigate(result.page + 1)} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold disabled:opacity-40">Next</button>
        </nav>
      )}
    </div>
  );
}
