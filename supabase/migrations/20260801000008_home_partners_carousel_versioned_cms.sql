BEGIN;

-- Phase 1G: versioned repeated partner records. The duplicate animation loop
-- remains derived presentation behavior and is never stored as extra content.
DROP POLICY IF EXISTS "Public Read Published Page Sections" ON page_sections;
CREATE POLICY "Public Read Published Page Sections" ON page_sections
    FOR SELECT
    USING (
        status = 'published'
        AND (
            is_visible = true
            OR section_key IN (
                'hero-slider', 'about-corporate-home', 'statistics-counter',
                'featured-projects-home', 'commitment-quote',
                'media-highlights-home', 'partners-carousel'
            )
        )
        AND EXISTS (
            SELECT 1 FROM pages
             WHERE pages.id = page_sections.page_id
               AND pages.is_published = true
        )
    );

CREATE OR REPLACE FUNCTION home_partners_carousel_snapshot(p_section_id UUID)
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
        'heading', ps.heading,
        'updatedAt', ps.updated_at,
        'updatedBy', ps.updated_by,
        'publishedAt', ps.published_at,
        'publishedBy', ps.published_by,
        'partners', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'itemId', si.id,
                    'itemKey', si.item_key,
                    'name', si.title,
                    'category', si.subtitle,
                    'iconKey', si.icon_key,
                    'accentColor', si.accent_color,
                    'sortOrder', si.sort_order,
                    'isVisible', si.is_visible
                ) ORDER BY si.sort_order, si.id
            )
              FROM section_items si
             WHERE si.section_id = ps.id
        ), '[]'::jsonb)
    )
      FROM page_sections ps
     WHERE ps.id = p_section_id;
$$;

CREATE OR REPLACE FUNCTION save_home_partners_carousel_draft(
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
    v_old_snapshot JSONB;
    v_new_snapshot JSONB;
    v_revision_number INTEGER;
    v_partner JSONB;
    v_partner_count INTEGER;
BEGIN
    IF v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 401, 'code', 'ADMIN_AUTH_REQUIRED', 'error', 'Authentication is required.');
    END IF;
    SELECT role INTO v_role FROM admin_profiles WHERE id = v_actor AND is_active = true;
    IF v_role IS NULL OR v_role NOT IN ('super_admin', 'content_editor') THEN
        RETURN jsonb_build_object('ok', false, 'status', 403, 'code', 'ADMIN_ROLE_FORBIDDEN', 'error', 'An active content administrator profile is required.');
    END IF;
    IF p_expected_updated_at IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 422, 'code', 'VALIDATION_ERROR', 'error', 'The expected updated timestamp is required.');
    END IF;

    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
       OR p_payload ->> 'sectionKey' IS DISTINCT FROM 'partners-carousel' THEN
        RAISE EXCEPTION 'Invalid Home Partners Carousel payload' USING ERRCODE = '22023';
    END IF;

    BEGIN
        v_source_id := (p_payload ->> 'id')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Home Partners Carousel payload contains an invalid section identifier' USING ERRCODE = '22023';
    END;

    IF v_source_id IS NULL
       OR jsonb_typeof(p_payload -> 'isVisible') IS DISTINCT FROM 'boolean'
       OR jsonb_typeof(p_payload -> 'partners') IS DISTINCT FROM 'array'
       OR length(btrim(COALESCE(p_payload ->> 'heading', ''))) NOT BETWEEN 1 AND 120 THEN
        RAISE EXCEPTION 'Home Partners Carousel section fields are invalid' USING ERRCODE = '22023';
    END IF;

    v_partner_count := jsonb_array_length(p_payload -> 'partners');
    IF v_partner_count NOT BETWEEN 1 AND 20 THEN
        RAISE EXCEPTION 'Home Partners Carousel requires between 1 and 20 partners' USING ERRCODE = '22023';
    END IF;

    IF (SELECT count(DISTINCT partner ->> 'itemKey') FROM jsonb_array_elements(p_payload -> 'partners') partner) <> v_partner_count THEN
        RAISE EXCEPTION 'Partner keys must be unique' USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_payload -> 'partners') partner
         WHERE jsonb_typeof(partner -> 'isVisible') = 'boolean'
           AND (partner ->> 'isVisible')::BOOLEAN = true
    ) THEN
        RAISE EXCEPTION 'At least one partner must be visible' USING ERRCODE = '22023';
    END IF;

    FOR v_partner IN SELECT value FROM jsonb_array_elements(p_payload -> 'partners')
    LOOP
        IF jsonb_typeof(v_partner) <> 'object'
           OR COALESCE(v_partner ->> 'itemKey', '') !~ '^partner-[a-z0-9-]{1,64}$'
           OR length(btrim(COALESCE(v_partner ->> 'name', ''))) NOT BETWEEN 1 AND 80
           OR length(btrim(COALESCE(v_partner ->> 'category', ''))) NOT BETWEEN 1 AND 80
           OR COALESCE(v_partner ->> 'iconKey', '') !~ '^fa-[a-z0-9-]{1,60}$'
           OR COALESCE(v_partner ->> 'accentColor', '') !~ '^#[0-9A-Fa-f]{6}$'
           OR jsonb_typeof(v_partner -> 'isVisible') IS DISTINCT FROM 'boolean' THEN
            RAISE EXCEPTION 'One or more Home partner records are invalid' USING ERRCODE = '22023';
        END IF;
    END LOOP;

    SELECT id INTO v_page_id FROM pages WHERE slug = 'home' FOR UPDATE;
    IF v_page_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 503, 'code', 'HOME_PAGE_NOT_CONFIGURED', 'error', 'The Home page record is not configured.');
    END IF;
    IF NULLIF(p_payload ->> 'pageId', '') IS NOT NULL
       AND (p_payload ->> 'pageId')::UUID <> v_page_id THEN
        RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_PARTNERS_CAROUSEL_CONFLICT', 'error', 'The edited section no longer belongs to the current Home page.');
    END IF;

    SELECT * INTO v_draft
      FROM page_sections
     WHERE page_id = v_page_id AND section_key = 'partners-carousel' AND status = 'draft'
     FOR UPDATE;

    IF v_draft.id IS NOT NULL THEN
        IF v_source_id <> v_draft.id OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN
            RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_PARTNERS_CAROUSEL_CONFLICT', 'error', 'The Partners Carousel draft changed after this editor loaded it.');
        END IF;
        v_draft_id := v_draft.id;
        v_old_snapshot := home_partners_carousel_snapshot(v_draft_id);
        UPDATE page_sections
           SET heading = btrim(p_payload ->> 'heading'),
               is_visible = (p_payload ->> 'isVisible')::BOOLEAN,
               updated_by = v_actor
         WHERE id = v_draft_id;
        DELETE FROM section_items WHERE section_id = v_draft_id;
    ELSE
        SELECT * INTO v_published
          FROM page_sections
         WHERE page_id = v_page_id AND section_key = 'partners-carousel' AND status = 'published'
         FOR UPDATE;
        IF v_published.id IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'status', 503, 'code', 'HOME_PARTNERS_CAROUSEL_NOT_CONFIGURED', 'error', 'The published Home Partners Carousel is not configured.');
        END IF;
        IF v_source_id <> v_published.id OR v_published.updated_at IS DISTINCT FROM p_expected_updated_at THEN
            RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_PARTNERS_CAROUSEL_CONFLICT', 'error', 'The published Partners Carousel changed after this editor loaded it.');
        END IF;

        SELECT COALESCE(max(version_number), 0) + 1 INTO v_next_version
          FROM page_sections
         WHERE page_id = v_page_id AND section_key = 'partners-carousel';
        v_old_snapshot := home_partners_carousel_snapshot(v_published.id);
        INSERT INTO page_sections (
            page_id, section_key, section_name, heading, allowed_variant,
            sort_order, is_visible, status, version_number, settings,
            updated_by, supersedes_id
        ) VALUES (
            v_page_id, 'partners-carousel', v_published.section_name,
            btrim(p_payload ->> 'heading'), v_published.allowed_variant,
            v_published.sort_order, (p_payload ->> 'isVisible')::BOOLEAN,
            'draft', v_next_version, COALESCE(v_published.settings, '{}'::jsonb),
            v_actor, v_published.id
        ) RETURNING id INTO v_draft_id;
    END IF;

    INSERT INTO section_items (
        section_id, item_key, title, subtitle, icon_library, icon_key,
        accent_color, sort_order, is_visible, updated_by
    )
    SELECT v_draft_id,
           partner ->> 'itemKey',
           btrim(partner ->> 'name'),
           btrim(partner ->> 'category'),
           'fontawesome',
           partner ->> 'iconKey',
           lower(partner ->> 'accentColor'),
           ordinal * 10,
           (partner ->> 'isVisible')::BOOLEAN,
           v_actor
      FROM jsonb_array_elements(p_payload -> 'partners') WITH ORDINALITY AS entries(partner, ordinal);

    v_new_snapshot := home_partners_carousel_snapshot(v_draft_id);
    SELECT COALESCE(max(version_number), 0) + 1 INTO v_revision_number
      FROM content_revisions
     WHERE table_name = 'page_sections' AND record_id = v_draft_id;
    INSERT INTO content_revisions (
        table_name, record_id, revision_data, created_by, version_number, change_summary
    ) VALUES (
        'page_sections', v_draft_id, v_new_snapshot, v_actor, v_revision_number,
        CASE WHEN v_draft.id IS NULL THEN 'Created Home Partners Carousel draft' ELSE 'Saved Home Partners Carousel draft' END
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

CREATE OR REPLACE FUNCTION publish_home_partners_carousel_draft(
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
     WHERE id = p_section_id AND section_key = 'partners-carousel' AND status = 'draft'
     FOR UPDATE;
    IF v_draft.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 404, 'code', 'HOME_PARTNERS_CAROUSEL_DRAFT_NOT_FOUND', 'error', 'The Home Partners Carousel draft no longer exists.');
    END IF;
    IF v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN
        RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_PARTNERS_CAROUSEL_CONFLICT', 'error', 'The Partners Carousel draft changed after this editor loaded it.');
    END IF;

    IF length(btrim(COALESCE(v_draft.heading, ''))) NOT BETWEEN 1 AND 120
       OR (SELECT count(*) FROM section_items WHERE section_id = v_draft.id) NOT BETWEEN 1 AND 20
       OR NOT EXISTS (SELECT 1 FROM section_items WHERE section_id = v_draft.id AND is_visible = true)
       OR EXISTS (
            SELECT 1 FROM section_items
             WHERE section_id = v_draft.id
               AND (
                    COALESCE(item_key, '') !~ '^partner-[a-z0-9-]{1,64}$'
                    OR length(btrim(COALESCE(title, ''))) NOT BETWEEN 1 AND 80
                    OR length(btrim(COALESCE(subtitle, ''))) NOT BETWEEN 1 AND 80
                    OR COALESCE(icon_key, '') !~ '^fa-[a-z0-9-]{1,60}$'
                    OR COALESCE(accent_color, '') !~ '^#[0-9a-f]{6}$'
               )
       ) THEN
        RETURN jsonb_build_object('ok', false, 'status', 422, 'code', 'HOME_PARTNERS_CAROUSEL_INVALID', 'error', 'The Partners Carousel draft contains invalid partner records.');
    END IF;

    v_old_snapshot := home_partners_carousel_snapshot(v_draft.id);
    SELECT * INTO v_previous_published
      FROM page_sections
     WHERE page_id = v_draft.page_id AND section_key = v_draft.section_key AND status = 'published'
     FOR UPDATE;
    IF v_previous_published.id IS NOT NULL THEN
        v_previous_snapshot := home_partners_carousel_snapshot(v_previous_published.id);
        UPDATE page_sections SET status = 'archived', updated_by = v_actor WHERE id = v_previous_published.id;
        INSERT INTO audit_logs (admin_id, action, table_name, record_id, old_values, new_values)
        VALUES (v_actor, 'archive_published', 'page_sections', v_previous_published.id,
            v_previous_snapshot, home_partners_carousel_snapshot(v_previous_published.id));
    END IF;

    UPDATE page_sections
       SET status = 'published', published_at = clock_timestamp(),
           published_by = v_actor, updated_by = v_actor
     WHERE id = v_draft.id;

    v_new_snapshot := home_partners_carousel_snapshot(v_draft.id);
    SELECT COALESCE(max(version_number), 0) + 1 INTO v_revision_number
      FROM content_revisions
     WHERE table_name = 'page_sections' AND record_id = v_draft.id;
    INSERT INTO content_revisions (
        table_name, record_id, revision_data, created_by, version_number, change_summary
    ) VALUES ('page_sections', v_draft.id, v_new_snapshot, v_actor, v_revision_number, 'Published Home Partners Carousel');
    INSERT INTO audit_logs (admin_id, action, table_name, record_id, old_values, new_values)
    VALUES (v_actor, 'publish', 'page_sections', v_draft.id, v_old_snapshot, v_new_snapshot);
    RETURN jsonb_build_object('ok', true, 'data', v_new_snapshot);
END;
$$;

REVOKE ALL ON FUNCTION home_partners_carousel_snapshot(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION save_home_partners_carousel_draft(JSONB, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION publish_home_partners_carousel_draft(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_home_partners_carousel_draft(JSONB, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_home_partners_carousel_draft(UUID, TIMESTAMPTZ) TO authenticated;

-- Exact current public partner content. Eight rows are canonical; the
-- component derives a second loop only for continuous animation.
DO $$
DECLARE
    v_page_id UUID;
    v_section_id UUID;
    v_snapshot JSONB;
BEGIN
    SELECT id INTO v_page_id FROM pages WHERE slug = 'home';
    IF v_page_id IS NULL THEN
        RAISE EXCEPTION 'Home page is required before seeding the Partners Carousel';
    END IF;
    IF EXISTS (
        SELECT 1 FROM page_sections
         WHERE page_id = v_page_id AND section_key = 'partners-carousel' AND status = 'published'
    ) THEN
        RETURN;
    END IF;

    INSERT INTO page_sections (
        page_id, section_key, section_name, heading, sort_order,
        is_visible, status, version_number, settings, published_at
    ) VALUES (
        v_page_id, 'partners-carousel', 'Partners Carousel',
        'Our Prestigious Tenants & Partners', 70, true, 'published', 1,
        '{}'::jsonb, clock_timestamp()
    ) RETURNING id INTO v_section_id;

    INSERT INTO section_items (
        section_id, item_key, title, subtitle, icon_library, icon_key,
        accent_color, sort_order, is_visible
    ) VALUES
    (v_section_id, 'partner-prime-bank', 'Prime Bank', 'Finance Partner', 'fontawesome', 'fa-building-columns', '#c5a880', 10, true),
    (v_section_id, 'partner-city-bank', 'City Bank', 'Clearing Partner', 'fontawesome', 'fa-university', '#ff2a2a', 20, true),
    (v_section_id, 'partner-apex-corp', 'Apex Corp', 'Corporate Tenant', 'fontawesome', 'fa-city', '#05c46b', 30, true),
    (v_section_id, 'partner-chevron-ltd', 'Chevron Ltd', 'Energy Client', 'fontawesome', 'fa-oil-well', '#f1c40f', 40, true),
    (v_section_id, 'partner-standard-chartered', 'Standard Chartered', 'Financial Client', 'fontawesome', 'fa-vault', '#38ef7d', 50, true),
    (v_section_id, 'partner-beximco-group', 'Beximco Group', 'Strategic Partner', 'fontawesome', 'fa-industry', '#ff9800', 60, true),
    (v_section_id, 'partner-eastern-bank', 'Eastern Bank', 'Banking Partner', 'fontawesome', 'fa-wallet', '#00d2ff', 70, true),
    (v_section_id, 'partner-nexus-tech', 'Nexus Tech', 'Technology Client', 'fontawesome', 'fa-microchip', '#e91e63', 80, true);

    v_snapshot := home_partners_carousel_snapshot(v_section_id);
    INSERT INTO content_revisions (
        table_name, record_id, revision_data, version_number, change_summary
    ) VALUES ('page_sections', v_section_id, v_snapshot, 1, 'Seeded initial published Home Partners Carousel');
    INSERT INTO audit_logs (admin_id, action, table_name, record_id, new_values)
    VALUES (NULL, 'migration_seed', 'page_sections', v_section_id, v_snapshot);
END;
$$;

COMMIT;
