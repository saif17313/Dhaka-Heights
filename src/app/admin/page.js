'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from './dashboard.module.css';

const KPI_DEFINITIONS = [
  { key: 'projectsCount', label: 'Total Projects', href: '/admin/projects', icon: 'fa-building', iconClass: 'bg-blue-50 text-blue-600' },
  { key: 'inquiriesCount', label: 'Total Inquiries', href: '/admin/inquiries', icon: 'fa-comment-dots', iconClass: 'bg-emerald-50 text-emerald-600' },
  { key: 'vacanciesCount', label: 'Active Vacancies', href: '/admin/careers', icon: 'fa-briefcase', iconClass: 'bg-purple-50 text-purple-600' },
  { key: 'pagesCount', label: 'Published Pages', href: '/admin/pages', icon: 'fa-file-lines', iconClass: 'bg-amber-50 text-amber-600' },
  { key: 'mediaCount', label: 'Media Assets', href: '/admin/media', icon: 'fa-image', iconClass: 'bg-rose-50 text-rose-600' },
];

const MANAGEMENT_MODULES = [
  { title: 'Edit Pages & Sections', desc: 'Manage page layouts, sections & hero banners', icon: 'fa-layer-group', iconClass: 'bg-blue-50 text-blue-600', href: '/admin/pages' },
  { title: 'Manage Projects', desc: 'Add, edit & organize real estate projects', icon: 'fa-building', iconClass: 'bg-[#FFF9F0] text-[#B59410]', href: '/admin/projects' },
  { title: 'Sister Concerns Manager', desc: 'Manage subsidiary details & services', icon: 'fa-briefcase', iconClass: 'bg-purple-50 text-purple-600', href: '/admin/concerns' },
  { title: 'Careers & Vacancies', desc: 'Post jobs, manage openings & applicants', icon: 'fa-user-tie', iconClass: 'bg-emerald-50 text-emerald-600', href: '/admin/careers' },
  { title: 'Inquiries Inbox', desc: 'View & respond to customer inquiries', icon: 'fa-envelope-open-text', iconClass: 'bg-amber-50 text-amber-600', href: '/admin/inquiries' },
  { title: 'Central Media Library', desc: 'Upload, manage & organize media assets', icon: 'fa-images', iconClass: 'bg-rose-50 text-rose-600', href: '/admin/media' },
  { title: 'Navigation & Footer', desc: 'Manage navigation menus & footer links', icon: 'fa-sitemap', iconClass: 'bg-indigo-50 text-indigo-600', href: '/admin/navigation' },
  { title: 'Site Settings & SEO', desc: 'General settings, SEO & site configuration', icon: 'fa-sliders', iconClass: 'bg-slate-100 text-slate-700', href: '/admin/settings' },
];

const PAGE_SHORTCUTS = [
  { label: 'Home Page', icon: 'fa-house', href: '/admin/pages/home' },
  { label: 'About Page', icon: 'fa-building-columns', href: '/admin/pages/about' },
  { label: 'Projects Page', icon: 'fa-city', href: '/admin/pages/projects' },
  { label: 'Concerns Page', icon: 'fa-handshake', href: '/admin/pages/concerns' },
  { label: 'Media Page', icon: 'fa-newspaper', href: '/admin/pages/media' },
  { label: 'Career Page', icon: 'fa-user-tie', href: '/admin/pages/career' },
  { label: 'Contact Page', icon: 'fa-envelope', href: '/admin/pages/contact' },
];

const ACTION_STYLES = {
  CREATE: { icon: 'fa-plus', iconClass: 'bg-emerald-100 text-emerald-600' },
  UPDATE: { icon: 'fa-pen-to-square', iconClass: 'bg-blue-100 text-blue-600' },
  DELETE: { icon: 'fa-trash', iconClass: 'bg-rose-100 text-rose-600' },
  PUBLISH: { icon: 'fa-arrow-up-from-bracket', iconClass: 'bg-purple-100 text-purple-600' },
};

const EMPTY_METRICS = {
  projectsCount: null,
  inquiriesCount: null,
  vacanciesCount: null,
  pagesCount: null,
  mediaCount: null,
};

function formatLabel(value = '') {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getProfileName(user) {
  const metadataName = user?.user_metadata?.full_name || user?.user_metadata?.name;
  if (metadataName) return metadataName;
  const emailName = user?.email?.split('@')[0]?.replace(/[._-]/g, ' ');
  return emailName ? formatLabel(emailName) : 'Administrator';
}

function AnalyticsEmptyState({ title }) {
  return (
    <div className={styles.analyticsEmpty} role="status">
      <div className="max-w-xs">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <i className="fa-solid fa-chart-line" aria-hidden="true"></i>
        </div>
        <p className="text-sm font-bold text-[#0B1B3D]">{title} is not configured</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          No verified analytics source exists in the current dashboard schema.
        </p>
      </div>
    </div>
  );
}

export default function ExecutiveDashboardPage() {
  const [adminName, setAdminName] = useState('Administrator');
  const [currentDate] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [addNewOpen, setAddNewOpen] = useState(false);
  const [editPagesOpen, setEditPagesOpen] = useState(false);
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [recentActivities, setRecentActivities] = useState([]);
  const [serviceState, setServiceState] = useState({
    database: 'Checking',
    realtime: 'Connecting',
    assetRegistry: 'Checking',
  });

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function loadDashboardData() {
      setLoading(true);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (active && user) setAdminName(getProfileName(user));

        const [
          projectsResult,
          inquiriesResult,
          vacanciesResult,
          pagesResult,
          mediaResult,
          auditResult,
        ] = await Promise.all([
          supabase.from('projects').select('*', { count: 'exact', head: true }),
          supabase.from('inquiries').select('*', { count: 'exact', head: true }),
          supabase.from('job_openings').select('*', { count: 'exact', head: true }),
          supabase.from('pages').select('*', { count: 'exact', head: true }),
          supabase.from('media_assets').select('*', { count: 'exact', head: true }),
          supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(6),
        ]);

        if (!active) return;

        const metricResults = [projectsResult, inquiriesResult, vacanciesResult, pagesResult, mediaResult];
        const queryErrors = [...metricResults, auditResult].filter((result) => result.error);

        setMetrics({
          projectsCount: projectsResult.error ? null : projectsResult.count ?? 0,
          inquiriesCount: inquiriesResult.error ? null : inquiriesResult.count ?? 0,
          vacanciesCount: vacanciesResult.error ? null : vacanciesResult.count ?? 0,
          pagesCount: pagesResult.error ? null : pagesResult.count ?? 0,
          mediaCount: mediaResult.error ? null : mediaResult.count ?? 0,
        });

        const activityRows = auditResult.error ? [] : auditResult.data || [];
        setRecentActivities(
          activityRows.map((log) => {
            const action = String(log.action || 'UPDATE').toUpperCase();
            const actionStyle = ACTION_STYLES[action] || ACTION_STYLES.UPDATE;
            const tableName = formatLabel(log.table_name || 'Content');
            const timestamp = log.timestamp
              ? new Date(log.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
              : 'Timestamp unavailable';

            return {
              id: log.id,
              action: `${formatLabel(action)} ${tableName}`,
              summary: `${tableName} • ${timestamp}`,
              actor: log.admin_id ? log.admin_id.slice(0, 2).toUpperCase() : 'AD',
              ...actionStyle,
            };
          })
        );

        setDataError(queryErrors.length > 0 ? 'Some live dashboard data is unavailable for this session.' : '');
        setServiceState((current) => ({
          ...current,
          database: metricResults.some((result) => result.error) ? 'Limited' : 'Connected',
          assetRegistry: mediaResult.error ? 'Unavailable' : 'Connected',
        }));
      } catch (error) {
        if (!active) return;
        console.warn('Dashboard data fetch notice:', error.message);
        setDataError('Live dashboard data could not be loaded.');
        setServiceState((current) => ({ ...current, database: 'Unavailable', assetRegistry: 'Unavailable' }));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboardData();

    const channel = supabase
      .channel('executive-dashboard-db')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, loadDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inquiries' }, loadDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_openings' }, loadDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pages' }, loadDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'media_assets' }, loadDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, loadDashboardData)
      .subscribe((status) => {
        if (!active) return;
        const realtimeStatus = status === 'SUBSCRIBED'
          ? 'Connected'
          : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'
            ? 'Unavailable'
            : 'Connecting';
        setServiceState((current) => ({ ...current, realtime: realtimeStatus }));
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const formattedDate = currentDate?.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const serviceRows = [
    { label: 'Supabase Database', status: serviceState.database },
    { label: 'Realtime Channel', status: serviceState.realtime },
    { label: 'Media Asset Registry', status: serviceState.assetRegistry },
  ];
  const allServicesConnected = serviceRows.every((service) => service.status === 'Connected');

  return (
    <div className={styles.dashboard}>
      <section className={styles.header} aria-labelledby="dashboard-title">
        <div className="min-w-0 text-left">
          <h1 id="dashboard-title" className="font-serif text-3xl font-bold tracking-tight text-[#0B1B3D] md:text-[34px] md:leading-tight">
            Welcome back, {adminName} <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-1.5 text-sm font-medium text-slate-500">
            Here&apos;s what&apos;s happening with Dhaka Heights today.
          </p>
        </div>

        <div className={styles.headerActions}>
          <div className={`${styles.headerControl} ${styles.dateControl} flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-2xs sm:w-auto`}>
            <i className="fa-regular fa-calendar text-[#B59410]" aria-hidden="true"></i>
            <time dateTime={currentDate?.toISOString()}>{formattedDate || 'Loading date…'}</time>
          </div>

          <div className="relative w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setAddNewOpen((open) => !open)}
              className={`${styles.headerControl} w-full rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-800 shadow-2xs transition hover:border-[#C5A880] hover:bg-slate-50 sm:w-auto`}
              aria-expanded={addNewOpen}
              aria-haspopup="menu"
            >
              <span className="flex items-center justify-center gap-2">
                <i className="fa-solid fa-plus text-[#B59410]" aria-hidden="true"></i>
                <span>Add New</span>
                <i className="fa-solid fa-chevron-down text-[9px] text-slate-400" aria-hidden="true"></i>
              </span>
            </button>

            {addNewOpen && (
              <div className="absolute right-0 z-50 mt-2 w-52 rounded-2xl border border-slate-200 bg-white py-2 text-xs font-medium shadow-xl" role="menu">
                <Link href="/admin/projects" onClick={() => setAddNewOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-slate-700 hover:bg-slate-50" role="menuitem">
                  <i className="fa-solid fa-building text-[#B59410]" aria-hidden="true"></i>
                  <span>New Real Estate Project</span>
                </Link>
                <Link href="/admin/articles" onClick={() => setAddNewOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-slate-700 hover:bg-slate-50" role="menuitem">
                  <i className="fa-solid fa-newspaper text-[#B59410]" aria-hidden="true"></i>
                  <span>New Media Article</span>
                </Link>
                <Link href="/admin/careers" onClick={() => setAddNewOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-slate-700 hover:bg-slate-50" role="menuitem">
                  <i className="fa-solid fa-briefcase text-[#B59410]" aria-hidden="true"></i>
                  <span>New Career Vacancy</span>
                </Link>
              </div>
            )}
          </div>

          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.headerControl} flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B1B3D] px-4 text-xs font-bold text-white shadow-xs transition hover:bg-[#122754] sm:w-auto`}
          >
            <span>View Website</span>
            <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" aria-hidden="true"></i>
          </Link>
        </div>
      </section>

      {dataError && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800" role="status">
          <i className="fa-solid fa-circle-exclamation mt-0.5" aria-hidden="true"></i>
          <span>{dataError}</span>
        </div>
      )}

      <section aria-label="Executive dashboard key metrics">
        <div className={styles.kpiGrid}>
          {KPI_DEFINITIONS.map((item) => {
            const value = metrics[item.key];
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`${styles.kpiCard} ${styles.interactiveCard} group flex min-w-0 items-start gap-3.5 rounded-2xl border border-slate-200 bg-white shadow-2xs transition hover:-translate-y-0.5 hover:border-[#C5A880] hover:shadow-md`}
              >
                <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg transition group-hover:scale-105 ${item.iconClass}`}>
                  <i className={`fa-solid ${item.icon}`} aria-hidden="true"></i>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-slate-500">{item.label}</span>
                  <span className="mt-1 block font-serif text-3xl font-bold leading-none text-[#0B1B3D]">
                    {value === null ? '—' : value}
                  </span>
                  <span className={`mt-2 flex items-center gap-1 text-[11px] font-semibold ${value === null ? 'text-amber-700' : 'text-slate-500'}`}>
                    <i className={`fa-solid ${loading ? 'fa-spinner animate-spin' : value === null ? 'fa-circle-exclamation' : 'fa-database'} text-[9px]`} aria-hidden="true"></i>
                    <span>{loading ? 'Loading live total…' : value === null ? 'Data unavailable' : 'Live record total'}</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className={styles.managementPanel} aria-labelledby="management-modules-title">
        <div className={styles.sectionHeader}>
          <h2 id="management-modules-title" className="font-serif text-lg font-bold text-[#0B1B3D]">Management Modules</h2>
          <span className="text-xs font-bold text-slate-400">Quick Access</span>
        </div>

        <div className={styles.moduleGrid}>
          {MANAGEMENT_MODULES.map((module) => (
            <Link
              key={module.title}
              href={module.href}
              className={`${styles.moduleCard} ${styles.interactiveCard} group flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 shadow-2xs transition hover:-translate-y-0.5 hover:border-[#C5A880] hover:bg-white hover:shadow-md`}
            >
              <div className="flex min-w-0 items-center gap-3.5">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base transition group-hover:scale-105 ${module.iconClass}`}>
                  <i className={`fa-solid ${module.icon}`} aria-hidden="true"></i>
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-xs font-bold text-[#0B1B3D] transition group-hover:text-[#B59410]">{module.title}</h3>
                  <p className="mt-1 truncate text-[11px] text-slate-500">{module.desc}</p>
                </div>
              </div>
              <i className="fa-solid fa-chevron-right shrink-0 text-xs text-slate-300 transition group-hover:text-[#B59410]" aria-hidden="true"></i>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.primaryGrid} aria-label="Dashboard activity and analytics">
        <article className={`${styles.panel} flex flex-col`}>
          <div className={styles.panelHeader}>
            <h2 className="font-serif text-base font-bold text-[#0B1B3D]">Recent Activity</h2>
            <Link href="/admin/audit-logs" className="text-xs font-bold text-slate-500 transition hover:text-[#0B1B3D]">View All</Link>
          </div>

          {loading ? (
            <div className="space-y-3" aria-label="Loading recent activity">
              {[0, 1, 2, 3, 4].map((item) => (
                <div key={item} className="flex animate-pulse items-center gap-3 rounded-xl bg-slate-50 p-2">
                  <span className="h-9 w-9 shrink-0 rounded-full bg-slate-200"></span>
                  <span className="h-3 flex-1 rounded bg-slate-200"></span>
                </div>
              ))}
            </div>
          ) : recentActivities.length > 0 ? (
            <div className="space-y-2">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl px-1 py-2 text-xs transition hover:bg-slate-50">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs ${activity.iconClass}`}>
                      <i className={`fa-solid ${activity.icon}`} aria-hidden="true"></i>
                    </div>
                    <div className="min-w-0">
                      <span className="block truncate font-bold leading-tight text-[#0B1B3D]">{activity.action}</span>
                      <span className="mt-1 block truncate font-mono text-[10px] text-slate-400">{activity.summary}</span>
                    </div>
                  </div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0B1B3D] font-serif text-[10px] font-bold text-[#C5A880] shadow-2xs">
                    {activity.actor}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.analyticsEmpty} role="status">
              <div>
                <i className="fa-regular fa-clock mb-3 text-2xl text-slate-400" aria-hidden="true"></i>
                <p className="text-sm font-bold text-[#0B1B3D]">No activity available</p>
                <p className="mt-1 text-xs text-slate-500">Audit records will appear here when accessible.</p>
              </div>
            </div>
          )}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className="font-serif text-base font-bold text-[#0B1B3D]">Traffic Overview</h2>
            <span className="shrink-0 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-500">No source</span>
          </div>
          <AnalyticsEmptyState title="Traffic analytics" />
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className="whitespace-nowrap font-serif text-sm font-bold text-[#0B1B3D]">Top Performing Sections</h2>
            <span className="shrink-0 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-500">No source</span>
          </div>
          <AnalyticsEmptyState title="Section performance" />
        </article>
      </section>

      <section className={styles.bottomGrid} aria-label="Page shortcuts and system status">
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className="font-serif text-lg font-bold text-[#0B1B3D]">Quick Page Shortcuts</h2>
            <div className="relative">
              <button
                type="button"
                onClick={() => setEditPagesOpen((open) => !open)}
                className="flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-slate-600 transition hover:border-[#C5A880] hover:bg-white"
                aria-expanded={editPagesOpen}
                aria-haspopup="menu"
              >
                <span>Edit Pages</span>
                <i className="fa-solid fa-chevron-down text-[8px] text-slate-400" aria-hidden="true"></i>
              </button>
              {editPagesOpen && (
                <div className="absolute right-0 z-50 mt-2 w-44 rounded-xl border border-slate-200 bg-white py-2 text-xs shadow-xl" role="menu">
                  <Link href="/admin/pages" onClick={() => setEditPagesOpen(false)} className="block px-4 py-2 text-slate-700 hover:bg-slate-50" role="menuitem">
                    Manage All Pages
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className={styles.shortcutsGrid}>
            {PAGE_SHORTCUTS.map((shortcut) => (
              <Link
                key={shortcut.label}
                href={shortcut.href}
                className={`${styles.shortcutCard} ${styles.interactiveCard} group flex min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center shadow-2xs transition hover:-translate-y-0.5 hover:border-[#C5A880] hover:bg-white hover:shadow-md`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-[#0B1B3D] shadow-2xs transition group-hover:scale-105 group-hover:text-[#B59410]">
                  <i className={`fa-solid ${shortcut.icon}`} aria-hidden="true"></i>
                </div>
                <span className="block w-full truncate text-[11px] font-bold text-[#0B1B3D] transition group-hover:text-[#B59410]">{shortcut.label}</span>
              </Link>
            ))}
          </div>
        </article>

        <article className={`${styles.panel} flex flex-col`}>
          <div className={styles.panelHeader}>
            <h2 className="font-serif text-lg font-bold text-[#0B1B3D]">System Status</h2>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${allServicesConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {allServicesConnected ? 'Verified Online' : 'Check Required'}
            </span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {serviceRows.map((service) => {
              const connected = service.status === 'Connected';
              const pending = service.status === 'Checking' || service.status === 'Connecting';
              return (
                <div key={service.label} className="flex min-h-12 items-center justify-between gap-4 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${connected ? 'bg-emerald-500' : pending ? 'animate-pulse bg-amber-400' : 'bg-rose-500'}`}></span>
                    <span className="truncate font-bold text-slate-800">{service.label}</span>
                  </div>
                  <span className={`shrink-0 font-bold ${connected ? 'text-emerald-600' : pending ? 'text-amber-600' : 'text-rose-600'}`}>{service.status}</span>
                </div>
              );
            })}
          </div>
        </article>
      </section>
    </div>
  );
}
