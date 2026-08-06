'use client';

import { useMemo, useState } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import PageHeader from './PageHeader';
import ScrollToTop from './ScrollToTop';
import { normalizeGoogleMapsEmbedUrl } from '@/lib/googleMaps';

const EMPTY_FORM = { name: '', email: '', phone: '', subject: '', message: '', honeypot: '' };

function Lines({ value }) {
  return String(value || '').split('\n').map((line, index) => <span key={`${line}-${index}`}>{index > 0 && <br />}{line}</span>);
}

function renderTemplate(template, values) {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, value || ''), template || '');
}

export default function ContactPageClient({ contactPage, previewMode = false }) {
  const content = contactPage.content;
  const cards = useMemo(() => content.infoCards.filter((item) => item.isVisible !== false), [content.infoCards]);
  const subjects = useMemo(() => content.subjectOptions.filter((item) => item.isVisible !== false), [content.subjectOptions]);
  const mapUrl = useMemo(() => normalizeGoogleMapsEmbedUrl(content.map?.iframeUrl), [content.map?.iframeUrl]);
  const [form, setForm] = useState({ ...EMPTY_FORM, subject: subjects[0]?.value || '' });
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setNotice(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (previewMode) {
      setNotice({ type: 'error', text: content.form.previewNotice });
      return;
    }
    setSubmitting(true);
    setNotice(null);
    try {
      const response = await fetch('/api/submissions/contact-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: form.name, email: form.email, phone: form.phone, subject: form.subject, message: form.message, honeypot: form.honeypot }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || content.form.errorMessage);
      const subjectLabel = subjects.find((item) => item.value === form.subject)?.label || form.subject;
      setNotice({ type: 'success', text: renderTemplate(content.form.successMessage, { name: form.name, subject: subjectLabel, phone: form.phone }) });
      setForm({ ...EMPTY_FORM, subject: subjects[0]?.value || '' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message || content.form.errorMessage });
    } finally {
      setSubmitting(false);
    }
  };

  if (!previewMode && contactPage.isVisible === false) return <div><Navbar /><main style={{ marginTop: '80px' }} /><Footer /><ScrollToTop /></div>;

  return (
    <div>
      <Navbar />
      <main style={{ marginTop: '80px' }}>
        <PageHeader title={content.header.title} subtitle={content.header.subtitle} breadcrumbs={[{ label: content.header.breadcrumbLabel }]} />

        <section className="py-16 contact-info-cards-section" style={{ backgroundColor: '#ffffff' }}>
          <div className="container grid-4 gap-6">
            {cards.map((card) => (
              <div className="contact-info-card" key={card.itemId}>
                <div className="icon-wrapper"><i className={card.iconClass}></i></div>
                <h4 className="text-navy font-bold text-base mb-2">{card.title}</h4>
                <p className={`text-gray-500 text-xs leading-relaxed ${card.ctaLabel ? 'mb-4' : ''}`}><Lines value={card.body} /></p>
                {card.ctaLabel && <a href={card.ctaUrl} target={card.ctaTarget} rel={card.ctaTarget === '_blank' ? 'noopener noreferrer' : undefined} className="btn btn-secondary text-xxs inline-block" style={{ padding: '8px 16px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--accent-gold)' }}>{card.ctaLabel}{card.ctaIconClass && <> <i className={`${card.ctaIconClass} ml-1`}></i></>}</a>}
              </div>
            ))}
          </div>
        </section>

        <section className="py-20 bg-gray-50 contact-form-map-section" style={{ backgroundColor: '#fcfcfd', borderTop: '1px solid var(--border-light)' }}>
          <div className="container grid-2 gap-10">
            <div className="contact-form-card">
              <h3 className="text-navy font-serif text-2xl font-bold mb-2">{content.form.heading}</h3>
              <p className="text-gray-400 text-xs mb-8">{content.form.description}</p>
              <form onSubmit={submit} className="flex flex-col gap-6">
                <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.honeypot} onChange={(event) => setField('honeypot', event.target.value)} style={{ position: 'absolute', left: '-10000px' }} />
                <div className="flex flex-col"><input type="text" placeholder={content.form.namePlaceholder} required value={form.name} onChange={(event) => setField('name', event.target.value)} className="luxury-input-field" /></div>
                <div className="grid-2 gap-6">
                  <input type="email" placeholder={content.form.emailPlaceholder} value={form.email} onChange={(event) => setField('email', event.target.value)} className="luxury-input-field" />
                  <input type="tel" placeholder={content.form.phonePlaceholder} required value={form.phone} onChange={(event) => setField('phone', event.target.value)} className="luxury-input-field" />
                </div>
                <div className="flex flex-col">
                  <label className="text-gray-500 text-xs font-semibold uppercase mb-1">{content.form.subjectLabel}</label>
                  <select value={form.subject} onChange={(event) => setField('subject', event.target.value)} className="luxury-select-boxed">
                    {subjects.map((subject) => <option value={subject.value} key={subject.itemId}>{subject.label}</option>)}
                  </select>
                </div>
                <div className="flex flex-col"><textarea rows="4" placeholder={content.form.messagePlaceholder} required value={form.message} onChange={(event) => setField('message', event.target.value)} className="luxury-textarea-field"></textarea></div>
                {notice && <p role="status" aria-live="polite" className={`text-xs font-semibold ${notice.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>{notice.text}</p>}
                <button type="submit" disabled={submitting || previewMode} className="btn btn-primary w-full mt-2" style={{ padding: '14px', fontSize: '0.95rem', cursor: submitting || previewMode ? 'not-allowed' : 'pointer', borderRadius: '30px' }}>{submitting ? content.form.submittingLabel : content.form.submitLabel}</button>
              </form>
            </div>

            <div className="flex flex-col gap-6 justify-center">
              <span className="section-tag" style={{ marginBottom: '-10px' }}>{content.map.tag}</span>
              <h3 className="text-navy font-serif text-3xl font-bold">{content.map.heading}</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-2">{content.map.description}</p>
              <div className="map-wrapper rounded shadow border" style={{ height: '350px', overflow: 'hidden', border: '1px solid var(--border-light)', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05)' }}>
                <iframe src={mapUrl} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={content.map.iframeTitle}></iframe>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  );
}
