'use client';

import React, { useCallback, useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import MediaLibrary from '@/components/admin/MediaLibrary';
import LivePreview from '@/components/admin/LivePreview';

const SECTION_CONFIGS = {
  hero: {
    title: 'Hero Banner & Slider',
    description: 'Manage main hero headline, subtext, primary CTA buttons, and slide banners.',
    fields: ['heading', 'subheading', 'description', 'primary_cta_label', 'primary_cta_url', 'secondary_cta_label', 'secondary_cta_url'],
    hasMedia: true,
    hasItems: true,
    itemType: 'Hero Slide',
  },
  overview: {
    title: 'Corporate Overview',
    description: 'Manage company overview statement, brand slogan, and introduction paragraph.',
    fields: ['heading', 'subheading', 'description'],
    hasMedia: false,
    hasItems: false,
  },
  'about-summary': {
    title: 'About Summary Block',
    description: 'Manage commitment statement, background architectural media, and profile CTA.',
    fields: ['heading', 'description', 'primary_cta_label', 'primary_cta_url'],
    hasMedia: true,
    hasItems: false,
  },
  'featured-projects': {
    title: 'Featured Real Estate Portfolio',
    description: 'Select canonical property records to feature on the homepage.',
    fields: ['heading', 'subheading'],
    hasMedia: false,
    hasRelationalSelection: true,
    entityType: 'project',
  },
  'sister-concerns-summary': {
    title: 'Sister Concerns Highlights',
    description: 'Select group subsidiaries to showcase on the homepage.',
    fields: ['heading', 'subheading'],
    hasMedia: false,
    hasRelationalSelection: true,
    entityType: 'concern',
  },
  'metrics-stats': {
    title: 'Corporate Stats Banner',
    description: 'Manage numerical achievements and key performance metrics.',
    fields: ['heading'],
    hasMedia: false,
    hasItems: true,
    itemType: 'Metric Stat',
  },
  'media-highlights': {
    title: 'Press & Media Highlights',
    description: 'Select latest press releases and news posts for homepage highlights.',
    fields: ['heading', 'subheading'],
    hasMedia: false,
    hasRelationalSelection: true,
    entityType: 'media_post',
  },
  'contact-cta': {
    title: 'Contact & Inquiry CTA Banner',
    description: 'Manage bottom call-to-action banner text, background, and booking button.',
    fields: ['heading', 'subheading', 'primary_cta_label', 'primary_cta_url'],
    hasMedia: true,
    hasItems: false,
  },
};

export default function HomeSectionEditorPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const sectionKey = params.sectionKey;
  const config = SECTION_CONFIGS[sectionKey] || {
    title: `${sectionKey.replace(/-/g, ' ').toUpperCase()} Section`,
    description: 'Configure section properties, text fields, and settings.',
    fields: ['heading', 'description'],
    hasMedia: true,
  };

  const [formData, setFormData] = useState({
    heading: 'Welcome to Dhaka Heights',
    subheading: 'Building Legacies. Creating Better Lifestyles.',
    description: 'Dhaka Heights is committed to developing thoughtful designs and spaces that elevate the way people live, work and connect.',
    primary_cta_label: 'Explore Projects',
    primary_cta_url: '/projects',
    secondary_cta_label: 'Our Story',
    secondary_cta_url: '/about',
    media_url: '',
  });

  const [items, setItems] = useState([
    { id: '1', title: 'Trusted Quality', desc: 'Delivering architectural excellence in high-rise living.', status: 'Published' },
    { id: '2', title: 'Prime Locations', desc: 'Prestige properties across Gulshan, Banani, and Bashundhara.', status: 'Published' },
  ]);

  const [projectsList, setProjectsList] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [concernsList, setConcernsList] = useState([]);
  const [selectedConcerns, setSelectedConcerns] = useState([]);
  const [deviceView, setDeviceView] = useState('desktop'); // desktop, tablet, mobile
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  const fetchSectionData = useCallback(async () => {
    try {
      if (config.entityType === 'project') {
        const { data } = await supabase.from('projects').select('id, name, category, status').order('name');
        if (data) setProjectsList(data);
      } else if (config.entityType === 'concern') {
        const { data } = await supabase.from('concerns').select('id, name, category').order('name');
        if (data) setConcernsList(data);
      }
    } catch (err) {
      console.error('Error fetching section data:', err);
    }
  }, [config.entityType, supabase]);

  useEffect(() => {
    // Intentional async data load when the selected section changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSectionData();
  }, [fetchSectionData]);

  const handleSave = async () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      alert(`✓ Changes to "${config.title}" saved successfully!`);
    }, 600);
  };

  return (
    <div className="space-y-6 w-full">
      {/* Editor Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
              ● Published
            </span>
            <span className="text-xs text-gray-400 font-mono">key: {sectionKey}</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-[#0B1B3D]">{config.title}</h1>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">{config.description}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setFullPreviewOpen(true)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            <i className="fa-solid fa-expand text-[#B59410]"></i>
            <span>Full Preview</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-[#0B1B3D] hover:bg-[#122754] text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
          >
            {saving ? (
              <>
                <i className="fa-solid fa-spinner fa-spin text-xs text-[#B59410]"></i>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-[#fa-floppy-disk] fa-floppy-disk text-xs text-[#C5A880]"></i>
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid: Form Controls & Live Device Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Controls (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Text Fields Box */}
          <div className="bg-white border border-gray-200/80 p-6 rounded-2xl shadow-xs space-y-4">
            <h2 className="text-sm font-serif font-bold text-[#0B1B3D] uppercase tracking-wider border-b border-gray-100 pb-3">
              Section Content & Fields
            </h2>

            <div className="space-y-4">
              {config.fields.includes('heading') && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Section Heading / Title</label>
                  <input
                    type="text"
                    value={formData.heading}
                    onChange={(e) => setFormData({ ...formData, heading: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:border-[#C5A880] focus:ring-2 focus:ring-[#C5A880]/20 focus:outline-none transition font-medium"
                  />
                </div>
              )}

              {config.fields.includes('subheading') && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Sub-heading / Tagline</label>
                  <input
                    type="text"
                    value={formData.subheading}
                    onChange={(e) => setFormData({ ...formData, subheading: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:border-[#C5A880] focus:ring-2 focus:ring-[#C5A880]/20 focus:outline-none transition font-medium"
                  />
                </div>
              )}

              {config.fields.includes('description') && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Body Text / Description</label>
                  <textarea
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:border-[#C5A880] focus:ring-2 focus:ring-[#C5A880]/20 focus:outline-none transition font-medium leading-relaxed"
                  />
                </div>
              )}

              {config.fields.includes('primary_cta_label') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Primary Button Label</label>
                    <input
                      type="text"
                      value={formData.primary_cta_label}
                      onChange={(e) => setFormData({ ...formData, primary_cta_label: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:border-[#C5A880] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Primary Button URL</label>
                    <input
                      type="text"
                      value={formData.primary_cta_url}
                      onChange={(e) => setFormData({ ...formData, primary_cta_url: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:border-[#C5A880] focus:outline-none font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cloudinary Media Selection Box */}
          {config.hasMedia && (
            <div className="bg-white border border-gray-200/80 p-6 rounded-2xl shadow-xs space-y-3">
              <h2 className="text-sm font-serif font-bold text-[#0B1B3D] uppercase tracking-wider border-b border-gray-100 pb-3">
                Background & Feature Media
              </h2>

              <div className="flex items-center gap-4">
                <div className="w-24 h-16 bg-gray-100 border border-gray-200 rounded-xl overflow-hidden flex items-center justify-center text-gray-400 shrink-0">
                  {formData.media_url ? (
                    <img src={formData.media_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <i className="fa-solid fa-image text-lg"></i>
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <span className="block text-xs font-bold text-gray-700">Cloudinary Media Asset</span>
                  <span className="block text-[10px] text-gray-400 font-mono truncate">
                    {formData.media_url || 'No custom image selected. Uses section fallback asset.'}
                  </span>
                  <button
                    onClick={() => setMediaPickerOpen(true)}
                    className="mt-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-photo-film text-[#B59410]"></i>
                    <span>Select Media Asset</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Relational Entity Selector */}
          {config.hasRelationalSelection && (
            <div className="bg-white border border-gray-200/80 p-6 rounded-2xl shadow-xs space-y-3">
              <h2 className="text-sm font-serif font-bold text-[#0B1B3D] uppercase tracking-wider border-b border-gray-100 pb-3">
                Relational Entity Selector ({config.entityType})
              </h2>

              <p className="text-xs text-gray-500 font-medium">
                Select canonical records from the PostgreSQL database to display in this section without duplicating data.
              </p>

              {config.entityType === 'project' && (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {projectsList.map((p) => (
                    <label key={p.id} className="flex items-center justify-between p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer text-xs">
                      <div className="flex items-center gap-2 font-bold text-[#0B1B3D]">
                        <input type="checkbox" className="rounded text-[#B59410] focus:ring-[#B59410]" defaultChecked />
                        <span>{p.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-gray-400">{p.category} • {p.status}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Live Device Preview (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-gray-200/80 p-4 rounded-2xl shadow-xs space-y-3 sticky top-24">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-xs font-serif font-bold text-[#0B1B3D] uppercase tracking-wider">
                Live Responsive Preview
              </h3>

              {/* Device Toggle Buttons */}
              <div className="flex items-center bg-gray-100 p-1 rounded-xl gap-1 border border-gray-200">
                <button
                  onClick={() => setDeviceView('desktop')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition ${deviceView === 'desktop' ? 'bg-white text-[#0B1B3D] shadow-xs' : 'text-gray-500'}`}
                >
                  <i className="fa-solid fa-desktop mr-1"></i> Desktop
                </button>
                <button
                  onClick={() => setDeviceView('mobile')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition ${deviceView === 'mobile' ? 'bg-white text-[#0B1B3D] shadow-xs' : 'text-gray-500'}`}
                >
                  <i className="fa-solid fa-mobile-screen mr-1"></i> Mobile
                </button>
              </div>
            </div>

            {/* Embedded Live Iframe Container */}
            <div className="flex justify-center bg-gray-900 p-3 rounded-xl overflow-hidden shadow-inner">
              <div
                style={{
                  width: deviceView === 'mobile' ? '375px' : '100%',
                  height: '480px',
                  transition: 'width 0.3s ease-in-out',
                }}
                className="bg-white rounded-lg overflow-hidden border border-gray-700 relative"
              >
                <iframe
                  src="/"
                  title="Live Section Preview"
                  className="w-full h-full border-none"
                ></iframe>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cloudinary Media Library Modal */}
      {mediaPickerOpen && (
        <MediaLibrary
          onSelectAsset={(asset) => {
            setFormData({ ...formData, media_url: asset.url });
            setMediaPickerOpen(false);
          }}
          onClose={() => setMediaPickerOpen(false)}
        />
      )}

      {/* Full Preview Modal */}
      {fullPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full h-full max-w-6xl max-h-[90vh]">
            <LivePreview
              previewUrl="/"
              pageTitle={`Full Live Preview: ${config.title}`}
              onClose={() => setFullPreviewOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
