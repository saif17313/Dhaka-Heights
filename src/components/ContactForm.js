'use client';

import React, { useMemo, useState } from 'react';
import { normalizeGoogleMapsEmbedUrl } from '@/lib/googleMaps';

const EMPTY_FORM = { name: '', email: '', phone: '', size: '', message: '', honeypot: '' };

export default function ContactForm({ contactSection, mapConfig = null, previewMode = false }) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({ name: false, email: false, phone: false, size: false });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const details = useMemo(() => (contactSection?.details || []).filter((item) => item.isVisible !== false), [contactSection]);
  const spaceOptions = useMemo(() => (contactSection?.spaceOptions || []).filter((item) => item.isVisible !== false), [contactSection]);
  const mapUrl = useMemo(() => normalizeGoogleMapsEmbedUrl(mapConfig?.iframeUrl), [mapConfig?.iframeUrl]);

  if (!contactSection || contactSection.isVisible === false) return null;
  const copy = contactSection.copy;

  const handleInputChange = (event) => {
    const { id, value } = event.target;
    const name = id.replace('form-', '');
    setFormData((current) => ({ ...current, [name]: value }));
    setSubmitError('');
    if (errors[name]) setErrors((current) => ({ ...current, [name]: false }));
  };

  const validateField = (field, value) => {
    if (field === 'name') return value.trim().length > 0;
    if (field === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    if (field === 'phone') return value.trim().length >= 8 && /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]*$/.test(value.trim());
    if (field === 'size') return value !== '';
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const newErrors = {
      name: !validateField('name', formData.name),
      email: !validateField('email', formData.email),
      phone: !validateField('phone', formData.phone),
      size: !validateField('size', formData.size),
    };
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean) || previewMode) return;

    const selectedOption = spaceOptions.find((option) => option.value === formData.size);
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const response = await fetch('/api/submissions/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.name,
          email: formData.email,
          phone: formData.phone,
          space_requirement: formData.size,
          space_requirement_label: selectedOption?.label || formData.size,
          requirements: formData.message,
          honeypot: formData.honeypot,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'Your request could not be sent. Please try again.');
      setIsSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Your request could not be sent. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSuccess = () => {
    setIsSubmitted(false);
    setFormData(EMPTY_FORM);
  };

  return (
    <section id="contact" className={`contact-section scroll-reveal ${previewMode ? 'revealed' : ''}`}>
      <div className="container grid-2">
        <div className="contact-info-col">
          <span className="section-tag">{contactSection.tagText}</span>
          <h2 className="section-title">{contactSection.heading}</h2>
          <p className="contact-lead">{contactSection.description}</p>

          <div className="contact-details-list">
            {details.map((detail) => (
              <div key={detail.itemKey} className="contact-detail-item">
                <div className="icon-circle"><i className={`fa-solid ${detail.iconKey}`} aria-hidden="true"></i></div>
                <div className="detail-text"><h4>{detail.label}</h4><p>{detail.value}</p></div>
              </div>
            ))}
          </div>

          <div className="map-mockup-wrapper">
            <iframe
              src={mapUrl}
              width="100%"
              height="260"
              style={{ border: 0, display: 'block' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={mapConfig?.iframeTitle || copy.mapTooltip || 'Dhaka Heights Properties Limited location map'}
            />
          </div>
        </div>

        <div className="contact-form-col">
          <div className="form-wrapper">
            <h3>{copy.formHeading}</h3>
            <p>{copy.formDescription}</p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group" aria-hidden="true" style={{ position: 'absolute', left: '-10000px' }}>
                <input id="form-honeypot" value={formData.honeypot} onChange={handleInputChange} tabIndex={-1} autoComplete="off" />
              </div>
              <div className="form-group">
                <input type="text" id="form-name" className={`form-input ${errors.name ? 'invalid-field' : ''}`} value={formData.name} onChange={handleInputChange} placeholder=" " required maxLength={120} />
                <label htmlFor="form-name" className="form-label">{copy.nameLabel}</label>
                {errors.name && <span className="error-msg">{copy.nameError}</span>}
              </div>
              <div className="form-group">
                <input type="email" id="form-email" className={`form-input ${errors.email ? 'invalid-field' : ''}`} value={formData.email} onChange={handleInputChange} placeholder=" " required maxLength={254} />
                <label htmlFor="form-email" className="form-label">{copy.emailLabel}</label>
                {errors.email && <span className="error-msg">{copy.emailError}</span>}
              </div>
              <div className="form-group">
                <input type="tel" id="form-phone" className={`form-input ${errors.phone ? 'invalid-field' : ''}`} value={formData.phone} onChange={handleInputChange} placeholder=" " required maxLength={40} />
                <label htmlFor="form-phone" className="form-label">{copy.phoneLabel}</label>
                {errors.phone && <span className="error-msg">{copy.phoneError}</span>}
              </div>
              <div className="form-group select-group">
                <select id="form-size" className={`form-input ${errors.size ? 'invalid-field' : ''}`} value={formData.size} onChange={handleInputChange} required>
                  <option value="" disabled hidden></option>
                  {spaceOptions.map((option) => <option key={option.itemKey} value={option.value}>{option.label}</option>)}
                </select>
                <label htmlFor="form-size" className="form-label select-label">{copy.sizeLabel}</label>
                {errors.size && <span className="error-msg">{copy.sizeError}</span>}
                <i className="fa-solid fa-angle-down select-caret" aria-hidden="true"></i>
              </div>
              <div className="form-group">
                <textarea id="form-message" className="form-input form-textarea" value={formData.message} onChange={handleInputChange} placeholder=" " rows="4" maxLength={2000}></textarea>
                <label htmlFor="form-message" className="form-label">{copy.messageLabel}</label>
              </div>
              {submitError && <p className="error-msg" role="alert">{submitError}</p>}
              <button type="submit" className="btn btn-primary btn-block submit-btn" disabled={isSubmitting || previewMode}>
                <span>{isSubmitting ? copy.submittingLabel : copy.submitLabel} <i className={`fa-solid ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i></span>
              </button>
            </form>

            <div className={`form-success-banner ${isSubmitted ? 'active' : ''}`} role="alert" aria-hidden={!isSubmitted}>
              <div className="success-banner-content">
                <div className="success-icon"><i className="fa-solid fa-circle-check"></i></div>
                <h4>{copy.successTitle}</h4>
                <p>{copy.successBody}</p>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleCloseSuccess}><span>{copy.closeLabel}</span></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
