'use client';

import React from 'react';

export default function AdminUsersPage() {
  const USERS = [
    { email: 'admin@dhakaheights.com', role: 'super_admin', status: 'Active' },
    { email: 'editor@dhakaheights.com', role: 'content_editor', status: 'Active' },
    { email: 'sales@dhakaheights.com', role: 'sales_manager', status: 'Active' },
    { email: 'hr@dhakaheights.com', role: 'hr_manager', status: 'Active' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between bg-gradient-to-r from-[#0D1E42] to-[#11244D] p-5 rounded-2xl border border-[#C5A880]/30 shadow-xl">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <i className="fa-solid fa-users-gear text-[#C5A880]"></i>
            <span>Admin Users &amp; Role Management</span>
          </h1>
          <p className="text-xs text-gray-400">Configure administrative access roles (Super Admin, Content Editor, Sales Manager, HR Manager).</p>
        </div>
      </div>

      <div className="bg-[#0D1E42]/90 border border-gray-800 p-5 rounded-2xl shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-[#C5A880] uppercase tracking-wider">Authorized Administrative Accounts</h3>

        <div className="space-y-2">
          {USERS.map((u) => (
            <div key={u.email} className="bg-gray-900 border border-gray-800 p-3.5 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-white block">{u.email}</span>
                <span className="text-[10px] text-[#C5A880] uppercase mt-0.5 block">{u.role}</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                {u.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
