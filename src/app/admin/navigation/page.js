'use client';

import React from 'react';
import Link from 'next/link';

export default function AdminNavigationOverviewPage() {
  return (
    <div className="space-y-6 w-full">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#B59410] text-xl shadow-xs shrink-0">
            <i className="fa-solid fa-sitemap"></i>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                ● Configured
              </span>
              <span className="text-xs text-gray-400 font-mono">Global Shell Structure</span>
            </div>
            <h1 className="text-2xl font-serif font-bold text-[#0B1B3D]">Navigation & Footer Link Management</h1>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">
              Manage public website navigation bar links, menu ordering, footer column links, copyright statements, and social channels.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Header Main Menu Editor Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 hover:border-[#C5A880] shadow-xs hover:shadow-md transition group flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#B59410] text-lg">
                <i className="fa-solid fa-compass"></i>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                ● Active
              </span>
            </div>

            <h2 className="text-lg font-serif font-bold text-[#0B1B3D] group-hover:text-[#B59410] transition">
              Header Main Menu Links
            </h2>

            <p className="text-xs text-gray-600 leading-relaxed">
              Configure the top navigation bar items (Home, About Us, Projects, Sister Concerns, Media Center, Career, Contact Us), custom target routes, and display ordering.
            </p>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[10px] text-gray-400 font-mono">Route: /admin/navigation/header</span>
            <Link
              href="/admin/navigation/header"
              className="px-4 py-2 bg-[#0B1B3D] hover:bg-[#122754] text-white rounded-xl text-xs font-bold transition flex items-center gap-2"
            >
              <span>Edit Header Menu</span>
              <i className="fa-solid fa-arrow-right text-[10px]"></i>
            </Link>
          </div>
        </div>

        {/* Footer Structure Editor Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 hover:border-[#C5A880] shadow-xs hover:shadow-md transition group flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#B59410] text-lg">
                <i className="fa-solid fa-sitemap"></i>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                ● Active
              </span>
            </div>

            <h2 className="text-lg font-serif font-bold text-[#0B1B3D] group-hover:text-[#B59410] transition">
              Footer Structure & Credentials
            </h2>

            <p className="text-xs text-gray-600 leading-relaxed">
              Manage corporate copyright statement, headquarters location info, hotline numbers, sales emails, and official social channel links (Facebook, LinkedIn, YouTube).
            </p>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[10px] text-gray-400 font-mono">Route: /admin/navigation/footer</span>
            <Link
              href="/admin/navigation/footer"
              className="px-4 py-2 bg-[#0B1B3D] hover:bg-[#122754] text-white rounded-xl text-xs font-bold transition flex items-center gap-2"
            >
              <span>Edit Footer Links</span>
              <i className="fa-solid fa-arrow-right text-[10px]"></i>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
