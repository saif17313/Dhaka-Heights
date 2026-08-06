'use client';

import React, { useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';

export default function AdminShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="admin-shell">
      <AdminSidebar
        isOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="admin-main">
        <AdminHeader onToggleMobile={() => setMobileOpen((current) => !current)} />

        <main className="admin-content">{children}</main>

        <footer className="admin-footer flex w-full flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-7 py-4 text-xs text-slate-500">
          <span className="font-medium">© {new Date().getFullYear()} Dhaka Heights Ltd. All rights reserved.</span>
          <span className="font-semibold text-slate-400">Administrator Console</span>
        </footer>
      </div>
    </div>
  );
}
