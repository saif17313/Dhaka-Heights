-- Dhaka Heights CMS - versioned Home Hero workflow
-- This migration is intentionally safe to stage in source control. Apply it only
-- to the confirmed development Supabase project after taking a database backup.

BEGIN;

-- Versioned page sections. A section key may have one draft, one published
-- version, and any number of archived historical versions.
ALTER TABLE page_sections
    ADD COLUMN IF NOT EXISTS status content_status,
    ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES admin_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES admin_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS supersedes_id UUID REFERENCES page_sections(id) ON DELETE SET NULL;

-- Preserve pre-workflow legacy content as published, while every new direct
-- insert defaults safely to draft.
UPDATE page_sections SET status = 'published' WHERE status IS NULL;
ALTER TABLE page_sections
    ALTER COLUMN status SET DEFAULT 'draft',
    ALTER COLUMN status SET NOT NULL;

UPDATE page_sections
   SET settings = jsonb_set(settings, '{autoplay_ms}', '6000'::jsonb, true)
 WHERE section_key = 'hero-slider'
   AND NOT (settings ? 'autoplay_ms');

ALTER TABLE section_items
    ADD COLUMN IF NOT EXISTS primary_cta_target TEXT NOT NULL DEFAULT '_self',
    ADD COLUMN IF NOT EXISTS secondary_cta_target TEXT NOT NULL DEFAULT '_self',
    ADD COLUMN IF NOT EXISTS mobile_image_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS image_alt TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES admin_profiles(id) ON DELETE SET NULL;

ALTER TABLE content_revisions
    ADD COLUMN IF NOT EXISTS version_number INTEGER,
    ADD COLUMN IF NOT EXISTS change_summary TEXT;

CREATE TABLE IF NOT EXISTS media_deletion_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL,
    public_id TEXT NOT NULL,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('image', 'video', 'raw')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'failed', 'completed')),
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    last_error TEXT,
    requested_by UUID REFERENCES admin_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE media_deletion_outbox ENABLE ROW LEVEL SECURITY;

-- Referenced media cannot be hard-deleted. Removing a section/image relation
-- deletes only that relation; explicit media deletion is allowed only after all
-- usage and content references have been removed.
ALTER TABLE media_asset_usage
    DROP CONSTRAINT IF EXISTS media_asset_usage_media_asset_id_fkey,
    ADD CONSTRAINT media_asset_usage_media_asset_id_fkey
        FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT;

ALTER TABLE section_items
    DROP CONSTRAINT IF EXISTS section_items_image_asset_id_fkey,
    ADD CONSTRAINT section_items_image_asset_id_fkey
        FOREIGN KEY (image_asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT,
    DROP CONSTRAINT IF EXISTS section_items_mobile_image_asset_id_fkey,
    ADD CONSTRAINT section_items_mobile_image_asset_id_fkey
        FOREIGN KEY (mobile_image_asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'page_sections_version_positive'
    ) THEN
        ALTER TABLE page_sections
            ADD CONSTRAINT page_sections_version_positive CHECK (version_number > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'page_sections_settings_object'
    ) THEN
        ALTER TABLE page_sections
            ADD CONSTRAINT page_sections_settings_object
            CHECK (jsonb_typeof(settings) = 'object');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'page_sections_hero_autoplay_valid'
    ) THEN
        ALTER TABLE page_sections
            ADD CONSTRAINT page_sections_hero_autoplay_valid
            CHECK (
                section_key <> 'hero-slider'
                OR (
                    settings ? 'autoplay_ms'
                    AND jsonb_typeof(settings -> 'autoplay_ms') = 'number'
                    AND (settings ->> 'autoplay_ms')::INTEGER BETWEEN 3000 AND 15000
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'section_items_primary_cta_target_valid'
    ) THEN
        ALTER TABLE section_items
            ADD CONSTRAINT section_items_primary_cta_target_valid
            CHECK (primary_cta_target IN ('_self', '_blank'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'section_items_secondary_cta_target_valid'
    ) THEN
        ALTER TABLE section_items
            ADD CONSTRAINT section_items_secondary_cta_target_valid
            CHECK (secondary_cta_target IN ('_self', '_blank'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'section_selection_item_one_entity'
    ) THEN
        ALTER TABLE section_entity_selection_items
            ADD CONSTRAINT section_selection_item_one_entity
            CHECK (num_nonnulls(project_id, concern_id, media_post_id) = 1);
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_page_sections_version
    ON page_sections (page_id, section_key, version_number);

CREATE UNIQUE INDEX IF NOT EXISTS uq_page_sections_active_draft
    ON page_sections (page_id, section_key)
    WHERE status = 'draft';

CREATE UNIQUE INDEX IF NOT EXISTS uq_page_sections_active_published
    ON page_sections (page_id, section_key)
    WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_page_sections_status_lookup
    ON page_sections (page_id, section_key, status, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_page_sections_supersedes
    ON page_sections (supersedes_id)
    WHERE supersedes_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_media_asset_usage_reference
    ON media_asset_usage (media_asset_id, table_name, record_id, field_name);

CREATE INDEX IF NOT EXISTS idx_media_asset_usage_record
    ON media_asset_usage (table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_content_revisions_record
    ON content_revisions (table_name, record_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_media_deletion_outbox_active_asset
    ON media_deletion_outbox (asset_id)
    WHERE status IN ('pending', 'failed');

CREATE UNIQUE INDEX IF NOT EXISTS uq_media_deletion_outbox_active_public_id
    ON media_deletion_outbox (public_id)
    WHERE status IN ('pending', 'failed');

CREATE UNIQUE INDEX IF NOT EXISTS uq_section_selection_project
    ON section_entity_selection_items (selection_id, project_id)
    WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_section_selection_concern
    ON section_entity_selection_items (selection_id, concern_id)
    WHERE concern_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_section_selection_media_post
    ON section_entity_selection_items (selection_id, media_post_id)
    WHERE media_post_id IS NOT NULL;

CREATE OR REPLACE FUNCTION set_home_content_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := clock_timestamp();
    RETURN NEW;
END;
$$;

-- Harden the existing role helper used throughout RLS against search-path
-- substitution while preserving its original contract.
CREATE OR REPLACE FUNCTION get_admin_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT role
      FROM admin_profiles
     WHERE id = auth.uid()
       AND is_active = true;
$$;

DROP TRIGGER IF EXISTS set_page_sections_updated_at ON page_sections;
CREATE TRIGGER set_page_sections_updated_at
    BEFORE UPDATE ON page_sections
    FOR EACH ROW
    EXECUTE FUNCTION set_home_content_updated_at();

DROP TRIGGER IF EXISTS set_section_items_updated_at ON section_items;
CREATE TRIGGER set_section_items_updated_at
    BEFORE UPDATE ON section_items
    FOR EACH ROW
    EXECUTE FUNCTION set_home_content_updated_at();

CREATE OR REPLACE FUNCTION enforce_section_selection_entity_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_entity_type TEXT;
BEGIN
    SELECT entity_type
      INTO v_entity_type
      FROM section_entity_selections
     WHERE id = NEW.selection_id;

    IF v_entity_type IS NULL THEN
        RAISE EXCEPTION 'Selection % does not exist', NEW.selection_id
            USING ERRCODE = '23503';
    END IF;

    IF (v_entity_type = 'project' AND NEW.project_id IS NULL)
       OR (v_entity_type = 'concern' AND NEW.concern_id IS NULL)
       OR (v_entity_type = 'media_post' AND NEW.media_post_id IS NULL) THEN
        RAISE EXCEPTION 'Selection item entity does not match selection type %', v_entity_type
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_section_selection_entity_type
    ON section_entity_selection_items;
CREATE TRIGGER enforce_section_selection_entity_type
    BEFORE INSERT OR UPDATE ON section_entity_selection_items
    FOR EACH ROW
    EXECUTE FUNCTION enforce_section_selection_entity_type();

-- Replace permissive public section policies with parent-aware publication
-- policies. Draft and archived rows are never readable by anon users.
DROP POLICY IF EXISTS "Public Read Visible Page Sections" ON page_sections;
DROP POLICY IF EXISTS "Public Read Published Page Sections" ON page_sections;
CREATE POLICY "Public Read Published Page Sections" ON page_sections
    FOR SELECT
    USING (
        status = 'published'
        AND (is_visible = true OR section_key = 'hero-slider')
        AND EXISTS (
            SELECT 1
              FROM pages
             WHERE pages.id = page_sections.page_id
               AND pages.is_published = true
        )
    );

DROP POLICY IF EXISTS "Public Read Visible Section Items" ON section_items;
DROP POLICY IF EXISTS "Public Read Published Section Items" ON section_items;
CREATE POLICY "Public Read Published Section Items" ON section_items
    FOR SELECT
    USING (
        is_visible = true
        AND EXISTS (
            SELECT 1
              FROM page_sections
              JOIN pages ON pages.id = page_sections.page_id
             WHERE page_sections.id = section_items.section_id
               AND page_sections.status = 'published'
               AND page_sections.is_visible = true
               AND pages.is_published = true
        )
    );

-- Direct authenticated writes are removed for versioned section content. The
-- SECURITY DEFINER RPCs below are the only mutation boundary for Phase 1A.
DROP POLICY IF EXISTS "Admin Full Access Page Sections" ON page_sections;
DROP POLICY IF EXISTS "Admin Read Page Sections" ON page_sections;
CREATE POLICY "Admin Read Page Sections" ON page_sections
    FOR SELECT
    USING (get_admin_role() IN ('super_admin', 'content_editor'));

DROP POLICY IF EXISTS "Admin Full Access Section Items" ON section_items;
DROP POLICY IF EXISTS "Admin Read Section Items" ON section_items;
CREATE POLICY "Admin Read Section Items" ON section_items
    FOR SELECT
    USING (get_admin_role() IN ('super_admin', 'content_editor'));

DROP POLICY IF EXISTS "Admin Manage Media Usage" ON media_asset_usage;
CREATE POLICY "Admin Manage Media Usage" ON media_asset_usage
    FOR ALL
    USING (get_admin_role() IN ('super_admin', 'content_editor'))
    WITH CHECK (get_admin_role() IN ('super_admin', 'content_editor'));

DROP POLICY IF EXISTS "Admin Read Content Revisions" ON content_revisions;
CREATE POLICY "Admin Read Content Revisions" ON content_revisions
    FOR SELECT
    USING (get_admin_role() IN ('super_admin', 'content_editor'));

-- Produce the exact serializable DTO consumed by the public Hero and admin
-- editor. This helper is private to the mutation functions and migration seed.
CREATE OR REPLACE FUNCTION home_hero_snapshot(p_section_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT jsonb_build_object(
        'id', ps.id,
        'pageId', ps.page_id,
        'sectionKey', ps.section_key,
        'status', ps.status,
        'versionNumber', ps.version_number,
        'isVisible', ps.is_visible,
        'autoplayMs', COALESCE((ps.settings ->> 'autoplay_ms')::INTEGER, 6000),
        'updatedAt', ps.updated_at,
        'updatedBy', ps.updated_by,
        'publishedAt', ps.published_at,
        'publishedBy', ps.published_by,
        'slides', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', si.id,
                    'eyebrow', si.tag_text,
                    'title', si.title,
                    'description', si.body_text,
                    'primaryCtaLabel', si.primary_cta_label,
                    'primaryCtaUrl', si.primary_cta_url,
                    'primaryCtaTarget', si.primary_cta_target,
                    'secondaryCtaLabel', si.secondary_cta_label,
                    'secondaryCtaUrl', si.secondary_cta_url,
                    'secondaryCtaTarget', si.secondary_cta_target,
                    'desktopMediaId', si.image_asset_id,
                    'mobileMediaId', si.mobile_image_asset_id,
                    'imageAlt', si.image_alt,
                    'sortOrder', si.sort_order,
                    'isVisible', si.is_visible,
                    'desktopMedia', CASE WHEN desktop_media.id IS NULL THEN NULL ELSE
                        jsonb_build_object(
                            'id', desktop_media.id,
                            'secureUrl', desktop_media.secure_url,
                            'displayName', desktop_media.display_name,
                            'altText', desktop_media.alt_text,
                            'width', desktop_media.width,
                            'height', desktop_media.height
                        )
                    END,
                    'mobileMedia', CASE WHEN mobile_media.id IS NULL THEN NULL ELSE
                        jsonb_build_object(
                            'id', mobile_media.id,
                            'secureUrl', mobile_media.secure_url,
                            'displayName', mobile_media.display_name,
                            'altText', mobile_media.alt_text,
                            'width', mobile_media.width,
                            'height', mobile_media.height
                        )
                    END
                )
                ORDER BY si.sort_order, si.created_at, si.id
            )
              FROM section_items si
              LEFT JOIN media_assets desktop_media
                ON desktop_media.id = si.image_asset_id
              LEFT JOIN media_assets mobile_media
                ON mobile_media.id = si.mobile_image_asset_id
             WHERE si.section_id = ps.id
        ), '[]'::jsonb)
    )
      FROM page_sections ps
     WHERE ps.id = p_section_id;
$$;

CREATE OR REPLACE FUNCTION home_hero_cta_url_valid(p_url TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT p_url IS NOT NULL
       AND (
           p_url ~ '^#[A-Za-z][A-Za-z0-9_-]*$'
           OR p_url ~ '^/([^/[:space:]][^[:space:]]*)?$'
           OR p_url ~ '^https://[^[:space:]]+$'
       );
$$;

-- Count every relational media reference, including legacy tables that may not
-- yet have a synchronized media_asset_usage row. Deletion functions lock the
-- media row before calling this helper so the decision is made atomically.
CREATE OR REPLACE FUNCTION media_asset_reference_count(p_asset_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT count(*)::INTEGER
      FROM (
          SELECT 'media_asset_usage:' || id::TEXT AS reference_key
            FROM media_asset_usage
           WHERE media_asset_id = p_asset_id
          UNION ALL
          SELECT 'custom_icons:' || id::TEXT FROM custom_icons WHERE media_asset_id = p_asset_id
          UNION ALL
          SELECT 'site_settings_logo:' || id::TEXT FROM site_settings WHERE logo_asset_id = p_asset_id
          UNION ALL
          SELECT 'site_settings_favicon:' || id::TEXT FROM site_settings WHERE favicon_asset_id = p_asset_id
          UNION ALL
          SELECT 'pages_og:' || id::TEXT FROM pages WHERE seo_og_image_id = p_asset_id
          UNION ALL
          SELECT 'section_items_custom_icon:' || id::TEXT FROM section_items WHERE custom_icon_asset_id = p_asset_id
          UNION ALL
          SELECT 'section_items_image:' || id::TEXT FROM section_items WHERE image_asset_id = p_asset_id
          UNION ALL
          SELECT 'section_items_mobile_image:' || id::TEXT FROM section_items WHERE mobile_image_asset_id = p_asset_id
          UNION ALL
          SELECT 'concerns_cover:' || id::TEXT FROM concerns WHERE cover_image_id = p_asset_id
          UNION ALL
          SELECT 'concerns_logo:' || id::TEXT FROM concerns WHERE logo_image_id = p_asset_id
          UNION ALL
          SELECT 'projects_cover:' || id::TEXT FROM projects WHERE cover_image_id = p_asset_id
          UNION ALL
          SELECT 'project_floor_plans:' || id::TEXT FROM project_floor_plans WHERE image_asset_id = p_asset_id
          UNION ALL
          SELECT 'project_media:' || id::TEXT FROM project_media WHERE media_asset_id = p_asset_id
          UNION ALL
          SELECT 'project_documents:' || id::TEXT FROM project_documents WHERE document_asset_id = p_asset_id
          UNION ALL
          SELECT 'media_posts_cover:' || id::TEXT FROM media_posts WHERE cover_image_id = p_asset_id
          UNION ALL
          SELECT 'selection_override_cover:' || id::TEXT
            FROM section_entity_selection_items
           WHERE override_cover_image_id = p_asset_id
      ) AS media_references;
$$;

-- Register verified Cloudinary metadata under the same transaction-scoped
-- public-id lock used by hard deletion. This closes the check/upsert race with
-- an active deletion outbox entry.
CREATE OR REPLACE FUNCTION save_media_asset_metadata(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_public_id TEXT;
    v_resource_type TEXT;
    v_asset media_assets%ROWTYPE;
BEGIN
    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
        RAISE EXCEPTION 'Media metadata payload must be an object'
            USING ERRCODE = '22023';
    END IF;

    v_public_id := NULLIF(btrim(p_payload ->> 'public_id'), '');
    v_resource_type := COALESCE(NULLIF(p_payload ->> 'resource_type', ''), 'image');

    IF v_public_id IS NULL OR NULLIF(btrim(p_payload ->> 'secure_url'), '') IS NULL THEN
        RAISE EXCEPTION 'Verified public_id and secure_url are required'
            USING ERRCODE = '22023';
    END IF;

    IF v_resource_type NOT IN ('image', 'video', 'raw') THEN
        RAISE EXCEPTION 'Unsupported media resource type'
            USING ERRCODE = '22023';
    END IF;

    IF p_payload ? 'tags'
       AND jsonb_typeof(p_payload -> 'tags') <> 'array' THEN
        RAISE EXCEPTION 'Media tags must be an array'
            USING ERRCODE = '22023';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(v_public_id, 0)
    );

    IF EXISTS (
        SELECT 1
          FROM media_deletion_outbox
         WHERE public_id = v_public_id
           AND status IN ('pending', 'failed')
    ) THEN
        RETURN jsonb_build_object(
            'ok', false, 'status', 409, 'code', 'MEDIA_DELETION_PENDING',
            'error', 'This Cloudinary asset has a pending deletion and cannot be registered.'
        );
    END IF;

    INSERT INTO media_assets (
        public_id,
        secure_url,
        resource_type,
        format,
        width,
        height,
        bytes,
        original_filename,
        display_name,
        folder,
        alt_text,
        caption,
        tags,
        uploaded_by,
        updated_at
    )
    VALUES (
        v_public_id,
        btrim(p_payload ->> 'secure_url'),
        v_resource_type,
        COALESCE(NULLIF(p_payload ->> 'format', ''), 'webp'),
        (p_payload ->> 'width')::INTEGER,
        (p_payload ->> 'height')::INTEGER,
        (p_payload ->> 'bytes')::INTEGER,
        NULLIF(p_payload ->> 'original_filename', ''),
        NULLIF(p_payload ->> 'display_name', ''),
        COALESCE(NULLIF(p_payload ->> 'folder', ''), 'dhaka-heights/dev/shared'),
        COALESCE(p_payload ->> 'alt_text', ''),
        COALESCE(p_payload ->> 'caption', ''),
        ARRAY(
            SELECT jsonb_array_elements_text(COALESCE(p_payload -> 'tags', '[]'::jsonb))
        ),
        NULLIF(p_payload ->> 'uploaded_by', '')::UUID,
        clock_timestamp()
    )
    ON CONFLICT (public_id) DO UPDATE
       SET secure_url = EXCLUDED.secure_url,
           resource_type = EXCLUDED.resource_type,
           format = EXCLUDED.format,
           width = EXCLUDED.width,
           height = EXCLUDED.height,
           bytes = EXCLUDED.bytes,
           original_filename = EXCLUDED.original_filename,
           display_name = EXCLUDED.display_name,
           folder = EXCLUDED.folder,
           alt_text = EXCLUDED.alt_text,
           caption = EXCLUDED.caption,
           tags = EXCLUDED.tags,
           uploaded_by = EXCLUDED.uploaded_by,
           updated_at = clock_timestamp()
    RETURNING * INTO v_asset;

    RETURN jsonb_build_object('ok', true, 'asset', to_jsonb(v_asset));
END;
$$;

CREATE OR REPLACE FUNCTION archive_media_asset_if_unused(p_asset_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_asset media_assets%ROWTYPE;
    v_reference_count INTEGER;
BEGIN
    SELECT *
      INTO v_asset
      FROM media_assets
     WHERE id = p_asset_id
     FOR UPDATE;

    IF v_asset.id IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false, 'status', 404, 'code', 'MEDIA_ASSET_NOT_FOUND',
            'error', 'Media asset not found.'
        );
    END IF;

    v_reference_count := media_asset_reference_count(p_asset_id);
    IF v_reference_count > 0 THEN
        RETURN jsonb_build_object(
            'ok', false, 'status', 409, 'code', 'MEDIA_ASSET_IN_USE',
            'error', 'Media asset is referenced and cannot be archived or deleted.',
            'usageCount', v_reference_count
        );
    END IF;

    UPDATE media_assets
       SET is_archived = true,
           updated_at = clock_timestamp()
     WHERE id = p_asset_id
     RETURNING * INTO v_asset;

    RETURN jsonb_build_object('ok', true, 'asset', to_jsonb(v_asset));
END;
$$;

CREATE OR REPLACE FUNCTION delete_media_asset_if_unused(
    p_asset_id UUID,
    p_requested_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_asset media_assets%ROWTYPE;
    v_reference_count INTEGER;
    v_deletion_id UUID;
    v_public_id TEXT;
BEGIN
    SELECT public_id
      INTO v_public_id
      FROM media_assets
     WHERE id = p_asset_id;

    IF v_public_id IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false, 'status', 404, 'code', 'MEDIA_ASSET_NOT_FOUND',
            'error', 'Media asset not found.'
        );
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(v_public_id, 0)
    );

    SELECT *
      INTO v_asset
      FROM media_assets
     WHERE id = p_asset_id
     FOR UPDATE;

    IF v_asset.id IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false, 'status', 404, 'code', 'MEDIA_ASSET_NOT_FOUND',
            'error', 'Media asset not found.'
        );
    END IF;

    v_reference_count := media_asset_reference_count(p_asset_id);
    IF v_reference_count > 0 THEN
        RETURN jsonb_build_object(
            'ok', false, 'status', 409, 'code', 'MEDIA_ASSET_IN_USE',
            'error', 'Media asset is referenced and cannot be archived or deleted.',
            'usageCount', v_reference_count
        );
    END IF;

    INSERT INTO media_deletion_outbox (
        asset_id,
        public_id,
        resource_type,
        status,
        requested_by
    )
    VALUES (
        v_asset.id,
        v_asset.public_id,
        COALESCE(v_asset.resource_type, 'image'),
        'pending',
        p_requested_by
    )
    RETURNING id INTO v_deletion_id;

    DELETE FROM media_assets WHERE id = p_asset_id;
    RETURN jsonb_build_object(
        'ok', true,
        'asset', to_jsonb(v_asset),
        'deletionId', v_deletion_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION complete_media_asset_deletion(p_deletion_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    UPDATE media_deletion_outbox
       SET status = 'completed',
           attempt_count = attempt_count + 1,
           last_error = NULL,
           updated_at = clock_timestamp(),
           completed_at = clock_timestamp()
     WHERE id = p_deletion_id
       AND status IN ('pending', 'failed');
$$;

CREATE OR REPLACE FUNCTION fail_media_asset_deletion(
    p_deletion_id UUID,
    p_error TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    UPDATE media_deletion_outbox
       SET status = 'failed',
           attempt_count = attempt_count + 1,
           last_error = left(COALESCE(p_error, 'Cloudinary deletion failed.'), 1000),
           updated_at = clock_timestamp()
     WHERE id = p_deletion_id
       AND status IN ('pending', 'failed');
$$;

CREATE OR REPLACE FUNCTION save_home_hero_draft(
    p_payload JSONB,
    p_expected_updated_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_role app_role;
    v_page_id UUID;
    v_source_id UUID;
    v_draft page_sections%ROWTYPE;
    v_published page_sections%ROWTYPE;
    v_draft_id UUID;
    v_next_version INTEGER;
    v_autoplay INTEGER;
    v_slide_count INTEGER;
    v_visible_count INTEGER;
    v_reference_count INTEGER;
    v_valid_reference_count INTEGER;
    v_old_snapshot JSONB;
    v_new_snapshot JSONB;
    v_revision_number INTEGER;
BEGIN
    IF v_actor IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false, 'status', 401, 'code', 'ADMIN_AUTH_REQUIRED',
            'error', 'Authentication is required.'
        );
    END IF;

    SELECT role
      INTO v_role
      FROM admin_profiles
     WHERE id = v_actor
       AND is_active = true;

    IF v_role IS NULL OR v_role NOT IN ('super_admin', 'content_editor') THEN
        RETURN jsonb_build_object(
            'ok', false, 'status', 403, 'code', 'ADMIN_ROLE_FORBIDDEN',
            'error', 'An active content administrator profile is required.'
        );
    END IF;

    IF p_expected_updated_at IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false, 'status', 422, 'code', 'VALIDATION_ERROR',
            'error', 'The expected updated timestamp is required.'
        );
    END IF;

    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
        RAISE EXCEPTION 'Hero payload must be a JSON object' USING ERRCODE = '22023';
    END IF;

    IF p_payload ->> 'sectionKey' IS DISTINCT FROM 'hero-slider' THEN
        RAISE EXCEPTION 'Only the hero-slider section can be saved by this function'
            USING ERRCODE = '22023';
    END IF;

    BEGIN
        v_source_id := (p_payload ->> 'id')::UUID;
        v_autoplay := (p_payload ->> 'autoplayMs')::INTEGER;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'Hero payload contains an invalid identifier or autoplay value'
            USING ERRCODE = '22023';
    END;

    IF v_autoplay NOT BETWEEN 3000 AND 15000 THEN
        RAISE EXCEPTION 'Hero autoplay must be between 3000 and 15000 milliseconds'
            USING ERRCODE = '22023';
    END IF;

    IF jsonb_typeof(p_payload -> 'slides') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Hero slides must be an array' USING ERRCODE = '22023';
    END IF;

    v_slide_count := jsonb_array_length(p_payload -> 'slides');
    IF v_slide_count NOT BETWEEN 1 AND 10 THEN
        RAISE EXCEPTION 'Hero must contain between 1 and 10 slides'
            USING ERRCODE = '22023';
    END IF;

    SELECT count(*)
      INTO v_visible_count
      FROM jsonb_array_elements(p_payload -> 'slides') AS slide
     WHERE COALESCE((slide ->> 'isVisible')::BOOLEAN, true) = true;

    IF v_visible_count = 0 THEN
        RAISE EXCEPTION 'Hero must contain at least one visible slide'
            USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM jsonb_array_elements(p_payload -> 'slides') AS slide
         WHERE length(btrim(COALESCE(slide ->> 'eyebrow', ''))) NOT BETWEEN 1 AND 80
            OR length(btrim(COALESCE(slide ->> 'title', ''))) NOT BETWEEN 1 AND 140
            OR length(btrim(COALESCE(slide ->> 'description', ''))) NOT BETWEEN 1 AND 500
            OR length(btrim(COALESCE(slide ->> 'imageAlt', ''))) NOT BETWEEN 1 AND 180
            OR length(btrim(COALESCE(slide ->> 'primaryCtaLabel', ''))) > 40
            OR length(btrim(COALESCE(slide ->> 'secondaryCtaLabel', ''))) > 40
            OR (
                (NULLIF(btrim(COALESCE(slide ->> 'primaryCtaLabel', '')), '') IS NULL)
                <> (NULLIF(btrim(COALESCE(slide ->> 'primaryCtaUrl', '')), '') IS NULL)
            )
            OR (
                (NULLIF(btrim(COALESCE(slide ->> 'secondaryCtaLabel', '')), '') IS NULL)
                <> (NULLIF(btrim(COALESCE(slide ->> 'secondaryCtaUrl', '')), '') IS NULL)
            )
            OR (
                NULLIF(btrim(COALESCE(slide ->> 'primaryCtaUrl', '')), '') IS NOT NULL
                AND NOT home_hero_cta_url_valid(btrim(slide ->> 'primaryCtaUrl'))
            )
            OR (
                NULLIF(btrim(COALESCE(slide ->> 'secondaryCtaUrl', '')), '') IS NOT NULL
                AND NOT home_hero_cta_url_valid(btrim(slide ->> 'secondaryCtaUrl'))
            )
            OR COALESCE(slide ->> 'primaryCtaTarget', '_self') NOT IN ('_self', '_blank')
            OR COALESCE(slide ->> 'secondaryCtaTarget', '_self') NOT IN ('_self', '_blank')
    ) THEN
        RAISE EXCEPTION 'Hero slide text or target validation failed'
            USING ERRCODE = '22023';
    END IF;

    -- Serialize media selection against archive/hard-delete decisions. If a
    -- save wins this lock, deletion waits and then observes the new usage row;
    -- if deletion wins, this save sees the archived/missing asset and fails.
    PERFORM media_assets.id
      FROM media_assets
     WHERE media_assets.id IN (
        SELECT DISTINCT (slide ->> 'desktopMediaId')::UUID
          FROM jsonb_array_elements(p_payload -> 'slides') AS slide
        UNION
        SELECT DISTINCT (slide ->> 'mobileMediaId')::UUID
          FROM jsonb_array_elements(p_payload -> 'slides') AS slide
         WHERE NULLIF(slide ->> 'mobileMediaId', '') IS NOT NULL
     )
     ORDER BY media_assets.id
     FOR SHARE;

    WITH referenced_assets AS (
        SELECT DISTINCT (slide ->> 'desktopMediaId')::UUID AS media_id
          FROM jsonb_array_elements(p_payload -> 'slides') AS slide
        UNION
        SELECT DISTINCT (slide ->> 'mobileMediaId')::UUID AS media_id
          FROM jsonb_array_elements(p_payload -> 'slides') AS slide
         WHERE NULLIF(slide ->> 'mobileMediaId', '') IS NOT NULL
    )
    SELECT count(*), count(media_assets.id)
      INTO v_reference_count, v_valid_reference_count
      FROM referenced_assets
      LEFT JOIN media_assets
        ON media_assets.id = referenced_assets.media_id
       AND media_assets.is_archived = false
       AND media_assets.resource_type = 'image';

    IF v_reference_count <> v_valid_reference_count THEN
        RAISE EXCEPTION 'Every Hero media reference must be an existing unarchived image'
            USING ERRCODE = '23503';
    END IF;

    SELECT id
      INTO v_page_id
      FROM pages
     WHERE slug = 'home'
     FOR UPDATE;

    IF v_page_id IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false, 'status', 503, 'code', 'HOME_PAGE_NOT_CONFIGURED',
            'error', 'The Home page record is not configured.'
        );
    END IF;

    IF NULLIF(p_payload ->> 'pageId', '') IS NOT NULL
       AND (p_payload ->> 'pageId')::UUID <> v_page_id THEN
        RETURN jsonb_build_object(
            'ok', false, 'status', 409, 'code', 'HOME_HERO_CONFLICT',
            'error', 'The edited section no longer belongs to the current Home page.'
        );
    END IF;

    SELECT *
      INTO v_draft
      FROM page_sections
     WHERE page_id = v_page_id
       AND section_key = 'hero-slider'
       AND status = 'draft'
     FOR UPDATE;

    IF v_draft.id IS NOT NULL THEN
        IF v_source_id <> v_draft.id
           OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN
            RETURN jsonb_build_object(
                'ok', false, 'status', 409, 'code', 'HOME_HERO_CONFLICT',
                'error', 'The Hero draft changed after this editor loaded it.'
            );
        END IF;

        v_draft_id := v_draft.id;
        v_old_snapshot := home_hero_snapshot(v_draft_id);

        UPDATE page_sections
           SET is_visible = (p_payload ->> 'isVisible')::BOOLEAN,
               settings = jsonb_set(
                   COALESCE(settings, '{}'::jsonb),
                   '{autoplay_ms}',
                   to_jsonb(v_autoplay),
                   true
               ),
               updated_by = v_actor
         WHERE id = v_draft_id;

        DELETE FROM media_asset_usage
         WHERE table_name = 'section_items'
           AND record_id IN (
               SELECT id FROM section_items WHERE section_id = v_draft_id
           );

        DELETE FROM section_items WHERE section_id = v_draft_id;
    ELSE
        SELECT *
          INTO v_published
          FROM page_sections
         WHERE page_id = v_page_id
           AND section_key = 'hero-slider'
           AND status = 'published'
         FOR UPDATE;

        IF v_published.id IS NULL THEN
            RETURN jsonb_build_object(
                'ok', false, 'status', 503, 'code', 'HOME_HERO_NOT_CONFIGURED',
                'error', 'The published Home Hero is not configured.'
            );
        END IF;

        IF v_source_id <> v_published.id
           OR v_published.updated_at IS DISTINCT FROM p_expected_updated_at THEN
            RETURN jsonb_build_object(
                'ok', false, 'status', 409, 'code', 'HOME_HERO_CONFLICT',
                'error', 'The published Hero changed after this editor loaded it.'
            );
        END IF;

        SELECT COALESCE(max(version_number), 0) + 1
          INTO v_next_version
          FROM page_sections
         WHERE page_id = v_page_id
           AND section_key = 'hero-slider';

        v_old_snapshot := home_hero_snapshot(v_published.id);

        INSERT INTO page_sections (
            page_id,
            section_key,
            section_name,
            tag_text,
            heading,
            subheading,
            description,
            allowed_variant,
            sort_order,
            is_visible,
            status,
            version_number,
            settings,
            updated_by,
            supersedes_id
        )
        VALUES (
            v_page_id,
            'hero-slider',
            v_published.section_name,
            v_published.tag_text,
            v_published.heading,
            v_published.subheading,
            v_published.description,
            v_published.allowed_variant,
            v_published.sort_order,
            (p_payload ->> 'isVisible')::BOOLEAN,
            'draft',
            v_next_version,
            jsonb_set(
                COALESCE(v_published.settings, '{}'::jsonb),
                '{autoplay_ms}',
                to_jsonb(v_autoplay),
                true
            ),
            v_actor,
            v_published.id
        )
        RETURNING id INTO v_draft_id;
    END IF;

    INSERT INTO section_items (
        section_id,
        title,
        body_text,
        tag_text,
        primary_cta_label,
        primary_cta_url,
        primary_cta_target,
        secondary_cta_label,
        secondary_cta_url,
        secondary_cta_target,
        image_asset_id,
        mobile_image_asset_id,
        image_alt,
        sort_order,
        is_visible,
        updated_by
    )
    SELECT
        v_draft_id,
        btrim(slide ->> 'title'),
        btrim(slide ->> 'description'),
        btrim(slide ->> 'eyebrow'),
        NULLIF(btrim(slide ->> 'primaryCtaLabel'), ''),
        NULLIF(btrim(slide ->> 'primaryCtaUrl'), ''),
        COALESCE(slide ->> 'primaryCtaTarget', '_self'),
        NULLIF(btrim(slide ->> 'secondaryCtaLabel'), ''),
        NULLIF(btrim(slide ->> 'secondaryCtaUrl'), ''),
        COALESCE(slide ->> 'secondaryCtaTarget', '_self'),
        (slide ->> 'desktopMediaId')::UUID,
        NULLIF(slide ->> 'mobileMediaId', '')::UUID,
        btrim(slide ->> 'imageAlt'),
        (ordinality * 10)::INTEGER,
        COALESCE((slide ->> 'isVisible')::BOOLEAN, true),
        v_actor
      FROM jsonb_array_elements(p_payload -> 'slides')
           WITH ORDINALITY AS slide_rows(slide, ordinality);

    INSERT INTO media_asset_usage (media_asset_id, table_name, record_id, field_name)
    SELECT image_asset_id, 'section_items', id, 'image_asset_id'
      FROM section_items
     WHERE section_id = v_draft_id
       AND image_asset_id IS NOT NULL
    ON CONFLICT (media_asset_id, table_name, record_id, field_name) DO NOTHING;

    INSERT INTO media_asset_usage (media_asset_id, table_name, record_id, field_name)
    SELECT mobile_image_asset_id, 'section_items', id, 'mobile_image_asset_id'
      FROM section_items
     WHERE section_id = v_draft_id
       AND mobile_image_asset_id IS NOT NULL
    ON CONFLICT (media_asset_id, table_name, record_id, field_name) DO NOTHING;

    v_new_snapshot := home_hero_snapshot(v_draft_id);

    SELECT COALESCE(max(version_number), 0) + 1
      INTO v_revision_number
      FROM content_revisions
     WHERE table_name = 'page_sections'
       AND record_id = v_draft_id;

    INSERT INTO content_revisions (
        table_name,
        record_id,
        revision_data,
        created_by,
        version_number,
        change_summary
    )
    VALUES (
        'page_sections',
        v_draft_id,
        v_new_snapshot,
        v_actor,
        v_revision_number,
        CASE WHEN v_draft.id IS NULL THEN 'Created Home Hero draft' ELSE 'Saved Home Hero draft' END
    );

    INSERT INTO audit_logs (
        admin_id,
        action,
        table_name,
        record_id,
        old_values,
        new_values
    )
    VALUES (
        v_actor,
        CASE WHEN v_draft.id IS NULL THEN 'create_draft' ELSE 'update_draft' END,
        'page_sections',
        v_draft_id,
        v_old_snapshot,
        v_new_snapshot
    );

    RETURN jsonb_build_object('ok', true, 'data', v_new_snapshot);
END;
$$;

CREATE OR REPLACE FUNCTION publish_home_hero_draft(
    p_section_id UUID,
    p_expected_updated_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_role app_role;
    v_draft page_sections%ROWTYPE;
    v_previous_published page_sections%ROWTYPE;
    v_old_snapshot JSONB;
    v_new_snapshot JSONB;
    v_previous_snapshot JSONB;
    v_revision_number INTEGER;
BEGIN
    IF v_actor IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false, 'status', 401, 'code', 'ADMIN_AUTH_REQUIRED',
            'error', 'Authentication is required.'
        );
    END IF;

    SELECT role
      INTO v_role
      FROM admin_profiles
     WHERE id = v_actor
       AND is_active = true;

    IF v_role IS NULL OR v_role NOT IN ('super_admin', 'content_editor') THEN
        RETURN jsonb_build_object(
            'ok', false, 'status', 403, 'code', 'ADMIN_ROLE_FORBIDDEN',
            'error', 'An active content administrator profile is required.'
        );
    END IF;

    IF p_section_id IS NULL OR p_expected_updated_at IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false, 'status', 422, 'code', 'VALIDATION_ERROR',
            'error', 'Draft ID and expected updated timestamp are required.'
        );
    END IF;

    SELECT *
      INTO v_draft
      FROM page_sections
     WHERE id = p_section_id
       AND section_key = 'hero-slider'
       AND status = 'draft'
     FOR UPDATE;

    IF v_draft.id IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false, 'status', 404, 'code', 'HOME_HERO_DRAFT_NOT_FOUND',
            'error', 'The Home Hero draft no longer exists.'
        );
    END IF;

    IF v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN
        RETURN jsonb_build_object(
            'ok', false, 'status', 409, 'code', 'HOME_HERO_CONFLICT',
            'error', 'The Hero draft changed after this editor loaded it.'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM section_items
         WHERE section_id = v_draft.id
           AND is_visible = true
    ) THEN
        RETURN jsonb_build_object(
            'ok', false, 'status', 422, 'code', 'HOME_HERO_NO_VISIBLE_SLIDES',
            'error', 'At least one visible slide is required before publishing.'
        );
    END IF;

    IF EXISTS (
        SELECT 1
          FROM section_items
          LEFT JOIN media_assets
            ON media_assets.id = section_items.image_asset_id
         WHERE section_items.section_id = v_draft.id
           AND section_items.is_visible = true
           AND (
               media_assets.id IS NULL
               OR media_assets.is_archived = true
               OR media_assets.resource_type <> 'image'
           )
    ) THEN
        RETURN jsonb_build_object(
            'ok', false, 'status', 422, 'code', 'HOME_HERO_MEDIA_INVALID',
            'error', 'Every visible slide requires an unarchived desktop image.'
        );
    END IF;

    v_old_snapshot := home_hero_snapshot(v_draft.id);

    SELECT *
      INTO v_previous_published
      FROM page_sections
     WHERE page_id = v_draft.page_id
       AND section_key = v_draft.section_key
       AND status = 'published'
     FOR UPDATE;

    IF v_previous_published.id IS NOT NULL THEN
        v_previous_snapshot := home_hero_snapshot(v_previous_published.id);

        UPDATE page_sections
           SET status = 'archived',
               updated_by = v_actor
         WHERE id = v_previous_published.id;

        INSERT INTO audit_logs (
            admin_id,
            action,
            table_name,
            record_id,
            old_values,
            new_values
        )
        VALUES (
            v_actor,
            'archive_published',
            'page_sections',
            v_previous_published.id,
            v_previous_snapshot,
            home_hero_snapshot(v_previous_published.id)
        );
    END IF;

    UPDATE page_sections
       SET status = 'published',
           published_at = clock_timestamp(),
           published_by = v_actor,
           updated_by = v_actor
     WHERE id = v_draft.id;

    v_new_snapshot := home_hero_snapshot(v_draft.id);

    SELECT COALESCE(max(version_number), 0) + 1
      INTO v_revision_number
      FROM content_revisions
     WHERE table_name = 'page_sections'
       AND record_id = v_draft.id;

    INSERT INTO content_revisions (
        table_name,
        record_id,
        revision_data,
        created_by,
        version_number,
        change_summary
    )
    VALUES (
        'page_sections',
        v_draft.id,
        v_new_snapshot,
        v_actor,
        v_revision_number,
        'Published Home Hero'
    );

    INSERT INTO audit_logs (
        admin_id,
        action,
        table_name,
        record_id,
        old_values,
        new_values
    )
    VALUES (
        v_actor,
        'publish',
        'page_sections',
        v_draft.id,
        v_old_snapshot,
        v_new_snapshot
    );

    RETURN jsonb_build_object('ok', true, 'data', v_new_snapshot);
END;
$$;

REVOKE ALL ON FUNCTION home_hero_snapshot(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION home_hero_cta_url_valid(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION media_asset_reference_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION save_media_asset_metadata(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION archive_media_asset_if_unused(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_media_asset_if_unused(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION complete_media_asset_deletion(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION fail_media_asset_deletion(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION save_home_hero_draft(JSONB, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION publish_home_hero_draft(UUID, TIMESTAMPTZ) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION save_media_asset_metadata(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION archive_media_asset_if_unused(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION delete_media_asset_if_unused(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION complete_media_asset_deletion(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION fail_media_asset_deletion(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION save_home_hero_draft(JSONB, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_home_hero_draft(UUID, TIMESTAMPTZ) TO authenticated;

-- Seed the exact current public Hero only when it has not been seeded already.
-- A missing Cloudinary asset aborts the entire migration, preventing a partial
-- section or a silent fallback to local assets.
DO $$
DECLARE
    v_page_id UUID;
    v_section_id UUID;
    v_asset_count INTEGER;
    v_hero1 UUID;
    v_hero2 UUID;
    v_hero3 UUID;
    v_completed UUID;
    v_upcoming UUID;
    v_snapshot JSONB;
BEGIN
    INSERT INTO pages (slug, title, is_published)
    VALUES ('home', 'Homepage', true)
    ON CONFLICT (slug) DO NOTHING;

    SELECT id INTO v_page_id FROM pages WHERE slug = 'home';

    IF EXISTS (
        SELECT 1
          FROM page_sections
         WHERE page_id = v_page_id
           AND section_key = 'hero-slider'
           AND status = 'published'
    ) THEN
        RETURN;
    END IF;

    SELECT count(*)
      INTO v_asset_count
      FROM media_assets
     WHERE public_id IN (
        'dhaka-heights/dev/hero1',
        'dhaka-heights/dev/hero2',
        'dhaka-heights/dev/hero3',
        'dhaka-heights/dev/proj_completed',
        'dhaka-heights/dev/proj_upcoming'
     )
       AND resource_type = 'image'
       AND is_archived = false;

    IF v_asset_count <> 5 THEN
        RAISE EXCEPTION
            'Home Hero seed requires all five unarchived Cloudinary images in dhaka-heights/dev; found % of 5',
            v_asset_count;
    END IF;

    SELECT id INTO STRICT v_hero1
      FROM media_assets WHERE public_id = 'dhaka-heights/dev/hero1';
    SELECT id INTO STRICT v_hero2
      FROM media_assets WHERE public_id = 'dhaka-heights/dev/hero2';
    SELECT id INTO STRICT v_hero3
      FROM media_assets WHERE public_id = 'dhaka-heights/dev/hero3';
    SELECT id INTO STRICT v_completed
      FROM media_assets WHERE public_id = 'dhaka-heights/dev/proj_completed';
    SELECT id INTO STRICT v_upcoming
      FROM media_assets WHERE public_id = 'dhaka-heights/dev/proj_upcoming';

    INSERT INTO page_sections (
        page_id,
        section_key,
        section_name,
        sort_order,
        is_visible,
        status,
        version_number,
        settings,
        published_at
    )
    VALUES (
        v_page_id,
        'hero-slider',
        'Hero Slider',
        10,
        true,
        'published',
        1,
        jsonb_build_object('autoplay_ms', 6000),
        clock_timestamp()
    )
    RETURNING id INTO v_section_id;

    INSERT INTO section_items (
        section_id,
        tag_text,
        title,
        body_text,
        primary_cta_label,
        primary_cta_url,
        primary_cta_target,
        secondary_cta_label,
        secondary_cta_url,
        secondary_cta_target,
        image_asset_id,
        image_alt,
        sort_order,
        is_visible
    )
    VALUES
    (
        v_section_id,
        'YOUR PRESTIGIOUS LIVING',
        'Shaping Harmonious Urban Spaces',
        'Ultra-premium residential apartments and commercial spaces tailored for modern lifestyle excellence. Located at the heart of Bashundhara R/A.',
        'Our Projects', '#projects', '_self',
        'Inquire Now', '#contact', '_self',
        v_hero1,
        'Modern Dhaka Heights residential development exterior',
        10,
        true
    ),
    (
        v_section_id,
        'BESPOKE ARCHITECTURE',
        'Where Vision Meets Engineering',
        'Designed to reflect modern luxury. State-of-the-art residential layouts, double-height lobby, and top-tier security infrastructure.',
        'About Us', '#about', '_self',
        'Inquire Now', '#contact', '_self',
        v_hero2,
        'Contemporary Dhaka Heights building with premium architecture',
        20,
        true
    ),
    (
        v_section_id,
        'PRIME RESIDENTIAL LOCATION',
        'Ready Premium Spaces',
        'Exclusive apartments of varied sizes from 1500 to 4400 SFT. Designed for maximum space efficiency and natural lighting.',
        'Browse Spaces', '#projects', '_self',
        'Inquire Now', '#contact', '_self',
        v_hero3,
        'Premium Dhaka Heights apartments in a prime residential location',
        30,
        true
    ),
    (
        v_section_id,
        'ELEGANT APARTMENTS',
        'Comfort and Class Combined',
        'Spacious layouts, earthquake-resistant design, and premium stone surfaces. Experience the elite lifestyle Dhaka Heights Properties Limited offers.',
        'Completed Projects', '#projects', '_self',
        'Inquire Now', '#contact', '_self',
        v_completed,
        'Completed Dhaka Heights apartment development',
        40,
        true
    ),
    (
        v_section_id,
        'SUSTAINABLE BUILDINGS',
        'Eco-Friendly Architectural Marvels',
        'Green urban landscapes, cross-ventilation, rainwater harvesting systems, and solar matrices built for our futuristic communities.',
        'Upcoming Launches', '#projects', '_self',
        'Inquire Now', '#contact', '_self',
        v_upcoming,
        'Upcoming sustainable Dhaka Heights building development',
        50,
        true
    );

    INSERT INTO media_asset_usage (media_asset_id, table_name, record_id, field_name)
    SELECT image_asset_id, 'section_items', id, 'image_asset_id'
      FROM section_items
     WHERE section_id = v_section_id
    ON CONFLICT (media_asset_id, table_name, record_id, field_name) DO NOTHING;

    v_snapshot := home_hero_snapshot(v_section_id);

    INSERT INTO content_revisions (
        table_name,
        record_id,
        revision_data,
        version_number,
        change_summary
    )
    VALUES (
        'page_sections',
        v_section_id,
        v_snapshot,
        1,
        'Seeded initial published Home Hero'
    );

    INSERT INTO audit_logs (
        admin_id,
        action,
        table_name,
        record_id,
        new_values
    )
    VALUES (
        NULL,
        'migration_seed',
        'page_sections',
        v_section_id,
        v_snapshot
    );
END;
$$;

COMMIT;
