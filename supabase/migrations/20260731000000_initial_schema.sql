-- Dhaka Heights Dynamic CMS — Initial Schema Migration
-- Migration: 20260731000000_initial_schema.sql

-- 1. CUSTOM ENUMS
CREATE TYPE app_role AS ENUM ('super_admin', 'content_editor', 'sales_manager', 'hr_manager');
CREATE TYPE content_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE submission_status AS ENUM ('new', 'contacted', 'qualified', 'closed', 'spam');
CREATE TYPE application_status AS ENUM ('new', 'reviewing', 'shortlisted', 'interviewed', 'rejected', 'hired');

-- 2. ADMIN PROFILES
CREATE TABLE admin_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role app_role NOT NULL DEFAULT 'content_editor',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. MEDIA ASSETS
CREATE TABLE media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id TEXT UNIQUE NOT NULL,
    secure_url TEXT NOT NULL,
    resource_type TEXT NOT NULL DEFAULT 'image',
    format TEXT NOT NULL DEFAULT 'webp',
    width INT,
    height INT,
    bytes INT,
    original_filename TEXT,
    display_name TEXT,
    folder TEXT NOT NULL DEFAULT 'dhaka-heights/dev',
    alt_text TEXT DEFAULT '',
    caption TEXT DEFAULT '',
    tags TEXT[] DEFAULT '{}',
    uploaded_by UUID REFERENCES admin_profiles(id) ON DELETE SET NULL,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. CUSTOM ICONS & MEDIA USAGE
CREATE TABLE custom_icons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    icon_name TEXT UNIQUE NOT NULL,
    media_asset_id UUID REFERENCES media_assets(id) ON DELETE CASCADE,
    category TEXT DEFAULT 'general',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE media_asset_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    field_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. SITE SETTINGS
CREATE TABLE site_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_title TEXT NOT NULL DEFAULT 'Dhaka Heights Properties Limited',
    tagline TEXT NOT NULL DEFAULT 'YOUR PRESTIGIOUS LIVING',
    company_name TEXT NOT NULL DEFAULT 'Dhaka Heights Properties Limited',
    founding_year INT NOT NULL DEFAULT 2008,
    primary_phone TEXT NOT NULL DEFAULT '+880 1928 222777',
    secondary_phone TEXT DEFAULT '+880 1711 000000',
    primary_email TEXT NOT NULL DEFAULT 'info@dhakaheights.com',
    sales_email TEXT DEFAULT 'sales@dhakaheights.com',
    hr_email TEXT DEFAULT 'careers@dhakaheights.com',
    office_address TEXT NOT NULL DEFAULT 'House 14, Road 03, Block I, Bashundhara R/A, Dhaka-1229',
    map_iframe_url TEXT,
    logo_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    favicon_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. PAGES & SECTIONS
CREATE TABLE pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    seo_meta_title TEXT,
    seo_meta_description TEXT,
    seo_canonical_url TEXT,
    seo_og_image_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    is_published BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE page_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    section_key TEXT NOT NULL,
    section_name TEXT NOT NULL,
    tag_text TEXT,
    heading TEXT,
    subheading TEXT,
    description TEXT,
    allowed_variant TEXT DEFAULT 'default',
    sort_order INT NOT NULL DEFAULT 10,
    is_visible BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE section_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES page_sections(id) ON DELETE CASCADE,
    title TEXT,
    subtitle TEXT,
    body_text TEXT,
    tag_text TEXT,
    primary_cta_label TEXT,
    primary_cta_url TEXT,
    secondary_cta_label TEXT,
    secondary_cta_url TEXT,
    icon_library TEXT DEFAULT 'lucide',
    icon_key TEXT,
    custom_icon_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    image_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    accent_color TEXT,
    sort_order INT NOT NULL DEFAULT 10,
    is_visible BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. NAVIGATION & FOOTER
CREATE TABLE navigation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES navigation_items(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    target TEXT DEFAULT '_self',
    sort_order INT NOT NULL DEFAULT 10,
    is_visible BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE footer_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 10,
    is_visible BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE footer_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES footer_groups(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 10,
    is_visible BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE social_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_name TEXT NOT NULL,
    url TEXT NOT NULL,
    icon_key TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 10,
    is_visible BOOLEAN NOT NULL DEFAULT true
);

-- 8. DOMAIN ENTITIES: CONCERNS, PROJECTS, MEDIA, JOBS
CREATE TABLE concerns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    subtitle TEXT,
    overview TEXT,
    cover_image_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    logo_image_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    features_list JSONB DEFAULT '[]'::jsonb,
    status content_status NOT NULL DEFAULT 'published',
    sort_order INT NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    tagline TEXT,
    category TEXT NOT NULL CHECK (category IN ('ongoing', 'completed', 'upcoming')),
    badge_text TEXT NOT NULL,
    location_address TEXT NOT NULL,
    city_zone TEXT NOT NULL,
    size_summary TEXT NOT NULL,
    project_type TEXT NOT NULL,
    floor_structure TEXT,
    parking_summary TEXT,
    elevator_summary TEXT,
    power_summary TEXT,
    description_short TEXT,
    description_full TEXT,
    cover_image_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    map_iframe_url TEXT,
    concern_id UUID REFERENCES concerns(id) ON DELETE SET NULL,
    status content_status NOT NULL DEFAULT 'published',
    sort_order INT NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE project_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    feature_title TEXT NOT NULL,
    icon_key TEXT,
    sort_order INT NOT NULL DEFAULT 10
);

CREATE TABLE project_amenities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    amenity_title TEXT NOT NULL,
    icon_key TEXT,
    sort_order INT NOT NULL DEFAULT 10
);

CREATE TABLE project_floor_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    unit_size TEXT,
    image_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    sort_order INT NOT NULL DEFAULT 10
);

CREATE TABLE project_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    caption TEXT,
    sort_order INT NOT NULL DEFAULT 10
);

CREATE TABLE project_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    document_asset_id UUID REFERENCES media_assets(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 10
);

CREATE TABLE media_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    published_date DATE NOT NULL DEFAULT CURRENT_DATE,
    excerpt TEXT,
    content_body TEXT,
    cover_image_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    status content_status NOT NULL DEFAULT 'published',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE job_openings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    department TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT 'Dhaka, Bangladesh',
    job_type TEXT NOT NULL DEFAULT 'Full-Time',
    experience_required TEXT NOT NULL,
    closing_date DATE,
    description TEXT NOT NULL,
    responsibilities JSONB DEFAULT '[]'::jsonb,
    requirements JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. RELATIONAL SELECTIONS (PLACEMENT OVERRIDES)
CREATE TABLE section_entity_selections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES page_sections(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'concern', 'media_post')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE section_entity_selection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    selection_id UUID NOT NULL REFERENCES section_entity_selections(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    concern_id UUID REFERENCES concerns(id) ON DELETE CASCADE,
    media_post_id UUID REFERENCES media_posts(id) ON DELETE CASCADE,
    override_title TEXT,
    override_description TEXT,
    override_cover_image_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    override_cta_label TEXT,
    sort_order INT NOT NULL DEFAULT 10,
    is_visible BOOLEAN NOT NULL DEFAULT true
);

-- 10. SUBMISSIONS (INQUIRIES & CAREER APPLICATIONS)
CREATE TABLE inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_type TEXT NOT NULL CHECK (submission_type IN ('contact', 'project_inquiry', 'callback_request', 'layout_request')),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    subject TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    status submission_status NOT NULL DEFAULT 'new',
    admin_notes TEXT,
    assigned_to UUID REFERENCES admin_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE career_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_opening_id UUID REFERENCES job_openings(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    cover_letter TEXT,
    resume_storage_path TEXT NOT NULL,
    resume_original_filename TEXT NOT NULL,
    status application_status NOT NULL DEFAULT 'new',
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. AUDIT LOGS & REVISIONS
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES admin_profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE content_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    revision_data JSONB NOT NULL,
    created_by UUID REFERENCES admin_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. INDEXES FOR PERFORMANCE
CREATE INDEX idx_projects_slug ON projects(slug);
CREATE INDEX idx_projects_status_sort ON projects(status, sort_order);
CREATE INDEX idx_concerns_slug ON concerns(slug);
CREATE INDEX idx_media_posts_slug ON media_posts(slug);
CREATE INDEX idx_media_posts_status ON media_posts(status, published_date DESC);
CREATE INDEX idx_page_sections_page ON page_sections(page_id, sort_order);
CREATE INDEX idx_section_items_section ON section_items(section_id, sort_order);
CREATE INDEX idx_inquiries_status ON inquiries(status, created_at DESC);
CREATE INDEX idx_career_apps_status ON career_applications(status, created_at DESC);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
