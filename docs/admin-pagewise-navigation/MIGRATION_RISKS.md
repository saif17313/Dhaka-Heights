# Migration & Implementation Risks Assessment

## Overview
This document evaluates potential technical risks, breaking change concerns, and mitigation strategies for the page-wise and section-wise admin navigation restructuring.

---

## Identified Risks & Mitigation Strategies

| Risk | Risk Severity | Potential Impact | Mitigation Strategy |
|---|---|---|---|
| **1. Existing Route Breakdown** | High | Deep links or external admin bookmarks to `/admin/pages` or `/admin/projects` breaking. | Retain top-level routes as Page Directory and Operational Module overviews. Use App Router parallel routes and nested layouts without breaking parent URLs. |
| **2. Layout CSS Overrides** | Medium | Accordion menu styles accidentally overriding public website or shell geometry. | Keep Admin Shell CSS scoped to `.admin-shell`, `.admin-sidebar`, `.admin-topbar` and explicit inline CSS variables (`--admin-sidebar-width: 292px`). |
| **3. Hardcoding Dynamic Data in Code** | Medium | Hardcoding page sections or project counts in JS files instead of reading from Supabase PostgreSQL. | Enforce hybrid navigation registry: main categories are code-controlled, while page lists, section lists, and counts are fetched dynamically from Supabase database. |
| **4. Relational Data Duplication** | High | Duplicating canonical project or concern records when selecting them for page sections. | Use `section_entity_selections` relational tables for page section placement. The canonical record in `projects` or `concerns` remains the sole source of truth. |
| **5. Unintended Git Branch Changes** | Critical | Committing or pushing directly to `main` branch. | Enforce branch safety rules: all work is performed on dedicated feature branch `feat/admin-pagewise-section-routing`. Zero remote pushes or merges without explicit approval. |
