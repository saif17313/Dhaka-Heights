# Dhaka Heights — Testing and Verification Matrix

This document defines all verification criteria, automated tests, visual regression checks, authentication tests, and RLS validation steps for the project.

---

## 1. Public Website Verification Matrix

| Test ID | Test Scenario | Target Route | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :---: |
| **PUB-01** | Homepage Load & Render | `/` | All sections render dynamically, animations load clean | Pending |
| **PUB-02** | Hero Slider CTAs | `/` | Clicking primary CTA navigates to slide's configured link | Pending |
| **PUB-03** | Projects Grid Filtering | `/projects` & `/` | Clicking tabs filters projects correctly without page crash | Pending |
| **PUB-04** | Project Details Route | `/project/[id]` | Renders correct project specs, gallery, floor plans, map | Pending |
| **PUB-05** | Concern Detail Route | `/concern/[slug]` | Renders profile, services, and related projects portfolio | Pending |
| **PUB-06** | Broken Route Resolution | `/concern/dhaka-heights-business-solution` | Loads cleanly without "Concern Not Found" error | Pending |
| **PUB-07** | Media Articles & Detail | `/media-center` & `/media-center/[slug]` | Renders articles, pagination, and full post body | Pending |
| **PUB-08** | Contact Form Submission | `/contact` & `/` | Form submits, validates input, and saves to `inquiries` | Pending |
| **PUB-09** | Career Application Submission | `/career` | Form validates PDF resume, uploads to storage, saves app | Pending |
| **PUB-10** | Draft Content Secrecy | Public Pages | Draft/un-published content is not visible to public users | Pending |

---

## 2. Responsive & Cross-Device Matrix

| Viewport Width | Device Target | Navigation Menu | Cards & Layout | Screenshots Verified |
| :--- | :--- | :--- | :--- | :---: |
| **1440px** | Desktop Monitor | Full Header Bar | Multi-column grid | Yes (Phase 0 Baseline) |
| **1024px** | Laptop / Tablet Landscape | Full Header Bar | 2-3 Column grid | Yes (Phase 0 Baseline) |
| **768px** | Tablet Portrait | Mobile Hamburger Drawer | 1-2 Column grid | Yes (Phase 0 Baseline) |
| **390px** | Mobile Smartphone | Full Mobile Navigation Drawer | 1 Column grid | Yes (Phase 0 Baseline) |

---

## 3. Security, RLS & Authentication Matrix

| Security Test ID | Target Entity | Scenario | Expected Behavior | Status |
| :--- | :--- | :--- | :--- | :---: |
| **SEC-01** | `inquiries` table | Anonymous user attempts `SELECT` query | Access Denied (RLS blocks read) | Pending |
| **SEC-02** | `career_applications` table | Anonymous user attempts `SELECT` query | Access Denied (RLS blocks read) | Pending |
| **SEC-03** | `career-resumes` bucket | Anonymous user requests direct file URL | 403 Forbidden | Pending |
| **SEC-04** | `/admin` routes | Unauthenticated request to `/admin` | Redirected to `/admin/login` | Pending |
| **SEC-05** | Role Access (HR Manager) | HR Manager attempts to access site settings | 403 Access Denied | Pending |
| **SEC-06** | Role Access (Sales Manager) | Sales Manager attempts to access HR resumes | 403 Access Denied | Pending |
| **SEC-07** | Cloudinary Uploads | Client calls upload without server signature | Upload Rejected | Pending |

---

## 4. Build & System Integrity Matrix

- [x] **`npm run build`**: Compiles cleanly with Turbopack (Phase 0 Baseline verified: 3.5s compile time).
- [x] **`npm run lint`**: ESLint audit (Baseline: 21 errors, 25 warnings recorded).
- [ ] **Secret Leak Audit**: Verification that no `.env.local` or secret keys appear in source files or Git commits.
