'use client';

import { useMemo, useState } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import PageHeader from './PageHeader';
import ScrollToTop from './ScrollToTop';
import { normalizeGoogleMapsEmbedUrl } from '@/lib/googleMaps';

const CATEGORY_OPTIONS = [
  { value: '', label: 'Select Category' },
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'mixed-use', label: 'Mixed-Use' },
  { value: 'other', label: 'Other' },
];

const EMPTY_FORM = {
  locality: '', address: '', sizeOfLand: '', roadWidth: '', category: '', facing: '', attractiveFeatures: '',
  landownerName: '', email: '', contactNumber: '', honeypot: '',
};

function Lines({ value }) {
  return String(value || '').split('\n').map((line, index) => <span key={`${line}-${index}`}>{index > 0 && <br />}{line}</span>);
}

export default function LandownerEnquiryForm({ infoCards = [], map }) {
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
      const response = await fetch('/api/submissions/landowner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locality: form.locality, address: form.address, size_of_land: form.sizeOfLand, road_width: form.roadWidth,
          category: form.category, facing: form.facing, attractive_features: form.attractiveFeatures,
          landowner_name: form.landownerName, email: form.email, contact_number: form.contactNumber, honeypot: form.honeypot,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'Your submission could not be recorded. Please try again.');
      setNotice({ type: 'success', text: 'Thank you! Your land details have been received. Our land acquisition team will contact you shortly.' });
      setForm(EMPTY_FORM);
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Your submission could not be recorded. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Navbar />
      <main style={{ marginTop: '80px' }}>
        <PageHeader
          title="Landowner Submission"
          subtitle="Share your land details for a development or joint-venture partnership"
          breadcrumbs={[{ label: 'Contact', url: '/contact' }, { label: 'Landowner' }]}
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
              <h3 className="text-navy font-serif text-2xl font-bold mb-2">Meet the Professionals</h3>
              <p className="text-gray-400 text-xs mb-8">Submit your land information below and our land acquisition team will review it for a potential partnership.</p>
              <form onSubmit={submit} className="flex flex-col gap-6">
                <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.honeypot} onChange={(event) => setField('honeypot', event.target.value)} style={{ position: 'absolute', left: '-10000px' }} />

                <div>
                  <h4 className="text-navy font-bold text-sm uppercase tracking-wide mb-4">Land Information</h4>
                  <div className="flex flex-col gap-6">
                    <div className="grid-2 gap-6">
                      <input type="text" placeholder="Locality" maxLength={160} value={form.locality} onChange={(event) => setField('locality', event.target.value)} className="luxury-input-field" />
                      <input type="text" placeholder="Address" maxLength={220} value={form.address} onChange={(event) => setField('address', event.target.value)} className="luxury-input-field" />
                    </div>
                    <div className="grid-2 gap-6">
                      <input type="text" placeholder="Size of the Land in Kathas" maxLength={60} value={form.sizeOfLand} onChange={(event) => setField('sizeOfLand', event.target.value)} className="luxury-input-field" />
                      <input type="text" placeholder="Width of the Road in Front (in Feet)" maxLength={60} value={form.roadWidth} onChange={(event) => setField('roadWidth', event.target.value)} className="luxury-input-field" />
                    </div>
                    <div className="grid-2 gap-6">
                      <select value={form.category} onChange={(event) => setField('category', event.target.value)} className="luxury-select-boxed">
                        {CATEGORY_OPTIONS.map((option) => <option value={option.value} key={option.value || 'placeholder'} disabled={!option.value}>{option.label}</option>)}
                      </select>
                      <input type="text" placeholder="Facing" maxLength={60} value={form.facing} onChange={(event) => setField('facing', event.target.value)} className="luxury-input-field" />
                    </div>
                    <input type="text" placeholder="Attractive Features (If Any)" maxLength={500} value={form.attractiveFeatures} onChange={(event) => setField('attractiveFeatures', event.target.value)} className="luxury-input-field" />
                  </div>
                </div>

                <div>
                  <h4 className="text-navy font-bold text-sm uppercase tracking-wide mb-4">Landowners Information</h4>
                  <div className="flex flex-col gap-6">
                    <input type="text" placeholder="Name of the Landowner *" required maxLength={120} value={form.landownerName} onChange={(event) => setField('landownerName', event.target.value)} className="luxury-input-field" />
                    <div className="grid-2 gap-6">
                      <input type="email" placeholder="Email ID" maxLength={254} value={form.email} onChange={(event) => setField('email', event.target.value)} className="luxury-input-field" />
                      <input type="tel" placeholder="Contact Number *" required maxLength={40} value={form.contactNumber} onChange={(event) => setField('contactNumber', event.target.value)} className="luxury-input-field" />
                    </div>
                  </div>
                </div>

                {notice && <p role="status" aria-live="polite" className={`text-xs font-semibold ${notice.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>{notice.text}</p>}
                <button type="submit" disabled={submitting} className="btn btn-primary w-full mt-2" style={{ padding: '14px', fontSize: '0.95rem', cursor: submitting ? 'not-allowed' : 'pointer', borderRadius: '30px' }}>{submitting ? 'Submitting...' : 'Submit'}</button>
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
