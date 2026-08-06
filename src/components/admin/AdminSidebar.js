'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AdminSidebar({ isOpen, onCloseMobile }) {
  const pathname = usePathname();
  const [profile, setProfile] = useState({
    name: 'Super Administrator',
    role: 'Super Admin',
    initials: 'SA',
  });

  const [expandedAccordions, setExpandedAccordions] = useState({
    'website-pages': true,
    'home-page-sub': pathname.startsWith('/admin/pages/home'),
    'operational-modules': true,
    'system-settings': true,
  });

  useEffect(() => {
    async function loadUserProfile() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const email = user.email || 'admin@dhakaheights.com';
          const role = user.user_metadata?.role || 'super_admin';
          const namePart = email.split('@')[0].replace(/[._-]/g, ' ');
          const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
          const displayName = user.user_metadata?.full_name || user.user_metadata?.name || formattedName;
          const initials = displayName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0])
            .join('')
            .toUpperCase();
          setProfile({
            name: displayName || 'Super Administrator',
            role: role === 'super_admin' ? 'Super Admin' : role,
            initials: initials || 'SA',
          });
        }
      } catch (err) {
        console.warn('Sidebar profile init notice:', err.message);
      }
    }
    loadUserProfile();
  }, []);

  // Keyboard navigation: Escape key closes mobile drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCloseMobile]);

  const isDashboardActive = pathname === '/admin';

  const toggleAccordion = (key) => {
    setExpandedAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-xs xl:hidden"
        />
      )}

      {/* Deep Navy Admin Sidebar */}
      <aside className={`admin-sidebar ${isOpen ? 'is-open' : ''}`}>
        {/* Scrollable Nav Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Brand Header Section */}
          <div className="p-4 border-b border-[#1A2C54] flex items-center justify-between shrink-0 h-[68px] box-border">
            <Link href="/admin" className="flex items-center gap-3 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C5A880] to-[#B59410] flex items-center justify-center font-serif font-bold text-[#0B1B3D] text-sm shadow-md shrink-0">
                DH
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-serif font-bold text-white tracking-widest leading-tight truncate">
                  DHAKA HEIGHTS
                </span>
                <span className="block text-[8px] text-[#C5A880] tracking-widest font-semibold uppercase leading-tight">
                  EXECUTIVE CONTROL
                </span>
              </div>
            </Link>

            <button
              onClick={onCloseMobile}
              className="p-1 text-sm text-gray-400 hover:text-white xl:hidden"
              aria-label="Close Navigation Drawer"
            >
              ✕
            </button>
          </div>

          {/* Sidebar Menu Items */}
          <nav className="p-3 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
            {/* Primary Executive Dashboard Link */}
            <div>
              <Link
                href="/admin"
                onClick={onCloseMobile}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-xs transition shadow-2xs ${
                  isDashboardActive
                    ? 'bg-gradient-to-r from-[#B59410] to-[#C5A880] text-[#0B1B3D]'
                    : 'text-gray-300 hover:bg-[#122754] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <i className="fa-solid fa-gauge-high text-xs"></i>
                  <span>Executive Dashboard</span>
                </div>
              </Link>
            </div>

            {/* GROUP 1: WEBSITE PAGES */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => toggleAccordion('website-pages')}
                className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C5A880]"
                aria-expanded={expandedAccordions['website-pages']}
              >
                <span>WEBSITE PAGES</span>
                <i className={`fa-solid ${expandedAccordions['website-pages'] ? 'fa-chevron-down' : 'fa-chevron-right'} text-[8px]`}></i>
              </button>

              {expandedAccordions['website-pages'] && (
                <div className="space-y-0.5 pl-1">
                  {/* Home Page Accordion Item */}
                  <div className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => toggleAccordion('home-page-sub')}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C5A880] ${
                        pathname.startsWith('/admin/pages/home')
                          ? 'bg-[#162A54] text-[#C5A880] font-bold'
                          : 'text-gray-300 hover:bg-[#122754] hover:text-white'
                      }`}
                      aria-expanded={expandedAccordions['home-page-sub']}
                    >
                      <div className="flex items-center gap-2.5">
                        <i className="fa-solid fa-house text-xs w-4 text-center"></i>
                        <span>Home Page</span>
                      </div>
                      <i className={`fa-solid ${expandedAccordions['home-page-sub'] ? 'fa-chevron-down' : 'fa-chevron-right'} text-[8px]`}></i>
                    </button>

                    {expandedAccordions['home-page-sub'] && (
                      <div className="pl-6 space-y-0.5 border-l border-amber-500/20 ml-4 my-1">
                        {[
                          { label: 'Overview', href: '/admin/pages/home' },
                          { label: 'Hero Slider', href: '/admin/pages/home/sections/hero-slider' },
                          { label: 'About Corporate Block', href: '/admin/pages/home/sections/about-corporate-home' },
                          { label: 'Statistics Counter', href: '/admin/pages/home/sections/statistics-counter' },
                          { label: 'Featured Projects', href: '/admin/pages/home/sections/featured-projects-home' },
                          { label: 'Commitment Quote', href: '/admin/pages/home/sections/commitment-quote' },
                          { label: 'Media Highlights', href: '/admin/pages/home/sections/media-highlights-home' },
                          { label: 'Partners Carousel', href: '/admin/pages/home/sections/partners-carousel' },
                          { label: 'Contact Section', href: '/admin/pages/home/sections/contact-section-home' },
                        ].map((sub) => {
                          const isSubActive = pathname === sub.href;
                          if (sub.planned) {
                            return (
                              <span
                                key={sub.label}
                                className="flex items-center justify-between gap-2 px-2.5 py-1 text-[11px] font-medium text-gray-500"
                                aria-disabled="true"
                              >
                                <span className="truncate">• {sub.label}</span>
                                <span className="text-[8px] uppercase tracking-wider text-gray-600">planned</span>
                              </span>
                            );
                          }
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              onClick={onCloseMobile}
                              className={`block px-2.5 py-1 rounded text-[11px] font-medium transition truncate ${
                                isSubActive
                                  ? 'text-[#C5A880] font-bold bg-[#132B59]'
                                  : 'text-gray-400 hover:text-white hover:bg-[#122754]'
                              }`}
                            >
                              • {sub.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Remaining Website Pages */}
                  {[
                    { label: 'About Page', href: '/admin/pages/about', icon: 'fa-circle-info' },
                    { label: 'Projects Page', href: '/admin/pages/projects', icon: 'fa-city' },
                    { label: 'Concerns Page', href: '/admin/pages/concerns', icon: 'fa-building-user' },
                    { label: 'Media Page', href: '/admin/pages/media', icon: 'fa-newspaper' },
                    { label: 'Career Page', href: '/admin/pages/career', icon: 'fa-user-tie' },
                    { label: 'Contact Page', href: '/admin/pages/contact', icon: 'fa-headset' },
                  ].map((link) => {
                    const isActive = pathname.startsWith(link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={onCloseMobile}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
                          isActive
                            ? 'bg-[#162A54] text-[#C5A880] font-bold border-l-2 border-[#C5A880]'
                            : 'text-gray-300 hover:bg-[#122754] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <i className={`fa-solid ${link.icon} text-xs w-4 text-center ${isActive ? 'text-[#C5A880]' : 'text-gray-400'}`}></i>
                          <span>{link.label}</span>
                        </div>
                        <i className="fa-solid fa-chevron-right text-[8px] text-gray-500"></i>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* GROUP 2: OPERATIONAL MODULES */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => toggleAccordion('operational-modules')}
                className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C5A880]"
                aria-expanded={expandedAccordions['operational-modules']}
              >
                <span>OPERATIONAL MODULES</span>
                <i className={`fa-solid ${expandedAccordions['operational-modules'] ? 'fa-chevron-down' : 'fa-chevron-right'} text-[8px]`}></i>
              </button>

              {expandedAccordions['operational-modules'] && (
                <div className="space-y-0.5 pl-1">
                  {[
                    { label: 'Real Estate Projects', href: '/admin/projects', icon: 'fa-building' },
                    { label: 'Sister Concerns', href: '/admin/concerns', icon: 'fa-briefcase' },
                    { label: 'Media & Articles', href: '/admin/articles', icon: 'fa-bullhorn' },
                    { label: 'Careers & Applications', href: '/admin/careers', icon: 'fa-file-user' },
                    { label: 'Inquiries & Leads', href: '/admin/inquiries', icon: 'fa-envelope-open-text' },
                    { label: 'Navigation & Footer', href: '/admin/navigation', icon: 'fa-sitemap' },
                  ].map((link) => {
                    const isActive = pathname.startsWith(link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={onCloseMobile}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
                          isActive
                            ? 'bg-[#162A54] text-[#C5A880] font-bold border-l-2 border-[#C5A880]'
                            : 'text-gray-300 hover:bg-[#122754] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <i className={`fa-solid ${link.icon} text-xs w-4 text-center ${isActive ? 'text-[#C5A880]' : 'text-gray-400'}`}></i>
                          <span>{link.label}</span>
                        </div>
                        <i className="fa-solid fa-chevron-right text-[8px] text-gray-500"></i>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* GROUP 3: SYSTEM & SETTINGS */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => toggleAccordion('system-settings')}
                className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C5A880]"
                aria-expanded={expandedAccordions['system-settings']}
              >
                <span>SYSTEM & SETTINGS</span>
                <i className={`fa-solid ${expandedAccordions['system-settings'] ? 'fa-chevron-down' : 'fa-chevron-right'} text-[8px]`}></i>
              </button>

              {expandedAccordions['system-settings'] && (
                <div className="space-y-0.5 pl-1">
                  {[
                    { label: 'Media Library', href: '/admin/media', icon: 'fa-images' },
                    { label: 'Site Settings & SEO', href: '/admin/settings', icon: 'fa-sliders' },
                    { label: 'Users & Roles', href: '/admin/users', icon: 'fa-users-gear' },
                    { label: 'Audit Logs', href: '/admin/audit-logs', icon: 'fa-clock-rotate-left' },
                  ].map((link) => {
                    const isActive = pathname.startsWith(link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={onCloseMobile}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
                          isActive
                            ? 'bg-[#162A54] text-[#C5A880] font-bold border-l-2 border-[#C5A880]'
                            : 'text-gray-300 hover:bg-[#122754] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <i className={`fa-solid ${link.icon} text-xs w-4 text-center ${isActive ? 'text-[#C5A880]' : 'text-gray-400'}`}></i>
                          <span>{link.label}</span>
                        </div>
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#C5A880]"></span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Architectural Line-Art Graphic (Gold on Navy) */}
          <div className="admin-sidebar-art shrink-0 justify-center p-2 opacity-30 pointer-events-none select-none">
            <img
              src="/admin/brand/dhaka-heights-architecture-lineart.png"
              alt=""
              aria-hidden="true"
              className="max-h-14 w-auto object-contain"
            />
          </div>
        </div>

        {/* User Profile Footer */}
        <div className="p-3 border-t border-[#1E2E52] bg-[#07132C] shrink-0 space-y-2">
          <div className="flex items-center justify-between p-2 rounded-xl bg-[#0F224A] border border-[#1B3264]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C5A880] to-[#B59410] text-[#0B1B3D] font-serif font-bold text-xs flex items-center justify-center shrink-0">
                {profile.initials}
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-white truncate">{profile.name}</span>
                <span className="block text-[9px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Active Session</span>
                </span>
              </div>
            </div>

            <i className="fa-solid fa-chevron-down text-[9px] text-gray-400 shrink-0"></i>
          </div>

          <div className="flex items-center justify-around border-t border-[#15274D] pt-1 text-xs text-gray-400">
            <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-[#C5A880]" title="Dark Mode (Light Shell Active)" aria-label="Dark mode status">
              <i className="fa-solid fa-moon"></i>
            </button>
            <Link href="/admin/settings" className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-[#C5A880]" title="Settings" aria-label="Admin settings">
              <i className="fa-solid fa-gear"></i>
            </Link>
            <button
              type="button"
              onClick={async () => {
                try {
                  await createClient().auth.signOut();
                } catch (error) {
                  console.warn('Sidebar sign-out notice:', error.message);
                } finally {
                  window.location.href = '/admin/login';
                }
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-white/5 hover:text-red-400 focus-visible:outline-2 focus-visible:outline-[#C5A880]"
              title="Sign Out"
              aria-label="Sign out"
            >
              <i className="fa-solid fa-right-from-bracket"></i>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
