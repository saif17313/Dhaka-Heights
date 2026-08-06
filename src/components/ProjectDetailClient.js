'use client';

import { useMemo, useState } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import PageHeader from './PageHeader';
import ScrollToTop from './ScrollToTop';
import { getYouTubeEmbedUrl } from '@/lib/youtube';

const EMPTY_FORM = { name: '', phone: '', email: '', message: '', honeypot: '' };

export default function ProjectDetailClient({ project, projectsPage, previewMode = false }) {
  const detail = projectsPage.content.detail;
  const images = useMemo(() => [
    { mediaId: project.coverMediaId, alt: project.coverAlt, media: project.coverMedia, isVisible: true },
    ...(project.gallery || []).filter((image) => image.isVisible !== false),
  ].filter((image) => image.media?.secureUrl), [project]);
  const [activeMediaId, setActiveMediaId] = useState(images[0]?.mediaId || '');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState('');
  const activeImage = images.find((image) => image.mediaId === activeMediaId) || images[0];
  const videoEmbedUrl = useMemo(() => getYouTubeEmbedUrl(project.videoUrl), [project.videoUrl]);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setSubmitError('');
    setSuccess('');
  };
  const submit = async (event) => {
    event.preventDefault();
    if (previewMode) return;
    setSubmitting(true); setSubmitError(''); setSuccess('');
    try {
      const response = await fetch('/api/submissions/inquiry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: form.name, phone: form.phone, email: form.email, message: form.message, honeypot: form.honeypot, project_slug: project.slug, project_name: project.name }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || detail.errorMessage);
      setSuccess(detail.successMessage); setForm(EMPTY_FORM);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : detail.errorMessage);
    } finally { setSubmitting(false); }
  };

  const body = <main style={{ marginTop: previewMode ? 0 : '80px' }}>
    <PageHeader title={project.name} subtitle={`${project.detailCategoryLabel} | ${project.detailLocation}`} breadcrumbs={[{ label: detail.projectsBreadcrumbLabel, url: '/projects' }, { label: project.name }]} bgImage={projectsPage.content.header.media?.secureUrl} />
    <section className="project-details-body-section"><div className="container"><div className="grid-3 gap-8">
      <div className="lg-col-span-2 flex flex-col gap-8">
        <div className="project-detail-hero-wrapper"><img src={activeImage?.media?.secureUrl} alt={activeImage?.alt || project.coverAlt} style={{ width: '100%', maxHeight: '500px', objectFit: 'cover' }} /></div>
        {images.length > 1 && <div style={{ display: 'flex', flexDirection: 'row', gap: '16px', flexWrap: 'wrap' }}>{images.map((image, index) => <button type="button" key={`${image.mediaId}-${index}`} onClick={() => setActiveMediaId(image.mediaId)} className={`project-detail-thumbnail ${activeMediaId === image.mediaId ? 'active' : ''}`} aria-label={`View ${image.alt}`} style={{ padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}><img src={image.media.secureUrl} alt={image.alt} /></button>)}</div>}
        {videoEmbedUrl && <div className="project-detail-video-wrapper"><h3 className="text-navy font-serif text-2xl font-bold mb-4" style={{ fontFamily: 'var(--font-playfair)', color: 'var(--primary-navy)' }}>Project Video Tour</h3><div className="project-detail-video-frame"><iframe src={videoEmbedUrl} title={`${project.name} video tour`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div></div>}
        <div className="project-text-block" style={{ marginTop: '45px' }}><h3 className="text-navy font-serif text-2xl font-bold mb-4" style={{ fontFamily: 'var(--font-playfair)', color: 'var(--primary-navy)' }}>{detail.overviewTitle}</h3><p className="text-gray-600 leading-relaxed mb-6" style={{ fontSize: '1.05rem', lineHeight: '1.8' }}>{project.description}</p><p className="text-gray-600 leading-relaxed" style={{ fontSize: '1rem', lineHeight: '1.8' }}>{detail.secondaryDescription}</p></div>
      </div>
      <div className="flex flex-col gap-8">
        <div className="project-spec-card"><h3 className="project-spec-title">{detail.atGlanceTitle}</h3><ul className="project-spec-list">
          <li className="project-spec-item"><span className="project-spec-label"><i className="fa-solid fa-building text-gold"></i> {detail.projectNameLabel}</span><span className="project-spec-value">{project.name}</span></li>
          <li className="project-spec-item"><span className="project-spec-label"><i className="fa-solid fa-location-dot text-gold"></i> {detail.locationLabel}</span><span className="project-spec-value">{project.detailLocation}</span></li>
          <li className="project-spec-item"><span className="project-spec-label"><i className="fa-solid fa-briefcase text-gold"></i> {detail.projectTypeLabel}</span><span className="project-spec-value">{project.projectType}</span></li>
          <li className="project-spec-item"><span className="project-spec-label"><i className="fa-solid fa-layer-group text-gold"></i> {detail.floorsLabel}</span><span className="project-spec-value">{project.floors}</span></li>
          <li className="project-spec-item"><span className="project-spec-label"><i className="fa-solid fa-ruler-combined text-gold"></i> {detail.landAreaLabel}</span><span className="project-spec-value">{project.landArea}</span></li>
          <li className="project-spec-item"><span className="project-spec-label"><i className="fa-solid fa-up-down text-gold"></i> {detail.heightLabel}</span><span className="project-spec-value">{project.buildingHeight}</span></li>
          <li className="project-spec-item"><span className="project-spec-label"><i className="fa-solid fa-arrows-left-right text-gold"></i> {detail.unitSizesLabel}</span><span className="project-spec-value text-right" style={{ maxWidth: '180px' }}>{project.detailSize}</span></li>
          <li className="project-spec-item"><span className="project-spec-label"><i className="fa-solid fa-square-parking text-gold"></i> {detail.parkingLabel}</span><span className="project-spec-value text-right" style={{ maxWidth: '180px' }}>{project.parking}</span></li>
        </ul></div>
        <div className="project-spec-card"><h3 className="project-spec-title" style={{ marginBottom: '10px' }}>{detail.formTitle}</h3><p className="text-gray-400 text-xs mb-6">{detail.formDescription}</p><form onSubmit={submit} className="flex flex-col gap-4">
          <input aria-hidden="true" tabIndex={-1} autoComplete="off" value={form.honeypot} onChange={(event) => update('honeypot', event.target.value)} style={{ position: 'absolute', left: '-10000px' }} />
          <div className="flex flex-col"><input type="text" placeholder={detail.namePlaceholder} required maxLength={120} value={form.name} onChange={(event) => update('name', event.target.value)} className="luxury-input-field" /></div>
          <div className="flex flex-col"><input type="tel" placeholder={detail.phonePlaceholder} required maxLength={40} value={form.phone} onChange={(event) => update('phone', event.target.value)} className="luxury-input-field" /></div>
          <div className="flex flex-col"><input type="email" placeholder={detail.emailPlaceholder} maxLength={254} value={form.email} onChange={(event) => update('email', event.target.value)} className="luxury-input-field" /></div>
          <div className="flex flex-col"><textarea rows="3" placeholder={detail.messagePlaceholder} maxLength={2000} value={form.message} onChange={(event) => update('message', event.target.value)} className="luxury-textarea-field"></textarea></div>
          {submitError && <p className="text-xs text-red-600" role="alert">{submitError}</p>}{success && <p className="text-xs text-emerald-700" role="status">{success}</p>}
          <button type="submit" disabled={submitting || previewMode} className="btn btn-primary w-full" style={{ padding: '14px', fontSize: '0.95rem', cursor: 'pointer' }}>{submitting ? detail.submittingLabel : detail.submitLabel}</button>
        </form></div>
      </div>
    </div></div></section>
  </main>;
  if (previewMode) return <div>{body}</div>;
  return <div><Navbar />{body}<Footer /><ScrollToTop /></div>;
}
