'use client';

import React, { useCallback, useEffect, useState } from 'react';
import * as LucideIcons from 'lucide-react';

// Allowlist of curated Lucide icon keys suitable for architectural & business UI
export const BUILTIN_ICON_ALLOWLIST = [
  { key: 'Building', label: 'Building / Tower', category: 'Architecture' },
  { key: 'Building2', label: 'Commercial Highrise', category: 'Architecture' },
  { key: 'Home', label: 'Residential Home', category: 'Architecture' },
  { key: 'Hotel', label: 'Luxury Suites', category: 'Architecture' },
  { key: 'Landmark', label: 'Corporate Landmark', category: 'Architecture' },
  { key: 'Warehouse', label: 'Depot & Storage', category: 'Architecture' },
  { key: 'Compass', label: 'Design & Engineering', category: 'Construction' },
  { key: 'Ruler', label: 'Floor Plan / Measurement', category: 'Construction' },
  { key: 'ShieldCheck', label: 'Structural Safety', category: 'Safety' },
  { key: 'ShieldAlert', label: 'Compliance Audit', category: 'Safety' },
  { key: 'Award', label: 'Certification / ISO', category: 'Badges' },
  { key: 'BadgeCheck', label: 'Accreditation', category: 'Badges' },
  { key: 'Zap', label: 'Power & Generator', category: 'Utilities' },
  { key: 'Sun', label: 'Solar Energy', category: 'Utilities' },
  { key: 'Leaf', label: 'Green / Sustainability', category: 'Utilities' },
  { key: 'Ship', label: 'Maritime Logistics', category: 'Logistics' },
  { key: 'Truck', label: 'Heavy Transport', category: 'Logistics' },
  { key: 'Briefcase', label: 'Business Solutions', category: 'Corporate' },
  { key: 'KeyRound', label: 'Realty & Handover', category: 'Corporate' },
  { key: 'PhoneCall', label: 'Hotline / Contact', category: 'Communication' },
  { key: 'Mail', label: 'Corporate Email', category: 'Communication' },
  { key: 'MapPin', label: 'Location Map', category: 'Navigation' },
];

export function RenderIcon({ iconKey, customUrl, className = 'w-5 h-5' }) {
  if (customUrl) {
    return <img src={customUrl} alt={iconKey || 'custom icon'} className={`${className} object-contain`} />;
  }

  if (iconKey && LucideIcons[iconKey]) {
    const Component = LucideIcons[iconKey];
    return <Component className={className} />;
  }

  // FontAwesome fallback support
  if (iconKey && iconKey.startsWith('fa-')) {
    return <i className={`fa-solid ${iconKey} ${className}`}></i>;
  }

  return <LucideIcons.HelpCircle className={className} />;
}

export default function IconPicker({
  value = { icon_library: 'lucide', icon_key: '', custom_url: '' },
  onChange,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('builtin');
  const [search, setSearch] = useState('');
  const [customIcons, setCustomIcons] = useState([]);
  const [loadingCustom, setLoadingCustom] = useState(false);

  const fetchCustomIcons = useCallback(async () => {
    setLoadingCustom(true);
    try {
      const res = await fetch('/api/admin/media?resourceType=image&tag=icon');
      if (res.ok) {
        const data = await res.json();
        setCustomIcons(data.assets || []);
      }
    } catch (err) {
      console.error('Failed to fetch custom icons:', err);
    } finally {
      setLoadingCustom(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'custom') {
      // Intentional async load when the custom icon tab is opened.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchCustomIcons();
    }
  }, [activeTab, fetchCustomIcons]);

  const filteredBuiltin = BUILTIN_ICON_ALLOWLIST.filter(
    (item) =>
      item.label.toLowerCase().includes(search.toLowerCase()) ||
      item.key.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectBuiltin = (key) => {
    if (onChange) {
      onChange({ icon_library: 'lucide', icon_key: key, custom_url: '' });
    }
  };

  const handleSelectCustom = (url, name) => {
    if (onChange) {
      onChange({ icon_library: 'custom', icon_key: name, custom_url: url });
    }
  };

  const handleClear = () => {
    if (onChange) {
      onChange({ icon_library: 'lucide', icon_key: '', custom_url: '' });
    }
  };

  return (
    <div className="icon-picker-container bg-[#111827] text-white p-4 rounded-lg border border-[#C5A880]/30 shadow-2xl max-w-md w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2">
        <h4 className="text-sm font-semibold text-[#C5A880]">Select Visual Icon</h4>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">
            ✕
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-3 border-b border-gray-800 pb-2">
        <button
          onClick={() => setActiveTab('builtin')}
          className={`px-3 py-1 text-xs rounded transition ${
            activeTab === 'builtin' ? 'bg-[#C5A880] text-black font-semibold' : 'bg-gray-800 text-gray-300'
          }`}
        >
          Built-in Library
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`px-3 py-1 text-xs rounded transition ${
            activeTab === 'custom' ? 'bg-[#C5A880] text-black font-semibold' : 'bg-gray-800 text-gray-300'
          }`}
        >
          Custom Uploads
        </button>
        <button
          onClick={handleClear}
          className="ml-auto px-2 py-1 text-xs bg-red-900/50 hover:bg-red-800 text-red-200 rounded"
        >
          Clear
        </button>
      </div>

      {/* Search Input */}
      <input
        type="text"
        placeholder="Search icons..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-1.5 text-xs bg-gray-900 border border-gray-700 rounded text-white mb-3 focus:outline-none focus:border-[#C5A880]"
      />

      {/* Content Area */}
      <div className="icon-grid max-h-56 overflow-y-auto grid grid-cols-4 gap-2 pr-1">
        {activeTab === 'builtin' &&
          filteredBuiltin.map((item) => {
            const isSelected = value?.icon_key === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleSelectBuiltin(item.key)}
                className={`flex flex-col items-center justify-center p-2 rounded border transition ${
                  isSelected
                    ? 'border-[#C5A880] bg-[#C5A880]/20 text-[#C5A880]'
                    : 'border-gray-800 bg-gray-900/50 text-gray-300 hover:border-gray-600'
                }`}
                title={item.label}
              >
                <RenderIcon iconKey={item.key} className="w-5 h-5 mb-1" />
                <span className="text-[10px] truncate w-full text-center">{item.key}</span>
              </button>
            );
          })}

        {activeTab === 'custom' && (
          <>
            {loadingCustom && <div className="col-span-4 text-xs text-gray-400 text-center py-4">Loading icons...</div>}
            {!loadingCustom && customIcons.length === 0 && (
              <div className="col-span-4 text-xs text-gray-500 text-center py-4">No custom icons found with tag &apos;icon&apos;</div>
            )}
            {!loadingCustom &&
              customIcons.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => handleSelectCustom(asset.secure_url, asset.display_name)}
                  className="flex flex-col items-center justify-center p-2 rounded border border-gray-800 bg-gray-900/50 hover:border-gray-600"
                >
                  <img src={asset.secure_url} alt={asset.display_name} className="w-6 h-6 object-contain mb-1" />
                  <span className="text-[10px] truncate w-full text-center">{asset.display_name}</span>
                </button>
              ))}
          </>
        )}
      </div>

      {/* Selected Preview Footer */}
      <div className="mt-3 pt-2 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
        <span>Selected:</span>
        <div className="flex items-center gap-2 font-medium text-white">
          <RenderIcon iconKey={value?.icon_key} customUrl={value?.custom_url} className="w-4 h-4 text-[#C5A880]" />
          <span>{value?.icon_key || value?.custom_url ? value.icon_key || 'Custom' : 'None'}</span>
        </div>
      </div>
    </div>
  );
}
