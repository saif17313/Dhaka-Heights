'use client';

import React, { useCallback, useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import MediaLibrary from '@/components/admin/MediaLibrary';

const CATEGORY_META = {
  news: { label: 'Press Releases & News', categoryFilter: ['Press Release', 'News', 'Corporate'], icon: 'fa-bullhorn', color: 'bg-[#0B1B3D] text-[#C5A880]' },
  articles: { label: 'Blogs & Editorial Articles', categoryFilter: ['Blog', 'Article', 'Insight'], icon: 'fa-feather-pointed', color: 'bg-emerald-100 text-emerald-800' },
};

export default function AdminFilteredMediaPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const categoryKey = (params.categoryKey || 'news').toLowerCase();
  const meta = CATEGORY_META[categoryKey] || { label: `${categoryKey.toUpperCase()} Content`, categoryFilter: [categoryKey], icon: 'fa-newspaper', color: 'bg-gray-100 text-gray-800' };

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  const fetchFilteredMediaPosts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('media_posts')
        .select('*')
        .order('published_date', { ascending: false });

      if (!error && data) {
        // Filter by category group
        const filtered = data.filter((p) => {
          const cat = (p.category || '').toLowerCase();
          if (categoryKey === 'news') return cat.includes('press') || cat.includes('news') || cat.includes('corporate');
          if (categoryKey === 'articles') return cat.includes('blog') || cat.includes('article') || cat.includes('insight');
          return cat === categoryKey;
        });
        setPosts(filtered.length > 0 ? filtered : data);
      }
    } catch (err) {
      console.error('Error fetching filtered media posts:', err);
    } finally {
      setLoading(false);
    }
  }, [categoryKey, supabase]);

  useEffect(() => {
    // Intentional async data load for the selected media category.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFilteredMediaPosts();
  }, [fetchFilteredMediaPosts]);

  const handleDelete = async (id, title) => {
    if (!confirm(`Are you sure you want to delete post "${title}"?`)) return;
    try {
      const { error } = await supabase.from('media_posts').delete().eq('id', id);
      if (error) throw error;
      fetchFilteredMediaPosts();
    } catch (err) {
      alert('Error deleting post: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#B59410] text-xl shadow-xs shrink-0">
            <i className={`fa-solid ${meta.icon}`}></i>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${meta.color}`}>
                ● Filter: {categoryKey}
              </span>
              <span className="text-xs text-gray-400 font-mono">Media & Articles</span>
            </div>
            <h1 className="text-2xl font-serif font-bold text-[#0B1B3D]">{meta.label}</h1>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">
              Filtered editorial posts, press coverage, and blog articles.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/articles"
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-2"
          >
            <i className="fa-solid fa-layer-group"></i>
            <span>All Articles</span>
          </Link>
        </div>
      </div>

      {/* Posts List Grid */}
      <div className="bg-white border border-gray-200/80 p-6 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h2 className="text-sm font-serif font-bold text-[#0B1B3D] uppercase tracking-wider">
            {meta.label} ({posts.length})
          </h2>
          <span className="text-xs text-gray-400 font-mono">Live Supabase Storage</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-gray-400 font-medium">
            <i className="fa-solid fa-spinner fa-spin text-lg text-[#B59410] mb-2 block"></i>
            Loading media posts...
          </div>
        ) : posts.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400 font-medium space-y-2">
            <i className="fa-solid fa-newspaper text-2xl text-gray-300 block"></i>
            <span>No posts found for category filter &quot;{categoryKey}&quot;.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posts.map((p) => (
              <div
                key={p.id || p.slug}
                className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3 hover:border-[#C5A880] shadow-xs hover:shadow-md transition group flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                      {p.category || 'News'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">{p.published_date || 'Recent'}</span>
                  </div>

                  <h3 className="text-base font-serif font-bold text-[#0B1B3D] group-hover:text-[#B59410] transition">
                    {p.title}
                  </h3>

                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                    {p.excerpt || p.content_body || 'Corporate news coverage and press release overview.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <Link
                    href={`/admin/media/detail/${p.slug}`}
                    className="px-3.5 py-1.5 bg-gray-100 hover:bg-[#0B1B3D] hover:text-white text-gray-700 rounded-xl text-xs font-bold transition"
                  >
                    Edit Detail
                  </Link>

                  <button
                    onClick={() => handleDelete(p.id, p.title)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-xl text-xs transition"
                    title="Delete Post"
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
