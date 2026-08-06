'use client';

import React, { useState, useEffect, useCallback } from 'react';

const FOLDER_OPTIONS = [
  { label: 'All Folders', value: '' },
  { label: 'Home / Hero', value: 'dhaka-heights/dev/home/hero' },
  { label: 'Home / About', value: 'dhaka-heights/dev/home/about' },
  { label: 'Projects / Covers', value: 'dhaka-heights/dev/projects/covers' },
  { label: 'Projects / Galleries', value: 'dhaka-heights/dev/projects/galleries' },
  { label: 'Projects / Floor Plans', value: 'dhaka-heights/dev/projects/floor-plans' },
  { label: 'Sister Concerns', value: 'dhaka-heights/dev/concerns' },
  { label: 'Articles & News', value: 'dhaka-heights/dev/articles' },
  { label: 'Customer Reviews', value: 'dhaka-heights/dev/customer-reviews' },
  { label: 'Partners & Clients', value: 'dhaka-heights/dev/partners' },
  { label: 'Custom Icons', value: 'dhaka-heights/dev/icons' },
  { label: 'Shared Assets', value: 'dhaka-heights/dev/shared' },
];

export default function MediaLibrary({
  isModal = false,
  onSelectAsset,
  onCloseModal,
  resourceTypeFilter = '',
  initialFolder = '',
}) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedFolder, setSelectedFolder] = useState(initialFolder);
  const [resourceType, setResourceType] = useState(resourceTypeFilter);
  const [tag] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  // Asset Details Drawer / Modal
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editAltText, setEditAltText] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editTags, setEditTags] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [, setUsageInfo] = useState([]);

  // Uploading state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search,
        folder: selectedFolder,
        resourceType,
        tag,
      });

      const res = await fetch(`/api/admin/media?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets || []);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to load media assets:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedFolder, resourceType, tag]);

  useEffect(() => {
    const requestId = window.setTimeout(fetchAssets, 0);
    return () => window.clearTimeout(requestId);
  }, [fetchAssets]);

  const handleSelectForDetails = async (asset) => {
    setSelectedAsset(asset);
    setEditDisplayName(asset.display_name || '');
    setEditAltText(asset.alt_text || '');
    setEditCaption(asset.caption || '');
    setEditTags(asset.tags ? asset.tags.join(', ') : '');

    // Check usage
    try {
      const res = await fetch(`/api/admin/media/${asset.id}`);
      if (res.ok) {
        const data = await res.json();
        setUsageInfo(data.usage || []);
      }
    } catch (err) {
      setUsageInfo([]);
    }
  };

  const selectOrInspectAsset = (asset) => {
    if (isModal && onSelectAsset) {
      onSelectAsset(asset);
      return;
    }
    handleSelectForDetails(asset);
  };

  const handleSaveMetadata = async () => {
    if (!selectedAsset) return;
    setSavingEdit(true);
    try {
      const tagsArray = editTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch(`/api/admin/media/${selectedAsset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: editDisplayName,
          alt_text: editAltText,
          caption: editCaption,
          tags: tagsArray,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSelectedAsset(updated);
        fetchAssets();
      }
    } catch (err) {
      console.error('Failed to update metadata:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteAsset = async (force = false) => {
    if (!selectedAsset) return;
    const confirmText = force
      ? `Are you sure you want to PERMANENTLY delete "${selectedAsset.display_name}"?`
      : `Delete or archive "${selectedAsset.display_name}"?`;

    if (!window.confirm(confirmText)) return;

    try {
      const res = await fetch(`/api/admin/media/${selectedAsset.id}${force ? '?force=true' : ''}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setSelectedAsset(null);
        fetchAssets();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to delete asset');
      }
    } catch (err) {
      console.error('Failed to delete asset:', err);
    }
  };

  const handleDirectUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (resourceTypeFilter === 'image' && !file.type.startsWith('image/')) {
      alert('Select an image file for this media field.');
      e.target.value = '';
      return;
    }

    setUploading(true);
    setUploadProgress('Requesting secure signature...');

    try {
      // 1. Get signed params
      const targetFolder = selectedFolder || 'dhaka-heights/dev/shared';
      const requestedResourceType = file.type.startsWith('video/') ? 'video' : 'image';
      const signRes = await fetch('/api/admin/cloudinary-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: targetFolder, resourceType: requestedResourceType }),
      });

      if (!signRes.ok) throw new Error('Signature generation failed');
      const signData = await signRes.json();

      // 2. Upload to Cloudinary direct
      setUploadProgress('Uploading to Cloudinary CDN...');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', signData.apiKey);
      formData.append('timestamp', signData.timestamp);
      formData.append('signature', signData.signature);
      formData.append('folder', signData.folder);
      if (signData.tags) formData.append('tags', signData.tags);

      const cldRes = await fetch(
        `https://api.cloudinary.com/v1_1/${signData.cloudName}/${signData.resourceType}/upload`,
        { method: 'POST', body: formData }
      );

      if (!cldRes.ok) throw new Error('Cloudinary direct upload failed');
      const cldData = await cldRes.json();

      // 3. Persist metadata in Supabase
      setUploadProgress('Saving metadata...');
      const metadataRes = await fetch('/api/admin/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_id: cldData.public_id,
          secure_url: cldData.secure_url,
          resource_type: signData.resourceType,
          format: cldData.format,
          width: cldData.width,
          height: cldData.height,
          bytes: cldData.bytes,
          original_filename: file.name,
          display_name: file.name,
          folder: signData.folder,
        }),
      });

      if (!metadataRes.ok) {
        const metadataError = await metadataRes.json().catch(() => ({}));
        throw new Error(metadataError.error || 'Failed to save uploaded asset metadata');
      }

      fetchAssets();
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      setUploadProgress('');
      e.target.value = '';
    }
  };

  return (
    <div className={`media-library-wrapper ${isModal ? 'p-2' : 'p-6'} bg-[#0B1B3D]/95 text-white min-h-[600px] flex flex-col rounded-xl border border-[#C5A880]/30 shadow-2xl`}>
      {/* Top Bar / Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-800">
        <div>
          <h2 className="text-xl font-bold text-[#C5A880] tracking-wide">Media Library</h2>
          <p className="text-xs text-gray-400">Cloudinary Media Assets &amp; Metadata Registry</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <label className="cursor-pointer px-4 py-2 bg-[#C5A880] hover:bg-[#D4AF37] text-black font-semibold text-xs rounded-lg transition shadow-md flex items-center gap-2">
            <i className="fa-solid fa-cloud-arrow-up"></i>
            <span>Upload New Asset</span>
            <input
              type="file"
              onChange={handleDirectUpload}
              className="hidden"
              accept={resourceTypeFilter === 'image' ? 'image/*' : 'image/*,video/*'}
            />
          </label>

          {isModal && onCloseModal && (
            <button onClick={onCloseModal} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg">
              Close
            </button>
          )}
        </div>
      </div>

      {uploading && (
        <div className="my-3 p-3 bg-amber-900/30 border border-amber-500/50 rounded text-amber-200 text-xs flex items-center justify-between">
          <span className="animate-pulse">⏳ {uploadProgress}</span>
        </div>
      )}

      {/* Filter Controls Bar */}
      <div className="flex flex-wrap items-center gap-3 py-4 border-b border-gray-800/60">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search assets by name or tag..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#C5A880]"
          />
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-gray-500 text-xs"></i>
        </div>

        {/* Folder Select */}
        <select
          value={selectedFolder}
          onChange={(e) => {
            setSelectedFolder(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 text-xs bg-gray-900 border border-gray-800 rounded-lg text-gray-300 focus:outline-none focus:border-[#C5A880]"
        >
          {FOLDER_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        {/* Type Select */}
        <select
          value={resourceType}
          disabled={Boolean(resourceTypeFilter)}
          onChange={(e) => {
            setResourceType(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 text-xs bg-gray-900 border border-gray-800 rounded-lg text-gray-300 focus:outline-none focus:border-[#C5A880] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <option value="">All Resource Types</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
        </select>

        {/* View Toggle */}
        <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-2 py-1 text-xs rounded ${viewMode === 'grid' ? 'bg-[#C5A880] text-black font-bold' : 'text-gray-400'}`}
          >
            <i className="fa-solid fa-border-all"></i>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-2 py-1 text-xs rounded ${viewMode === 'list' ? 'bg-[#C5A880] text-black font-bold' : 'text-gray-400'}`}
          >
            <i className="fa-solid fa-list"></i>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex gap-4 my-4 overflow-hidden min-h-[400px]">
        {/* Assets Display Grid / List */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loading && (
            <div className="py-20 text-center text-xs text-gray-400">Loading media assets...</div>
          )}

          {!loading && assets.length === 0 && (
            <div className="py-20 text-center text-xs text-gray-500">
              No media assets found matching the criteria.
            </div>
          )}

          {!loading && viewMode === 'grid' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => selectOrInspectAsset(asset)}
                  className={`group relative border rounded-lg overflow-hidden bg-gray-900 cursor-pointer transition ${
                    selectedAsset?.id === asset.id ? 'border-[#C5A880] ring-2 ring-[#C5A880]/50' : 'border-gray-800 hover:border-gray-600'
                  }`}
                >
                  <div className="w-full h-28 bg-black/40 flex items-center justify-center overflow-hidden">
                    {asset.resource_type === 'video' ? (
                      <div className="text-center p-2">
                        <i className="fa-solid fa-video text-2xl text-[#C5A880]"></i>
                        <span className="block text-[10px] text-gray-400 mt-1 truncate">{asset.display_name}</span>
                      </div>
                    ) : (
                      <img src={asset.secure_url} alt={asset.alt_text || asset.display_name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                    )}
                  </div>
                  <div className="p-2 bg-gray-900/90 border-t border-gray-800/80">
                    <span className="block text-[11px] font-medium text-gray-200 truncate">{asset.display_name}</span>
                    <span className="block text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">{asset.format} • {asset.width}x{asset.height}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && viewMode === 'list' && (
            <div className="space-y-2">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => selectOrInspectAsset(asset)}
                  className={`flex items-center gap-3 p-2 bg-gray-900 border rounded-lg cursor-pointer transition ${
                    selectedAsset?.id === asset.id ? 'border-[#C5A880]' : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <img src={asset.secure_url} alt={asset.display_name} className="w-10 h-10 object-cover rounded" />
                  <div className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-white truncate">{asset.display_name}</span>
                    <span className="block text-[10px] text-gray-400 truncate">{asset.public_id}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 uppercase">{asset.format}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Asset Details Sidebar */}
        {selectedAsset && !isModal && (
          <div className="w-72 bg-gray-900/90 border border-gray-800 rounded-lg p-4 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-800">
                <h4 className="text-xs font-bold text-[#C5A880] uppercase tracking-wider">Asset Details</h4>
                <button onClick={() => setSelectedAsset(null)} className="text-gray-400 hover:text-white text-xs">
                  ✕
                </button>
              </div>

              {/* Preview */}
              <div className="w-full h-36 bg-black rounded overflow-hidden mb-3 border border-gray-800 flex items-center justify-center">
                <img src={selectedAsset.secure_url} alt={selectedAsset.display_name} className="max-h-full max-w-full object-contain" />
              </div>

              {/* Metadata Form */}
              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block text-gray-400 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    className="w-full px-2.5 py-1 bg-gray-950 border border-gray-800 rounded text-white"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Alt Text (Accessibility)</label>
                  <input
                    type="text"
                    value={editAltText}
                    onChange={(e) => setEditAltText(e.target.value)}
                    className="w-full px-2.5 py-1 bg-gray-950 border border-gray-800 rounded text-white"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Caption</label>
                  <textarea
                    rows={2}
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    className="w-full px-2.5 py-1 bg-gray-950 border border-gray-800 rounded text-white resize-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Tags (Comma separated)</label>
                  <input
                    type="text"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    className="w-full px-2.5 py-1 bg-gray-950 border border-gray-800 rounded text-white"
                  />
                </div>

                {/* Properties list */}
                <div className="pt-2 border-t border-gray-800 text-[10px] text-gray-400 space-y-1">
                  <div><strong>Dimensions:</strong> {selectedAsset.width} x {selectedAsset.height} px</div>
                  <div><strong>Format:</strong> {selectedAsset.format}</div>
                  <div><strong>Folder:</strong> {selectedAsset.folder}</div>
                  <div><strong>Public ID:</strong> <span className="break-all">{selectedAsset.public_id}</span></div>
                </div>
              </div>
            </div>

            {/* Save & Delete Action Buttons */}
            <div className="mt-4 pt-3 border-t border-gray-800 flex flex-col gap-2">
              <button
                onClick={handleSaveMetadata}
                disabled={savingEdit}
                className="w-full py-1.5 bg-[#C5A880] hover:bg-[#D4AF37] text-black font-semibold text-xs rounded transition"
              >
                {savingEdit ? 'Saving...' : 'Save Metadata'}
              </button>
              <button
                onClick={() => handleDeleteAsset(false)}
                className="w-full py-1.5 bg-red-950/60 hover:bg-red-900/80 text-red-200 font-medium text-xs rounded border border-red-800/50 transition"
              >
                Delete / Archive Asset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-800 text-xs text-gray-400">
          <span>Showing Page {page} of {totalPages} ({totalCount} assets)</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-gray-900 border border-gray-800 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 bg-gray-900 border border-gray-800 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
