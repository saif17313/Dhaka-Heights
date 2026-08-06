# Dhaka Heights — Hardcoded Content Inventory

This document lists all hardcoded copy, image assets, icon usages, repeated lists, and card elements across the public website.

---

## 1. Static Assets & Images Inventory

### Public Assets (`public/assets/`):
- `logo.svg` — Brand Logo (Used in Preloader, Navbar, Footer)
- `hero1.png` — Hero Banner Slide 1 (1920x1080)
- `hero2.png` — Hero Banner Slide 2 (1920x1080)
- `hero3.png` — Hero Banner Slide 3 (1920x1080)
- `about_top_facade.png` — About Section Top Architectural Facade
- `about_bottom_interior.png` — About Section Bottom Lobby Interior
- `proj_ariana_lofts.png` — Project Cover / Card Image
- `proj_bd_palace.png` — Project Cover / Card Image
- `proj_italia.png` — Project Cover / Card Image
- `proj_mazumder_palace.png` — Project Cover / Card Image
- `proj_muztaba_mansion.png` — Project Cover / Card Image
- `proj_sunsplash.png` — Project Cover / Card Image
- `proj_silver_spring.png` — Project Cover / Card Image
- `proj_asha_purna.png` — Project Cover / Card Image
- `proj_green_heaven.png` — Project Cover / Card Image
- `proj_pinnacle.png` — Project Cover / Card Image
- `proj_completed.png` — General Completed Project Asset
- `proj_ongoing.png` — General Ongoing Project Asset
- `proj_upcoming.png` — General Upcoming Project Asset
- `media_bg.jpg` — Page Header Background Image
- `concern_bg.png` — Concern Section Background Asset
- `properties_bg.png` — Properties Showcase Background Asset
- `properties_bg_skyline.png` — Skyline Graphic Overlay

---

## 2. Hardcoded Domain Entities

### A. Projects List (10 Canonical Records)

1. `dhaka-heights-ariana-lofts`
   - Name: `Dhaka Heights Ariana Lofts`
   - Category: `ongoing`
   - Badge: `Ongoing`
   - Image: `/assets/proj_ariana_lofts.png`
   - Location: `Block-I, Road-15, Plot-983, Bashundhara R/A, Dhaka`
   - Size: `2400 SFT Available`
   - Type: `Luxury Residential Lofts`
   - Floors: `G + 9 Residential Floors`

2. `dhaka-heights-bd-palace`
   - Name: `Dhaka Heights BD Palace`
   - Category: `ongoing`
   - Badge: `Ongoing`
   - Image: `/assets/proj_bd_palace.png`
   - Location: `Gulshan-2, Dhaka` (Conflict note: Listed as Bashundhara R/A in concern page)
   - Size: `2800 SFT Available`
   - Type: `Elite Corporate Tower`

3. `dhaka-heights-italia`
   - Name: `Dhaka Heights Italia`
   - Category: `upcoming` (Conflict note: Listed as Ongoing in concern page)
   - Badge: `Upcoming`
   - Image: `/assets/proj_italia.png`
   - Location: `Banani, Dhaka` (Conflict note: Listed as Bashundhara R/A in concern page)
   - Size: `3200 SFT Luxury`
   - Type: `Premium Retail & Suites`

4. `dhaka-heights-mazumder-palace`
   - Name: `Dhaka Heights Mazumder Palace`
   - Category: `completed`
   - Badge: `Completed`
   - Image: `/assets/proj_mazumder_palace.png`
   - Location: `Plot# 213/A, Road# 07, Block# J, Bashundhara R/A, Dhaka`
   - Size: `2200 - 4400 SFT Ready Apartments`
   - Type: `Luxury Residential Landmark`

5. `dhaka-heights-muztaba-mansion`
   - Name: `Dhaka Heights Muztaba Mansion`
   - Category: `ongoing`
   - Badge: `Ongoing`
   - Image: `/assets/proj_muztaba_mansion.png`
   - Location: `Road- 13 & 15, Block- G, Bashundhara R/A, Dhaka`
   - Size: `2650 SFT Shell & Core`
   - Type: `Premium Residential Mansion`

6. `dhaka-heights-sunsplash`
   - Name: `Dhaka Heights Sunsplash`
   - Category: `upcoming` (Conflict note: Listed as Ongoing in concern page)
   - Badge: `Upcoming`
   - Image: `/assets/proj_sunsplash.png`
   - Location: `Plot 136/A, Sonia Sobhan 5th Avenue, Block I, Bashundhara R/A, Dhaka`
   - Size: `1850 SFT Apartments`
   - Type: `Luxury Residential Tower`

7. `dhaka-heights-silver-spring`
   - Name: `Dhaka Heights Silver Spring`
   - Category: `completed`
   - Badge: `Completed`
   - Image: `/assets/proj_silver_spring.png`
   - Location: `Block H, Bashundhara R/A, Dhaka`
   - Size: `1520 SFT Cozy`
   - Type: `Luxury Residential Landmark`

8. `dhaka-heights-asha-purna-ii`
   - Name: `Dhaka Heights Asha Purna II`
   - Category: `completed`
   - Badge: `Completed`
   - Image: `/assets/proj_asha_purna.png`
   - Location: `Bashundhara R/A, Dhaka`
   - Size: `1650 SFT Handed-over`
   - Type: `Completed Residential Project`

9. `dhaka-heights-green-heaven`
   - Name: `Dhaka Heights Green Heaven`
   - Category: `ongoing`
   - Badge: `Ongoing`
   - Image: `/assets/proj_green_heaven.png`
   - Location: `Jolshiri Abashon, Dhaka`
   - Size: `2100 SFT Ecological`
   - Type: `Ecological Residential Haven`

10. `dhaka-heights-pinnacle`
    - Name: `Dhaka Heights Pinnacle`
    - Category: `ongoing`
    - Badge: `Ongoing`
    - Image: `/assets/proj_pinnacle.png`
    - Location: `Jolshiri Abashon, Dhaka`
    - Size: `3400 SFT Premium`
    - Type: `High-Tech Business Plaza` (Conflict note: Listed as Residential High-Rise in concern page)

---

### B. Sister Concerns (8 Canonical Subsidiaries)

1. `dhaka-heights-developments-limited` (Dhaka Heights Developments Ltd)
2. `dhaka-heights-construction-limited` (Dhaka Heights Construction Ltd)
3. `dhaka-heights-design-and-interior` (Dhaka Heights Design & Interior)
4. `dhaka-heights-business-solution` (Dhaka Heights Business Solution) — Note: Link in `about/page.js` uses `dhaka-heights-realty` (Defect).
5. `dhaka-heights-global-limited` (Dhaka Heights Global Ltd)
6. `dhaka-heights-power-limited` (Dhaka Heights Power Ltd)
7. `dhaka-heights-maritime-limited` (Dhaka Heights Maritime Ltd)
8. `dhaka-heights-trading` (Dhaka Heights Trading)

---

### C. Media & Articles (16 Canonical Records)
Located in `src/data/mediaArticles.js`:
- `flats-sale-at-an-affordable-price-in-bashundhara-residential-area-dhaka`
- `ground-breaking-ceremony-of-dhaka-heights-green-heaven`
- `dhaka-heights-construction-ltd-jcl-is-a-bangladeshi-real-estate-developer-company-established-in-the-year-2008`
- `জমকালো-আয়োজনে-ঢাকা হাইটস-গ্রুপের-১৯তম-প্রতিষ্ঠাবার্ষিকী-পালন`
- `১৮-বছর-পেরিয়ে-১৯-এ-ঢাকা হাইটস-গ্রুপ-জমকালো-আয়োজনে-প্রতিষ্ঠাবার্ষিকী-পালন`
- `top-10-building-construction-companies-in-bashundhara-dhaka-bangladesh-2023`
- `top-20-real-estate-companies-in-dhaka-bangladesh-2023`
- `we-deeply-value-your-trust-partnership-encouragement`
- `land-owner-satisfying-review-dhaka-heights-group-ii-dhaka-heights-silver-spring`
- `land-owner-satisfying-review-dhaka-heights-group-ii-dhaka-heights-sunsplash`
- `dhaka-heights-muztaba-mansion-basement-casting-honorable-managing-director-sir-visit-the-project`
- `dhaka-heights-asha-purna-ii-project-handover-ceremony`
- `client-satisfying-review-dhaka-heights-sun-splash-handover`
- `land-owner-satisfying-review-project-handover`
- `how-to-choose-best-real-estate-company-for-flat-purchase-in-bashundhara-residential-area-dhaka`
- `the-10-best-real-estate-companies-in-bangladesh-2023`

---

### D. Partners & Financial Clients (8 Records)
Located in `src/app/page.js`:
1. `Prime Bank` (`Finance Partner`, Icon: `fa-building-columns`, Color: `#c5a880`)
2. `City Bank` (`Clearing Partner`, Icon: `fa-university`, Color: `#ff2a2a`)
3. `Apex Corp` (`Corporate Tenant`, Icon: `fa-city`, Color: `#05c46b`)
4. `Chevron Ltd` (`Energy Client`, Icon: `fa-oil-well`, Color: `#f1c40f`)
5. `Standard Chartered` (`Financial Client`, Icon: `fa-vault`, Color: `#38ef7d`)
6. `Beximco Group` (`Strategic Partner`, Icon: `fa-industry`, Color: `#ff9800`)
7. `Eastern Bank` (`Banking Partner`, Icon: `fa-wallet`, Color: `#00d2ff`)
8. `Nexus Tech` (`Technology Client`, Icon: `fa-microchip`, Color: `#e91e63`)
