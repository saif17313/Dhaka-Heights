BEGIN;

-- Phase 1E: versioned Home Commitment Quote. The visual composition remains
-- fixed in code; only the quotation, attribution, and visibility are content.
DROP POLICY IF EXISTS "Public Read Published Page Sections" ON page_sections;
CREATE POLICY "Public Read Published Page Sections" ON page_sections
    FOR SELECT
    USING (
        status = 'published'
        AND (
            is_visible = true
            OR section_key IN (
                'hero-slider', 'about-corporate-home', 'statistics-counter',
                'featured-projects-home', 'commitment-quote'
            )
        )
        AND EXISTS (
            SELECT 1 FROM pages
             WHERE pages.id = page_sections.page_id
               AND pages.is_published = true
        )
    );

CREATE OR REPLACE FUNCTION home_commitment_quote_snapshot(p_section_id UUID)
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
        'quoteText', ps.description,
        'attribution', ps.subheading,
        'updatedAt', ps.updated_at,
        'updatedBy', ps.updated_by,
        'publishedAt', ps.published_at,
        'publishedBy', ps.published_by
    )
      FROM page_sections ps
     WHERE ps.id = p_section_id;
$$;

CREATE OR REPLACE FUNCTION save_home_commitment_quote_draft(
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
        RAISE EXCEPTION 'Home Commitment Quote payload must be a JSON object' USING ERRCODE = '22023';
    END IF;

    IF p_payload ->> 'sectionKey' IS DISTINCT FROM 'commitment-quote' THEN
        RAISE EXCEPTION 'Only the commitment-quote section can be saved by this function' USING ERRCODE = '22023';
    END IF;

    BEGIN
        v_source_id := (p_payload ->> 'id')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Home Commitment Quote payload contains an invalid identifier' USING ERRCODE = '22023';
    END;

    IF jsonb_typeof(p_payload -> 'isVisible') IS DISTINCT FROM 'boolean'
       OR length(btrim(COALESCE(p_payload ->> 'quoteText', ''))) NOT BETWEEN 1 AND 500
       OR length(btrim(COALESCE(p_payload ->> 'attribution', ''))) NOT BETWEEN 1 AND 180 THEN
        RAISE EXCEPTION 'Home Commitment Quote validation failed' USING ERRCODE = '22023';
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
        RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_COMMITMENT_QUOTE_CONFLICT', 'error', 'The edited section no longer belongs to the current Home page.');
    END IF;

    SELECT * INTO v_draft
      FROM page_sections
     WHERE page_id = v_page_id
       AND section_key = 'commitment-quote'
       AND status = 'draft'
     FOR UPDATE;

    IF v_draft.id IS NOT NULL THEN
        IF v_source_id <> v_draft.id OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN
            RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_COMMITMENT_QUOTE_CONFLICT', 'error', 'The Commitment Quote draft changed after this editor loaded it.');
        END IF;

        v_draft_id := v_draft.id;
        v_old_snapshot := home_commitment_quote_snapshot(v_draft_id);

        UPDATE page_sections
           SET description = btrim(p_payload ->> 'quoteText'),
               subheading = btrim(p_payload ->> 'attribution'),
               is_visible = (p_payload ->> 'isVisible')::BOOLEAN,
               updated_by = v_actor
         WHERE id = v_draft_id;
    ELSE
        SELECT * INTO v_published
          FROM page_sections
         WHERE page_id = v_page_id
           AND section_key = 'commitment-quote'
           AND status = 'published'
         FOR UPDATE;

        IF v_published.id IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'status', 503, 'code', 'HOME_COMMITMENT_QUOTE_NOT_CONFIGURED', 'error', 'The published Home Commitment Quote is not configured.');
        END IF;

        IF v_source_id <> v_published.id OR v_published.updated_at IS DISTINCT FROM p_expected_updated_at THEN
            RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_COMMITMENT_QUOTE_CONFLICT', 'error', 'The published Commitment Quote changed after this editor loaded it.');
        END IF;

        SELECT COALESCE(max(version_number), 0) + 1 INTO v_next_version
          FROM page_sections
         WHERE page_id = v_page_id AND section_key = 'commitment-quote';

        v_old_snapshot := home_commitment_quote_snapshot(v_published.id);

        INSERT INTO page_sections (
            page_id, section_key, section_name, tag_text, heading, subheading,
            description, allowed_variant, sort_order, is_visible, status,
            version_number, settings, updated_by, supersedes_id
        ) VALUES (
            v_page_id, 'commitment-quote', v_published.section_name,
            v_published.tag_text, v_published.heading,
            btrim(p_payload ->> 'attribution'), btrim(p_payload ->> 'quoteText'),
            v_published.allowed_variant, v_published.sort_order,
            (p_payload ->> 'isVisible')::BOOLEAN, 'draft', v_next_version,
            v_published.settings, v_actor, v_published.id
        ) RETURNING id INTO v_draft_id;
    END IF;

    v_new_snapshot := home_commitment_quote_snapshot(v_draft_id);
    SELECT COALESCE(max(version_number), 0) + 1 INTO v_revision_number
      FROM content_revisions
     WHERE table_name = 'page_sections' AND record_id = v_draft_id;

    INSERT INTO content_revisions (
        table_name, record_id, revision_data, created_by, version_number, change_summary
    ) VALUES (
        'page_sections', v_draft_id, v_new_snapshot, v_actor, v_revision_number,
        CASE WHEN v_draft.id IS NULL THEN 'Created Home Commitment Quote draft' ELSE 'Saved Home Commitment Quote draft' END
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

CREATE OR REPLACE FUNCTION publish_home_commitment_quote_draft(
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
       AND section_key = 'commitment-quote'
       AND status = 'draft'
     FOR UPDATE;

    IF v_draft.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 404, 'code', 'HOME_COMMITMENT_QUOTE_DRAFT_NOT_FOUND', 'error', 'The Home Commitment Quote draft no longer exists.');
    END IF;

    IF v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN
        RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_COMMITMENT_QUOTE_CONFLICT', 'error', 'The Commitment Quote draft changed after this editor loaded it.');
    END IF;

    IF length(btrim(COALESCE(v_draft.description, ''))) NOT BETWEEN 1 AND 500
       OR length(btrim(COALESCE(v_draft.subheading, ''))) NOT BETWEEN 1 AND 180 THEN
        RETURN jsonb_build_object('ok', false, 'status', 422, 'code', 'HOME_COMMITMENT_QUOTE_INVALID', 'error', 'The Commitment Quote content is incomplete.');
    END IF;

    v_old_snapshot := home_commitment_quote_snapshot(v_draft.id);

    SELECT * INTO v_previous_published
      FROM page_sections
     WHERE page_id = v_draft.page_id
       AND section_key = v_draft.section_key
       AND status = 'published'
     FOR UPDATE;

    IF v_previous_published.id IS NOT NULL THEN
        v_previous_snapshot := home_commitment_quote_snapshot(v_previous_published.id);
        UPDATE page_sections
           SET status = 'archived', updated_by = v_actor
         WHERE id = v_previous_published.id;

        INSERT INTO audit_logs (admin_id, action, table_name, record_id, old_values, new_values)
        VALUES (v_actor, 'archive_published', 'page_sections', v_previous_published.id,
            v_previous_snapshot, home_commitment_quote_snapshot(v_previous_published.id));
    END IF;

    UPDATE page_sections
       SET status = 'published', published_at = clock_timestamp(),
           published_by = v_actor, updated_by = v_actor
     WHERE id = v_draft.id;

    v_new_snapshot := home_commitment_quote_snapshot(v_draft.id);
    SELECT COALESCE(max(version_number), 0) + 1 INTO v_revision_number
      FROM content_revisions
     WHERE table_name = 'page_sections' AND record_id = v_draft.id;

    INSERT INTO content_revisions (
        table_name, record_id, revision_data, created_by, version_number, change_summary
    ) VALUES (
        'page_sections', v_draft.id, v_new_snapshot, v_actor, v_revision_number,
        'Published Home Commitment Quote'
    );

    INSERT INTO audit_logs (admin_id, action, table_name, record_id, old_values, new_values)
    VALUES (v_actor, 'publish', 'page_sections', v_draft.id, v_old_snapshot, v_new_snapshot);

    RETURN jsonb_build_object('ok', true, 'data', v_new_snapshot);
END;
$$;

REVOKE ALL ON FUNCTION home_commitment_quote_snapshot(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION save_home_commitment_quote_draft(JSONB, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION publish_home_commitment_quote_draft(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_home_commitment_quote_draft(JSONB, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_home_commitment_quote_draft(UUID, TIMESTAMPTZ) TO authenticated;

-- Seed the exact current public quotation before switching the component to
-- the database read path. Re-running is safe when a published version exists.
DO $$
DECLARE
    v_page_id UUID;
    v_section_id UUID;
    v_snapshot JSONB;
BEGIN
    SELECT id INTO v_page_id FROM pages WHERE slug = 'home';
    IF v_page_id IS NULL THEN
        RAISE EXCEPTION 'Home page is required before seeding the Commitment Quote';
    END IF;

    IF EXISTS (
        SELECT 1 FROM page_sections
         WHERE page_id = v_page_id
           AND section_key = 'commitment-quote'
           AND status = 'published'
    ) THEN
        RETURN;
    END IF;

    INSERT INTO page_sections (
        page_id, section_key, section_name, subheading, description,
        sort_order, is_visible, status, version_number, settings, published_at
    ) VALUES (
        v_page_id,
        'commitment-quote',
        'Commitment Quote',
        'Dhaka Heights Properties Limited Board of Directors',
        'Architecture should speak of its time and place, but yearn for timelessness.',
        50,
        true,
        'published',
        1,
        '{}'::jsonb,
        clock_timestamp()
    ) RETURNING id INTO v_section_id;

    v_snapshot := home_commitment_quote_snapshot(v_section_id);

    INSERT INTO content_revisions (
        table_name, record_id, revision_data, version_number, change_summary
    ) VALUES (
        'page_sections', v_section_id, v_snapshot, 1,
        'Seeded initial published Home Commitment Quote'
    );

    INSERT INTO audit_logs (admin_id, action, table_name, record_id, new_values)
    VALUES (NULL, 'migration_seed', 'page_sections', v_section_id, v_snapshot);
END;
$$;

COMMIT;
