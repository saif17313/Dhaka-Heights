'use client';

import { useEffect, useRef, useState } from 'react';

// Curated Font Awesome 6 Free Solid icons relevant to a real-estate /
// construction / corporate-group site. Every admin "icon" field across the
// codebase stores a plain "fa-xxx" class string, so this picker just needs
// to hand back that same string.
export const FA_ICON_LIBRARY = [
  { key: 'fa-building', label: 'Building', group: 'Architecture' },
  { key: 'fa-city', label: 'City / Skyline', group: 'Architecture' },
  { key: 'fa-house', label: 'House', group: 'Architecture' },
  { key: 'fa-house-chimney', label: 'Residential Home', group: 'Architecture' },
  { key: 'fa-hotel', label: 'Hotel / Suites', group: 'Architecture' },
  { key: 'fa-warehouse', label: 'Warehouse', group: 'Architecture' },
  { key: 'fa-industry', label: 'Industry / Factory', group: 'Architecture' },
  { key: 'fa-landmark', label: 'Landmark', group: 'Architecture' },
  { key: 'fa-store', label: 'Retail / Store', group: 'Architecture' },
  { key: 'fa-school', label: 'School', group: 'Architecture' },
  { key: 'fa-hospital', label: 'Hospital', group: 'Architecture' },
  { key: 'fa-building-columns', label: 'Institution', group: 'Architecture' },

  { key: 'fa-hard-hat', label: 'Construction', group: 'Engineering' },
  { key: 'fa-compass-drafting', label: 'Design & Drafting', group: 'Engineering' },
  { key: 'fa-ruler-combined', label: 'Floor Plan', group: 'Engineering' },
  { key: 'fa-ruler', label: 'Measurement', group: 'Engineering' },
  { key: 'fa-hammer', label: 'Building Work', group: 'Engineering' },
  { key: 'fa-screwdriver-wrench', label: 'Maintenance', group: 'Engineering' },
  { key: 'fa-toolbox', label: 'Tools', group: 'Engineering' },
  { key: 'fa-gears', label: 'Operations', group: 'Engineering' },
  { key: 'fa-trowel-bricks', label: 'Masonry', group: 'Engineering' },
  { key: 'fa-vector-square', label: 'Blueprint', group: 'Engineering' },

  { key: 'fa-shield-halved', label: 'Safety & Compliance', group: 'Safety' },
  { key: 'fa-user-shield', label: 'Security', group: 'Safety' },
  { key: 'fa-clipboard-check', label: 'Quality Check', group: 'Safety' },
  { key: 'fa-clipboard-list', label: 'Inspection', group: 'Safety' },
  { key: 'fa-circle-check', label: 'Verified', group: 'Safety' },
  { key: 'fa-award', label: 'Certification', group: 'Safety' },
  { key: 'fa-certificate', label: 'Certificate', group: 'Safety' },
  { key: 'fa-medal', label: 'Award', group: 'Safety' },
  { key: 'fa-trophy', label: 'Achievement', group: 'Safety' },

  { key: 'fa-bolt', label: 'Power', group: 'Utilities' },
  { key: 'fa-plug', label: 'Electrical', group: 'Utilities' },
  { key: 'fa-solar-panel', label: 'Solar Energy', group: 'Utilities' },
  { key: 'fa-sun', label: 'Renewable Energy', group: 'Utilities' },
  { key: 'fa-leaf', label: 'Sustainability', group: 'Utilities' },
  { key: 'fa-recycle', label: 'Recycling', group: 'Utilities' },
  { key: 'fa-water', label: 'Water Supply', group: 'Utilities' },
  { key: 'fa-fire', label: 'Fire Safety', group: 'Utilities' },
  { key: 'fa-gauge', label: 'Performance', group: 'Utilities' },
  { key: 'fa-battery-full', label: 'Backup Power', group: 'Utilities' },

  { key: 'fa-ship', label: 'Maritime', group: 'Logistics' },
  { key: 'fa-anchor', label: 'Port / Dock', group: 'Logistics' },
  { key: 'fa-truck', label: 'Transport', group: 'Logistics' },
  { key: 'fa-truck-fast', label: 'Fast Delivery', group: 'Logistics' },
  { key: 'fa-boxes-stacked', label: 'Storage / Cargo', group: 'Logistics' },
  { key: 'fa-route', label: 'Logistics Route', group: 'Logistics' },
  { key: 'fa-plane', label: 'Air Freight', group: 'Logistics' },
  { key: 'fa-car', label: 'Vehicle', group: 'Logistics' },

  { key: 'fa-briefcase', label: 'Business', group: 'Corporate' },
  { key: 'fa-handshake', label: 'Partnership', group: 'Corporate' },
  { key: 'fa-users', label: 'Team', group: 'Corporate' },
  { key: 'fa-user-tie', label: 'Management', group: 'Corporate' },
  { key: 'fa-chart-line', label: 'Growth', group: 'Corporate' },
  { key: 'fa-chart-pie', label: 'Analytics', group: 'Corporate' },
  { key: 'fa-money-bill-trend-up', label: 'Finance', group: 'Corporate' },
  { key: 'fa-sack-dollar', label: 'Investment', group: 'Corporate' },
  { key: 'fa-scale-balanced', label: 'Legal', group: 'Corporate' },
  { key: 'fa-file-contract', label: 'Contracts', group: 'Corporate' },
  { key: 'fa-file-shield', label: 'Risk & Compliance', group: 'Corporate' },
  { key: 'fa-lightbulb', label: 'Innovation', group: 'Corporate' },
  { key: 'fa-rocket', label: 'Growth Strategy', group: 'Corporate' },
  { key: 'fa-globe', label: 'Global Reach', group: 'Corporate' },

  { key: 'fa-palette', label: 'Design Palette', group: 'Interior' },
  { key: 'fa-paint-roller', label: 'Interior Finishing', group: 'Interior' },
  { key: 'fa-couch', label: 'Interior Furnishing', group: 'Interior' },
  { key: 'fa-swatchbook', label: 'Material Selection', group: 'Interior' },
  { key: 'fa-pen-ruler', label: 'Interior Planning', group: 'Interior' },

  { key: 'fa-phone', label: 'Phone', group: 'Contact' },
  { key: 'fa-envelope', label: 'Email', group: 'Contact' },
  { key: 'fa-location-dot', label: 'Location', group: 'Contact' },
  { key: 'fa-map', label: 'Map', group: 'Contact' },
  { key: 'fa-headset', label: 'Support', group: 'Contact' },
  { key: 'fa-comments', label: 'Customer Relations', group: 'Contact' },
  { key: 'fa-bullhorn', label: 'Marketing', group: 'Contact' },
];

// Brand icons (social/platform logos) live in a separate Font Awesome font
// family ("fa-brands") and must not be mixed with the solid icons above.
export const FA_BRAND_ICON_LIBRARY = [
  { key: 'fa-facebook-f', label: 'Facebook', group: 'Social' },
  { key: 'fa-instagram', label: 'Instagram', group: 'Social' },
  { key: 'fa-linkedin-in', label: 'LinkedIn', group: 'Social' },
  { key: 'fa-x-twitter', label: 'X (Twitter)', group: 'Social' },
  { key: 'fa-youtube', label: 'YouTube', group: 'Social' },
  { key: 'fa-tiktok', label: 'TikTok', group: 'Social' },
  { key: 'fa-pinterest-p', label: 'Pinterest', group: 'Social' },
  { key: 'fa-snapchat', label: 'Snapchat', group: 'Social' },
  { key: 'fa-whatsapp', label: 'WhatsApp', group: 'Messaging' },
  { key: 'fa-telegram', label: 'Telegram', group: 'Messaging' },
  { key: 'fa-google', label: 'Google', group: 'Web' },
  { key: 'fa-wordpress', label: 'WordPress', group: 'Web' },
  { key: 'fa-vimeo-v', label: 'Vimeo', group: 'Web' },
  { key: 'fa-behance', label: 'Behance', group: 'Web' },
  { key: 'fa-dribbble', label: 'Dribbble', group: 'Web' },
  { key: 'fa-github', label: 'GitHub', group: 'Web' },
];

export default function FontAwesomeIconPicker({ value, onChange, error, library = 'solid' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const family = library === 'brands' ? 'fa-brands' : 'fa-solid';
  const icons = library === 'brands' ? FA_BRAND_ICON_LIBRARY : FA_ICON_LIBRARY;
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const query = search.trim().toLowerCase();
  const filtered = query
    ? icons.filter(
        (item) => item.label.toLowerCase().includes(query) || item.key.toLowerCase().includes(query) || item.group.toLowerCase().includes(query),
      )
    : icons;

  const select = (key) => {
    onChange(key);
    setOpen(false);
    setSearch('');
    setCustomMode(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <span className="mb-1.5 block text-[11px] font-bold text-slate-700">Icon</span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none transition focus:border-[#C5A880] focus:ring-2 focus:ring-[#C5A880]/20 ${error ? 'border-red-300' : 'border-slate-200'}`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0B1B3D] text-white">
          <i className={`${value ? family : 'fa-solid'} ${value || 'fa-circle-question'}`} />
        </span>
        <span className="flex-1 truncate text-left">{value || 'Choose an icon'}</span>
        <i className="fa-solid fa-chevron-down text-[10px] text-slate-400" />
      </button>
      {error && <span className="mt-1 block text-[10px] font-semibold text-red-600">{error}</span>}

      {open && (
        <div className="absolute z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search icons…"
            className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#C5A880]"
          />
          <div className="grid max-h-56 grid-cols-5 gap-1.5 overflow-y-auto pr-1">
            {filtered.map((item) => (
              <button
                key={item.key}
                type="button"
                title={item.label}
                onClick={() => select(item.key)}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-[9px] ${value === item.key ? 'border-[#C5A880] bg-amber-50 text-[#0B1B3D]' : 'border-slate-100 text-slate-500 hover:border-slate-300'}`}
              >
                <i className={`${family} ${item.key} text-sm`} />
                <span className="w-full truncate text-center">{item.label}</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="col-span-5 py-4 text-center text-[11px] text-slate-400">No icons match &ldquo;{search}&rdquo;.</p>}
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2">
            {customMode ? (
              <input
                autoFocus
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="fa-custom-icon-name"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono outline-none focus:border-[#C5A880]"
              />
            ) : (
              <button type="button" onClick={() => setCustomMode(true)} className="text-[10px] font-bold text-[#B59410]">
                Can&rsquo;t find it? Enter a custom Font Awesome class →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
