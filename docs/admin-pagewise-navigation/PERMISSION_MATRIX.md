# Role-Based Access Control (RBAC) Permission Matrix

## Overview
This document specifies the server-side and client-side permission matrix across administrative roles in Dhaka Heights.

---

## Administrative Roles
1. `super_admin`: Full system control, user management, audit logs, global settings, publishing, and content editing.
2. `content_editor`: Public website pages, page section content, real estate projects, sister concerns, media posts, and global navigation.
3. `sales_manager`: Customer inquiries, lead workflow status, project slot availability, and property inquiries.
4. `hr_manager`: Job vacancies posting, applicant CV submissions, and private resume download links.

---

## Route & Module Permission Matrix

| Admin Route / Module | `super_admin` | `content_editor` | `sales_manager` | `hr_manager` |
|---|---|---|---|---|
| `/admin` (Executive Dashboard) | ✅ Full Access | ✅ Content View | ✅ Sales View | ✅ HR View |
| `/admin/pages/*` (Public Pages CMS) | ✅ Full Access | ✅ Edit & Publish | ❌ No Access | ❌ No Access |
| `/admin/projects/*` (Real Estate Projects) | ✅ Full Access | ✅ Edit Content | ✅ Read & Lead Link | ❌ No Access |
| `/admin/concerns/*` (Sister Concerns) | ✅ Full Access | ✅ Edit Content | ❌ No Access | ❌ No Access |
| `/admin/media/*` (Media & Articles) | ✅ Full Access | ✅ Edit Content | ❌ No Access | ❌ No Access |
| `/admin/careers/*` (Careers & Vacancies) | ✅ Full Access | ❌ No Access | ❌ No Access | ✅ Full Access |
| `/admin/inquiries/*` (Inquiries Inbox) | ✅ Full Access | ❌ No Access | ✅ Full Access | ❌ No Access |
| `/admin/navigation/*` (Header & Footer) | ✅ Full Access | ✅ Edit Content | ❌ No Access | ❌ No Access |
| `/admin/settings` (Site Settings & SEO) | ✅ Full Access | ❌ No Access | ❌ No Access | ❌ No Access |
| `/admin/users` (Users & Roles) | ✅ Full Access | ❌ No Access | ❌ No Access | ❌ No Access |
| `/admin/audit-logs` (Audit Log Trail) | ✅ Full Access | ❌ No Access | ❌ No Access | ❌ No Access |

---

## Enforcement Architecture
- **Sidebar Menu Filtering**: The sidebar component filters visible accordion groups based on `user_metadata.role`.
- **Server-Side API Route Protection**: API route handlers and server actions verify user session role via `supabase.auth.getUser()` before processing queries or mutations.
