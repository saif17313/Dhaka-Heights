BEGIN;

-- Phase 3: the Projects listing, project detail content, and the canonical
-- project catalogue publish as one atomic page version. Stable project IDs are
-- retained so Home placements keep their existing relational references.
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS property_category TEXT,
    ADD COLUMN IF NOT EXISTS location_key TEXT,
    ADD COLUMN IF NOT EXISTS size_category TEXT,
    ADD COLUMN IF NOT EXISTS detail_category_label TEXT,
    ADD COLUMN IF NOT EXISTS detail_location_address TEXT,
    ADD COLUMN IF NOT EXISTS detail_size_summary TEXT,
    ADD COLUMN IF NOT EXISTS land_area TEXT,
    ADD COLUMN IF NOT EXISTS building_height TEXT,
    ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES admin_profiles(id) ON DELETE SET NULL;

-- The public Project callback form intentionally treats email as optional.
ALTER TABLE inquiries ALTER COLUMN email DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projects_property_category_valid') THEN
        ALTER TABLE projects ADD CONSTRAINT projects_property_category_valid
            CHECK (property_category IS NULL OR property_category IN ('residential','commercial','mixed-use'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projects_size_category_valid') THEN
        ALTER TABLE projects ADD CONSTRAINT projects_size_category_valid
            CHECK (size_category IS NULL OR size_category IN ('small','medium','large'));
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS set_projects_updated_at ON projects;
CREATE TRIGGER set_projects_updated_at BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION set_home_content_updated_at();

DROP POLICY IF EXISTS "Public Read Published Page Sections" ON page_sections;
CREATE POLICY "Public Read Published Page Sections" ON page_sections
    FOR SELECT USING (
        status='published'
        AND (is_visible=true OR section_key IN (
            'hero-slider','about-corporate-home','statistics-counter',
            'featured-projects-home','commitment-quote','media-highlights-home',
            'partners-carousel','contact-section-home','about-page','projects-page'
        ))
        AND EXISTS (SELECT 1 FROM pages p WHERE p.id=page_sections.page_id AND p.is_published=true)
    );

-- Canonical project writes are performed only by the authenticated publish RPC.
DROP POLICY IF EXISTS "Admin Full Access Projects" ON projects;
DROP POLICY IF EXISTS "Admin Read Projects" ON projects;
CREATE POLICY "Admin Read Projects" ON projects FOR SELECT
    USING (get_admin_role() IN ('super_admin','content_editor','sales_manager'));

DROP POLICY IF EXISTS "Public Read Project Features" ON project_features;
CREATE POLICY "Public Read Project Features" ON project_features FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id=project_features.project_id AND p.status='published')
);
DROP POLICY IF EXISTS "Public Read Project Amenities" ON project_amenities;
CREATE POLICY "Public Read Project Amenities" ON project_amenities FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id=project_amenities.project_id AND p.status='published')
);
DROP POLICY IF EXISTS "Public Read Project Floor Plans" ON project_floor_plans;
CREATE POLICY "Public Read Project Floor Plans" ON project_floor_plans FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id=project_floor_plans.project_id AND p.status='published')
);
DROP POLICY IF EXISTS "Public Read Project Media" ON project_media;
CREATE POLICY "Public Read Project Media" ON project_media FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id=project_media.project_id AND p.status='published')
);
DROP POLICY IF EXISTS "Public Read Project Documents" ON project_documents;
CREATE POLICY "Public Read Project Documents" ON project_documents FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id=project_documents.project_id AND p.status='published')
);

CREATE OR REPLACE FUNCTION projects_page_snapshot(p_section_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
SELECT jsonb_build_object(
    'id',ps.id,'pageId',ps.page_id,'sectionKey',ps.section_key,
    'status',ps.status,'versionNumber',ps.version_number,'isVisible',ps.is_visible,
    'content',ps.settings,
    'updatedAt',ps.updated_at,'updatedBy',ps.updated_by,
    'publishedAt',ps.published_at,'publishedBy',ps.published_by
)
FROM page_sections ps WHERE ps.id=p_section_id AND ps.section_key='projects-page';
$$;

CREATE OR REPLACE FUNCTION validate_projects_page_payload(p_payload JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
    v_content JSONB:=p_payload->'content';
    v_project JSONB;
    v_gallery JSONB;
    v_count INTEGER;
    v_media_id UUID;
BEGIN
    IF p_payload->>'sectionKey' IS DISTINCT FROM 'projects-page' THEN RAISE EXCEPTION 'Invalid Projects page section key' USING ERRCODE='22023'; END IF;
    IF jsonb_typeof(v_content)<>'object' THEN RAISE EXCEPTION 'Projects page content must be an object' USING ERRCODE='22023'; END IF;
    IF jsonb_typeof(v_content->'projects')<>'array' THEN RAISE EXCEPTION 'Projects must be an array' USING ERRCODE='22023'; END IF;
    v_count:=jsonb_array_length(v_content->'projects');
    IF v_count<1 OR v_count>50 THEN RAISE EXCEPTION 'Projects must contain between 1 and 50 records' USING ERRCODE='22023'; END IF;
    IF COALESCE((v_content#>>'{listing,itemsPerPage}')::INTEGER,0) NOT BETWEEN 1 AND 24 THEN RAISE EXCEPTION 'Items per page must be between 1 and 24' USING ERRCODE='22023'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_content->'projects') p GROUP BY lower(p->>'slug') HAVING count(*)>1) THEN RAISE EXCEPTION 'Project slugs must be unique' USING ERRCODE='23505'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_content->'projects') p GROUP BY p->>'projectId' HAVING count(*)>1) THEN RAISE EXCEPTION 'Project IDs must be unique' USING ERRCODE='23505'; END IF;

    BEGIN v_media_id:=(v_content#>>'{header,mediaId}')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'A valid Projects header image is required' USING ERRCODE='22023'; END;
    IF NOT EXISTS(SELECT 1 FROM media_assets WHERE id=v_media_id AND resource_type='image' AND is_archived=false) THEN RAISE EXCEPTION 'The Projects header image is unavailable' USING ERRCODE='23503'; END IF;

    FOR v_project IN SELECT value FROM jsonb_array_elements(v_content->'projects') LOOP
        IF COALESCE(length(btrim(v_project->>'name')),0) NOT BETWEEN 1 AND 140 THEN RAISE EXCEPTION 'Every project requires a valid name' USING ERRCODE='22023'; END IF;
        IF COALESCE(v_project->>'slug','') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN RAISE EXCEPTION 'Every project requires a valid slug' USING ERRCODE='22023'; END IF;
        IF v_project->>'lifecycle' NOT IN ('ongoing','completed','upcoming') THEN RAISE EXCEPTION 'Invalid project lifecycle' USING ERRCODE='22023'; END IF;
        IF v_project->>'propertyCategory' NOT IN ('residential','commercial','mixed-use') THEN RAISE EXCEPTION 'Invalid project category' USING ERRCODE='22023'; END IF;
        IF v_project->>'sizeCategory' NOT IN ('small','medium','large') THEN RAISE EXCEPTION 'Invalid project size category' USING ERRCODE='22023'; END IF;
        IF COALESCE(length(btrim(v_project->>'cardLocation')),0)=0 OR COALESCE(length(btrim(v_project->>'cardSize')),0)=0 OR COALESCE(length(btrim(v_project->>'projectType')),0)=0 THEN RAISE EXCEPTION 'Project card fields are required' USING ERRCODE='22023'; END IF;
        IF COALESCE(length(btrim(v_project->>'description')),0)=0 THEN RAISE EXCEPTION 'Project descriptions are required' USING ERRCODE='22023'; END IF;
        BEGIN
            PERFORM (v_project->>'projectId')::UUID;
            v_media_id:=(v_project->>'coverMediaId')::UUID;
        EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Every project requires valid project and cover media IDs' USING ERRCODE='22023'; END;
        IF NOT EXISTS(SELECT 1 FROM media_assets WHERE id=v_media_id AND resource_type='image' AND is_archived=false) THEN RAISE EXCEPTION 'A project cover image is unavailable' USING ERRCODE='23503'; END IF;
        IF COALESCE(length(btrim(v_project->>'coverAlt')),0) NOT BETWEEN 1 AND 180 THEN RAISE EXCEPTION 'Project cover alt text is required' USING ERRCODE='22023'; END IF;
        IF jsonb_typeof(v_project->'gallery')<>'array' OR jsonb_array_length(v_project->'gallery')>8 THEN RAISE EXCEPTION 'Project galleries must contain at most eight images' USING ERRCODE='22023'; END IF;
        FOR v_gallery IN SELECT value FROM jsonb_array_elements(v_project->'gallery') LOOP
            BEGIN v_media_id:=(v_gallery->>'mediaId')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Gallery media IDs must be valid' USING ERRCODE='22023'; END;
            IF NOT EXISTS(SELECT 1 FROM media_assets WHERE id=v_media_id AND resource_type='image' AND is_archived=false) THEN RAISE EXCEPTION 'A gallery image is unavailable' USING ERRCODE='23503'; END IF;
            IF COALESCE(length(btrim(v_gallery->>'alt')),0) NOT BETWEEN 1 AND 180 THEN RAISE EXCEPTION 'Gallery alt text is required' USING ERRCODE='22023'; END IF;
        END LOOP;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION replace_projects_page_media_usage(p_section_id UUID,p_payload JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
BEGIN
    DELETE FROM media_asset_usage WHERE table_name='page_sections' AND record_id=p_section_id AND field_name LIKE 'projects-page:%';
    INSERT INTO media_asset_usage(media_asset_id,table_name,record_id,field_name)
    VALUES((p_payload#>>'{content,header,mediaId}')::UUID,'page_sections',p_section_id,'projects-page:header') ON CONFLICT DO NOTHING;
    INSERT INTO media_asset_usage(media_asset_id,table_name,record_id,field_name)
    SELECT (project->>'coverMediaId')::UUID,'page_sections',p_section_id,'projects-page:'||(project->>'projectId')||':cover'
    FROM jsonb_array_elements(p_payload#>'{content,projects}') project ON CONFLICT DO NOTHING;
    INSERT INTO media_asset_usage(media_asset_id,table_name,record_id,field_name)
    SELECT (gallery->>'mediaId')::UUID,'page_sections',p_section_id,
           'projects-page:'||(project->>'projectId')||':gallery:'||ordinality
    FROM jsonb_array_elements(p_payload#>'{content,projects}') project
    CROSS JOIN LATERAL jsonb_array_elements(project->'gallery') WITH ORDINALITY entries(gallery,ordinality)
    ON CONFLICT DO NOTHING;
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
            detail_location_address,detail_size_summary,land_area,building_height,is_visible,updated_by
        ) VALUES(
            v_project_id,btrim(v_project->>'slug'),btrim(v_project->>'name'),btrim(v_project->>'tagline'),v_project->>'lifecycle',btrim(v_project->>'badgeText'),
            btrim(v_project->>'cardLocation'),btrim(v_project->>'cityZone'),btrim(v_project->>'cardSize'),btrim(v_project->>'projectType'),
            btrim(v_project->>'floors'),btrim(v_project->>'parking'),btrim(v_project->>'elevators'),btrim(v_project->>'power'),
            btrim(v_project->>'descriptionShort'),btrim(v_project->>'description'),(v_project->>'coverMediaId')::UUID,'published',
            (v_project->>'sortOrder')::INTEGER,v_project->>'propertyCategory',v_project->>'locationKey',v_project->>'sizeCategory',
            btrim(v_project->>'detailCategoryLabel'),btrim(v_project->>'detailLocation'),btrim(v_project->>'detailSize'),
            btrim(v_project->>'landArea'),btrim(v_project->>'buildingHeight'),COALESCE((v_project->>'isVisible')::BOOLEAN,true),p_actor
        ) ON CONFLICT(id) DO UPDATE SET
            slug=EXCLUDED.slug,name=EXCLUDED.name,tagline=EXCLUDED.tagline,category=EXCLUDED.category,badge_text=EXCLUDED.badge_text,
            location_address=EXCLUDED.location_address,city_zone=EXCLUDED.city_zone,size_summary=EXCLUDED.size_summary,project_type=EXCLUDED.project_type,
            floor_structure=EXCLUDED.floor_structure,parking_summary=EXCLUDED.parking_summary,elevator_summary=EXCLUDED.elevator_summary,
            power_summary=EXCLUDED.power_summary,description_short=EXCLUDED.description_short,description_full=EXCLUDED.description_full,
            cover_image_id=EXCLUDED.cover_image_id,status='published',sort_order=EXCLUDED.sort_order,property_category=EXCLUDED.property_category,
            location_key=EXCLUDED.location_key,size_category=EXCLUDED.size_category,detail_category_label=EXCLUDED.detail_category_label,
            detail_location_address=EXCLUDED.detail_location_address,detail_size_summary=EXCLUDED.detail_size_summary,land_area=EXCLUDED.land_area,
            building_height=EXCLUDED.building_height,is_visible=EXCLUDED.is_visible,updated_by=p_actor;

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

CREATE OR REPLACE FUNCTION save_projects_page_draft(p_payload JSONB,p_expected_updated_at TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
    v_actor UUID:=auth.uid(); v_role app_role; v_page_id UUID; v_source_id UUID;
    v_draft page_sections%ROWTYPE; v_published page_sections%ROWTYPE; v_draft_id UUID;
    v_next INTEGER; v_old JSONB; v_new JSONB; v_revision INTEGER;
BEGIN
    IF v_actor IS NULL THEN RETURN jsonb_build_object('ok',false,'status',401,'code','ADMIN_AUTH_REQUIRED','error','Authentication is required.'); END IF;
    SELECT role INTO v_role FROM admin_profiles WHERE id=v_actor AND is_active=true;
    IF v_role IS NULL OR v_role NOT IN('super_admin','content_editor') THEN RETURN jsonb_build_object('ok',false,'status',403,'code','ADMIN_ROLE_FORBIDDEN','error','An active content administrator profile is required.'); END IF;
    PERFORM validate_projects_page_payload(p_payload);
    BEGIN v_source_id:=(p_payload->>'id')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Invalid Projects section ID' USING ERRCODE='22023'; END;
    SELECT id INTO v_page_id FROM pages WHERE slug='projects' AND is_published=true FOR UPDATE;
    IF v_page_id IS NULL THEN RETURN jsonb_build_object('ok',false,'status',503,'code','PROJECTS_PAGE_NOT_CONFIGURED','error','The Projects page is not configured.'); END IF;
    IF NULLIF(p_payload->>'pageId','') IS NOT NULL AND (p_payload->>'pageId')::UUID<>v_page_id THEN RETURN jsonb_build_object('ok',false,'status',409,'code','PROJECTS_PAGE_CONFLICT','error','The edited content no longer belongs to the Projects page.'); END IF;
    SELECT * INTO v_draft FROM page_sections WHERE page_id=v_page_id AND section_key='projects-page' AND status='draft' FOR UPDATE;
    IF v_draft.id IS NOT NULL THEN
        IF v_source_id<>v_draft.id OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('ok',false,'status',409,'code','PROJECTS_PAGE_CONFLICT','error','The Projects draft changed after this editor loaded it.'); END IF;
        v_draft_id:=v_draft.id; v_old:=projects_page_snapshot(v_draft_id);
        UPDATE page_sections SET settings=p_payload->'content',is_visible=COALESCE((p_payload->>'isVisible')::BOOLEAN,true),updated_by=v_actor WHERE id=v_draft_id;
    ELSE
        SELECT * INTO v_published FROM page_sections WHERE page_id=v_page_id AND section_key='projects-page' AND status='published' FOR UPDATE;
        IF v_published.id IS NULL THEN RETURN jsonb_build_object('ok',false,'status',503,'code','PROJECTS_PAGE_NOT_CONFIGURED','error','Published Projects page content is not configured.'); END IF;
        IF v_source_id<>v_published.id OR v_published.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('ok',false,'status',409,'code','PROJECTS_PAGE_CONFLICT','error','The published Projects page changed after this editor loaded it.'); END IF;
        SELECT COALESCE(max(version_number),0)+1 INTO v_next FROM page_sections WHERE page_id=v_page_id AND section_key='projects-page';
        v_old:=projects_page_snapshot(v_published.id);
        INSERT INTO page_sections(page_id,section_key,section_name,allowed_variant,sort_order,is_visible,status,version_number,settings,updated_by,supersedes_id)
        VALUES(v_page_id,'projects-page','Projects Page','portfolio',10,COALESCE((p_payload->>'isVisible')::BOOLEAN,true),'draft',v_next,p_payload->'content',v_actor,v_published.id)
        RETURNING id INTO v_draft_id;
    END IF;
    PERFORM replace_projects_page_media_usage(v_draft_id,p_payload);
    v_new:=projects_page_snapshot(v_draft_id);
    SELECT COALESCE(max(version_number),0)+1 INTO v_revision FROM content_revisions WHERE table_name='page_sections' AND record_id=v_draft_id;
    INSERT INTO content_revisions(table_name,record_id,revision_data,created_by,version_number,change_summary)
    VALUES('page_sections',v_draft_id,v_new,v_actor,v_revision,CASE WHEN v_draft.id IS NULL THEN 'Created Projects page draft' ELSE 'Saved Projects page draft' END);
    INSERT INTO audit_logs(admin_id,action,table_name,record_id,old_values,new_values)
    VALUES(v_actor,CASE WHEN v_draft.id IS NULL THEN 'create_draft' ELSE 'update_draft' END,'page_sections',v_draft_id,v_old,v_new);
    RETURN jsonb_build_object('ok',true,'data',v_new);
END;
$$;

CREATE OR REPLACE FUNCTION publish_projects_page_draft(p_section_id UUID,p_expected_updated_at TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
    v_actor UUID:=auth.uid(); v_role app_role; v_draft page_sections%ROWTYPE; v_published page_sections%ROWTYPE;
    v_old JSONB; v_previous JSONB; v_new JSONB; v_revision INTEGER;
BEGIN
    IF v_actor IS NULL THEN RETURN jsonb_build_object('ok',false,'status',401,'code','ADMIN_AUTH_REQUIRED','error','Authentication is required.'); END IF;
    SELECT role INTO v_role FROM admin_profiles WHERE id=v_actor AND is_active=true;
    IF v_role IS NULL OR v_role NOT IN('super_admin','content_editor') THEN RETURN jsonb_build_object('ok',false,'status',403,'code','ADMIN_ROLE_FORBIDDEN','error','An active content administrator profile is required.'); END IF;
    SELECT * INTO v_draft FROM page_sections WHERE id=p_section_id AND section_key='projects-page' AND status='draft' FOR UPDATE;
    IF v_draft.id IS NULL THEN RETURN jsonb_build_object('ok',false,'status',404,'code','PROJECTS_PAGE_DRAFT_NOT_FOUND','error','The Projects page draft no longer exists.'); END IF;
    IF p_expected_updated_at IS NULL OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('ok',false,'status',409,'code','PROJECTS_PAGE_CONFLICT','error','The Projects page draft changed after this editor loaded it.'); END IF;
    v_old:=projects_page_snapshot(v_draft.id); PERFORM validate_projects_page_payload(v_old);
    PERFORM sync_projects_catalog(v_draft.settings,v_actor);
    SELECT * INTO v_published FROM page_sections WHERE page_id=v_draft.page_id AND section_key='projects-page' AND status='published' FOR UPDATE;
    IF v_published.id IS NOT NULL THEN
        v_previous:=projects_page_snapshot(v_published.id);
        UPDATE page_sections SET status='archived',updated_by=v_actor WHERE id=v_published.id;
        INSERT INTO audit_logs(admin_id,action,table_name,record_id,old_values,new_values)
        VALUES(v_actor,'archive_published','page_sections',v_published.id,v_previous,projects_page_snapshot(v_published.id));
    END IF;
    UPDATE page_sections SET status='published',published_at=clock_timestamp(),published_by=v_actor,updated_by=v_actor WHERE id=v_draft.id;
    v_new:=projects_page_snapshot(v_draft.id);
    SELECT COALESCE(max(version_number),0)+1 INTO v_revision FROM content_revisions WHERE table_name='page_sections' AND record_id=v_draft.id;
    INSERT INTO content_revisions(table_name,record_id,revision_data,created_by,version_number,change_summary)
    VALUES('page_sections',v_draft.id,v_new,v_actor,v_revision,'Published Projects page and canonical catalogue');
    INSERT INTO audit_logs(admin_id,action,table_name,record_id,old_values,new_values)
    VALUES(v_actor,'publish','page_sections',v_draft.id,v_old,v_new);
    RETURN jsonb_build_object('ok',true,'data',v_new);
END;
$$;

REVOKE ALL ON FUNCTION projects_page_snapshot(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION validate_projects_page_payload(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION replace_projects_page_media_usage(UUID,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION sync_projects_catalog(JSONB,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION save_projects_page_draft(JSONB,TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION publish_projects_page_draft(UUID,TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION projects_page_snapshot(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION save_projects_page_draft(JSONB,TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_projects_page_draft(UUID,TIMESTAMPTZ) TO authenticated;

DO $$
DECLARE
    v_page UUID; v_section UUID; v_header UUID; v_hero1 UUID; v_hero2 UUID; v_hero3 UUID;
    v_projects JSONB; v_content JSONB; v_snapshot JSONB;
BEGIN
    SELECT id INTO v_page FROM pages WHERE slug='projects';
    SELECT id INTO v_header FROM media_assets WHERE public_id='dhaka-heights/dev/properties_bg' AND is_archived=false;
    SELECT id INTO v_hero1 FROM media_assets WHERE public_id='dhaka-heights/dev/hero1' AND is_archived=false;
    SELECT id INTO v_hero2 FROM media_assets WHERE public_id='dhaka-heights/dev/hero2' AND is_archived=false;
    SELECT id INTO v_hero3 FROM media_assets WHERE public_id='dhaka-heights/dev/hero3' AND is_archived=false;
    IF v_page IS NULL OR v_header IS NULL OR v_hero1 IS NULL OR v_hero2 IS NULL OR v_hero3 IS NULL THEN RAISE EXCEPTION 'Projects page and canonical media assets are required'; END IF;
    IF EXISTS(SELECT 1 FROM page_sections WHERE page_id=v_page AND section_key='projects-page' AND status='published') THEN RETURN; END IF;

    SELECT jsonb_agg(jsonb_build_object(
        'projectId',p.id,'slug',p.slug,'name',p.name,'tagline',p.tagline,'lifecycle',p.category,
        'propertyCategory',CASE p.slug WHEN 'dhaka-heights-bd-palace' THEN 'commercial' WHEN 'dhaka-heights-italia' THEN 'mixed-use' WHEN 'dhaka-heights-pinnacle' THEN 'commercial' ELSE 'residential' END,
        'locationKey',CASE WHEN p.slug IN('dhaka-heights-bd-palace') THEN 'gulshan' WHEN p.slug='dhaka-heights-italia' THEN 'banani' WHEN p.slug IN('dhaka-heights-green-heaven','dhaka-heights-pinnacle') THEN 'jolshiri' ELSE 'bashundhara' END,
        'cityZone',p.city_zone,
        'sizeCategory',CASE WHEN p.slug='dhaka-heights-mazumder-palace' THEN 'large' WHEN p.slug IN('dhaka-heights-italia','dhaka-heights-pinnacle') THEN 'medium' ELSE 'small' END,
        'badgeText',p.badge_text,
        'cardLocation',CASE p.slug WHEN 'dhaka-heights-muztaba-mansion' THEN 'Road- 13 & 15, Block- G, Bashundhara R/A, Dhaka' ELSE p.location_address END,
        'cardSize',CASE p.slug
            WHEN 'dhaka-heights-ariana-lofts' THEN '2400 sft' WHEN 'dhaka-heights-bd-palace' THEN '2800 sft' WHEN 'dhaka-heights-italia' THEN '3200 sft'
            WHEN 'dhaka-heights-mazumder-palace' THEN '4200 sft' WHEN 'dhaka-heights-muztaba-mansion' THEN '2650 sft' WHEN 'dhaka-heights-sunsplash' THEN '1850 sft'
            WHEN 'dhaka-heights-silver-spring' THEN '1520 sft' WHEN 'dhaka-heights-asha-purna-ii' THEN '1650 sft' WHEN 'dhaka-heights-green-heaven' THEN '2100 sft' ELSE '3400 sft' END,
        'projectType',p.project_type,'descriptionShort',p.description_short,
        'detailCategoryLabel',CASE WHEN p.category='completed' THEN 'Completed Prestige' ELSE 'Ongoing Development' END,
        'detailLocation',CASE p.slug
            WHEN 'dhaka-heights-bd-palace' THEN 'Bashundhara R/A, Dhaka' WHEN 'dhaka-heights-italia' THEN 'Bashundhara R/A, Dhaka'
            WHEN 'dhaka-heights-sunsplash' THEN 'Plot 136/A, Sonia Sobhan 5th Avenue, Block I, Bashundhara R/A, Dhaka'
            WHEN 'dhaka-heights-silver-spring' THEN 'Block H, Bashundhara R/A, Dhaka' ELSE p.location_address END,
        'detailSize',CASE p.slug
            WHEN 'dhaka-heights-ariana-lofts' THEN '2400 SFT Available Slots' WHEN 'dhaka-heights-bd-palace' THEN '2800 SFT Available Slots'
            WHEN 'dhaka-heights-italia' THEN '3200 SFT Luxury Suites' WHEN 'dhaka-heights-mazumder-palace' THEN '2200 - 4400 SFT Ready Apartments'
            WHEN 'dhaka-heights-muztaba-mansion' THEN '2650 SFT Shell & Core Slots' WHEN 'dhaka-heights-sunsplash' THEN '1850 SFT Apartments'
            WHEN 'dhaka-heights-silver-spring' THEN '1520 SFT Apartments' WHEN 'dhaka-heights-asha-purna-ii' THEN '1650 SFT Apartments'
            WHEN 'dhaka-heights-green-heaven' THEN '2100 SFT Ecological Suites' ELSE '3400 SFT Premium Units' END,
        'floors',CASE p.slug WHEN 'dhaka-heights-mazumder-palace' THEN 'G + 9 Residential Floors' WHEN 'dhaka-heights-sunsplash' THEN 'G + 9 Residential Floors' WHEN 'dhaka-heights-silver-spring' THEN 'G + 9 Residential Floors' ELSE p.floor_structure END,
        'parking',CASE p.slug WHEN 'dhaka-heights-bd-palace' THEN 'Ground Floor Parking' WHEN 'dhaka-heights-italia' THEN 'Ground Floor Parking' WHEN 'dhaka-heights-muztaba-mansion' THEN 'Ground Floor Parking' WHEN 'dhaka-heights-sunsplash' THEN 'Ground Floor Parking' WHEN 'dhaka-heights-silver-spring' THEN 'Ground Floor Parking' WHEN 'dhaka-heights-asha-purna-ii' THEN 'Ground Floor Parking' WHEN 'dhaka-heights-green-heaven' THEN 'Ground Floor Parking' ELSE p.parking_summary END,
        'elevators',CASE p.slug WHEN 'dhaka-heights-bd-palace' THEN '1 High-Speed Elevator' WHEN 'dhaka-heights-italia' THEN '1 Passenger Elevator' WHEN 'dhaka-heights-sunsplash' THEN '1 Passenger Elevator' WHEN 'dhaka-heights-silver-spring' THEN '1 Passenger Elevator' WHEN 'dhaka-heights-asha-purna-ii' THEN '1 Passenger Elevator' WHEN 'dhaka-heights-green-heaven' THEN '1 High-Speed Elevator' ELSE p.elevator_summary END,
        'power',CASE p.slug WHEN 'dhaka-heights-bd-palace' THEN 'Synchronized Generator Backup' WHEN 'dhaka-heights-italia' THEN 'Full Generator Backup' WHEN 'dhaka-heights-muztaba-mansion' THEN 'Generator Backup' WHEN 'dhaka-heights-sunsplash' THEN '100% Generator Backup' WHEN 'dhaka-heights-silver-spring' THEN 'Auto Generator Backup' WHEN 'dhaka-heights-asha-purna-ii' THEN 'Full Generator Backup' WHEN 'dhaka-heights-green-heaven' THEN 'Eco-Friendly Hybrid Generator/Solar System' ELSE p.power_summary END,
        'landArea',CASE p.slug WHEN 'dhaka-heights-ariana-lofts' THEN '5 Katha' WHEN 'dhaka-heights-bd-palace' THEN '6 Katha' WHEN 'dhaka-heights-italia' THEN '7.5 Katha' WHEN 'dhaka-heights-mazumder-palace' THEN '10 Katha' WHEN 'dhaka-heights-muztaba-mansion' THEN '8 Katha' WHEN 'dhaka-heights-sunsplash' THEN '6.2 Katha' WHEN 'dhaka-heights-silver-spring' THEN '5 Katha' WHEN 'dhaka-heights-asha-purna-ii' THEN '6 Katha' WHEN 'dhaka-heights-green-heaven' THEN '8.5 Katha' ELSE '10 Katha' END,
        'buildingHeight','100 Ft',
        'description',CASE p.slug
            WHEN 'dhaka-heights-ariana-lofts' THEN 'Dhaka Heights Ariana Lofts is designed for modern lifestyles, combining contemporary structural features with optimized residential layouts in Block-I of Bashundhara Residential Area. The project features natural light, premium fittings, and green common areas.'
            WHEN 'dhaka-heights-bd-palace' THEN 'Dhaka Heights BD Palace offers elegant and highly functional living spaces in the heart of Dhaka. Engineered for seismic resilience, the building structure integrates smart ventilation and security systems, making it a perfect home for families seeking modern aesthetics.'
            WHEN 'dhaka-heights-italia' THEN 'Inspired by Italian architectural details, Dhaka Heights Italia features spacious residential layouts, high-performance fittings, and a landscaped rooftop lounge. Built with premium materials to guarantee durability and luxury.'
            WHEN 'dhaka-heights-mazumder-palace' THEN 'Delivered with absolute perfection, Dhaka Heights Mazumder Palace is a flagship completed development in Block J of Bashundhara. Known for its gorgeous glass-accented facade, spacious double-height lobby, and round-the-clock facilities management.'
            WHEN 'dhaka-heights-muztaba-mansion' THEN 'Dhaka Heights Muztaba Mansion combines a peaceful residential environment with excellent connectivity in Block G. The building features eco-friendly design elements, high ceilings, structural safety compliance, and robust security.'
            WHEN 'dhaka-heights-sunsplash' THEN 'Dhaka Heights Sunsplash stands out with its modern architectural facade and sunny, open-plan spaces. Located on Sonia Sobhan 5th Avenue, the building provides families with standard smart security, premium tiles, and structural safety parameters.'
            WHEN 'dhaka-heights-silver-spring' THEN 'A completed architectural beauty in Block H of Bashundhara. Dhaka Heights Silver Spring offers compact yet highly optimized luxury living spaces, designed for cozy family comfort, structural durability, and low maintenance.'
            WHEN 'dhaka-heights-asha-purna-ii' THEN 'Successfully handed over to happy landowners and buyers, Dhaka Heights Asha Purna II represents Dhaka Heights Properties Limited''s commitment to high quality, structural timeline compliance, and outstanding customer service.'
            WHEN 'dhaka-heights-green-heaven' THEN 'An ongoing eco-friendly residential development located next to the lake in Jolshiri Abashon. Dhaka Heights Green Heaven incorporates natural cross-ventilation, native plant landscaping, rooftop water recycling, and modern recreational facilities.'
            ELSE 'Standing tall as a premier residential address in Jolshiri Abashon, Dhaka Heights Pinnacle features oversized apartments with high ceilings, glass balconies overlooking the skyline, and a health club and gym for residents.' END,
        'coverMediaId',p.cover_image_id,'coverAlt',p.name,'sortOrder',p.sort_order,'isVisible',true,
        'gallery',CASE p.slug
            WHEN 'dhaka-heights-ariana-lofts' THEN jsonb_build_array(jsonb_build_object('mediaId',v_hero1,'alt',p.name||' architectural view 1','isVisible',true),jsonb_build_object('mediaId',v_hero2,'alt',p.name||' architectural view 2','isVisible',true),jsonb_build_object('mediaId',v_hero3,'alt',p.name||' architectural view 3','isVisible',true))
            WHEN 'dhaka-heights-bd-palace' THEN jsonb_build_array(jsonb_build_object('mediaId',v_hero2,'alt',p.name||' architectural view 1','isVisible',true),jsonb_build_object('mediaId',v_hero3,'alt',p.name||' architectural view 2','isVisible',true),jsonb_build_object('mediaId',v_hero1,'alt',p.name||' architectural view 3','isVisible',true))
            WHEN 'dhaka-heights-italia' THEN jsonb_build_array(jsonb_build_object('mediaId',v_hero3,'alt',p.name||' architectural view 1','isVisible',true),jsonb_build_object('mediaId',v_hero1,'alt',p.name||' architectural view 2','isVisible',true),jsonb_build_object('mediaId',v_hero2,'alt',p.name||' architectural view 3','isVisible',true))
            WHEN 'dhaka-heights-sunsplash' THEN jsonb_build_array(jsonb_build_object('mediaId',v_hero3,'alt',p.name||' architectural view 1','isVisible',true),jsonb_build_object('mediaId',v_hero1,'alt',p.name||' architectural view 2','isVisible',true))
            WHEN 'dhaka-heights-silver-spring' THEN jsonb_build_array(jsonb_build_object('mediaId',v_hero1,'alt',p.name||' architectural view 1','isVisible',true),jsonb_build_object('mediaId',v_hero3,'alt',p.name||' architectural view 2','isVisible',true))
            WHEN 'dhaka-heights-asha-purna-ii' THEN jsonb_build_array(jsonb_build_object('mediaId',v_hero2,'alt',p.name||' architectural view 1','isVisible',true),jsonb_build_object('mediaId',v_hero1,'alt',p.name||' architectural view 2','isVisible',true))
            WHEN 'dhaka-heights-pinnacle' THEN jsonb_build_array(jsonb_build_object('mediaId',v_hero3,'alt',p.name||' architectural view 1','isVisible',true),jsonb_build_object('mediaId',v_hero2,'alt',p.name||' architectural view 2','isVisible',true))
            ELSE jsonb_build_array(jsonb_build_object('mediaId',v_hero1,'alt',p.name||' architectural view 1','isVisible',true),jsonb_build_object('mediaId',v_hero2,'alt',p.name||' architectural view 2','isVisible',true)) END
    ) ORDER BY p.sort_order) INTO v_projects FROM projects p WHERE p.status='published';

    v_content:=jsonb_build_object(
        'seo',jsonb_build_object('title','Our Projects | Dhaka Heights Properties Limited','description','Explore Dhaka Heights ongoing, completed, and upcoming residential and commercial developments.','canonicalUrl','/projects'),
        'header',jsonb_build_object('title','Our Properties','subtitle','Explore Iconic Ready and Upcoming Commercial Spaces','breadcrumbLabel','Projects','mediaId',v_header,'imageAlt','Dhaka Heights property portfolio skyline'),
        'listing',jsonb_build_object(
            'filterTitle','Filters','resetLabel','Reset','loadingLabel','Loading Projects...','resultsTemplate','Showing {visible} of {total} Dhaka Heights Properties Limited projects','itemsPerPage',6,
            'statusLabel','Status','allStatusLabel','All Status','ongoingLabel','Ongoing','completedLabel','Completed','upcomingLabel','Upcoming',
            'categoryLabel','Category','allCategoryLabel','All Categories','commercialLabel','Commercial Hub','residentialLabel','Residential Suites','mixedUseLabel','Mixed-Use',
            'locationLabel','Location','allLocationLabel','All Locations','bashundharaLabel','Bashundhara R/A','jolshiriLabel','Jolshiri Abashon','gulshanLabel','Gulshan','bananiLabel','Banani',
            'sizeLabel','Size (SFT)','allSizeLabel','All Sizes','smallLabel','Small (< 3000 SFT)','mediumLabel','Medium (3000 - 4000 SFT)','largeLabel','Large (> 4000 SFT)',
            'previousLabel','Prev','nextLabel','Next','emptyTitle','No Properties Found','emptyBody','We could not find any properties matching the selected filters. Try broadening your criteria.','emptyResetLabel','Reset Filters'
        ),
        'detail',jsonb_build_object(
            'projectsBreadcrumbLabel','Projects','notFoundTitle','Project Not Found','notFoundBody','The requested commercial property details do not exist.','returnLabel','Return to Projects',
            'overviewTitle','Project Overview','secondaryDescription','Designed by leading structural specialists, our building frameworks integrate wind tunnel simulations, heavy seismic resilience parameters, and triple-redundant mechanical layouts to promise seamless 24/7 corporate operational capability.',
            'atGlanceTitle','At a Glance','projectNameLabel','Project Name:','locationLabel','Location:','projectTypeLabel','Project Type:','floorsLabel','Floors:','landAreaLabel','Land Area:','heightLabel','Height:','unitSizesLabel','Unit Sizes:','parkingLabel','Parking:',
            'formTitle','Request Callback','formDescription','Schedule a walkthrough or request customized unit layouts.','namePlaceholder','Your Name *','phonePlaceholder','Phone Number *','emailPlaceholder','Email Address','messagePlaceholder','Message / Requirements...','submitLabel','Submit Inquiry','submittingLabel','Sending Inquiry...','successMessage','Thank you! Your property inquiry has been received. Our corporate representative will contact you shortly.','errorMessage','Your inquiry could not be submitted. Please try again.'
        ),
        'projects',v_projects
    );
    INSERT INTO page_sections(page_id,section_key,section_name,allowed_variant,sort_order,is_visible,status,version_number,settings,published_at)
    VALUES(v_page,'projects-page','Projects Page','portfolio',10,true,'published',1,v_content,clock_timestamp()) RETURNING id INTO v_section;
    PERFORM validate_projects_page_payload(projects_page_snapshot(v_section));
    PERFORM replace_projects_page_media_usage(v_section,projects_page_snapshot(v_section));
    PERFORM sync_projects_catalog(v_content,NULL);
    v_snapshot:=projects_page_snapshot(v_section);
    INSERT INTO content_revisions(table_name,record_id,revision_data,version_number,change_summary) VALUES('page_sections',v_section,v_snapshot,1,'Seeded initial published Projects page');
    INSERT INTO audit_logs(action,table_name,record_id,new_values) VALUES('migration_seed','page_sections',v_section,v_snapshot);
END;
$$;

COMMIT;
