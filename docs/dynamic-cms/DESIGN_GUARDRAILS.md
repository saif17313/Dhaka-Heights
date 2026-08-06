# Dhaka Heights — Public Website Design Guardrails

This document establishes the inviolable design tokens, typography rules, color standards, component class protections, and baseline visual guidelines for the public website.

---

## 1. Protected Public Design Tokens

### Core Color Palette
- **Primary Navy (`--primary-navy`)**: `#0B1B3D`
- **Accent Gold (`--accent-gold`)**: `#C5A880`
- **Dark Gold / Border (`--gold-dark`)**: `#A68A60`
- **Base Cream / Off-White (`--base-cream`)**: `#FAF9F6`
- **Card Background Dark (`--card-bg-navy`)**: `rgba(11, 27, 61, 0.85)`
- **Border Light (`--border-light`)**: `#E2E8F0`

### Core Typography
- **Serif Font (`--font-playfair`)**: `Playfair Display`, `Georgia`, serif
- **Sans-Serif Font (`--font-inter`)**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif

### Visual & Depth Effects
- **Subtle Glassmorphism**: `backdrop-filter: blur(12px); background: rgba(11, 27, 61, 0.75);`
- **3D Card Tilt Effect**: Preserved via interactive mouse-movement transform calculation (`rotateX`, `rotateY`, `scale3d(1.02, 1.02, 1.02)`).
- **Golden Offset Borders**: Preserved on feature images (`border: 2px solid var(--accent-gold); transform: translate(10px, 10px)`).

---

## 2. Mandatory Restrictions & Prohibitions

1. **No Public Visual Redesign**: The public website design is the absolute visual source of truth. No components, colors, card margins, or fonts may be altered.
2. **No Unrestricted Raw HTML/CSS**: Administrators are not allowed to inject arbitrary raw CSS or inline JavaScript through the CMS.
3. **No Tailwind in Public Bundle**: Do not install Tailwind on public pages or rewrite existing CSS classes (`src/app/globals.css`).
4. **Predefined Safe Variants**: Allowed design options in CMS must be code-controlled enum variants (e.g., `variant = 'default'`, `variant = 'dark'`, `variant = 'gold-accent'`).
5. **Image Aspect Ratios**: Dynamic Cloudinary image URLs must preserve original visual aspect ratios and card crop parameters (`object-fit: cover`).

---

## 3. Baseline Screenshots & Viewport Records

Baseline screenshots captured during Phase 0 are stored in the artifact directory (`brain/19d6626f-190b-46d9-9d0a-7834e788d839/`):

| Page Route | 1440px Desktop Baseline | 1024px Laptop/Tablet | 768px Tablet | 390px Mobile |
| :--- | :--- | :--- | :--- | :--- |
| `/` (Homepage) | `homepage_maximized.png` | `homepage_1024.png` | `homepage_768.png` | `homepage_390.png` |
| `/about` | `about_1440.png` | `about_1024.png` | `about_768.png` | `about_390.png` |
| `/projects` | `projects_1440.png` | `projects_1024.png` | `projects_768.png` | `projects_390.png` |
| `/project/[id]` | `project_detail_1440.png` | `project_detail_1024.png` | `project_detail_768.png` | `project_detail_390.png` |
| `/media-center` | `media_center_1440.png` | `media_center_1024.png` | `media_center_768.png` | `media_center_390.png` |
| `/career` | `career_1440.png` | `career_1024.png` | `career_768.png` | `career_390.png` |
| `/contact` | `contact_1440.png` | `contact_1024.png` | `contact_768.png` | `contact_390.png` |

---

## 4. Protected CSS Classes
The following CSS class names in `src/app/globals.css` must remain unchanged:
- `.hero-section`, `.slider-wrapper`, `.slide-bg`, `.slide-content`
- `.about-section-premium`, `.about-premium-grid`, `.overview-top-img`, `.overview-bottom-img`
- `.projects-section`, `.projects-grid`, `.project-card`, `.project-badge`
- `.concern-card-premium`, `.concern-card-bg-layer`, `.concern-card-overlay-layer`
- `.btn-premium`, `.btn-gold`, `.btn-outline-navy`, `.section-tag-gold`
- `.details-modal-wrapper`, `.modal-overlay`, `.preloader`
