'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CustomerReviewCard from '@/components/CustomerReviewCard';
import CustomerReviewDetail from '@/components/CustomerReviewDetail';
import YouTubeThumbnail from '@/components/YouTubeThumbnail';
import MediaLibrary from '@/components/admin/MediaLibrary';
import { deleteCustomerReview, saveCustomerReview } from '@/lib/customerReviewsActions';
import { extractYouTubeVideoId, getYouTubeThumbnailUrls, normalizeYouTubeUrl } from '@/lib/youtube';

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-800 outline-none transition focus:border-[#C5A880] focus:ring-2 focus:ring-[#C5A880]/20';
const LABEL = 'mb-1.5 block text-[11px] font-bold text-slate-700';
const TABS = ['Customer & Review', 'Review Media', 'Preview'];

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function order(items) { return items.map((item, index) => ({ ...item, sortOrder: (index + 1) * 10 })); }
function move(items, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return order(next);
}
function mapAsset(asset) {
  return {
    id: asset.id,
    secureUrl: asset.secure_url || asset.secureUrl || asset.url,
    publicId: asset.public_id || asset.publicId,
    displayName: asset.display_name || asset.displayName || asset.filename,
    altText: asset.alt_text || asset.altText || '',
    caption: asset.caption || '',
    width: asset.width,
    height: asset.height,
    format: asset.format,
  };
}
function Field({ label, value, onChange, multiline = false, type = 'text', error = '', placeholder = '' }) {
  const Component = multiline ? 'textarea' : 'input';
  return (
    <label>
      <span className={LABEL}>{label}</span>
      <Component type={type} rows={multiline ? 7 : undefined} value={value ?? ''} onChange={(event) => onChange(event.target.value)} className={`${INPUT} ${error ? 'border-red-300' : ''}`} placeholder={placeholder} />
      {error && <span className="mt-1 block text-[10px] font-semibold text-red-600">{error}</span>}
    </label>
  );
}
function reviewComparable(review) {
  return JSON.stringify({
    id: review.id,
    slug: review.slug,
    customerName: review.customerName,
    customerDesignation: review.customerDesignation,
    customerLocation: review.customerLocation,
    customerType: review.customerType,
    reviewCategory: review.reviewCategory,
    relatedProject: review.relatedProject,
    profileImageId: review.profileImageId,
    profileImageAlt: review.profileImageAlt,
    reviewText: review.reviewText,
    rating: review.rating,
    reviewDate: review.reviewDate,
    selectedPreviewMediaId: review.selectedPreviewMediaId,
    status: review.status,
    isFeatured: review.isFeatured,
    sortOrder: review.sortOrder,
    media: review.media,
  });
}

export default function CustomerReviewEditor({ initialReview, mediaPage, isNew = false, initialTab = 'Customer & Review' }) {
  const router = useRouter();
  const initial = useMemo(() => clone(initialReview), [initialReview]);
  const [review, setReview] = useState(initial);
  const [baseline, setBaseline] = useState(reviewComparable(initial));
  const [tab, setTab] = useState(TABS.includes(initialTab) ? initialTab : 'Customer & Review');
  const [picker, setPicker] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('neutral');
  const [errors, setErrors] = useState({});
  const [previewMode, setPreviewMode] = useState('card');
  const dirty = reviewComparable(review) !== baseline;

  const update = (patch) => {
    setReview((current) => ({ ...current, ...patch }));
    setMessage('');
    setErrors({});
  };
  const updateMedia = (index, patch) => update({ media: review.media.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });

  const chooseAsset = (asset) => {
    const mapped = mapAsset(asset);
    if (picker?.kind === 'profile') {
      update({
        profileImageId: asset.id,
        profileImage: mapped,
        profileImageAlt: review.profileImageAlt || asset.alt_text || review.customerName,
      });
    }
    if (picker?.kind === 'photo-add') {
      const item = {
        id: crypto.randomUUID(),
        reviewId: review.id,
        mediaType: 'image',
        imageAssetId: asset.id,
        imageAsset: mapped,
        caption: asset.caption || '',
        altText: asset.alt_text || `${review.customerName || 'Customer'} review photo`,
        sortOrder: (review.media.length + 1) * 10,
      };
      update({ media: [...review.media, item] });
    }
    if (picker?.kind === 'photo-replace') {
      updateMedia(picker.index, {
        imageAssetId: asset.id,
        imageAsset: mapped,
        altText: review.media[picker.index]?.altText || asset.alt_text || `${review.customerName || 'Customer'} review photo`,
      });
    }
    setPicker(null);
  };

  const addYouTube = () => {
    const videoId = extractYouTubeVideoId(youtubeUrl);
    if (!videoId) {
      setTone('error');
      setMessage('Paste a valid YouTube watch, youtu.be, Shorts, live, or embed URL.');
      return;
    }
    const thumbnails = getYouTubeThumbnailUrls(videoId);
    update({
      media: [...review.media, {
        id: crypto.randomUUID(),
        reviewId: review.id,
        mediaType: 'youtube',
        youtubeUrl: normalizeYouTubeUrl(videoId),
        youtubeVideoId: videoId,
        thumbnailUrl: thumbnails.max,
        caption: '',
        sortOrder: (review.media.length + 1) * 10,
      }],
    });
    setYoutubeUrl('');
    setTone('success');
    setMessage('YouTube video added locally. Save the review to persist it.');
  };

  const removeMedia = (index) => {
    const item = review.media[index];
    if (!window.confirm('Remove this media item from the customer review? Shared Media Library assets will not be deleted.')) return;
    const next = order(review.media.filter((_, itemIndex) => itemIndex !== index));
    update({
      media: next,
      selectedPreviewMediaId: review.selectedPreviewMediaId === item.id ? null : review.selectedPreviewMediaId,
    });
  };

  const save = async (statusOverride = null) => {
    setBusy(statusOverride === 'published' ? 'publish' : 'save');
    setMessage('');
    setErrors({});
    try {
      const response = await saveCustomerReview({
        review: { ...review, status: statusOverride || review.status },
        media: review.media,
        expectedUpdatedAt: isNew && !review.createdAt ? null : review.updatedAt,
      });
      if (!response?.ok) {
        setTone('error');
        setMessage(response?.error || 'Customer review save failed.');
        setErrors(response?.fieldErrors || {});
        return;
      }
      const saved = clone(response.data);
      setReview(saved);
      setBaseline(reviewComparable(saved));
      setTone('success');
      setMessage(saved.status === 'published' ? 'Customer review published and public pages revalidated.' : 'Customer review saved.');
      if (isNew) router.replace(`/admin/media/customer-reviews/${saved.id}`);
      router.refresh();
    } finally {
      setBusy('');
    }
  };

  const removeReview = async () => {
    if (isNew || !window.confirm(`Permanently delete ${review.customerName}'s review?`)) return;
    setBusy('delete');
    const response = await deleteCustomerReview({ id: review.id });
    if (!response?.ok) {
      setTone('error');
      setMessage(response?.error || 'Delete failed.');
      setBusy('');
      return;
    }
    router.push('/admin/media/customer-reviews');
    router.refresh();
  };

  const publicReview = { ...review, media: review.media, selectedPreview: review.media.find((item) => item.id === review.selectedPreviewMediaId) || null };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <Link href="/admin/media/customer-reviews" className="text-[10px] font-bold uppercase tracking-[.16em] text-[#B59410]"><i className="fa-solid fa-arrow-left mr-1" /> Customer Reviews</Link>
          <h1 className="mt-1 font-serif text-2xl font-bold text-[#0B1B3D]">{isNew ? 'Create Customer Review' : `Edit ${review.customerName}`}</h1>
          <p className="mt-1 text-xs text-slate-500">{review.status} · Serial {review.sortOrder} · {dirty ? 'Unsaved changes' : 'Up to date'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isNew && review.status === 'published' && <Link href={`/media-center/customer-reviews/${review.slug}`} target="_blank" className="rounded-xl border px-4 py-2 text-xs font-bold text-slate-600">Public Page</Link>}
          {!isNew && <button type="button" onClick={removeReview} disabled={busy} className="rounded-xl border border-red-200 px-4 py-2 text-xs font-bold text-red-600 disabled:opacity-40">Delete</button>}
          <button type="button" onClick={() => save()} disabled={!dirty || busy} className="rounded-xl bg-slate-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy === 'save' ? 'Saving…' : 'Save'}</button>
          <button type="button" onClick={() => save('published')} disabled={busy || (!dirty && review.status === 'published')} className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy === 'publish' ? 'Publishing…' : 'Save & Publish'}</button>
        </div>
      </header>

      {message && <div className={`rounded-xl border p-3 text-xs font-semibold ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message}</div>}

      <nav className="flex flex-wrap gap-2" aria-label="Customer Review editor sections">
        {TABS.map((name) => <button type="button" key={name} onClick={() => setTab(name)} className={`rounded-xl px-4 py-2 text-xs font-bold ${tab === name ? 'bg-[#0B1B3D] text-white' : 'border bg-white text-slate-600'}`}>{name}</button>)}
      </nav>

      {tab === 'Customer & Review' && (
        <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-serif text-lg font-bold text-[#0B1B3D]">Customer Profile</h2>
            <p className="text-xs text-slate-500">The profile photo is separate from review gallery media.</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {review.profileImage?.secureUrl ? <img src={review.profileImage.secureUrl} alt="" className="aspect-square w-full rounded-xl object-cover" /> : <div className="flex aspect-square items-center justify-center rounded-xl bg-[#0B1B3D] text-5xl font-serif text-white">{(review.customerName || 'C').slice(0, 1)}</div>}
              <button type="button" onClick={() => setPicker({ kind: 'profile' })} className="mt-3 w-full rounded-xl bg-[#0B1B3D] px-3 py-2 text-xs font-bold text-white">Choose / Upload Profile Photo</button>
              {review.profileImageId && <button type="button" onClick={() => update({ profileImageId: null, profileImage: null, profileImageAlt: '' })} className="mt-2 w-full rounded-xl border px-3 py-2 text-xs font-bold text-slate-600">Remove Profile Photo</button>}
              <p className="mt-3 text-[10px] leading-5 text-slate-500">Recommended: square professional portrait, at least 600 × 600 px. Uploads use the existing Cloudinary Media Library.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Customer name *" value={review.customerName} onChange={(value) => update({ customerName: value })} error={errors.customerName} />
              <Field label="URL slug *" value={review.slug} onChange={(value) => update({ slug: value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })} error={errors.slug} />
              <Field label="Designation / occupation" value={review.customerDesignation} onChange={(value) => update({ customerDesignation: value })} error={errors.customerDesignation} />
              <Field label="Location" value={review.customerLocation} onChange={(value) => update({ customerLocation: value })} error={errors.customerLocation} />
              <label><span className={LABEL}>Customer type</span><select className={INPUT} value={review.customerType || ''} onChange={(event) => update({ customerType: event.target.value })}><option value="">Not specified</option><option>Apartment Buyer</option><option>Landowner</option><option>Investor</option><option>Other</option></select>{errors.customerType && <span className="mt-1 block text-[10px] text-red-600">{errors.customerType}</span>}</label>
              <Field label="Review category" value={review.reviewCategory} onChange={(value) => update({ reviewCategory: value })} error={errors.reviewCategory} />
              <Field label="Related project" value={review.relatedProject} onChange={(value) => update({ relatedProject: value })} error={errors.relatedProject} />
              <Field label="Profile image alt text" value={review.profileImageAlt} onChange={(value) => update({ profileImageAlt: value })} error={errors.profileImageAlt} />
              <Field label="Review date" type="date" value={review.reviewDate} onChange={(value) => update({ reviewDate: value })} error={errors.reviewDate} />
              <label><span className={LABEL}>Rating</span><select className={INPUT} value={review.rating ?? ''} onChange={(event) => update({ rating: event.target.value ? Number(event.target.value) : null })}><option value="">No rating</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} star{value === 1 ? '' : 's'}</option>)}</select>{errors.rating && <span className="mt-1 block text-[10px] text-red-600">{errors.rating}</span>}</label>
              <Field label="Serial order" type="number" value={review.sortOrder} onChange={(value) => update({ sortOrder: Number(value) })} error={errors.sortOrder} />
              <label><span className={LABEL}>Status</span><select className={INPUT} value={review.status} onChange={(event) => update({ status: event.target.value })}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-xs font-bold text-slate-700"><input type="checkbox" checked={review.isFeatured} onChange={(event) => update({ isFeatured: event.target.checked })} /> Featured customer story</label>
            </div>
          </div>
          <Field label="Full written review *" value={review.reviewText} onChange={(value) => update({ reviewText: value })} multiline error={errors.reviewText} placeholder="Write the full customer experience. Separate paragraphs with a blank line." />
        </section>
      )}

      {tab === 'Review Media' && (
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="font-serif text-lg font-bold text-[#0B1B3D]">Photos, YouTube Videos & Card Preview</h2><p className="text-xs text-slate-500">Add multiple items, reorder them, and select exactly one optional preview for the public listing card.</p></div>
            <div className="flex gap-2"><button type="button" onClick={() => setPicker({ kind: 'photo-add' })} className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white"><i className="fa-solid fa-image mr-2" /> Add Photo</button><button type="button" onClick={() => update({ selectedPreviewMediaId: null })} disabled={!review.selectedPreviewMediaId} className="rounded-xl border px-4 py-2 text-xs font-bold text-slate-600 disabled:opacity-40">Clear Card Preview</button></div>
          </div>

          <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_auto]">
            <input className={INPUT} value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="Paste YouTube watch, youtu.be, Shorts, live, or embed URL" />
            <button type="button" onClick={addYouTube} className="rounded-xl bg-[#C5A880] px-4 py-2 text-xs font-bold text-[#0B1B3D]"><i className="fa-brands fa-youtube mr-2" /> Add YouTube Video</button>
          </div>

          {errors.media && <p className="text-xs font-semibold text-red-600">{errors.media}</p>}
          {errors.selectedPreviewMediaId && <p className="text-xs font-semibold text-red-600">{errors.selectedPreviewMediaId}</p>}

          {review.media.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center text-xs text-slate-500">No review media added. The public card will automatically use a balanced text-only layout.</div>
          ) : (
            <div className="space-y-3">
              {review.media.map((item, index) => (
                <article key={item.id} className={`grid gap-4 rounded-2xl border p-4 lg:grid-cols-[220px_1fr_auto] ${review.selectedPreviewMediaId === item.id ? 'border-[#C5A880] bg-amber-50/40' : 'border-slate-200'}`}>
                  <div className="overflow-hidden rounded-xl bg-slate-100">
                    {item.mediaType === 'image' && item.imageAsset?.secureUrl ? <img src={item.imageAsset.secureUrl} alt="" className="aspect-video h-full w-full object-cover" /> : item.mediaType === 'youtube' ? <div className="relative aspect-video"><YouTubeThumbnail videoId={item.youtubeVideoId} alt="YouTube review thumbnail" className="h-full w-full object-cover" /><span className="absolute inset-0 flex items-center justify-center bg-[#0B1B3D]/25 text-3xl text-white"><i className="fa-solid fa-play" /></span></div> : <div className="flex aspect-video items-center justify-center text-slate-400">Missing preview</div>}
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#0B1B3D] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white">{item.mediaType}</span><span className="font-mono text-[9px] text-slate-400">{item.id}</span></div>
                    {item.mediaType === 'image' ? <><Field label="Image alt text *" value={item.altText} onChange={(value) => updateMedia(index, { altText: value })} error={errors[`media.${index}.altText`]} /><button type="button" onClick={() => setPicker({ kind: 'photo-replace', index })} className="rounded-lg border px-3 py-1.5 text-xs font-bold text-slate-600">Replace Photo</button></> : <><Field label="YouTube URL" value={item.youtubeUrl} onChange={(value) => { const videoId = extractYouTubeVideoId(value); updateMedia(index, { youtubeUrl: value, youtubeVideoId: videoId || null, thumbnailUrl: videoId ? getYouTubeThumbnailUrls(videoId).max : null }); }} error={errors[`media.${index}.youtubeUrl`]} /><p className="text-[10px] text-slate-500">Video ID: {item.youtubeVideoId || 'Invalid URL'}. Thumbnail is generated automatically.</p></>}
                    <Field label="Optional caption" value={item.caption} onChange={(value) => updateMedia(index, { caption: value })} error={errors[`media.${index}.caption`]} />
                    <label className="flex items-center gap-2 rounded-xl border border-[#C5A880]/50 bg-white p-3 text-xs font-bold text-[#0B1B3D]"><input type="radio" name="card-preview" checked={review.selectedPreviewMediaId === item.id} onChange={() => update({ selectedPreviewMediaId: item.id })} /> Use as Card Preview</label>
                  </div>
                  <div className="flex gap-1 lg:flex-col"><button type="button" disabled={index === 0} onClick={() => update({ media: move(review.media, index, -1) })} className="h-9 w-9 rounded-lg border text-slate-600 disabled:opacity-30" aria-label="Move media up">↑</button><button type="button" disabled={index === review.media.length - 1} onClick={() => update({ media: move(review.media, index, 1) })} className="h-9 w-9 rounded-lg border text-slate-600 disabled:opacity-30" aria-label="Move media down">↓</button><button type="button" onClick={() => removeMedia(index)} className="h-9 w-9 rounded-lg border border-red-200 text-red-600" aria-label="Remove media"><i className="fa-solid fa-trash" /></button></div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'Preview' && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-serif text-lg font-bold text-[#0B1B3D]">Unsaved Preview</h2><p className="text-xs text-slate-500">This preview uses the current local form state.</p></div><select className={INPUT} value={previewMode} onChange={(event) => setPreviewMode(event.target.value)}><option value="card">Listing card</option><option value="detail">Detail page</option></select></div>
          <div className="max-h-[820px] overflow-auto rounded-xl border bg-[#FAF9F6] p-4">{previewMode === 'card' ? <div className="customer-reviews-grid"><CustomerReviewCard review={publicReview} interactive={false} /></div> : <CustomerReviewDetail review={publicReview} mediaPage={mediaPage} previewMode />}</div>
        </section>
      )}

      {picker && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-7xl"><MediaLibrary isModal resourceTypeFilter="image" initialFolder="dhaka-heights/dev/customer-reviews" onSelectAsset={chooseAsset} onCloseModal={() => setPicker(null)} /></div>
        </div>
      )}
    </div>
  );
}
