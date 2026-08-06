'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import LivePreview from '@/components/admin/LivePreview';

export default function AdminPagesPage() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePreview, setActivePreview] = useState(null);

  const supabase = useMemo(() => createClient(), []);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pages')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        setPages(data);
      } else {
        setPages([
          { id: '1', title: 'Homepage', slug: 'home', route: '/', is_published: true },
          { id: '2', title: 'About Us', slug: 'about', route: '/about', is_published: true },
          { id: '3', title: 'Projects Portfolio', slug: 'projects', route: '/projects', is_published: true },
          { id: '4', title: 'Sister Concerns', slug: 'concern', route: '/concern/dhaka-heights-developments-limited', is_published: true },
          { id: '5', title: 'Media Center', slug: 'media-center', route: '/media-center', is_published: true },
          { id: '6', title: 'Career Opportunities', slug: 'career', route: '/career', is_published: true },
          { id: '7', title: 'Contact Us', slug: 'contact', route: '/contact', is_published: true },
        ]);
      }
    } catch (err) {
      console.error('Error fetching pages:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // Intentional async initial page inventory load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPages();
  }, [fetchPages]);

  return (
    <div className="space-y-6 w-full">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 text-xl shadow-xs shrink-0">
            <i className="fa-solid fa-layer-group"></i>
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-[#0B1B3D]">Website Pages & Sections</h1>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">
              Manage page layouts, section ordering, hero banners, and live website previews.
            </p>
          </div>
        </div>
      </div>

      {/* Configured Pages Grid */}
      <div className="bg-white border border-gray-200/80 p-6 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h2 className="text-sm font-serif font-bold text-[#0B1B3D] uppercase tracking-wider">
            Configured Public Website Pages ({pages.length})
          </h2>
          <span className="text-xs text-gray-400 font-mono">Live Supabase Storage</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-gray-400 font-medium">
            <i className="fa-solid fa-spinner fa-spin text-lg text-[#B59410] mb-2 block"></i>
            Loading website pages...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pages.map((p) => {
              const routePath = p.route || (p.slug === 'home' ? '/' : `/${p.slug}`);
              return (
                <div
                  key={p.id || p.slug}
                  className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3 hover:border-[#C5A880] shadow-xs hover:shadow-md transition group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                        ● {p.is_published ? 'Published' : 'Draft'}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">{routePath}</span>
                    </div>

                    <h3 className="text-base font-serif font-bold text-[#0B1B3D] group-hover:text-[#B59410] transition">
                      {p.title}
                    </h3>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setActivePreview({ title: p.title, route: routePath })}
                      className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-eye text-[#B59410]"></i>
                      <span>Live Preview</span>
                    </button>

                    <a
                      href={routePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 bg-[#0B1B3D] hover:bg-[#122754] text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
                    >
                      <span>Visit</span>
                      <i className="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live Preview Modal Overlay */}
      {activePreview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full h-full max-w-6xl max-h-[90vh]">
            <LivePreview
              previewUrl={activePreview.route}
              pageTitle={`Live Preview: ${activePreview.title}`}
              onClose={() => setActivePreview(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
