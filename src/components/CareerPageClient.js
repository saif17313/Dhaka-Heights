'use client';

import { useMemo, useRef, useState } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import PageHeader from './PageHeader';
import ScrollToTop from './ScrollToTop';

const INITIAL_FORM = { name: '', email: '', phone: '', coverLetter: '', jobId: 'general', honeypot: '' };

export default function CareerPageClient({ careerPage, previewMode = false }) {
  const content = careerPage.content;
  const jobs = useMemo(() => content.jobs.filter((job) => job.isVisible !== false), [content.jobs]);
  const firstJobId = jobs[0]?.jobId || 'general';
  const [form, setForm] = useState({ ...INITIAL_FORM, jobId: firstJobId });
  const [resume, setResume] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);
  const fileRef = useRef(null);

  const setField = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setNotice(null); };
  const submit = async (event) => {
    event.preventDefault();
    if (previewMode) { setNotice({ type: 'error', text: content.form.previewNotice }); return; }
    setSubmitting(true); setNotice(null);
    try {
      const body = new FormData();
      body.set('applicant_name', form.name);
      body.set('email', form.email);
      body.set('phone', form.phone);
      body.set('cover_letter', form.coverLetter);
      body.set('job_id', form.jobId === 'general' ? '' : form.jobId);
      body.set('honeypot', form.honeypot);
      if (resume) body.set('resume', resume);
      const response = await fetch('/api/submissions/career', { method: 'POST', body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || content.form.errorMessage);
      setNotice({ type: 'success', text: result.message || content.form.successMessage });
      setForm({ ...INITIAL_FORM, jobId: firstJobId }); setResume(null); if (fileRef.current) fileRef.current.value = '';
    } catch (error) { setNotice({ type: 'error', text: error.message || content.form.errorMessage }); }
    finally { setSubmitting(false); }
  };

  const body = <main style={{ marginTop: previewMode ? 0 : '80px' }}>
    <PageHeader title={content.header.title} subtitle={content.header.subtitle} breadcrumbs={[{ label: content.header.breadcrumbLabel }]} bgImage={content.header.media?.secureUrl} />
    <section className="py-16 hr-philosophy-section" style={{ backgroundColor: '#ffffff' }}>
      <div className="container grid-2">
        <div className="flex flex-col justify-center scroll-reveal revealed" style={{ paddingRight: '30px' }}>
          <span className="section-tag">{content.philosophy.tag}</span>
          <h2 className="section-title text-navy text-3xl font-serif mb-6">{content.philosophy.heading}</h2>
          {content.philosophy.paragraphs.map((paragraph, index) => <p key={index} className={`text-gray-600 leading-relaxed ${index < content.philosophy.paragraphs.length - 1 ? 'mb-4' : ''}`} style={{ fontSize: '0.95rem' }}>{paragraph}</p>)}
          <div className="mt-8 flex flex-col gap-4">{content.philosophy.benefits.filter((item) => item.isVisible !== false).map((item) => <div key={item.id} className="flex items-center text-sm font-semibold text-navy"><span style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(197, 168, 128, 0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px', color: 'var(--accent-gold)' }}><i className="fa-solid fa-check" /></span>{item.text}</div>)}</div>
        </div>
        <div className="flex items-center justify-center" style={{ padding: '20px 20px 20px 0' }}><div style={{ position: 'relative', width: '100%', maxWidth: '500px' }}><div style={{ position: 'absolute', top: '15px', left: '15px', right: '-15px', bottom: '-15px', border: '2px solid var(--accent-gold)', borderRadius: '8px', zIndex: 0 }} /><img src={content.philosophy.media?.secureUrl} alt={content.philosophy.imageAlt} className="rounded shadow-xl border" style={{ position: 'relative', border: '1px solid var(--border-light)', width: '100%', maxHeight: '350px', objectFit: 'cover', borderRadius: '8px', zIndex: 1 }} /></div></div>
      </div>
    </section>
    <section className="py-20 bg-gray-50 career-listings-section" style={{ backgroundColor: '#fcfcfd', borderTop: '1px solid var(--border-light)' }}>
      <div className="container grid-2 gap-10">
        <div><span className="section-tag">{content.jobsSection.tag}</span><h2 className="section-title text-navy text-2xl font-serif mb-8">{content.jobsSection.heading}</h2><div className="flex flex-col gap-6">{jobs.map((job) => <div key={job.jobId} className="career-job-card"><span className={`career-job-tag ${job.tagClass}`}>{job.department}</span><h4 className="text-navy font-bold text-lg mt-3 mb-1">{job.title}</h4><div className="flex gap-4 text-gray-400 text-xs mb-3 mt-1"><span><i className="fa-solid fa-location-dot mr-1" /> {job.location}</span><span>•</span><span><i className="fa-solid fa-briefcase mr-1" /> {job.experience}</span></div><p className="text-gray-500 text-sm leading-relaxed">{job.description}</p></div>)}</div></div>
        <div className="career-form-card"><h3 className="text-navy font-serif text-xl font-bold mb-2">{content.form.heading}</h3><p className="text-gray-400 text-xs mb-6">{content.form.description}</p>
          <form onSubmit={submit} className="flex flex-col gap-6">
            <input name="company" value={form.honeypot} onChange={(event) => setField('honeypot', event.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-10000px' }} />
            <div className="flex flex-col"><input type="text" placeholder={content.form.namePlaceholder} required maxLength={120} value={form.name} onChange={(event) => setField('name', event.target.value)} className="luxury-input-field" /></div>
            <div className="grid-2 gap-6"><input type="email" placeholder={content.form.emailPlaceholder} required maxLength={254} value={form.email} onChange={(event) => setField('email', event.target.value)} className="luxury-input-field" /><input type="tel" placeholder={content.form.phonePlaceholder} required maxLength={40} value={form.phone} onChange={(event) => setField('phone', event.target.value)} className="luxury-input-field" /></div>
            <div className="flex flex-col"><label className="text-gray-500 text-xs font-semibold uppercase mb-1">{content.form.positionLabel}</label><select required value={form.jobId} onChange={(event) => setField('jobId', event.target.value)} className="luxury-select-boxed">{jobs.map((job) => <option value={job.jobId} key={job.jobId}>{job.optionLabel || `${job.title} (${job.department})`}</option>)}<option value="general">{content.form.generalOptionLabel}</option></select></div>
            <div className="flex flex-col"><textarea rows="4" maxLength={3000} placeholder={content.form.coverLetterPlaceholder} value={form.coverLetter} onChange={(event) => setField('coverLetter', event.target.value)} className="luxury-textarea-field" /></div>
            <div className="flex flex-col"><label className="text-gray-500 text-xs font-semibold uppercase mb-1">{content.form.resumeLabel}</label><div className="luxury-file-uploader"><input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={(event) => { setResume(event.target.files?.[0] || null); setNotice(null); }} required={!resume} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 2 }} /><div className="uploader-icon"><i className="fa-solid fa-cloud-arrow-up" /></div><span className="uploader-text">{resume ? `${content.form.selectedPrefix} ${resume.name}` : content.form.uploadPrompt}</span><span className="uploader-subtext">{content.form.uploadHelp}</span></div></div>
            {notice && <p aria-live="polite" className={`rounded-xl border p-3 text-xs font-semibold ${notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{notice.text}</p>}
            <button type="submit" disabled={submitting} className="btn btn-primary w-full mt-2" style={{ padding: '14px', fontSize: '0.95rem', cursor: submitting ? 'wait' : 'pointer', borderRadius: '30px' }}>{submitting ? content.form.submittingLabel : content.form.submitLabel}</button>
          </form>
        </div>
      </div>
    </section>
  </main>;
  if (previewMode) return <div>{body}</div>;
  if (!careerPage.isVisible) return <div><Navbar /><Footer /></div>;
  return <div><Navbar />{body}<Footer /><ScrollToTop /></div>;
}
