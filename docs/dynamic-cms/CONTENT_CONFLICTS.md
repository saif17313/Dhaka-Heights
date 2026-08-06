# Dhaka Heights — Content Conflicts & Data Inconsistencies

This document lists all conflicting project records, inconsistent contact information, broken links, and duplicate datasets identified during the Phase 0 audit.

---

## 1. Project Information Conflicts

### Conflict 1: Dhaka Heights BD Palace
- **`src/components/ProjectsGrid.js`**:
  - Location: `Gulshan-2, Dhaka`
  - Type: `Elite Corporate Tower`
  - Size: `2800 SFT Available`
  - Category: `ongoing`
- **`src/app/concern/[slug]/page.js`** (under `dhaka-heights-developments-limited`):
  - Location: `Bashundhara R/A, Dhaka`
  - Type: `Luxury Residential Apartments`
- **Proposed Resolution**: Treat `ProjectsGrid.js` as canonical primary project record (`Gulshan-2, Corporate`). Use placement-specific overrides on the concern section if necessary, until user clarifies.
- **Status**: Unresolved (Preserving visible output).

---

### Conflict 2: Dhaka Heights Italia
- **`src/components/ProjectsGrid.js`**:
  - Location: `Banani, Dhaka`
  - Type: `Premium Retail & Suites`
  - Category: `upcoming` (Badge: `Upcoming`)
- **`src/app/concern/[slug]/page.js`**:
  - Location: `Bashundhara R/A, Dhaka`
  - Type: `Premium Residential Suites`
  - Category: `ongoing` (Badge: `Ongoing`)
- **Proposed Resolution**: Treat `ProjectsGrid.js` as canonical (`Banani, Upcoming`). Preserve concern overrides until user direction.
- **Status**: Unresolved (Preserving visible output).

---

### Conflict 3: Dhaka Heights Sunsplash
- **`src/components/ProjectsGrid.js`**:
  - Category: `upcoming` (Badge: `Upcoming`)
  - Type: `Luxury Residential Tower`
- **`src/app/concern/[slug]/page.js`**:
  - Category: `ongoing` (Badge: `Ongoing`)
  - Location: `Plot 136/A, Sonia Sobhan 5th Avenue, Block I, Bashundhara R/A, Dhaka`
- **Proposed Resolution**: Use canonical record with `upcoming` status for global listing, while preserving `ongoing` badge on subsidiary portfolio view.
- **Status**: Unresolved (Preserving visible output).

---

### Conflict 4: Dhaka Heights Pinnacle
- **`src/components/ProjectsGrid.js`**:
  - Type: `High-Tech Business Plaza`
  - Location: `Jolshiri Abashon, Dhaka`
- **`src/components/DetailsModal.js`**:
  - Category: `Ongoing Development`
  - Size: `3400 SFT Premium Units`
  - Floors: `G + 9 Residential Floors`
- **`src/app/concern/[slug]/page.js`**:
  - Type: `Premium Residential High-Rise`
- **Proposed Resolution**: Set canonical type to `High-Tech Business Plaza / Mixed-Use High-Rise`.
- **Status**: Unresolved.

---

### Conflict 5: Dhaka Heights Mazumder Palace
- **`src/components/ProjectsGrid.js`**:
  - Location: `Plot# 213/A, Block# J, Bashundhara R/A`
  - Size: `4200 SFT Ready`
- **`src/components/DetailsModal.js`**:
  - Location: `Plot# 213/A, Road# 07, Block# J, Bashundhara R/A, Dhaka`
  - Size: `2200 - 4400 SFT Ready Apartments`
- **Proposed Resolution**: Standardize canonical location to include Road# 07 and size range to `2200 - 4400 SFT`.
- **Status**: Unresolved.

---

## 2. Broken Links & Navigation Defects

### Defect 1: Broken Concern Link on About Page
- **Location**: `src/app/about/page.js` line 211
- **Issue**: Link targets `/concern/dhaka-heights-realty`. However, `src/app/concern/[slug]/page.js` has no entry for `dhaka-heights-realty` (it defines `dhaka-heights-business-solution`). Clicking the card results in a "Concern Not Found" page.
- **Proposed Resolution**: Update slug to `dhaka-heights-business-solution` in canonical database records and update About page mapping.

### Defect 2: Hero Slider Primary CTA Scroll Destination
- **Location**: `src/components/HeroSlider.js` line 121
- **Issue**: `onClick={(e) => handleScrollDown(e)}` forces all primary CTA buttons on all 5 slides to scroll down to `#about`, ignoring `slide.link` (`projects`, `about`, `projects`).
- **Proposed Resolution**: Fix click handler to navigate to `slide.link` (e.g. `/projects` or `#projects`) as configured per slide.

---

## 3. Inconsistent Company Contact Information

- **Corporate Office Address**:
  - `Navbar.js` / `Footer.js`: `House 14, Road 03, Block I, Bashundhara R/A, Dhaka-1229`
  - `ContactForm.js`: `Plot 14, Road 03, Block I, Bashundhara R/A, Dhaka`
- **Hotline Numbers**:
  - `Navbar.js`: `+88 01928 222 777`
  - `Footer.js`: `+880 1928-222777`, `+880 1711-000000`
  - `ContactForm.js`: `+880 1928 222777`, `+880 1711 000000`
- **Company Name & Founding History**:
  - Listed as `Dhaka Heights Properties Limited` on homepage, `Dhaka Heights Construction LTD (JCL)` in media articles (established 2008 / 18 years vs 19th anniversary in media articles).
- **Proposed Resolution**: Create a single canonical `site_settings` table in Supabase for global address, hotline, email, map embed URL, and founding year.

---

## 4. User Decision Status Table

| Conflict ID | Topic | Current Visible Output | Proposed Resolution | User Decision |
| :--- | :--- | :--- | :--- | :--- |
| **CFL-01** | BD Palace Location | Gulshan-2 (Grid) vs Bashundhara (Concern) | Preserve visible output until approved | Pending |
| **CFL-02** | Italia Category | Upcoming (Grid) vs Ongoing (Concern) | Preserve visible output until approved | Pending |
| **CFL-03** | Sunsplash Category | Upcoming (Grid) vs Ongoing (Concern) | Preserve visible output until approved | Pending |
| **CFL-04** | Broken Realty Link | `/concern/dhaka-heights-realty` (Broken) | Map to `dhaka-heights-business-solution` | Pending |
| **CFL-05** | Hero CTA scroll | All scroll to `#about` | Navigate to slide destination | Pending |
