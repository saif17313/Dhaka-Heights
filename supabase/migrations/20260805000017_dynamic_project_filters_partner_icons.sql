BEGIN;

-- Fix 01: make Projects filter vocabularies versioned CMS content and allow
-- Home Partners Carousel records to use either Font Awesome or uploaded media.
-- Existing published UI, routes, content and environment configuration remain unchanged.

-- Project classification values are now validated against each Projects page
-- version instead of fixed database CHECK lists.
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_category_check;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_property_category_valid;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_size_category_valid;

-- Backfill every existing Projects page version. Existing labels are preserved,
-- while Hotel and Resorts are added to the category vocabulary.
UPDATE page_sections
SET settings = jsonb_set(
    settings,
    '{listing,filterOptions}',
    jsonb_build_object(
        'status', jsonb_build_array(
            jsonb_build_object('key','ongoing','label',COALESCE(NULLIF(settings#>>'{listing,ongoingLabel}',''),'Ongoing')),
            jsonb_build_object('key','completed','label',COALESCE(NULLIF(settings#>>'{listing,completedLabel}',''),'Completed')),
            jsonb_build_object('key','upcoming','label',COALESCE(NULLIF(settings#>>'{listing,upcomingLabel}',''),'Upcoming'))
        ),
        'category', jsonb_build_array(
            jsonb_build_object('key','commercial','label',COALESCE(NULLIF(settings#>>'{listing,commercialLabel}',''),'Commercial Hub')),
            jsonb_build_object('key','residential','label',COALESCE(NULLIF(settings#>>'{listing,residentialLabel}',''),'Residential Suites')),
            jsonb_build_object('key','mixed-use','label',COALESCE(NULLIF(settings#>>'{listing,mixedUseLabel}',''),'Mixed-Use')),
            jsonb_build_object('key','hotel','label','Hotel'),
            jsonb_build_object('key','resort','label','Resorts')
        ),
        'location', jsonb_build_array(
            jsonb_build_object('key','bashundhara','label',COALESCE(NULLIF(settings#>>'{listing,bashundharaLabel}',''),'Bashundhara R/A')),
            jsonb_build_object('key','jolshiri','label',COALESCE(NULLIF(settings#>>'{listing,jolshiriLabel}',''),'Jolshiri Abashon')),
            jsonb_build_object('key','gulshan','label',COALESCE(NULLIF(settings#>>'{listing,gulshanLabel}',''),'Gulshan')),
            jsonb_build_object('key','banani','label',COALESCE(NULLIF(settings#>>'{listing,bananiLabel}',''),'Banani'))
        ),
        'size', jsonb_build_array(
            jsonb_build_object('key','small','label',COALESCE(NULLIF(settings#>>'{listing,smallLabel}',''),'Small (< 3000 SFT)')),
            jsonb_build_object('key','medium','label',COALESCE(NULLIF(settings#>>'{listing,mediumLabel}',''),'Medium (3000 - 4000 SFT)')),
            jsonb_build_object('key','large','label',COALESCE(NULLIF(settings#>>'{listing,largeLabel}',''),'Large (> 4000 SFT)'))
        )
    ),
    true
)
WHERE section_key = 'projects-page'
  AND jsonb_typeof(settings) = 'object'
  AND jsonb_typeof(settings->'listing') = 'object'
  AND settings#>'{listing,filterOptions}' IS NULL;

CREATE OR REPLACE FUNCTION validate_projects_page_payload(p_payload JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
    v_content JSONB:=p_payload->'content';
    v_filter_options JSONB;
    v_group TEXT;
    v_options JSONB;
    v_option JSONB;
    v_project JSONB;
    v_gallery JSONB;
    v_count INTEGER;
    v_media_id UUID;
BEGIN
    IF p_payload->>'sectionKey' IS DISTINCT FROM 'projects-page' THEN RAISE EXCEPTION 'Invalid Projects page section key' USING ERRCODE='22023'; END IF;
    IF v_content IS NULL OR jsonb_typeof(v_content) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Projects page content must be an object' USING ERRCODE='22023'; END IF;
    IF jsonb_typeof(v_content->'projects') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Projects must be an array' USING ERRCODE='22023'; END IF;
    v_count:=jsonb_array_length(v_content->'projects');
    IF v_count<1 OR v_count>50 THEN RAISE EXCEPTION 'Projects must contain between 1 and 50 records' USING ERRCODE='22023'; END IF;
    IF COALESCE((v_content#>>'{listing,itemsPerPage}')::INTEGER,0) NOT BETWEEN 1 AND 24 THEN RAISE EXCEPTION 'Items per page must be between 1 and 24' USING ERRCODE='22023'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_content->'projects') p GROUP BY lower(p->>'slug') HAVING count(*)>1) THEN RAISE EXCEPTION 'Project slugs must be unique' USING ERRCODE='23505'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_content->'projects') p GROUP BY p->>'projectId' HAVING count(*)>1) THEN RAISE EXCEPTION 'Project IDs must be unique' USING ERRCODE='23505'; END IF;

    v_filter_options:=v_content#>'{listing,filterOptions}';
    IF v_filter_options IS NULL OR jsonb_typeof(v_filter_options) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Projects filter options must be an object' USING ERRCODE='22023'; END IF;

    FOREACH v_group IN ARRAY ARRAY['status','category','location','size'] LOOP
        v_options:=v_filter_options->v_group;
        IF v_options IS NULL OR jsonb_typeof(v_options) IS DISTINCT FROM 'array' OR jsonb_array_length(v_options) NOT BETWEEN 1 AND 30 THEN
            RAISE EXCEPTION 'Every Projects filter group requires between 1 and 30 options' USING ERRCODE='22023';
        END IF;
        IF (SELECT count(*) FROM jsonb_array_elements(v_options))
           <> (SELECT count(DISTINCT option->>'key') FROM jsonb_array_elements(v_options) option) THEN
            RAISE EXCEPTION 'Projects filter option keys must be unique within each group' USING ERRCODE='23505';
        END IF;
        FOR v_option IN SELECT value FROM jsonb_array_elements(v_options) LOOP
            IF jsonb_typeof(v_option) IS DISTINCT FROM 'object'
               OR COALESCE(v_option->>'key','')='all'
               OR COALESCE(v_option->>'key','') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
               OR length(btrim(COALESCE(v_option->>'label',''))) NOT BETWEEN 1 AND 80 THEN
                RAISE EXCEPTION 'One or more Projects filter options are invalid' USING ERRCODE='22023';
            END IF;
        END LOOP;
    END LOOP;

    BEGIN v_media_id:=(v_content#>>'{header,mediaId}')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'A valid Projects header image is required' USING ERRCODE='22023'; END;
    IF NOT EXISTS(SELECT 1 FROM media_assets WHERE id=v_media_id AND resource_type='image' AND is_archived=false) THEN RAISE EXCEPTION 'The Projects header image is unavailable' USING ERRCODE='23503'; END IF;

    FOR v_project IN SELECT value FROM jsonb_array_elements(v_content->'projects') LOOP
        IF COALESCE(length(btrim(v_project->>'name')),0) NOT BETWEEN 1 AND 140 THEN RAISE EXCEPTION 'Every project requires a valid name' USING ERRCODE='22023'; END IF;
        IF COALESCE(v_project->>'slug','') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN RAISE EXCEPTION 'Every project requires a valid slug' USING ERRCODE='22023'; END IF;
        IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_filter_options->'status') option WHERE option->>'key'=v_project->>'lifecycle') THEN RAISE EXCEPTION 'Invalid project lifecycle' USING ERRCODE='22023'; END IF;
        IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_filter_options->'category') option WHERE option->>'key'=v_project->>'propertyCategory') THEN RAISE EXCEPTION 'Invalid project category' USING ERRCODE='22023'; END IF;
        IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_filter_options->'location') option WHERE option->>'key'=v_project->>'locationKey') THEN RAISE EXCEPTION 'Invalid project location filter value' USING ERRCODE='22023'; END IF;
        IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_filter_options->'size') option WHERE option->>'key'=v_project->>'sizeCategory') THEN RAISE EXCEPTION 'Invalid project size category' USING ERRCODE='22023'; END IF;
        IF COALESCE(length(btrim(v_project->>'cardLocation')),0)=0 OR COALESCE(length(btrim(v_project->>'cardSize')),0)=0 OR COALESCE(length(btrim(v_project->>'projectType')),0)=0 THEN RAISE EXCEPTION 'Project card fields are required' USING ERRCODE='22023'; END IF;
        IF COALESCE(length(btrim(v_project->>'description')),0)=0 THEN RAISE EXCEPTION 'Project descriptions are required' USING ERRCODE='22023'; END IF;
        BEGIN
            PERFORM (v_project->>'projectId')::UUID;
            v_media_id:=(v_project->>'coverMediaId')::UUID;
        EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Every project requires valid project and cover media IDs' USING ERRCODE='22023'; END;
        IF NOT EXISTS(SELECT 1 FROM media_assets WHERE id=v_media_id AND resource_type='image' AND is_archived=false) THEN RAISE EXCEPTION 'A project cover image is unavailable' USING ERRCODE='23503'; END IF;
        IF COALESCE(length(btrim(v_project->>'coverAlt')),0) NOT BETWEEN 1 AND 180 THEN RAISE EXCEPTION 'Project cover alt text is required' USING ERRCODE='22023'; END IF;
        IF jsonb_typeof(v_project->'gallery') IS DISTINCT FROM 'array' OR jsonb_array_length(v_project->'gallery')>8 THEN RAISE EXCEPTION 'Project galleries must contain at most eight images' USING ERRCODE='22023'; END IF;
        FOR v_gallery IN SELECT value FROM jsonb_array_elements(v_project->'gallery') LOOP
            BEGIN v_media_id:=(v_gallery->>'mediaId')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Gallery media IDs must be valid' USING ERRCODE='22023'; END;
            IF NOT EXISTS(SELECT 1 FROM media_assets WHERE id=v_media_id AND resource_type='image' AND is_archived=false) THEN RAISE EXCEPTION 'A gallery image is unavailable' USING ERRCODE='23503'; END IF;
            IF COALESCE(length(btrim(v_gallery->>'alt')),0) NOT BETWEEN 1 AND 180 THEN RAISE EXCEPTION 'Gallery alt text is required' USING ERRCODE='22023'; END IF;
        END LOOP;
    END LOOP;
END;
$$;

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
                    'iconMode', CASE WHEN si.icon_library='custom' AND si.custom_icon_asset_id IS NOT NULL THEN 'custom' ELSE 'fontawesome' END,
                    'iconLibrary', si.icon_library,
                    'iconKey', si.icon_key,
                    'customIconMediaId', si.custom_icon_asset_id,
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
    v_icon_mode TEXT;
    v_custom_icon_id UUID;
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
        v_icon_mode := COALESCE(NULLIF(v_partner->>'iconMode',''),'fontawesome');
        IF jsonb_typeof(v_partner) <> 'object'
           OR COALESCE(v_partner ->> 'itemKey', '') !~ '^partner-[a-z0-9-]{1,64}$'
           OR length(btrim(COALESCE(v_partner ->> 'name', ''))) NOT BETWEEN 1 AND 80
           OR length(btrim(COALESCE(v_partner ->> 'category', ''))) NOT BETWEEN 1 AND 80
           OR v_icon_mode NOT IN ('fontawesome','custom')
           OR COALESCE(v_partner ->> 'accentColor', '') !~ '^#[0-9A-Fa-f]{6}$'
           OR jsonb_typeof(v_partner -> 'isVisible') IS DISTINCT FROM 'boolean' THEN
            RAISE EXCEPTION 'One or more Home partner records are invalid' USING ERRCODE = '22023';
        END IF;

        IF v_icon_mode='fontawesome' THEN
            IF COALESCE(v_partner ->> 'iconKey', '') !~ '^fa-[a-z0-9-]{1,60}$' THEN
                RAISE EXCEPTION 'One or more Font Awesome partner icons are invalid' USING ERRCODE = '22023';
            END IF;
        ELSE
            BEGIN
                v_custom_icon_id := (v_partner->>'customIconMediaId')::UUID;
            EXCEPTION WHEN invalid_text_representation OR null_value_not_allowed THEN
                RAISE EXCEPTION 'One or more uploaded partner icon IDs are invalid' USING ERRCODE = '22023';
            END;
            IF v_custom_icon_id IS NULL OR NOT EXISTS (
                SELECT 1 FROM media_assets
                 WHERE id=v_custom_icon_id AND resource_type='image' AND is_archived=false
            ) THEN
                RAISE EXCEPTION 'One or more uploaded partner icons are unavailable' USING ERRCODE = '23503';
            END IF;
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
        DELETE FROM media_asset_usage
         WHERE table_name='section_items'
           AND record_id IN (SELECT id FROM section_items WHERE section_id=v_draft_id);
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
        custom_icon_asset_id, accent_color, sort_order, is_visible, updated_by
    )
    SELECT v_draft_id,
           partner ->> 'itemKey',
           btrim(partner ->> 'name'),
           btrim(partner ->> 'category'),
           COALESCE(NULLIF(partner->>'iconMode',''),'fontawesome'),
           CASE WHEN COALESCE(NULLIF(partner->>'iconMode',''),'fontawesome')='fontawesome' THEN partner->>'iconKey' ELSE NULL END,
           CASE WHEN partner->>'iconMode'='custom' THEN (partner->>'customIconMediaId')::UUID ELSE NULL END,
           lower(partner ->> 'accentColor'),
           ordinal * 10,
           (partner ->> 'isVisible')::BOOLEAN,
           v_actor
      FROM jsonb_array_elements(p_payload -> 'partners') WITH ORDINALITY AS entries(partner, ordinal);

    INSERT INTO media_asset_usage(media_asset_id,table_name,record_id,field_name)
    SELECT custom_icon_asset_id,'section_items',id,'custom_icon_asset_id'
      FROM section_items
     WHERE section_id=v_draft_id AND icon_library='custom' AND custom_icon_asset_id IS NOT NULL
    ON CONFLICT DO NOTHING;

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
       OR (SELECT count(*) FROM section_items WHERE section_id=v_draft.id)
          <> (SELECT count(DISTINCT item_key) FROM section_items WHERE section_id=v_draft.id)
       OR EXISTS (
            SELECT 1 FROM section_items si
             WHERE si.section_id = v_draft.id
               AND (
                    COALESCE(si.item_key, '') !~ '^partner-[a-z0-9-]{1,64}$'
                    OR length(btrim(COALESCE(si.title, ''))) NOT BETWEEN 1 AND 80
                    OR length(btrim(COALESCE(si.subtitle, ''))) NOT BETWEEN 1 AND 80
                    OR COALESCE(si.icon_library,'fontawesome') NOT IN ('fontawesome','custom')
                    OR (COALESCE(si.icon_library,'fontawesome')='fontawesome' AND COALESCE(si.icon_key, '') !~ '^fa-[a-z0-9-]{1,60}$')
                    OR (si.icon_library='custom' AND (
                        si.custom_icon_asset_id IS NULL OR NOT EXISTS (
                            SELECT 1 FROM media_assets ma
                             WHERE ma.id=si.custom_icon_asset_id AND ma.resource_type='image' AND ma.is_archived=false
                        )
                    ))
                    OR COALESCE(si.accent_color, '') !~ '^#[0-9a-f]{6}$'
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

COMMIT;
