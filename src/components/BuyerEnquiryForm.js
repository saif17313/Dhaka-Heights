'use client';

import { useMemo, useState } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import PageHeader from './PageHeader';
import ScrollToTop from './ScrollToTop';
import { normalizeGoogleMapsEmbedUrl } from '@/lib/googleMaps';

const EMPTY_FORM = {
  name: '', phone: '', email: '', projectSlug: '',
  preferredLocation: '', budgetRange: '', unitSize: '', message: '', honeypot: '',
};

function Lines({ value }) {
  return String(value || '').split('\n').map((line, index) => <span key={`${line}-${index}`}>{index > 0 && <br />}{line}</span>);
}

export default function BuyerEnquiryForm({ projects, infoCards = [], map }) {
  const cards = useMemo(() => infoCards.filter((item) => item.isVisible !== false), [infoCards]);
  const mapUrl = useMemo(() => normalizeGoogleMapsEmbedUrl(map?.iframeUrl), [map?.iframeUrl]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setNotice(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    try {
      const response = await fetch('/api/submissions/buyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.name, phone: form.phone, email: form.email, project_slug: form.projectSlug,
          preferred_location: form.preferredLocation, budget_range: form.budgetRange, unit_size: form.unitSize,
          message: form.message, honeypot: form.honeypot,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'Your enquiry could not be submitted. Please try again.');
      setNotice({ type: 'success', text: 'Thank you! Your enquiry has been received. Our sales team will contact you shortly.' });
      setForm(EMPTY_FORM);
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Your enquiry could not be submitted. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Navbar />
      <main style={{ marginTop: '80px' }}>
        <PageHeader
          title="Buyer Enquiry"
          subtitle="Tell us what you're looking for and our team will get in touch"
          breadcrumbs={[{ label: 'Contact', url: '/contact' }, { label: 'Buyer' }]}
        />

        {cards.length > 0 && (
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
        )}

        <section className="py-20 bg-gray-50 contact-form-map-section" style={{ backgroundColor: '#fcfcfd', borderTop: '1px solid var(--border-light)' }}>
          <div className="container grid-2 gap-10">
            <div className="contact-form-card">
              <h3 className="text-navy font-serif text-2xl font-bold mb-2">Property Buyer Enquiry</h3>
              <p className="text-gray-400 text-xs mb-8">Share a few details about what you&rsquo;re looking for and our sales team will reach out with matching options.</p>
              <form onSubmit={submit} className="flex flex-col gap-6">
                <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.honeypot} onChange={(event) => setField('honeypot', event.target.value)} style={{ position: 'absolute', left: '-10000px' }} />
                <div className="flex flex-col"><input type="text" placeholder="Your Name *" required maxLength={120} value={form.name} onChange={(event) => setField('name', event.target.value)} className="luxury-input-field" /></div>
                <div className="grid-2 gap-6">
                  <input type="tel" placeholder="Phone Number *" required maxLength={40} value={form.phone} onChange={(event) => setField('phone', event.target.value)} className="luxury-input-field" />
                  <input type="email" placeholder="Email Address" maxLength={254} value={form.email} onChange={(event) => setField('email', event.target.value)} className="luxury-input-field" />
                </div>
                <div className="flex flex-col">
                  <label className="text-gray-500 text-xs font-semibold uppercase mb-1">Project of Interest</label>
                  <select value={form.projectSlug} onChange={(event) => setField('projectSlug', event.target.value)} className="luxury-select-boxed">
                    <option value="">Any Project</option>
                    {projects.map((project) => <option value={project.slug} key={project.slug}>{project.name}</option>)}
                  </select>
                </div>
                <div className="grid-2 gap-6">
                  <input type="text" placeholder="Preferred Location" maxLength={160} value={form.preferredLocation} onChange={(event) => setField('preferredLocation', event.target.value)} className="luxury-input-field" />
                  <input type="text" placeholder="Budget Range (e.g. 80 Lakh - 1.5 Crore)" maxLength={160} value={form.budgetRange} onChange={(event) => setField('budgetRange', event.target.value)} className="luxury-input-field" />
                </div>
                <div className="flex flex-col"><input type="text" placeholder="Unit Size Requirement (e.g. 1500-2000 SFT)" maxLength={160} value={form.unitSize} onChange={(event) => setField('unitSize', event.target.value)} className="luxury-input-field" /></div>
                <div className="flex flex-col"><textarea rows="4" placeholder="Message / Requirements..." maxLength={2000} value={form.message} onChange={(event) => setField('message', event.target.value)} className="luxury-textarea-field"></textarea></div>
                {notice && <p role="status" aria-live="polite" className={`text-xs font-semibold ${notice.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>{notice.text}</p>}
                <button type="submit" disabled={submitting} className="btn btn-primary w-full mt-2" style={{ padding: '14px', fontSize: '0.95rem', cursor: submitting ? 'not-allowed' : 'pointer', borderRadius: '30px' }}>{submitting ? 'Sending Enquiry...' : 'Submit Enquiry'}</button>
              </form>
            </div>

            <div className="flex flex-col gap-6 justify-center">
              <span className="section-tag" style={{ marginBottom: '-10px' }}>{map?.tag}</span>
              <h3 className="text-navy font-serif text-3xl font-bold">{map?.heading}</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-2">{map?.description}</p>
              <div className="map-wrapper rounded shadow border" style={{ height: '350px', overflow: 'hidden', border: '1px solid var(--border-light)', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05)' }}>
                <iframe src={mapUrl} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={map?.iframeTitle}></iframe>
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
