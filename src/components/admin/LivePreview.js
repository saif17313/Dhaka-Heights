'use client';

import React, { useState } from 'react';

const VIEWPORTS = [
  { id: 'desktop', label: 'Desktop', width: 1440, icon: 'fa-desktop' },
  { id: 'tablet', label: 'Tablet', width: 1024, icon: 'fa-tablet-screen-button' },
  { id: 'mobile', label: 'Mobile', width: 390, icon: 'fa-mobile-screen-button' },
];

export default function LivePreview({
  previewUrl = '/',
  pageTitle = 'Page Preview',
  onClose,
}) {
  const [viewport, setViewport] = useState('desktop');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentViewport = VIEWPORTS.find((v) => v.id === viewport) || VIEWPORTS[0];

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="live-preview-wrapper bg-[#07132B] text-white flex flex-col h-full rounded-2xl border border-[#C5A880]/30 shadow-2xl overflow-hidden">
      {/* Top Controls Bar */}
      <div className="px-4 py-2.5 bg-[#0D1E42] border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Title & Refresh */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-[#C5A880] tracking-wide flex items-center gap-1.5">
            <i className="fa-solid fa-eye"></i>
            <span>{pageTitle}</span>
          </span>

          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
            <i className="fa-solid fa-bolt text-[9px] animate-pulse"></i>
            <span>DRAFT PREVIEW MODE</span>
          </span>

          <button
            onClick={handleRefresh}
            className="p-1 px-2 bg-gray-900 hover:bg-gray-800 text-gray-300 text-xs rounded border border-gray-800 transition"
            title="Refresh Preview"
          >
            <i className={`fa-solid fa-rotate-right ${isRefreshing ? 'animate-spin' : ''}`}></i>
          </button>
        </div>

        {/* Center: Viewport Switcher */}
        <div className="flex items-center bg-gray-950 p-1 rounded-xl border border-gray-800 gap-1">
          {VIEWPORTS.map((v) => (
            <button
              key={v.id}
              onClick={() => setViewport(v.id)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition flex items-center gap-1.5 ${
                viewport === v.id
                  ? 'bg-[#C5A880] text-black font-semibold shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <i className={`fa-solid ${v.icon}`}></i>
              <span>{v.label}</span>
              <span className="text-[9px] opacity-70">({v.width}px)</span>
            </button>
          ))}
        </div>

        {/* Right: Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="px-2.5 py-1 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white text-xs rounded-lg border border-gray-800"
          >
            ✕ Close Preview
          </button>
        )}
      </div>

      {/* Frame Container */}
      <div className="flex-1 bg-black/60 p-4 flex justify-center overflow-auto items-start">
        <div
          style={{ width: `${currentViewport.width}px` }}
          className="transition-all duration-300 bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-800 my-auto min-h-[500px] max-h-[85vh] flex flex-col"
        >
          <iframe
            key={`${previewUrl}-${viewport}-${isRefreshing}`}
            src={previewUrl}
            className="w-full flex-1 border-0 min-h-[500px]"
            title="Live Preview"
          ></iframe>
        </div>
      </div>
    </div>
  );
}
