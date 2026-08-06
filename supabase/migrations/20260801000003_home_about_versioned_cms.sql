BEGIN;

-- Phase 1B: versioned Home About Corporate Block. The Phase 1A section
-- workflow remains the shared publication model; named items allow this
-- composition to attach two independent media assets without URL copying.
ALTER TABLE section_items
    ADD COLUMN IF NOT EXISTS item_key TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'section_items_item_key_format'
    ) THEN
        ALTER TABLE section_items
            ADD CONSTRAINT section_items_item_key_format
            CHECK (item_key IS NULL OR item_key ~ '^[a-z][a-z0-9-]{0,79}$');
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_section_items_named_item
    ON section_items (section_id, item_key)
    WHERE item_key IS NOT NULL;

-- A deliberately hidden published About section must remain discoverable as
-- metadata so the public loader can distinguish "disabled" from "missing".
DROP POLICY IF EXISTS "Public Read Published Page Sections" ON page_sections;
CREATE POLICY "Public Read Published Page Sections" ON page_sections
    FOR SELECT
    USING (
        status = 'published'
        AND (
            is_visible = true
            OR section_key IN ('hero-slider', 'about-corporate-home')
        )
        AND EXISTS (
            SELECT 1
              FROM pages
             WHERE pages.id = page_sections.page_id
               AND pages.is_published = true
        )
    );

CREATE OR REPLACE FUNCTION home_about_snapshot(p_section_id UUID)
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
        'tagText', ps.tag_text,
        'heading', ps.heading,
        'highlightedHeading', ps.subheading,
        'leadText', ps.description,
        'bodyText', COALESCE(ps.settings ->> 'body_text', ''),
        'primaryCtaLabel', COALESCE(ps.settings #>> '{primary_cta,label}', ''),
        'primaryCtaUrl', COALESCE(ps.settings #>> '{primary_cta,url}', ''),
        'primaryCtaTarget', COALESCE(ps.settings #>> '{primary_cta,target}', '_self'),
        'videoButtonLabel', COALESCE(ps.settings ->> 'video_button_label', ''),
        'updatedAt', ps.updated_at,
        'updatedBy', ps.updated_by,
        'publishedAt', ps.published_at,
        'publishedBy', ps.published_by,
        'topImage', (
            SELECT jsonb_build_object(
                'itemId', si.id,
                'mediaId', si.image_asset_id,
                'imageAlt', si.image_alt,
                'media', CASE WHEN ma.id IS NULL THEN NULL ELSE jsonb_build_object(
                    'id', ma.id,
                    'secureUrl', ma.secure_url,
                    'displayName', COALESCE(ma.display_name, ma.original_filename),
                    'altText', COALESCE(ma.alt_text, ''),
                    'width', ma.width,
                    'height', ma.height
                ) END
            )
              FROM section_items si
              LEFT JOIN media_assets ma ON ma.id = si.image_asset_id
             WHERE si.section_id = ps.id
               AND si.item_key = 'top-image'
        ),
        'bottomImage', (
            SELECT jsonb_build_object(
                'itemId', si.id,
                'mediaId', si.image_asset_id,
                'imageAlt', si.image_alt,
                'media', CASE WHEN ma.id IS NULL THEN NULL ELSE jsonb_build_object(
                    'id', ma.id,
                    'secureUrl', ma.secure_url,
                    'displayName', COALESCE(ma.display_name, ma.original_filename),
                    'altText', COALESCE(ma.alt_text, ''),
                    'width', ma.width,
                    'height', ma.height
                ) END
            )
              FROM section_items si
              LEFT JOIN media_assets ma ON ma.id = si.image_asset_id
             WHERE si.section_id = ps.id
               AND si.item_key = 'bottom-image'
        )
    )
      FROM page_sections ps
     WHERE ps.id = p_section_id;
$$;

CREATE OR REPLACE FUNCTION save_home_about_draft(
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
    v_top_media_id UUID;
    v_bottom_media_id UUID;
    v_old_snapshot JSONB;
    v_new_snapshot JSONB;
    v_revision_number INTEGER;
BEGIN
    IF v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 401, 'code', 'ADMIN_AUTH_REQUIRED', 'error', 'Authentication is required.');
    END IF;

    SELECT role INTO v_role
      FROM admin_profiles
     WHERE id = v_actor AND is_active = true;

    IF v_role IS NULL OR v_role NOT IN ('super_admin', 'content_editor') THEN
        RETURN jsonb_build_object('ok', false, 'status', 403, 'code', 'ADMIN_ROLE_FORBIDDEN', 'error', 'An active content administrator profile is required.');
    END IF;

    IF p_expected_updated_at IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 422, 'code', 'VALIDATION_ERROR', 'error', 'The expected updated timestamp is required.');
    END IF;

    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
        RAISE EXCEPTION 'Home About payload must be a JSON object' USING ERRCODE = '22023';
    END IF;

    IF p_payload ->> 'sectionKey' IS DISTINCT FROM 'about-corporate-home' THEN
        RAISE EXCEPTION 'Only the about-corporate-home section can be saved by this function' USING ERRCODE = '22023';
    END IF;

    BEGIN
        v_source_id := (p_payload ->> 'id')::UUID;
        v_top_media_id := (p_payload #>> '{topImage,mediaId}')::UUID;
        v_bottom_media_id := (p_payload #>> '{bottomImage,mediaId}')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Home About payload contains an invalid identifier' USING ERRCODE = '22023';
    END;

    IF jsonb_typeof(p_payload -> 'topImage') IS DISTINCT FROM 'object'
       OR jsonb_typeof(p_payload -> 'bottomImage') IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'Both named About images are required' USING ERRCODE = '22023';
    END IF;

    IF length(btrim(COALESCE(p_payload ->> 'tagText', ''))) NOT BETWEEN 1 AND 100
       OR length(btrim(COALESCE(p_payload ->> 'heading', ''))) NOT BETWEEN 1 AND 180
       OR length(btrim(COALESCE(p_payload ->> 'highlightedHeading', ''))) NOT BETWEEN 1 AND 180
       OR length(btrim(COALESCE(p_payload ->> 'leadText', ''))) NOT BETWEEN 1 AND 1000
       OR length(btrim(COALESCE(p_payload ->> 'bodyText', ''))) NOT BETWEEN 1 AND 1000
       OR length(btrim(COALESCE(p_payload ->> 'primaryCtaLabel', ''))) NOT BETWEEN 1 AND 40
       OR length(btrim(COALESCE(p_payload ->> 'videoButtonLabel', ''))) NOT BETWEEN 1 AND 40
       OR length(btrim(COALESCE(p_payload #>> '{topImage,imageAlt}', ''))) NOT BETWEEN 1 AND 180
       OR length(btrim(COALESCE(p_payload #>> '{bottomImage,imageAlt}', ''))) NOT BETWEEN 1 AND 180 THEN
        RAISE EXCEPTION 'Home About text validation failed' USING ERRCODE = '22023';
    END IF;

    IF NOT home_hero_cta_url_valid(btrim(COALESCE(p_payload ->> 'primaryCtaUrl', '')))
       OR COALESCE(p_payload ->> 'primaryCtaTarget', '_self') NOT IN ('_self', '_blank') THEN
        RAISE EXCEPTION 'Home About CTA validation failed' USING ERRCODE = '22023';
    END IF;

    -- Serialize media selection against archive and hard-delete decisions.
    PERFORM id
      FROM media_assets
     WHERE id IN (v_top_media_id, v_bottom_media_id)
     ORDER BY id
     FOR SHARE;

    IF NOT EXISTS (
        SELECT 1 FROM media_assets
         WHERE id = v_top_media_id AND is_archived = false AND resource_type = 'image'
    ) OR NOT EXISTS (
        SELECT 1 FROM media_assets
         WHERE id = v_bottom_media_id AND is_archived = false AND resource_type = 'image'
    ) THEN
        RAISE EXCEPTION 'Both About media references must be existing unarchived images' USING ERRCODE = '23503';
    END IF;

    SELECT id INTO v_page_id
      FROM pages
     WHERE slug = 'home'
     FOR UPDATE;

    IF v_page_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 503, 'code', 'HOME_PAGE_NOT_CONFIGURED', 'error', 'The Home page record is not configured.');
    END IF;

    IF NULLIF(p_payload ->> 'pageId', '') IS NOT NULL
       AND (p_payload ->> 'pageId')::UUID <> v_page_id THEN
        RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_ABOUT_CONFLICT', 'error', 'The edited section no longer belongs to the current Home page.');
    END IF;

    SELECT * INTO v_draft
      FROM page_sections
     WHERE page_id = v_page_id
       AND section_key = 'about-corporate-home'
       AND status = 'draft'
     FOR UPDATE;

    IF v_draft.id IS NOT NULL THEN
        IF v_source_id <> v_draft.id OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN
            RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_ABOUT_CONFLICT', 'error', 'The About draft changed after this editor loaded it.');
        END IF;

        v_draft_id := v_draft.id;
        v_old_snapshot := home_about_snapshot(v_draft_id);

        UPDATE page_sections
           SET tag_text = btrim(p_payload ->> 'tagText'),
               heading = btrim(p_payload ->> 'heading'),
               subheading = btrim(p_payload ->> 'highlightedHeading'),
               description = btrim(p_payload ->> 'leadText'),
               is_visible = (p_payload ->> 'isVisible')::BOOLEAN,
               settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
                   'body_text', btrim(p_payload ->> 'bodyText'),
                   'primary_cta', jsonb_build_object(
                       'label', btrim(p_payload ->> 'primaryCtaLabel'),
                       'url', btrim(p_payload ->> 'primaryCtaUrl'),
                       'target', COALESCE(p_payload ->> 'primaryCtaTarget', '_self')
                   ),
                   'video_button_label', btrim(p_payload ->> 'videoButtonLabel')
               ),
               updated_by = v_actor
         WHERE id = v_draft_id;

        DELETE FROM media_asset_usage
         WHERE table_name = 'section_items'
           AND record_id IN (SELECT id FROM section_items WHERE section_id = v_draft_id);
        DELETE FROM section_items WHERE section_id = v_draft_id;
    ELSE
        SELECT * INTO v_published
          FROM page_sections
         WHERE page_id = v_page_id
           AND section_key = 'about-corporate-home'
           AND status = 'published'
         FOR UPDATE;

        IF v_published.id IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'status', 503, 'code', 'HOME_ABOUT_NOT_CONFIGURED', 'error', 'The published Home About block is not configured.');
        END IF;

        IF v_source_id <> v_published.id OR v_published.updated_at IS DISTINCT FROM p_expected_updated_at THEN
            RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_ABOUT_CONFLICT', 'error', 'The published About block changed after this editor loaded it.');
        END IF;

        SELECT COALESCE(max(version_number), 0) + 1 INTO v_next_version
          FROM page_sections
         WHERE page_id = v_page_id AND section_key = 'about-corporate-home';

        v_old_snapshot := home_about_snapshot(v_published.id);

        INSERT INTO page_sections (
            page_id, section_key, section_name, tag_text, heading, subheading,
            description, allowed_variant, sort_order, is_visible, status,
            version_number, settings, updated_by, supersedes_id
        ) VALUES (
            v_page_id, 'about-corporate-home', v_published.section_name,
            btrim(p_payload ->> 'tagText'), btrim(p_payload ->> 'heading'),
            btrim(p_payload ->> 'highlightedHeading'), btrim(p_payload ->> 'leadText'),
            v_published.allowed_variant, v_published.sort_order,
            (p_payload ->> 'isVisible')::BOOLEAN, 'draft', v_next_version,
            COALESCE(v_published.settings, '{}'::jsonb) || jsonb_build_object(
                'body_text', btrim(p_payload ->> 'bodyText'),
                'primary_cta', jsonb_build_object(
                    'label', btrim(p_payload ->> 'primaryCtaLabel'),
                    'url', btrim(p_payload ->> 'primaryCtaUrl'),
                    'target', COALESCE(p_payload ->> 'primaryCtaTarget', '_self')
                ),
                'video_button_label', btrim(p_payload ->> 'videoButtonLabel')
            ),
            v_actor, v_published.id
        ) RETURNING id INTO v_draft_id;
    END IF;

    INSERT INTO section_items (
        section_id, item_key, title, image_asset_id, image_alt,
        sort_order, is_visible, updated_by
    ) VALUES
    (v_draft_id, 'top-image', 'Top facade image', v_top_media_id,
        btrim(p_payload #>> '{topImage,imageAlt}'), 10, true, v_actor),
    (v_draft_id, 'bottom-image', 'Bottom interior image', v_bottom_media_id,
        btrim(p_payload #>> '{bottomImage,imageAlt}'), 20, true, v_actor);

    INSERT INTO media_asset_usage (media_asset_id, table_name, record_id, field_name)
    SELECT image_asset_id, 'section_items', id, 'image_asset_id'
      FROM section_items
     WHERE section_id = v_draft_id
    ON CONFLICT (media_asset_id, table_name, record_id, field_name) DO NOTHING;

    v_new_snapshot := home_about_snapshot(v_draft_id);
    SELECT COALESCE(max(version_number), 0) + 1 INTO v_revision_number
      FROM content_revisions
     WHERE table_name = 'page_sections' AND record_id = v_draft_id;

    INSERT INTO content_revisions (
        table_name, record_id, revision_data, created_by, version_number, change_summary
    ) VALUES (
        'page_sections', v_draft_id, v_new_snapshot, v_actor, v_revision_number,
        CASE WHEN v_draft.id IS NULL THEN 'Created Home About draft' ELSE 'Saved Home About draft' END
    );

    INSERT INTO audit_logs (admin_id, action, table_name, record_id, old_values, new_values)
    VALUES (
        v_actor,
        CASE WHEN v_draft.id IS NULL THEN 'create_draft' ELSE 'update_draft' END,
        'page_sections', v_draft_id, v_old_snapshot, v_new_snapshot
    );

    RETURN jsonb_build_object('ok', true, 'data', v_new_snapshot);
END;
$$;

CREATE OR REPLACE FUNCTION publish_home_about_draft(
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
    v_previous_snapshot JSONB;
    v_new_snapshot JSONB;
    v_revision_number INTEGER;
BEGIN
    IF v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 401, 'code', 'ADMIN_AUTH_REQUIRED', 'error', 'Authentication is required.');
    END IF;

    SELECT role INTO v_role FROM admin_profiles WHERE id = v_actor AND is_active = true;
    IF v_role IS NULL OR v_role NOT IN ('super_admin', 'content_editor') THEN
        RETURN jsonb_build_object('ok', false, 'status', 403, 'code', 'ADMIN_ROLE_FORBIDDEN', 'error', 'An active content administrator profile is required.');
    END IF;

    IF p_section_id IS NULL OR p_expected_updated_at IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 422, 'code', 'VALIDATION_ERROR', 'error', 'Draft ID and expected updated timestamp are required.');
    END IF;

    SELECT * INTO v_draft
      FROM page_sections
     WHERE id = p_section_id
       AND section_key = 'about-corporate-home'
       AND status = 'draft'
     FOR UPDATE;

    IF v_draft.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 404, 'code', 'HOME_ABOUT_DRAFT_NOT_FOUND', 'error', 'The Home About draft no longer exists.');
    END IF;

    IF v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN
        RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_ABOUT_CONFLICT', 'error', 'The About draft changed after this editor loaded it.');
    END IF;

    IF (SELECT count(*) FROM section_items WHERE section_id = v_draft.id AND item_key IN ('top-image', 'bottom-image')) <> 2
       OR EXISTS (
            SELECT 1
              FROM section_items si
              LEFT JOIN media_assets ma ON ma.id = si.image_asset_id
             WHERE si.section_id = v_draft.id
               AND si.item_key IN ('top-image', 'bottom-image')
               AND (ma.id IS NULL OR ma.is_archived = true OR ma.resource_type <> 'image')
       ) THEN
        RETURN jsonb_build_object('ok', false, 'status', 422, 'code', 'HOME_ABOUT_MEDIA_INVALID', 'error', 'Both About images must reference unarchived image assets.');
    END IF;

    v_old_snapshot := home_about_snapshot(v_draft.id);

    SELECT * INTO v_previous_published
      FROM page_sections
     WHERE page_id = v_draft.page_id
       AND section_key = v_draft.section_key
       AND status = 'published'
     FOR UPDATE;

    IF v_previous_published.id IS NOT NULL THEN
        v_previous_snapshot := home_about_snapshot(v_previous_published.id);
        UPDATE page_sections
           SET status = 'archived', updated_by = v_actor
         WHERE id = v_previous_published.id;

        INSERT INTO audit_logs (admin_id, action, table_name, record_id, old_values, new_values)
        VALUES (v_actor, 'archive_published', 'page_sections', v_previous_published.id,
            v_previous_snapshot, home_about_snapshot(v_previous_published.id));
    END IF;

    UPDATE page_sections
       SET status = 'published', published_at = clock_timestamp(),
           published_by = v_actor, updated_by = v_actor
     WHERE id = v_draft.id;

    v_new_snapshot := home_about_snapshot(v_draft.id);
    SELECT COALESCE(max(version_number), 0) + 1 INTO v_revision_number
      FROM content_revisions
     WHERE table_name = 'page_sections' AND record_id = v_draft.id;

    INSERT INTO content_revisions (
        table_name, record_id, revision_data, created_by, version_number, change_summary
    ) VALUES (
        'page_sections', v_draft.id, v_new_snapshot, v_actor, v_revision_number,
        'Published Home About block'
    );

    INSERT INTO audit_logs (admin_id, action, table_name, record_id, old_values, new_values)
    VALUES (v_actor, 'publish', 'page_sections', v_draft.id, v_old_snapshot, v_new_snapshot);

    RETURN jsonb_build_object('ok', true, 'data', v_new_snapshot);
END;
$$;

REVOKE ALL ON FUNCTION home_about_snapshot(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION save_home_about_draft(JSONB, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION publish_home_about_draft(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_home_about_draft(JSONB, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_home_about_draft(UUID, TIMESTAMPTZ) TO authenticated;

-- Exact current public About block. Missing media aborts the migration so the
-- application never switches to incomplete CMS content.
DO $$
DECLARE
    v_page_id UUID;
    v_section_id UUID;
    v_top_media_id UUID;
    v_bottom_media_id UUID;
    v_snapshot JSONB;
BEGIN
    SELECT id INTO v_page_id FROM pages WHERE slug = 'home';
    IF v_page_id IS NULL THEN
        RAISE EXCEPTION 'Home page is required before seeding the About block';
    END IF;

    IF EXISTS (
        SELECT 1 FROM page_sections
         WHERE page_id = v_page_id
           AND section_key = 'about-corporate-home'
           AND status = 'published'
    ) THEN
        RETURN;
    END IF;

    SELECT id INTO STRICT v_top_media_id
      FROM media_assets
     WHERE public_id = 'dhaka-heights/dev/about_top_facade'
       AND resource_type = 'image' AND is_archived = false;
    SELECT id INTO STRICT v_bottom_media_id
      FROM media_assets
     WHERE public_id = 'dhaka-heights/dev/about_bottom_interior'
       AND resource_type = 'image' AND is_archived = false;

    INSERT INTO page_sections (
        page_id, section_key, section_name, tag_text, heading, subheading,
        description, sort_order, is_visible, status, version_number,
        settings, published_at
    ) VALUES (
        v_page_id,
        'about-corporate-home',
        'About Corporate Block',
        'ABOUT DHAKA HEIGHTS PROPERTIES LIMITED',
        'Inspired by Architectural Brilliance.',
        'Committed to Excellence.',
        'Dhaka Heights Properties Limited is a trusted conglomerate in real estate development, committed to excellence, premium quality, and thoughtful design. Since our inception in 2008 under Dhaka Heights Developments Ltd, we build lasting residential and commercial landmarks that reflect integrity, innovation, and responsibility.',
        20,
        true,
        'published',
        1,
        jsonb_build_object(
            'body_text', 'Every project we create reflects our unwavering pursuit of excellence — combining premium structural engineering, eco-friendly green initiatives, and high-performance design, creating unmatched value for families and businesses across Bangladesh.',
            'primary_cta', jsonb_build_object('label', 'Learn More', 'url', '/about', 'target', '_self'),
            'video_button_label', 'Watch Video'
        ),
        clock_timestamp()
    ) RETURNING id INTO v_section_id;

    INSERT INTO section_items (
        section_id, item_key, title, image_asset_id, image_alt, sort_order, is_visible
    ) VALUES
    (v_section_id, 'top-image', 'Top facade image', v_top_media_id,
        'Dhaka Heights Properties Limited Modern Architectural Facade', 10, true),
    (v_section_id, 'bottom-image', 'Bottom interior image', v_bottom_media_id,
        'Dhaka Heights Properties Limited Premium Corporate Lobby', 20, true);

    INSERT INTO media_asset_usage (media_asset_id, table_name, record_id, field_name)
    SELECT image_asset_id, 'section_items', id, 'image_asset_id'
      FROM section_items
     WHERE section_id = v_section_id
    ON CONFLICT (media_asset_id, table_name, record_id, field_name) DO NOTHING;

    v_snapshot := home_about_snapshot(v_section_id);

    INSERT INTO content_revisions (
        table_name, record_id, revision_data, version_number, change_summary
    ) VALUES (
        'page_sections', v_section_id, v_snapshot, 1,
        'Seeded initial published Home About block'
    );

    INSERT INTO audit_logs (admin_id, action, table_name, record_id, new_values)
    VALUES (NULL, 'migration_seed', 'page_sections', v_section_id, v_snapshot);
END;
$$;

COMMIT;
