BEGIN;

-- Adds an optional YouTube video URL per project. Surfaced as a video demo
-- frame on the public Project Detail page (next to the image gallery) and
-- editable per-project inside the admin Projects catalogue editor.
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Backfill every existing Projects page version so already-published and
-- in-progress draft content carries the new field explicitly.
UPDATE page_sections
SET settings = jsonb_set(
    settings,
    '{projects}',
    (
        SELECT jsonb_agg(
            CASE WHEN project ? 'videoUrl' THEN project ELSE project || jsonb_build_object('videoUrl', '') END
        )
        FROM jsonb_array_elements(settings->'projects') project
    ),
    true
)
WHERE section_key = 'projects-page'
  AND jsonb_typeof(settings) = 'object'
  AND jsonb_typeof(settings->'projects') = 'array';

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
        IF length(COALESCE(v_project->>'videoUrl','')) > 500 THEN RAISE EXCEPTION 'Project video URL is too long' USING ERRCODE='22023'; END IF;
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

CREATE OR REPLACE FUNCTION sync_projects_catalog(p_content JSONB,p_actor UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE v_project JSONB; v_project_id UUID; v_media_row RECORD;
BEGIN
    FOR v_project IN SELECT value FROM jsonb_array_elements(p_content->'projects') LOOP
        v_project_id:=(v_project->>'projectId')::UUID;
        INSERT INTO projects(
            id,slug,name,tagline,category,badge_text,location_address,city_zone,size_summary,project_type,
            floor_structure,parking_summary,elevator_summary,power_summary,description_short,description_full,
            cover_image_id,status,sort_order,property_category,location_key,size_category,detail_category_label,
            detail_location_address,detail_size_summary,land_area,building_height,is_visible,updated_by,video_url
        ) VALUES(
            v_project_id,btrim(v_project->>'slug'),btrim(v_project->>'name'),btrim(v_project->>'tagline'),v_project->>'lifecycle',btrim(v_project->>'badgeText'),
            btrim(v_project->>'cardLocation'),btrim(v_project->>'cityZone'),btrim(v_project->>'cardSize'),btrim(v_project->>'projectType'),
            btrim(v_project->>'floors'),btrim(v_project->>'parking'),btrim(v_project->>'elevators'),btrim(v_project->>'power'),
            btrim(v_project->>'descriptionShort'),btrim(v_project->>'description'),(v_project->>'coverMediaId')::UUID,'published',
            (v_project->>'sortOrder')::INTEGER,v_project->>'propertyCategory',v_project->>'locationKey',v_project->>'sizeCategory',
            btrim(v_project->>'detailCategoryLabel'),btrim(v_project->>'detailLocation'),btrim(v_project->>'detailSize'),
            btrim(v_project->>'landArea'),btrim(v_project->>'buildingHeight'),COALESCE((v_project->>'isVisible')::BOOLEAN,true),p_actor,
            NULLIF(btrim(v_project->>'videoUrl'),'')
        ) ON CONFLICT(id) DO UPDATE SET
            slug=EXCLUDED.slug,name=EXCLUDED.name,tagline=EXCLUDED.tagline,category=EXCLUDED.category,badge_text=EXCLUDED.badge_text,
            location_address=EXCLUDED.location_address,city_zone=EXCLUDED.city_zone,size_summary=EXCLUDED.size_summary,project_type=EXCLUDED.project_type,
            floor_structure=EXCLUDED.floor_structure,parking_summary=EXCLUDED.parking_summary,elevator_summary=EXCLUDED.elevator_summary,
            power_summary=EXCLUDED.power_summary,description_short=EXCLUDED.description_short,description_full=EXCLUDED.description_full,
            cover_image_id=EXCLUDED.cover_image_id,status='published',sort_order=EXCLUDED.sort_order,property_category=EXCLUDED.property_category,
            location_key=EXCLUDED.location_key,size_category=EXCLUDED.size_category,detail_category_label=EXCLUDED.detail_category_label,
            detail_location_address=EXCLUDED.detail_location_address,detail_size_summary=EXCLUDED.detail_size_summary,land_area=EXCLUDED.land_area,
            building_height=EXCLUDED.building_height,is_visible=EXCLUDED.is_visible,updated_by=p_actor,video_url=EXCLUDED.video_url;

        DELETE FROM media_asset_usage WHERE table_name='projects' AND record_id=v_project_id AND field_name='cover_image_id';
        INSERT INTO media_asset_usage(media_asset_id,table_name,record_id,field_name)
        VALUES((v_project->>'coverMediaId')::UUID,'projects',v_project_id,'cover_image_id') ON CONFLICT DO NOTHING;
        DELETE FROM media_asset_usage WHERE table_name='project_media' AND record_id IN (SELECT id FROM project_media WHERE project_id=v_project_id);
        DELETE FROM project_media WHERE project_id=v_project_id;
        FOR v_media_row IN
            INSERT INTO project_media(project_id,media_asset_id,caption,sort_order)
            SELECT v_project_id,(gallery->>'mediaId')::UUID,btrim(gallery->>'alt'),ordinality*10
            FROM jsonb_array_elements(v_project->'gallery') WITH ORDINALITY entries(gallery,ordinality)
            WHERE COALESCE((gallery->>'isVisible')::BOOLEAN,true)=true
            RETURNING id,media_asset_id
        LOOP
            INSERT INTO media_asset_usage(media_asset_id,table_name,record_id,field_name)
            VALUES(v_media_row.media_asset_id,'project_media',v_media_row.id,'media_asset_id') ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END;
$$;

COMMIT;
