# Dhaka Heights — Admin Information Architecture

This document defines the menu structure, navigation hierarchy, CRUD flows, preview states, and role permissions for the `/admin` portal.

---

## 1. Admin Brand & Visual Direction
The administration portal adopts a high-end, executive aesthetic tailored to the Dhaka Heights corporate identity:
- **Surface Palette**: Deep Navy `#0B1B3D`, Dark Charcoal `#111827`, Glassmorphic Card Surfaces `#162447`.
- **Accent Palette**: Brushed Gold `#C5A880`, Warm Gold `#D4AF37`, Bright Gold `#E5C158`.
- **Content Surfaces**: Clean Ivory `#FAFAFA` / Pure White `#FFFFFF` inside form card containers for optimal readability.
- **Micro-Interactions**: Soft 3D depth layers, subtle border glows on focus, smooth collapsible drawer transitions.

---

## 2. Navigation Hierarchy & Sidebar Structure

```
/admin (Dashboard)
├── Overview Metrics & Quick Actions
│
├── 🌐 Website Content (Pages & Sections)
│   ├── Home Page
│   │   ├── Hero Banner Slider
│   │   ├── About Preview Block
│   │   ├── Metrics Stats Banner
│   │   ├── Featured Projects Placement
│   │   ├── Commitment Quote
│   │   ├── Media Highlights Placement
│   │   ├── Partners Carousel
│   │   └── Contact & Map CTA
│   ├── About Us Page
│   ├── Projects Page
│   ├── Concerns Page
│   ├── Media Center Page
│   ├── Career Page
│   └── Contact Us Page
│
├── 🏢 Portfolio Management
│   ├── Projects (Canonical CRUD, Specs, Floor Plans, Gallery, SEO)
│   └── Sister Concerns (Canonical Subsidiaries, Profiles, Services)
│
├── 📰 Media & Press
│   └── Media Posts (Articles, News, Press Releases, Featured Toggle)
│
├── 💼 Careers & HR
│   ├── Job Openings (Vacancies, Requirements, Deadlines)
│   └── Applications Inbox (Applicant Resumes, Private CV Download, Status Workflow)
│
├── 📥 Inquiries & Leads
│   └── Leads Inbox (Contact, Project Inquiries, Callbacks, Layout PDF Requests)
│
├── 🖼️ Media Library
│   ├── Asset Explorer (Grid/List, Cloudinary Folder Tree, Search, Tags)
│   └── Icon Picker (Lucide Allowlist + Custom Uploaded SVGs)
│
├── ⚙️ Navigation & Footer
│   ├── Header Navbar Editor
│   ├── Footer Groups & Links
│   └── Social Links Manager
│
├── 🛠️ Site Settings
│   ├── Global Coordinates (Address, Phone, Email, Maps, Logo, Favicon)
│   └── SEO Defaults & Open Graph Settings
│
└── 🔐 Governance & Audit
    ├── Admin Users & RBAC
    └── Audit Logs
```

---

## 3. Role Permissions Matrix

| Admin Module | Super Admin | Content Editor | Sales Manager | HR Manager |
| :--- | :---: | :---: | :---: | :---: |
| **Dashboard Summary** | Full | Content Only | Leads Only | HR Only |
| **Website Content Editors** | ✅ Full | ✅ Edit & Publish | ❌ No | ❌ No |
| **Projects & Concerns CRUD** | ✅ Full | ✅ Edit & Publish | 👁️ Read-Only | ❌ No |
| **Media Posts CRUD** | ✅ Full | ✅ Edit & Publish | ❌ No | ❌ No |
| **Job Openings CRUD** | ✅ Full | ❌ No | ❌ No | ✅ Full |
| **Applications & Private CVs** | ✅ Full | ❌ No Access | ❌ No Access | ✅ Full |
| **Inquiries Inbox** | ✅ Full | ❌ No Access | ✅ Full | ❌ No Access |
| **Media Library** | ✅ Full | ✅ Upload & Edit | ❌ Read-Only | ❌ Read-Only |
| **Site Settings & Navigation** | ✅ Full | ✅ Edit | ❌ No | ❌ No |
| **Admin User Management** | ✅ Full | ❌ No | ❌ No | ❌ No |
| **Audit Logs** | ✅ View | ❌ No | ❌ No | ❌ No |

---

## 4. User Experience & Editor Workflows

### Section Content Editor Flow:
1. Administrator navigates to `Website Content -> [Page Name] -> [Section Name]`.
2. Fields load in structured forms (Headings, Tags, Body, CTA buttons, Image selectors).
3. **Card Collection Editor**: Reorder handles with drag-and-drop support + keyboard fallback buttons (`Move Up`, `Move Down`).
4. **Relational Entity Picker**: Select canonical project/concern/article with optional placement override inputs (Alternate title, short description, custom cover image).
5. **Live Section Preview**: Embedded responsive iframe preview updates in real time.
6. **Save Draft / Publish**: Administrator can save as `Draft` or click `Publish Now` (triggers revalidation of public Next.js route).

### Media Selector & Image Picker Workflow:
- Every image input field provides 3 clear actions:
  1. `Choose from Media Library` (Opens modal asset selector).
  2. `Upload New Asset` (Invokes server-signed Cloudinary upload).
  3. `Remove / Clear Image`.
- Previews display current aspect ratio, format, dimensions, alt text, and public ID.
