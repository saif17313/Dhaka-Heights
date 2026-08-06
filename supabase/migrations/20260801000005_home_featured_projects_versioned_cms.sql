BEGIN;

-- Phase 1D: ordered Home placements backed by canonical published projects.
CREATE UNIQUE INDEX IF NOT EXISTS uq_section_entity_selection_type
    ON section_entity_selections (section_id, entity_type);

ALTER TABLE projects
    DROP CONSTRAINT IF EXISTS projects_cover_image_id_fkey,
    ADD CONSTRAINT projects_cover_image_id_fkey
        FOREIGN KEY (cover_image_id) REFERENCES media_assets(id) ON DELETE RESTRICT;

ALTER TABLE section_entity_selection_items
    DROP CONSTRAINT IF EXISTS section_entity_selection_items_project_id_fkey,
    ADD CONSTRAINT section_entity_selection_items_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT;

-- Hidden published CMS sections remain readable as metadata so the loader can
-- distinguish an intentionally disabled section from missing configuration.
DROP POLICY IF EXISTS "Public Read Published Page Sections" ON page_sections;
CREATE POLICY "Public Read Published Page Sections" ON page_sections
    FOR SELECT
    USING (
        status = 'published'
        AND (
            is_visible = true
            OR section_key IN (
                'hero-slider', 'about-corporate-home', 'statistics-counter',
                'featured-projects-home'
            )
        )
        AND EXISTS (
            SELECT 1 FROM pages
             WHERE pages.id = page_sections.page_id
               AND pages.is_published = true
        )
    );

-- Placement rows inherit publication from their versioned parent section.
DROP POLICY IF EXISTS "Public Read Section Selections" ON section_entity_selections;
DROP POLICY IF EXISTS "Public Read Published Section Selections" ON section_entity_selections;
CREATE POLICY "Public Read Published Section Selections" ON section_entity_selections
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
              FROM page_sections ps
              JOIN pages p ON p.id = ps.page_id
             WHERE ps.id = section_entity_selections.section_id
               AND ps.status = 'published'
               AND ps.is_visible = true
               AND p.is_published = true
        )
    );

DROP POLICY IF EXISTS "Public Read Selection Items" ON section_entity_selection_items;
DROP POLICY IF EXISTS "Public Read Published Selection Items" ON section_entity_selection_items;
CREATE POLICY "Public Read Published Selection Items" ON section_entity_selection_items
    FOR SELECT
    USING (
        is_visible = true
        AND EXISTS (
            SELECT 1
              FROM section_entity_selections ses
              JOIN page_sections ps ON ps.id = ses.section_id
              JOIN pages p ON p.id = ps.page_id
             WHERE ses.id = section_entity_selection_items.selection_id
               AND ps.status = 'published'
               AND ps.is_visible = true
               AND p.is_published = true
        )
    );

-- Versioned placement writes are restricted to the authenticated RPCs below.
DROP POLICY IF EXISTS "Admin Full Access Section Selections" ON section_entity_selections;
DROP POLICY IF EXISTS "Admin Read Section Selections" ON section_entity_selections;
CREATE POLICY "Admin Read Section Selections" ON section_entity_selections
    FOR SELECT USING (get_admin_role() IN ('super_admin', 'content_editor'));

DROP POLICY IF EXISTS "Admin Full Access Selection Items" ON section_entity_selection_items;
DROP POLICY IF EXISTS "Admin Read Selection Items" ON section_entity_selection_items;
CREATE POLICY "Admin Read Selection Items" ON section_entity_selection_items
    FOR SELECT USING (get_admin_role() IN ('super_admin', 'content_editor'));

CREATE OR REPLACE FUNCTION home_featured_projects_snapshot(p_section_id UUID)
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
        'pageSize', COALESCE((ps.settings ->> 'page_size')::INTEGER, 6),
        'updatedAt', ps.updated_at,
        'updatedBy', ps.updated_by,
        'publishedAt', ps.published_at,
        'publishedBy', ps.published_by,
        'projects', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'placementId', sei.id,
                    'projectId', p.id,
                    'sortOrder', sei.sort_order,
                    'isVisible', sei.is_visible,
                    'project', jsonb_build_object(
                        'id', p.id,
                        'slug', p.slug,
                        'name', p.name,
                        'category', p.category,
                        'badgeText', p.badge_text,
                        'location', p.location_address,
                        'size', p.size_summary,
                        'projectType', p.project_type,
                        'status', p.status,
                        'coverMediaId', p.cover_image_id,
                        'coverMedia', CASE WHEN ma.id IS NULL THEN NULL ELSE jsonb_build_object(
                            'id', ma.id,
                            'secureUrl', ma.secure_url,
                            'displayName', COALESCE(ma.display_name, ma.original_filename),
                            'altText', COALESCE(ma.alt_text, ''),
                            'width', ma.width,
                            'height', ma.height
                        ) END
                    )
                ) ORDER BY sei.sort_order, sei.id
            )
              FROM section_entity_selections ses
              JOIN section_entity_selection_items sei ON sei.selection_id = ses.id
              JOIN projects p ON p.id = sei.project_id
              LEFT JOIN media_assets ma ON ma.id = p.cover_image_id
             WHERE ses.section_id = ps.id
               AND ses.entity_type = 'project'
        ), '[]'::jsonb)
    )
      FROM page_sections ps
     WHERE ps.id = p_section_id;
$$;

CREATE OR REPLACE FUNCTION save_home_featured_projects_draft(
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
    v_selection_id UUID;
    v_next_version INTEGER;
    v_selected_count INTEGER;
    v_old_snapshot JSONB;
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

    IF p_expected_updated_at IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 422, 'code', 'VALIDATION_ERROR', 'error', 'The expected updated timestamp is required.');
    END IF;

    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
       OR p_payload ->> 'sectionKey' IS DISTINCT FROM 'featured-projects-home' THEN
        RAISE EXCEPTION 'Invalid Home Featured Projects payload' USING ERRCODE = '22023';
    END IF;

    BEGIN
        v_source_id := (p_payload ->> 'id')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Home Featured Projects payload contains an invalid section identifier' USING ERRCODE = '22023';
    END;

    IF jsonb_typeof(p_payload -> 'isVisible') IS DISTINCT FROM 'boolean'
       OR jsonb_typeof(p_payload -> 'projects') IS DISTINCT FROM 'array'
       OR length(btrim(COALESCE(p_payload ->> 'tagText', ''))) NOT BETWEEN 1 AND 80
       OR length(btrim(COALESCE(p_payload ->> 'heading', ''))) NOT BETWEEN 1 AND 140
       OR jsonb_typeof(p_payload -> 'pageSize') <> 'number'
       OR (p_payload ->> 'pageSize')::INTEGER NOT BETWEEN 1 AND 12 THEN
        RAISE EXCEPTION 'Home Featured Projects section fields are invalid' USING ERRCODE = '22023';
    END IF;

    v_selected_count := jsonb_array_length(p_payload -> 'projects');
    IF v_selected_count NOT BETWEEN 1 AND 20 THEN
        RAISE EXCEPTION 'Select between 1 and 20 Home projects' USING ERRCODE = '22023';
    END IF;

    IF (SELECT count(DISTINCT project ->> 'projectId') FROM jsonb_array_elements(p_payload -> 'projects') project) <> v_selected_count
       OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(p_payload -> 'projects') project
             WHERE COALESCE(project ->> 'projectId', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                OR jsonb_typeof(project -> 'isVisible') IS DISTINCT FROM 'boolean'
       )
       OR NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(p_payload -> 'projects') project
             WHERE (project ->> 'isVisible')::BOOLEAN = true
       ) THEN
        RAISE EXCEPTION 'Home project placements are invalid, duplicated, or all hidden' USING ERRCODE = '22023';
    END IF;

    -- Lock selected canonical projects and covers against concurrent mutation.
    PERFORM p.id
      FROM projects p
      JOIN media_assets ma ON ma.id = p.cover_image_id
     WHERE p.id IN (
        SELECT (project ->> 'projectId')::UUID
          FROM jsonb_array_elements(p_payload -> 'projects') project
     )
     ORDER BY p.id
     FOR SHARE OF p, ma;

    IF (
        SELECT count(*)
          FROM projects p
          JOIN media_assets ma ON ma.id = p.cover_image_id
         WHERE p.id IN (
            SELECT (project ->> 'projectId')::UUID
              FROM jsonb_array_elements(p_payload -> 'projects') project
         )
           AND p.status = 'published'
           AND ma.is_archived = false
           AND ma.resource_type = 'image'
    ) <> v_selected_count THEN
        RAISE EXCEPTION 'Every Home placement must reference a published project with an active cover image' USING ERRCODE = '23503';
    END IF;

    SELECT id INTO v_page_id FROM pages WHERE slug = 'home' FOR UPDATE;
    IF v_page_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 503, 'code', 'HOME_PAGE_NOT_CONFIGURED', 'error', 'The Home page record is not configured.');
    END IF;

    IF NULLIF(p_payload ->> 'pageId', '') IS NOT NULL
       AND (p_payload ->> 'pageId')::UUID <> v_page_id THEN
        RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_FEATURED_PROJECTS_CONFLICT', 'error', 'The edited section no longer belongs to the current Home page.');
    END IF;

    SELECT * INTO v_draft
      FROM page_sections
     WHERE page_id = v_page_id AND section_key = 'featured-projects-home' AND status = 'draft'
     FOR UPDATE;

    IF v_draft.id IS NOT NULL THEN
        IF v_source_id <> v_draft.id OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN
            RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_FEATURED_PROJECTS_CONFLICT', 'error', 'The Featured Projects draft changed after this editor loaded it.');
        END IF;
        v_draft_id := v_draft.id;
        v_old_snapshot := home_featured_projects_snapshot(v_draft_id);
        UPDATE page_sections
           SET tag_text = btrim(p_payload ->> 'tagText'),
               heading = btrim(p_payload ->> 'heading'),
               is_visible = (p_payload ->> 'isVisible')::BOOLEAN,
               settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('page_size', (p_payload ->> 'pageSize')::INTEGER),
               updated_by = v_actor
         WHERE id = v_draft_id;
        DELETE FROM section_entity_selections WHERE section_id = v_draft_id AND entity_type = 'project';
    ELSE
        SELECT * INTO v_published
          FROM page_sections
         WHERE page_id = v_page_id AND section_key = 'featured-projects-home' AND status = 'published'
         FOR UPDATE;

        IF v_published.id IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'status', 503, 'code', 'HOME_FEATURED_PROJECTS_NOT_CONFIGURED', 'error', 'The published Home Featured Projects section is not configured.');
        END IF;
        IF v_source_id <> v_published.id OR v_published.updated_at IS DISTINCT FROM p_expected_updated_at THEN
            RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_FEATURED_PROJECTS_CONFLICT', 'error', 'The published Featured Projects section changed after this editor loaded it.');
        END IF;

        SELECT COALESCE(max(version_number), 0) + 1 INTO v_next_version
          FROM page_sections
         WHERE page_id = v_page_id AND section_key = 'featured-projects-home';
        v_old_snapshot := home_featured_projects_snapshot(v_published.id);

        INSERT INTO page_sections (
            page_id, section_key, section_name, tag_text, heading, allowed_variant,
            sort_order, is_visible, status, version_number, settings, updated_by, supersedes_id
        ) VALUES (
            v_page_id, 'featured-projects-home', v_published.section_name,
            btrim(p_payload ->> 'tagText'), btrim(p_payload ->> 'heading'),
            v_published.allowed_variant, v_published.sort_order,
            (p_payload ->> 'isVisible')::BOOLEAN, 'draft', v_next_version,
            COALESCE(v_published.settings, '{}'::jsonb) || jsonb_build_object('page_size', (p_payload ->> 'pageSize')::INTEGER),
            v_actor, v_published.id
        ) RETURNING id INTO v_draft_id;
    END IF;

    INSERT INTO section_entity_selections (section_id, entity_type)
    VALUES (v_draft_id, 'project') RETURNING id INTO v_selection_id;

    INSERT INTO section_entity_selection_items (
        selection_id, project_id, sort_order, is_visible
    )
    SELECT v_selection_id, (project ->> 'projectId')::UUID,
           ordinal * 10, (project ->> 'isVisible')::BOOLEAN
      FROM jsonb_array_elements(p_payload -> 'projects') WITH ORDINALITY AS entries(project, ordinal);

    v_new_snapshot := home_featured_projects_snapshot(v_draft_id);
    SELECT COALESCE(max(version_number), 0) + 1 INTO v_revision_number
      FROM content_revisions
     WHERE table_name = 'page_sections' AND record_id = v_draft_id;

    INSERT INTO content_revisions (
        table_name, record_id, revision_data, created_by, version_number, change_summary
    ) VALUES (
        'page_sections', v_draft_id, v_new_snapshot, v_actor, v_revision_number,
        CASE WHEN v_draft.id IS NULL THEN 'Created Home Featured Projects draft' ELSE 'Saved Home Featured Projects draft' END
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

CREATE OR REPLACE FUNCTION publish_home_featured_projects_draft(
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
    v_selection_id UUID;
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
     WHERE id = p_section_id AND section_key = 'featured-projects-home' AND status = 'draft'
     FOR UPDATE;
    IF v_draft.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 404, 'code', 'HOME_FEATURED_PROJECTS_DRAFT_NOT_FOUND', 'error', 'The Home Featured Projects draft no longer exists.');
    END IF;
    IF v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN
        RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_FEATURED_PROJECTS_CONFLICT', 'error', 'The Featured Projects draft changed after this editor loaded it.');
    END IF;

    SELECT id INTO v_selection_id
      FROM section_entity_selections
     WHERE section_id = v_draft.id AND entity_type = 'project';

    IF v_selection_id IS NULL
       OR (SELECT count(*) FROM section_entity_selection_items WHERE selection_id = v_selection_id) NOT BETWEEN 1 AND 20
       OR NOT EXISTS (SELECT 1 FROM section_entity_selection_items WHERE selection_id = v_selection_id AND is_visible = true)
       OR EXISTS (
            SELECT 1
              FROM section_entity_selection_items sei
              LEFT JOIN projects p ON p.id = sei.project_id
              LEFT JOIN media_assets ma ON ma.id = p.cover_image_id
             WHERE sei.selection_id = v_selection_id
               AND (p.id IS NULL OR p.status <> 'published' OR ma.id IS NULL OR ma.is_archived = true OR ma.resource_type <> 'image')
       ) THEN
        RETURN jsonb_build_object('ok', false, 'status', 422, 'code', 'HOME_FEATURED_PROJECTS_INVALID', 'error', 'The Featured Projects draft contains invalid canonical project placements.');
    END IF;

    v_old_snapshot := home_featured_projects_snapshot(v_draft.id);
    SELECT * INTO v_previous_published
      FROM page_sections
     WHERE page_id = v_draft.page_id AND section_key = v_draft.section_key AND status = 'published'
     FOR UPDATE;

    IF v_previous_published.id IS NOT NULL THEN
        v_previous_snapshot := home_featured_projects_snapshot(v_previous_published.id);
        UPDATE page_sections SET status = 'archived', updated_by = v_actor WHERE id = v_previous_published.id;
        INSERT INTO audit_logs (admin_id, action, table_name, record_id, old_values, new_values)
        VALUES (v_actor, 'archive_published', 'page_sections', v_previous_published.id,
            v_previous_snapshot, home_featured_projects_snapshot(v_previous_published.id));
    END IF;

    UPDATE page_sections
       SET status = 'published', published_at = clock_timestamp(),
           published_by = v_actor, updated_by = v_actor
     WHERE id = v_draft.id;

    v_new_snapshot := home_featured_projects_snapshot(v_draft.id);
    SELECT COALESCE(max(version_number), 0) + 1 INTO v_revision_number
      FROM content_revisions
     WHERE table_name = 'page_sections' AND record_id = v_draft.id;
    INSERT INTO content_revisions (
        table_name, record_id, revision_data, created_by, version_number, change_summary
    ) VALUES ('page_sections', v_draft.id, v_new_snapshot, v_actor, v_revision_number, 'Published Home Featured Projects section');
    INSERT INTO audit_logs (admin_id, action, table_name, record_id, old_values, new_values)
    VALUES (v_actor, 'publish', 'page_sections', v_draft.id, v_old_snapshot, v_new_snapshot);

    RETURN jsonb_build_object('ok', true, 'data', v_new_snapshot);
END;
$$;

REVOKE ALL ON FUNCTION home_featured_projects_snapshot(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION save_home_featured_projects_draft(JSONB, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION publish_home_featured_projects_draft(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_home_featured_projects_draft(JSONB, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_home_featured_projects_draft(UUID, TIMESTAMPTZ) TO authenticated;

-- Verified one-to-one local/Cloudinary cover map and exact current placement order.
DO $$
DECLARE
    v_page_id UUID;
    v_section_id UUID;
    v_selection_id UUID;
    v_snapshot JSONB;
BEGIN
    IF (
        SELECT count(*) FROM media_assets
         WHERE public_id IN (
            'dhaka-heights/dev/proj_ariana_lofts', 'dhaka-heights/dev/proj_bd_palace',
            'dhaka-heights/dev/proj_italia', 'dhaka-heights/dev/proj_mazumder_palace',
            'dhaka-heights/dev/proj_muztaba_mansion', 'dhaka-heights/dev/proj_sunsplash',
            'dhaka-heights/dev/proj_silver_spring', 'dhaka-heights/dev/proj_asha_purna',
            'dhaka-heights/dev/proj_green_heaven', 'dhaka-heights/dev/proj_pinnacle'
         ) AND resource_type = 'image' AND is_archived = false
    ) <> 10 THEN
        RAISE EXCEPTION 'All ten verified active project cover assets are required';
    END IF;

    UPDATE projects p
       SET cover_image_id = ma.id, updated_at = clock_timestamp()
      FROM media_assets ma
     WHERE ma.public_id = CASE p.slug
        WHEN 'dhaka-heights-ariana-lofts' THEN 'dhaka-heights/dev/proj_ariana_lofts'
        WHEN 'dhaka-heights-bd-palace' THEN 'dhaka-heights/dev/proj_bd_palace'
        WHEN 'dhaka-heights-italia' THEN 'dhaka-heights/dev/proj_italia'
        WHEN 'dhaka-heights-mazumder-palace' THEN 'dhaka-heights/dev/proj_mazumder_palace'
        WHEN 'dhaka-heights-muztaba-mansion' THEN 'dhaka-heights/dev/proj_muztaba_mansion'
        WHEN 'dhaka-heights-sunsplash' THEN 'dhaka-heights/dev/proj_sunsplash'
        WHEN 'dhaka-heights-silver-spring' THEN 'dhaka-heights/dev/proj_silver_spring'
        WHEN 'dhaka-heights-asha-purna-ii' THEN 'dhaka-heights/dev/proj_asha_purna'
        WHEN 'dhaka-heights-green-heaven' THEN 'dhaka-heights/dev/proj_green_heaven'
        WHEN 'dhaka-heights-pinnacle' THEN 'dhaka-heights/dev/proj_pinnacle'
        ELSE NULL
     END;

    IF (SELECT count(*) FROM projects WHERE cover_image_id IS NOT NULL AND status = 'published') < 10 THEN
        RAISE EXCEPTION 'All ten canonical published projects require cover relations';
    END IF;

    INSERT INTO media_asset_usage (media_asset_id, table_name, record_id, field_name)
    SELECT cover_image_id, 'projects', id, 'cover_image_id'
      FROM projects
     WHERE cover_image_id IS NOT NULL
    ON CONFLICT (media_asset_id, table_name, record_id, field_name) DO NOTHING;

    SELECT id INTO v_page_id FROM pages WHERE slug = 'home';
    IF v_page_id IS NULL THEN
        RAISE EXCEPTION 'Home page is required before seeding Featured Projects';
    END IF;
    IF EXISTS (
        SELECT 1 FROM page_sections
         WHERE page_id = v_page_id AND section_key = 'featured-projects-home' AND status = 'published'
    ) THEN
        RETURN;
    END IF;

    INSERT INTO page_sections (
        page_id, section_key, section_name, tag_text, heading, sort_order,
        is_visible, status, version_number, settings, published_at
    ) VALUES (
        v_page_id, 'featured-projects-home', 'Featured Projects', 'OUR PROPERTIES',
        'Iconic Commercial Spaces', 40, true, 'published', 1,
        jsonb_build_object('page_size', 6), clock_timestamp()
    ) RETURNING id INTO v_section_id;

    INSERT INTO section_entity_selections (section_id, entity_type)
    VALUES (v_section_id, 'project') RETURNING id INTO v_selection_id;

    INSERT INTO section_entity_selection_items (selection_id, project_id, sort_order, is_visible)
    SELECT v_selection_id, id, sort_order, true
      FROM projects
     WHERE slug IN (
        'dhaka-heights-ariana-lofts', 'dhaka-heights-bd-palace', 'dhaka-heights-italia',
        'dhaka-heights-mazumder-palace', 'dhaka-heights-muztaba-mansion',
        'dhaka-heights-sunsplash', 'dhaka-heights-silver-spring',
        'dhaka-heights-asha-purna-ii', 'dhaka-heights-green-heaven', 'dhaka-heights-pinnacle'
     )
     ORDER BY sort_order;

    IF (SELECT count(*) FROM section_entity_selection_items WHERE selection_id = v_selection_id) <> 10 THEN
        RAISE EXCEPTION 'The exact ten canonical project placements are required';
    END IF;

    v_snapshot := home_featured_projects_snapshot(v_section_id);
    INSERT INTO content_revisions (
        table_name, record_id, revision_data, version_number, change_summary
    ) VALUES ('page_sections', v_section_id, v_snapshot, 1, 'Seeded initial published Home Featured Projects section');
    INSERT INTO audit_logs (admin_id, action, table_name, record_id, new_values)
    VALUES (NULL, 'migration_seed', 'page_sections', v_section_id, v_snapshot);
END;
$$;

COMMIT;
