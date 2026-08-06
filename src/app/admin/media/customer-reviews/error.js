'use client';

export default function CustomerReviewsError({ error, reset }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
      <i className="fa-solid fa-triangle-exclamation text-3xl text-red-500" />
      <h1 className="mt-3 font-serif text-2xl font-bold text-[#0B1B3D]">Customer Reviews could not be loaded</h1>
      <p className="mt-2 text-xs text-slate-500">{error?.message || 'Check the Customer Reviews database migration and try again.'}</p>
      <button type="button" onClick={reset} className="mt-5 rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white">Try Again</button>
    </div>
  );
}
