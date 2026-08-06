'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import LivePreview from '@/components/admin/LivePreview';

const HOME_SECTION_INVENTORY = [
  {
    key: 'hero-slider',
    name: 'Hero Slider',
    description: 'Five-slide Home banner, calls to action, visibility, timing, and Cloudinary media.',
    phase: 'Phase 1A',
    editorAvailable: true,
    actionLabel: 'Edit Hero',
  },
  {
    key: 'about-corporate-home',
    name: 'About Corporate Block',
    description: 'Corporate introduction, two calls to action, and the two-image composition.',
    phase: 'Phase 1B',
    editorAvailable: true,
    actionLabel: 'Edit About',
  },
  {
    key: 'statistics-counter',
    name: 'Statistics Counter',
    description: 'Four animated business statistics with labels, supporting copy, and icons.',
    phase: 'Phase 1C',
    editorAvailable: true,
    actionLabel: 'Edit Statistics',
  },
  {
    key: 'featured-projects-home',
    name: 'Featured Projects',
    description: 'Ordered Home placements backed by canonical project records.',
    phase: 'Phase 1D',
    editorAvailable: true,
    actionLabel: 'Edit Projects',
  },
  {
    key: 'commitment-quote',
    name: 'Commitment Quote',
    description: 'Board quotation and attribution shown between projects and media.',
    phase: 'Phase 1E',
    editorAvailable: true,
    actionLabel: 'Edit Quote',
  },
  {
    key: 'media-highlights-home',
    name: 'Media Highlights',
    description: 'Ordered Home placements backed by canonical media posts.',
    phase: 'Phase 1F',
    editorAvailable: true,
    actionLabel: 'Edit Media',
  },
  {
    key: 'partners-carousel',
    name: 'Partners Carousel',
    description: 'Eight canonical partners used to generate the continuous visual loop.',
    phase: 'Phase 1G',
    editorAvailable: true,
    actionLabel: 'Edit Partners',
  },
  {
    key: 'contact-section-home',
    name: 'Contact Section',
    description: 'Home contact copy, details, form options, and inquiry submission.',
    phase: 'Phase 1H',
    editorAvailable: true,
    actionLabel: 'Edit Contact',
  },
];

function sectionBadge(section) {
  if (!section.record) {
    return { label: 'Planned', className: 'bg-slate-100 text-slate-600' };
  }
  if (section.record.status === 'draft') {
    return { label: 'Draft', className: 'bg-amber-100 text-amber-800' };
  }
  if (!section.record.is_visible) {
    return { label: 'Published · Hidden', className: 'bg-blue-100 text-blue-800' };
  }
  return { label: 'Published', className: 'bg-emerald-100 text-emerald-800' };
}

export default function AdminHomePageOverview() {
  const [sections, setSections] = useState(() => HOME_SECTION_INVENTORY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activePreview, setActivePreview] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSections() {
      const supabase = createClient();
      setLoading(true);
      setLoadError('');

      try {
        const { data: page, error: pageError } = await supabase
          .from('pages')
          .select('id')
          .eq('slug', 'home')
          .single();

        if (pageError) throw pageError;

        const { data: records, error: sectionError } = await supabase
          .from('page_sections')
          .select('id, section_key, section_name, description, status, version_number, is_visible, updated_at')
          .eq('page_id', page.id)
          .order('version_number', { ascending: false });

        if (sectionError) throw sectionError;

        const currentByKey = new Map();
        const statusPriority = { draft: 3, published: 2, archived: 1 };
        for (const record of records || []) {
          const current = currentByKey.get(record.section_key);
          if (
            !current
            || (statusPriority[record.status] || 0) > (statusPriority[current.status] || 0)
          ) {
            currentByKey.set(record.section_key, record);
          }
        }

        if (!cancelled) {
          setSections(HOME_SECTION_INVENTORY.map((section) => ({
            ...section,
            record: currentByKey.get(section.key) || null,
          })));
        }
      } catch (error) {
        if (!cancelled) {
          setSections(HOME_SECTION_INVENTORY);
          setLoadError(error instanceof Error ? error.message : 'Home sections could not be loaded.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSections();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-gray-200/80 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-xl text-[#B59410] shadow-xs">
            <i className="fa-solid fa-house"></i>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Public route
              </span>
              <span className="font-mono text-xs text-gray-400">/</span>
            </div>
            <h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Home Page Management</h1>
            <p className="mt-0.5 text-xs font-medium text-gray-500">
              The section list mirrors the current public Home page. All page-level Home sections are dynamic.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActivePreview(true)}
            className="flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-200"
          >
            <i className="fa-solid fa-eye text-[#B59410]"></i>
            <span>Preview published page</span>
          </button>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#122754]"
          >
            <span>Visit live page</span>
            <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
          </a>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700" role="alert">
          Database state could not be loaded: {loadError}
        </div>
      )}

      <section className="space-y-4 rounded-2xl border border-gray-200/80 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h2 className="font-serif text-sm font-bold uppercase tracking-wider text-[#0B1B3D]">
            Current Home sections ({HOME_SECTION_INVENTORY.length})
          </h2>
          <span className="font-mono text-xs text-gray-400">Canonical public order</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs font-medium text-gray-400">
            <i className="fa-solid fa-spinner fa-spin mb-2 block text-lg text-[#B59410]"></i>
            Loading saved section state…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {sections.map((section, index) => {
              const badge = sectionBadge(section);
              return (
                <article key={section.key} className="group flex flex-col justify-between space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition hover:border-[#C5A880] hover:shadow-md">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded border border-amber-200/60 bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-bold text-[#B59410]">
                        {String(index + 1).padStart(2, '0')} · {section.key}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <h3 className="font-serif text-base font-bold text-[#0B1B3D] transition group-hover:text-[#B59410]">{section.name}</h3>
                    <p className="text-xs leading-relaxed text-gray-600">{section.description}</p>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                    <span className="font-mono text-[10px] text-gray-400">
                      {section.record
                        ? `v${section.record.version_number} · ${new Date(section.record.updated_at).toLocaleDateString()}`
                        : section.phase}
                    </span>
                    {section.editorAvailable ? (
                      <Link href={`/admin/pages/home/sections/${section.key}`} className="flex items-center gap-2 rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#122754]">
                        <span>{section.actionLabel || 'Edit section'}</span>
                        <i className="fa-solid fa-arrow-right text-[10px]"></i>
                      </Link>
                    ) : (
                      <span className="rounded-xl bg-slate-100 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Planned phase</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {activePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="h-full max-h-[90vh] w-full max-w-6xl">
            <LivePreview
              previewUrl="/"
              pageTitle="Published Home Page Preview"
              onClose={() => setActivePreview(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
