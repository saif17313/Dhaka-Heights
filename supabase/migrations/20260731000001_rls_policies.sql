-- Dhaka Heights Dynamic CMS — Row Level Security (RLS) Policies
-- Migration: 20260731000001_rls_policies.sql

-- ENABLE RLS ON ALL TABLES
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_icons ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_asset_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE navigation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE footer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE footer_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE concerns ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_floor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_entity_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_entity_selection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_revisions ENABLE ROW LEVEL SECURITY;

-- HELPER FUNCTION TO GET CURRENT ADMIN ROLE
CREATE OR REPLACE FUNCTION get_admin_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM admin_profiles WHERE id = auth.uid() AND is_active = true;
$$;

-- 1. PUBLIC READ-ONLY POLICIES FOR PUBLISHED CONTENT

CREATE POLICY "Public Read Site Settings" ON site_settings
    FOR SELECT USING (true);

CREATE POLICY "Public Read Published Pages" ON pages
    FOR SELECT USING (is_published = true);

CREATE POLICY "Public Read Visible Page Sections" ON page_sections
    FOR SELECT USING (is_visible = true);

CREATE POLICY "Public Read Visible Section Items" ON section_items
    FOR SELECT USING (is_visible = true);

CREATE POLICY "Public Read Visible Navigation" ON navigation_items
    FOR SELECT USING (is_visible = true);

CREATE POLICY "Public Read Visible Footer Groups" ON footer_groups
    FOR SELECT USING (is_visible = true);

CREATE POLICY "Public Read Visible Footer Links" ON footer_links
    FOR SELECT USING (is_visible = true);

CREATE POLICY "Public Read Visible Social Links" ON social_links
    FOR SELECT USING (is_visible = true);

CREATE POLICY "Public Read Published Concerns" ON concerns
    FOR SELECT USING (status = 'published');

CREATE POLICY "Public Read Published Projects" ON projects
    FOR SELECT USING (status = 'published');

CREATE POLICY "Public Read Project Features" ON project_features
    FOR SELECT USING (true);

CREATE POLICY "Public Read Project Amenities" ON project_amenities
    FOR SELECT USING (true);

CREATE POLICY "Public Read Project Floor Plans" ON project_floor_plans
    FOR SELECT USING (true);

CREATE POLICY "Public Read Project Media" ON project_media
    FOR SELECT USING (true);

CREATE POLICY "Public Read Project Documents" ON project_documents
    FOR SELECT USING (true);

CREATE POLICY "Public Read Published Media Posts" ON media_posts
    FOR SELECT USING (status = 'published');

CREATE POLICY "Public Read Active Job Openings" ON job_openings
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public Read Section Selections" ON section_entity_selections
    FOR SELECT USING (true);

CREATE POLICY "Public Read Selection Items" ON section_entity_selection_items
    FOR SELECT USING (is_visible = true);

CREATE POLICY "Public Read Media Assets" ON media_assets
    FOR SELECT USING (is_archived = false);

CREATE POLICY "Public Read Custom Icons" ON custom_icons
    FOR SELECT USING (true);

-- 2. PUBLIC SUBMISSION WRITE-ONLY POLICIES

CREATE POLICY "Public Insert Inquiries" ON inquiries
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public Insert Career Applications" ON career_applications
    FOR INSERT WITH CHECK (true);

-- 3. ADMIN POLICIES (Super Admin & Content Editors)

CREATE POLICY "Admin Full Access Site Settings" ON site_settings
    FOR ALL USING (get_admin_role() IN ('super_admin', 'content_editor'));

CREATE POLICY "Admin Full Access Pages" ON pages
    FOR ALL USING (get_admin_role() IN ('super_admin', 'content_editor'));

CREATE POLICY "Admin Full Access Page Sections" ON page_sections
    FOR ALL USING (get_admin_role() IN ('super_admin', 'content_editor'));

CREATE POLICY "Admin Full Access Section Items" ON section_items
    FOR ALL USING (get_admin_role() IN ('super_admin', 'content_editor'));

CREATE POLICY "Admin Full Access Navigation" ON navigation_items
    FOR ALL USING (get_admin_role() IN ('super_admin', 'content_editor'));

CREATE POLICY "Admin Full Access Footer Groups" ON footer_groups
    FOR ALL USING (get_admin_role() IN ('super_admin', 'content_editor'));

CREATE POLICY "Admin Full Access Footer Links" ON footer_links
    FOR ALL USING (get_admin_role() IN ('super_admin', 'content_editor'));

CREATE POLICY "Admin Full Access Social Links" ON social_links
    FOR ALL USING (get_admin_role() IN ('super_admin', 'content_editor'));

CREATE POLICY "Admin Full Access Concerns" ON concerns
    FOR ALL USING (get_admin_role() IN ('super_admin', 'content_editor'));

CREATE POLICY "Admin Full Access Projects" ON projects
    FOR ALL USING (get_admin_role() IN ('super_admin', 'content_editor'));

CREATE POLICY "Admin Full Access Project Features" ON project_features
    FOR ALL USING (get_admin_role() IN ('super_admin', 'content_editor'));

CREATE POLICY "Admin Full Access Project Amenities" ON project_amenities
    FOR ALL USING (get_admin_role() IN ('super_admin', 'content_editor'));

CREATE POLICY "Admin Full Access Project Floor Plans" ON project_floor_plans
    FOR ALL USING (get_admin_role() IN ('super_admin', 'content_editor'));

CREATE POLICY "Admin Full Access Project Media" ON project_media
    FOR ALL USING (get_admin_role() IN ('super_admin', 'content_editor'));

CREATE POLICY "Admin Full Access Project Documents" ON project_documents
    FOR ALL USING (get_admin_role() IN ('super_admin', 'content_editor'));

CREATE POLICY "Admin Full Access Media Posts" ON media_posts
    FOR ALL USING (get_admin_role() IN ('super_admin', 'content_editor'));

CREATE POLICY "Admin Full Access Media Assets" ON media_assets
    FOR ALL USING (get_admin_role() IN ('super_admin', 'content_editor'));

CREATE POLICY "Admin Full Access Custom Icons" ON custom_icons
    FOR ALL USING (get_admin_role() IN ('super_admin', 'content_editor'));

CREATE POLICY "Admin Full Access Section Selections" ON section_entity_selections
    FOR ALL USING (get_admin_role() IN ('super_admin', 'content_editor'));

CREATE POLICY "Admin Full Access Selection Items" ON section_entity_selection_items
    FOR ALL USING (get_admin_role() IN ('super_admin', 'content_editor'));

-- 4. ROLE SPECIFIC POLICIES (Sales Manager & HR Manager)

CREATE POLICY "Sales Manager Manage Inquiries" ON inquiries
    FOR ALL USING (get_admin_role() IN ('super_admin', 'sales_manager'));

CREATE POLICY "HR Manager Manage Job Openings" ON job_openings
    FOR ALL USING (get_admin_role() IN ('super_admin', 'hr_manager'));

CREATE POLICY "HR Manager Manage Applications" ON career_applications
    FOR ALL USING (get_admin_role() IN ('super_admin', 'hr_manager'));

CREATE POLICY "Super Admin Manage Profiles" ON admin_profiles
    FOR ALL USING (get_admin_role() = 'super_admin');

CREATE POLICY "Super Admin Read Audit Logs" ON audit_logs
    FOR SELECT USING (get_admin_role() = 'super_admin');
