-- Dhaka Heights Dynamic CMS — Seed Data
-- Seed: supabase/seed.sql

-- 1. SEED SITE SETTINGS
INSERT INTO site_settings (
    site_title, tagline, company_name, founding_year,
    primary_phone, secondary_phone, primary_email, sales_email, hr_email,
    office_address, map_iframe_url
) VALUES (
    'Dhaka Heights Properties Limited',
    'YOUR PRESTIGIOUS LIVING',
    'Dhaka Heights Properties Limited',
    2008,
    '+880 1928 222777',
    '+880 1711 000000',
    'info@dhakaheights.com',
    'sales@dhakaheights.com',
    'careers@dhakaheights.com',
    'House 14, Road 03, Block I, Bashundhara R/A, Dhaka-1229',
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3650.098274712061!2d90.42531631536412!3d23.81510199221297!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3755c64c103a8093%3A0xd660a5f503ba86c1!2sBashundhara%20R%2FA%2C%20Dhaka!5e0!3m2!1sen!2sbd!4v1645000000000!5m2!1sen!2sbd'
);

-- 2. SEED PAGES
INSERT INTO pages (slug, title, is_published) VALUES
('home', 'Home | Dhaka Heights Properties Limited', true),
('about', 'About Us | Dhaka Heights Properties Limited', true),
('projects', 'Our Projects | Dhaka Heights Properties Limited', true),
('concerns', 'Sister Concerns | Dhaka Heights Properties Limited', true),
('media-center', 'Media Center | Dhaka Heights Properties Limited', true),
('career', 'Career Opportunities | Dhaka Heights Properties Limited', true),
('contact', 'Contact Us | Dhaka Heights Properties Limited', true);

-- 3. SEED NAVIGATION ITEMS
INSERT INTO navigation_items (label, url, sort_order) VALUES
('Home', '/', 10),
('About', '/about', 20),
('Concern', '/about#concerns', 30),
('Projects', '/projects', 40),
('Media', '/media-center', 50),
('Career', '/career', 60),
('Contact', '/contact', 70);

-- 4. SEED FOOTER GROUPS & LINKS
INSERT INTO footer_groups (title, sort_order) VALUES
('Quick Links', 10),
('Sister Concerns', 20);

INSERT INTO footer_links (group_id, label, url, sort_order)
SELECT id, 'About Us', '/about', 10 FROM footer_groups WHERE title = 'Quick Links';
INSERT INTO footer_links (group_id, label, url, sort_order)
SELECT id, 'Our Projects', '/projects', 20 FROM footer_groups WHERE title = 'Quick Links';
INSERT INTO footer_links (group_id, label, url, sort_order)
SELECT id, 'Media Center', '/media-center', 30 FROM footer_groups WHERE title = 'Quick Links';
INSERT INTO footer_links (group_id, label, url, sort_order)
SELECT id, 'Career', '/career', 40 FROM footer_groups WHERE title = 'Quick Links';
INSERT INTO footer_links (group_id, label, url, sort_order)
SELECT id, 'Contact Us', '/contact', 50 FROM footer_groups WHERE title = 'Quick Links';

INSERT INTO footer_links (group_id, label, url, sort_order)
SELECT id, 'DH Developments Ltd', '/concern/dhaka-heights-developments-limited', 10 FROM footer_groups WHERE title = 'Sister Concerns';
INSERT INTO footer_links (group_id, label, url, sort_order)
SELECT id, 'DH Construction Ltd', '/concern/dhaka-heights-construction-limited', 20 FROM footer_groups WHERE title = 'Sister Concerns';
INSERT INTO footer_links (group_id, label, url, sort_order)
SELECT id, 'DH Design & Interior', '/concern/dhaka-heights-design-and-interior', 30 FROM footer_groups WHERE title = 'Sister Concerns';
INSERT INTO footer_links (group_id, label, url, sort_order)
SELECT id, 'DH Business Solution', '/concern/dhaka-heights-business-solution', 40 FROM footer_groups WHERE title = 'Sister Concerns';

-- 5. SEED SOCIAL LINKS
INSERT INTO social_links (platform_name, url, icon_key, sort_order) VALUES
('Facebook', 'https://facebook.com/dhakaheights', 'fa-facebook-f', 10),
('LinkedIn', 'https://linkedin.com/company/dhakaheights', 'fa-linkedin-in', 20),
('YouTube', 'https://youtube.com/@dhakaheights', 'fa-youtube', 30),
('Instagram', 'https://instagram.com/dhakaheights', 'fa-instagram', 40);
