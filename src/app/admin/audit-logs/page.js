'use client';

import React from 'react';

export default function AdminAuditLogsPage() {
  const LOGS = [
    { action: 'UPDATE_PROJECT', entity: 'dhaka-heights-ariana-lofts', user: 'admin@dhakaheights.com', time: '2026-07-31 13:00:00' },
    { action: 'CREATE_MEDIA_ASSET', entity: 'dhaka-heights/dev/shared/logo.svg', user: 'admin@dhakaheights.com', time: '2026-07-31 12:45:00' },
    { action: 'GENERATE_RESUME_LINK', entity: 'resumes/applicant_cv_1.pdf', user: 'hr@dhakaheights.com', time: '2026-07-31 12:30:00' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between bg-gradient-to-r from-[#0D1E42] to-[#11244D] p-5 rounded-2xl border border-[#C5A880]/30 shadow-xl">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <i className="fa-solid fa-shield-halved text-[#C5A880]"></i>
            <span>Administrative Audit Log</span>
          </h1>
          <p className="text-xs text-gray-400">Track content edits, media uploads, role changes, and file access history.</p>
        </div>
      </div>

      <div className="bg-[#0D1E42]/90 border border-gray-800 p-5 rounded-2xl shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-[#C5A880] uppercase tracking-wider">Audit Trail Log</h3>

        <div className="space-y-2 text-xs">
          {LOGS.map((log, idx) => (
            <div key={idx} className="bg-gray-900 border border-gray-800 p-3 rounded-lg flex items-center justify-between">
              <div>
                <span className="font-bold text-[#C5A880]">{log.action}</span>
                <span className="block text-gray-300 font-mono text-[11px] mt-0.5">{log.entity}</span>
              </div>
              <div className="text-right text-[10px] text-gray-400">
                <span className="block text-gray-300">{log.user}</span>
                <span>{log.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
