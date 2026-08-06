'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

function formatRole(value = 'super_admin') {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildProfile(user) {
  const email = user?.email || 'admin@dhakaheights.com';
  const emailName = email.split('@')[0].replace(/[._-]/g, ' ');
  const name = user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || emailName.replace(/\b\w/g, (character) => character.toUpperCase())
    || 'Administrator';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return {
    name,
    email,
    role: formatRole(user?.user_metadata?.role),
    initials: initials || 'AD',
  };
}

export default function AdminHeader({ onToggleMobile }) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profile, setProfile] = useState({
    name: 'Administrator',
    email: 'admin@dhakaheights.com',
    role: 'Super Admin',
    initials: 'AD',
  });

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (active && user) setProfile(buildProfile(user));
      } catch (error) {
        console.warn('Admin header profile notice:', error.message);
      }
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  async function handleSignOut() {
    setUserMenuOpen(false);
    try {
      await createClient().auth.signOut();
    } catch (error) {
      console.warn('Admin sign-out notice:', error.message);
    } finally {
      window.location.href = '/admin/login';
    }
  }

  return (
    <header className="admin-topbar">
      <div className="flex h-full w-full items-center justify-between gap-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={onToggleMobile}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-[#C5A880] hover:bg-white hover:text-black focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#C5A880]/50 xl:hidden"
            aria-label="Open navigation menu"
          >
            <i className="fa-solid fa-bars-staggered text-sm" aria-hidden="true"></i>
          </button>

          <div className="relative flex w-full min-w-0 max-w-[460px] items-center">
            <input
              type="search"
              placeholder="Global search (Projects, Inquiries, Media, Pages...)"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-12 text-xs font-medium text-slate-800 transition placeholder:text-slate-400 focus:border-[#C5A880] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C5A880]/20"
              aria-label="Global admin search"
            />
            <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3.5 text-xs text-slate-400" aria-hidden="true"></i>
            <kbd className="pointer-events-none absolute right-3 hidden rounded border border-slate-300 bg-slate-200/80 px-1.5 py-0.5 font-mono text-[9px] text-slate-500 shadow-2xs sm:inline-block">
              ⌘ K
            </kbd>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button type="button" className="hidden min-h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 sm:flex" aria-label="Language: English">
            <i className="fa-solid fa-globe text-slate-400" aria-hidden="true"></i>
            <span>EN</span>
            <i className="fa-solid fa-chevron-down text-[9px] text-slate-400" aria-hidden="true"></i>
          </button>

          <button type="button" className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-[#0B1B3D]" aria-label="Notifications">
            <i className="fa-regular fa-bell text-sm" aria-hidden="true"></i>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((open) => !open)}
              className="flex max-w-56 items-center gap-2.5 rounded-xl border border-transparent p-1 transition hover:border-slate-200 hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#C5A880]/50"
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B1B3D] font-serif text-xs font-bold text-[#C5A880] shadow-xs">
                {profile.initials}
              </span>
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block max-w-32 truncate text-xs font-bold leading-tight text-[#0B1B3D]">{profile.name}</span>
                <span className="block max-w-32 truncate text-[9px] font-semibold text-amber-600">{profile.role}</span>
              </span>
              <i className="fa-solid fa-chevron-down hidden text-[9px] text-slate-400 md:block" aria-hidden="true"></i>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-2xl" role="menu">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <span className="block truncate text-xs font-bold text-slate-800">{profile.name}</span>
                  <span className="block truncate font-mono text-[10px] text-slate-500">{profile.email}</span>
                </div>
                <Link href="/admin/settings" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:text-[#0B1B3D]" role="menuitem">
                  <i className="fa-solid fa-sliders text-xs text-slate-400" aria-hidden="true"></i>
                  <span>Account Settings</span>
                </Link>
                <Link href="/admin/audit-logs" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:text-[#0B1B3D]" role="menuitem">
                  <i className="fa-solid fa-clock-rotate-left text-xs text-slate-400" aria-hidden="true"></i>
                  <span>Audit Trail Log</span>
                </Link>
                <div className="mt-1 border-t border-slate-100 pt-1">
                  <button type="button" onClick={handleSignOut} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-red-600 transition hover:bg-red-50" role="menuitem">
                    <i className="fa-solid fa-right-from-bracket text-xs text-red-500" aria-hidden="true"></i>
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
