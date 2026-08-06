'use client';

import React from 'react';
import MediaLibrary from '@/components/admin/MediaLibrary';

export default function AdminMediaPage() {
  return (
    <div className="p-6 bg-[#0B1B3D] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <MediaLibrary />
      </div>
    </div>
  );
}
