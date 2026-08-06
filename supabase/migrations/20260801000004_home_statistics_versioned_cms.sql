BEGIN;

-- Phase 1C: structured numeric semantics for the Home Statistics Counter.
ALTER TABLE section_items
    ADD COLUMN IF NOT EXISTS numeric_value NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS value_suffix TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'section_items_numeric_value_nonnegative'
    ) THEN
        ALTER TABLE section_items
            ADD CONSTRAINT section_items_numeric_value_nonnegative
            CHECK (numeric_value IS NULL OR numeric_value BETWEEN 0 AND 1000000000);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'section_items_value_suffix_length'
    ) THEN
        ALTER TABLE section_items
            ADD CONSTRAINT section_items_value_suffix_length
            CHECK (length(value_suffix) <= 10);
    END IF;
END;
$$;

-- Hidden published CMS sections remain readable as metadata so the public
-- loader can distinguish an intentionally disabled section from missing data.
DROP POLICY IF EXISTS "Public Read Published Page Sections" ON page_sections;
CREATE POLICY "Public Read Published Page Sections" ON page_sections
    FOR SELECT
    USING (
        status = 'published'
        AND (
            is_visible = true
            OR section_key IN ('hero-slider', 'about-corporate-home', 'statistics-counter')
        )
        AND EXISTS (
            SELECT 1
              FROM pages
             WHERE pages.id = page_sections.page_id
               AND pages.is_published = true
        )
    );

CREATE OR REPLACE FUNCTION home_statistics_snapshot(p_section_id UUID)
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
        'updatedAt', ps.updated_at,
        'updatedBy', ps.updated_by,
        'publishedAt', ps.published_at,
        'publishedBy', ps.published_by,
        'metrics', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'itemId', si.id,
                    'itemKey', si.item_key,
                    'value', si.numeric_value,
                    'suffix', si.value_suffix,
                    'label', si.title,
                    'supportingText', si.body_text,
                    'iconKey', si.icon_key,
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

CREATE OR REPLACE FUNCTION save_home_statistics_draft(
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
    v_metric JSONB;
    v_metric_count INTEGER;
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

    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
        RAISE EXCEPTION 'Home Statistics payload must be a JSON object' USING ERRCODE = '22023';
    END IF;

    IF p_payload ->> 'sectionKey' IS DISTINCT FROM 'statistics-counter' THEN
        RAISE EXCEPTION 'Only the statistics-counter section can be saved by this function' USING ERRCODE = '22023';
    END IF;

    BEGIN
        v_source_id := (p_payload ->> 'id')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Home Statistics payload contains an invalid section identifier' USING ERRCODE = '22023';
    END;

    IF jsonb_typeof(p_payload -> 'isVisible') IS DISTINCT FROM 'boolean'
       OR jsonb_typeof(p_payload -> 'metrics') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Statistics visibility and metrics have invalid types' USING ERRCODE = '22023';
    END IF;

    v_metric_count := jsonb_array_length(p_payload -> 'metrics');
    IF v_metric_count NOT BETWEEN 1 AND 8 THEN
        RAISE EXCEPTION 'Home Statistics requires between 1 and 8 metrics' USING ERRCODE = '22023';
    END IF;

    IF (SELECT count(DISTINCT metric ->> 'itemKey') FROM jsonb_array_elements(p_payload -> 'metrics') metric) <> v_metric_count THEN
        RAISE EXCEPTION 'Metric keys must be unique' USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_payload -> 'metrics') metric
         WHERE jsonb_typeof(metric -> 'isVisible') = 'boolean'
           AND (metric ->> 'isVisible')::BOOLEAN = true
    ) THEN
        RAISE EXCEPTION 'At least one metric must be visible' USING ERRCODE = '22023';
    END IF;

    FOR v_metric IN SELECT value FROM jsonb_array_elements(p_payload -> 'metrics')
    LOOP
        IF jsonb_typeof(v_metric) <> 'object'
           OR COALESCE(v_metric ->> 'itemKey', '') !~ '^metric-[a-z0-9-]{1,64}$'
           OR jsonb_typeof(v_metric -> 'value') <> 'number'
           OR (v_metric ->> 'value')::NUMERIC NOT BETWEEN 0 AND 1000000000
           OR scale((v_metric ->> 'value')::NUMERIC) > 2
           OR length(COALESCE(v_metric ->> 'suffix', '')) > 10
           OR length(btrim(COALESCE(v_metric ->> 'label', ''))) NOT BETWEEN 1 AND 80
           OR length(btrim(COALESCE(v_metric ->> 'supportingText', ''))) NOT BETWEEN 1 AND 160
           OR COALESCE(v_metric ->> 'iconKey', '') !~ '^fa-[a-z0-9-]{1,60}$'
           OR jsonb_typeof(v_metric -> 'isVisible') IS DISTINCT FROM 'boolean' THEN
            RAISE EXCEPTION 'One or more Home Statistics metrics are invalid' USING ERRCODE = '22023';
        END IF;
    END LOOP;

    SELECT id INTO v_page_id FROM pages WHERE slug = 'home' FOR UPDATE;
    IF v_page_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 503, 'code', 'HOME_PAGE_NOT_CONFIGURED', 'error', 'The Home page record is not configured.');
    END IF;

    IF NULLIF(p_payload ->> 'pageId', '') IS NOT NULL
       AND (p_payload ->> 'pageId')::UUID <> v_page_id THEN
        RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_STATISTICS_CONFLICT', 'error', 'The edited section no longer belongs to the current Home page.');
    END IF;

    SELECT * INTO v_draft
      FROM page_sections
     WHERE page_id = v_page_id AND section_key = 'statistics-counter' AND status = 'draft'
     FOR UPDATE;

    IF v_draft.id IS NOT NULL THEN
        IF v_source_id <> v_draft.id OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN
            RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_STATISTICS_CONFLICT', 'error', 'The Statistics draft changed after this editor loaded it.');
        END IF;

        v_draft_id := v_draft.id;
        v_old_snapshot := home_statistics_snapshot(v_draft_id);
        UPDATE page_sections
           SET is_visible = (p_payload ->> 'isVisible')::BOOLEAN,
               updated_by = v_actor
         WHERE id = v_draft_id;
        DELETE FROM section_items WHERE section_id = v_draft_id;
    ELSE
        SELECT * INTO v_published
          FROM page_sections
         WHERE page_id = v_page_id AND section_key = 'statistics-counter' AND status = 'published'
         FOR UPDATE;

        IF v_published.id IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'status', 503, 'code', 'HOME_STATISTICS_NOT_CONFIGURED', 'error', 'The published Home Statistics section is not configured.');
        END IF;

        IF v_source_id <> v_published.id OR v_published.updated_at IS DISTINCT FROM p_expected_updated_at THEN
            RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_STATISTICS_CONFLICT', 'error', 'The published Statistics section changed after this editor loaded it.');
        END IF;

        SELECT COALESCE(max(version_number), 0) + 1 INTO v_next_version
          FROM page_sections
         WHERE page_id = v_page_id AND section_key = 'statistics-counter';

        v_old_snapshot := home_statistics_snapshot(v_published.id);
        INSERT INTO page_sections (
            page_id, section_key, section_name, allowed_variant, sort_order,
            is_visible, status, version_number, settings, updated_by, supersedes_id
        ) VALUES (
            v_page_id, 'statistics-counter', v_published.section_name,
            v_published.allowed_variant, v_published.sort_order,
            (p_payload ->> 'isVisible')::BOOLEAN, 'draft', v_next_version,
            COALESCE(v_published.settings, '{}'::jsonb), v_actor, v_published.id
        ) RETURNING id INTO v_draft_id;
    END IF;

    INSERT INTO section_items (
        section_id, item_key, title, body_text, icon_library, icon_key,
        numeric_value, value_suffix, sort_order, is_visible, updated_by
    )
    SELECT
        v_draft_id,
        metric ->> 'itemKey',
        btrim(metric ->> 'label'),
        btrim(metric ->> 'supportingText'),
        'fontawesome',
        metric ->> 'iconKey',
        (metric ->> 'value')::NUMERIC,
        COALESCE(metric ->> 'suffix', ''),
        ordinal * 10,
        (metric ->> 'isVisible')::BOOLEAN,
        v_actor
      FROM jsonb_array_elements(p_payload -> 'metrics') WITH ORDINALITY AS entries(metric, ordinal);

    v_new_snapshot := home_statistics_snapshot(v_draft_id);
    SELECT COALESCE(max(version_number), 0) + 1 INTO v_revision_number
      FROM content_revisions
     WHERE table_name = 'page_sections' AND record_id = v_draft_id;

    INSERT INTO content_revisions (
        table_name, record_id, revision_data, created_by, version_number, change_summary
    ) VALUES (
        'page_sections', v_draft_id, v_new_snapshot, v_actor, v_revision_number,
        CASE WHEN v_draft.id IS NULL THEN 'Created Home Statistics draft' ELSE 'Saved Home Statistics draft' END
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

CREATE OR REPLACE FUNCTION publish_home_statistics_draft(
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
     WHERE id = p_section_id AND section_key = 'statistics-counter' AND status = 'draft'
     FOR UPDATE;

    IF v_draft.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 404, 'code', 'HOME_STATISTICS_DRAFT_NOT_FOUND', 'error', 'The Home Statistics draft no longer exists.');
    END IF;

    IF v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN
        RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_STATISTICS_CONFLICT', 'error', 'The Statistics draft changed after this editor loaded it.');
    END IF;

    IF (SELECT count(*) FROM section_items WHERE section_id = v_draft.id) NOT BETWEEN 1 AND 8
       OR NOT EXISTS (SELECT 1 FROM section_items WHERE section_id = v_draft.id AND is_visible = true)
       OR EXISTS (
            SELECT 1 FROM section_items
             WHERE section_id = v_draft.id
               AND (
                    numeric_value IS NULL OR numeric_value NOT BETWEEN 0 AND 1000000000
                    OR length(COALESCE(value_suffix, '')) > 10
                    OR length(btrim(COALESCE(title, ''))) NOT BETWEEN 1 AND 80
                    OR length(btrim(COALESCE(body_text, ''))) NOT BETWEEN 1 AND 160
                    OR COALESCE(icon_key, '') !~ '^fa-[a-z0-9-]{1,60}$'
               )
       ) THEN
        RETURN jsonb_build_object('ok', false, 'status', 422, 'code', 'HOME_STATISTICS_INVALID', 'error', 'The Statistics draft contains invalid metric records.');
    END IF;

    v_old_snapshot := home_statistics_snapshot(v_draft.id);
    SELECT * INTO v_previous_published
      FROM page_sections
     WHERE page_id = v_draft.page_id AND section_key = v_draft.section_key AND status = 'published'
     FOR UPDATE;

    IF v_previous_published.id IS NOT NULL THEN
        v_previous_snapshot := home_statistics_snapshot(v_previous_published.id);
        UPDATE page_sections SET status = 'archived', updated_by = v_actor WHERE id = v_previous_published.id;
        INSERT INTO audit_logs (admin_id, action, table_name, record_id, old_values, new_values)
        VALUES (v_actor, 'archive_published', 'page_sections', v_previous_published.id,
            v_previous_snapshot, home_statistics_snapshot(v_previous_published.id));
    END IF;

    UPDATE page_sections
       SET status = 'published', published_at = clock_timestamp(),
           published_by = v_actor, updated_by = v_actor
     WHERE id = v_draft.id;

    v_new_snapshot := home_statistics_snapshot(v_draft.id);
    SELECT COALESCE(max(version_number), 0) + 1 INTO v_revision_number
      FROM content_revisions
     WHERE table_name = 'page_sections' AND record_id = v_draft.id;

    INSERT INTO content_revisions (
        table_name, record_id, revision_data, created_by, version_number, change_summary
    ) VALUES (
        'page_sections', v_draft.id, v_new_snapshot, v_actor, v_revision_number,
        'Published Home Statistics section'
    );

    INSERT INTO audit_logs (admin_id, action, table_name, record_id, old_values, new_values)
    VALUES (v_actor, 'publish', 'page_sections', v_draft.id, v_old_snapshot, v_new_snapshot);

    RETURN jsonb_build_object('ok', true, 'data', v_new_snapshot);
END;
$$;

REVOKE ALL ON FUNCTION home_statistics_snapshot(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION save_home_statistics_draft(JSONB, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION publish_home_statistics_draft(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_home_statistics_draft(JSONB, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_home_statistics_draft(UUID, TIMESTAMPTZ) TO authenticated;

-- Exact current public Statistics Counter content.
DO $$
DECLARE
    v_page_id UUID;
    v_section_id UUID;
    v_snapshot JSONB;
BEGIN
    SELECT id INTO v_page_id FROM pages WHERE slug = 'home';
    IF v_page_id IS NULL THEN
        RAISE EXCEPTION 'Home page is required before seeding the Statistics Counter';
    END IF;

    IF EXISTS (
        SELECT 1 FROM page_sections
         WHERE page_id = v_page_id
           AND section_key = 'statistics-counter'
           AND status = 'published'
    ) THEN
        RETURN;
    END IF;

    INSERT INTO page_sections (
        page_id, section_key, section_name, sort_order, is_visible,
        status, version_number, settings, published_at
    ) VALUES (
        v_page_id, 'statistics-counter', 'Statistics Counter', 30, true,
        'published', 1, '{}'::jsonb, clock_timestamp()
    ) RETURNING id INTO v_section_id;

    INSERT INTO section_items (
        section_id, item_key, title, body_text, icon_library, icon_key,
        numeric_value, value_suffix, sort_order, is_visible
    ) VALUES
    (v_section_id, 'metric-years-excellence', 'Years of Excellence',
        'Delivering corporate prestige', 'fontawesome', 'fa-calendar-check', 15, '+', 10, true),
    (v_section_id, 'metric-iconic-developments', 'Iconic Developments',
        'Premium commercial towers', 'fontawesome', 'fa-building', 8, '+', 20, true),
    (v_section_id, 'metric-area-delivered', 'Sq. Ft. Delivered',
        'Optimized workspace area', 'fontawesome', 'fa-maximize', 450, 'K+', 30, true),
    (v_section_id, 'metric-client-satisfaction', 'Client Satisfaction',
        'Bespoke tenant services', 'fontawesome', 'fa-users', 99.8, '%', 40, true);

    v_snapshot := home_statistics_snapshot(v_section_id);
    INSERT INTO content_revisions (
        table_name, record_id, revision_data, version_number, change_summary
    ) VALUES (
        'page_sections', v_section_id, v_snapshot, 1,
        'Seeded initial published Home Statistics section'
    );

    INSERT INTO audit_logs (admin_id, action, table_name, record_id, new_values)
    VALUES (NULL, 'migration_seed', 'page_sections', v_section_id, v_snapshot);
END;
$$;

COMMIT;
