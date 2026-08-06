BEGIN;

-- Phase 2: the complete About page is one versioned publish unit. Structured
-- repeated records use section_items; Sister Concern cards remain relational.
DROP POLICY IF EXISTS "Public Read Published Page Sections" ON page_sections;
CREATE POLICY "Public Read Published Page Sections" ON page_sections
    FOR SELECT USING (
        status = 'published'
        AND (is_visible = true OR section_key IN (
            'hero-slider','about-corporate-home','statistics-counter',
            'featured-projects-home','commitment-quote','media-highlights-home',
            'partners-carousel','contact-section-home','about-page'
        ))
        AND EXISTS (SELECT 1 FROM pages p WHERE p.id = page_sections.page_id AND p.is_published = true)
    );

CREATE OR REPLACE FUNCTION about_page_snapshot(p_section_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
SELECT jsonb_build_object(
    'id', ps.id, 'pageId', ps.page_id, 'sectionKey', ps.section_key,
    'status', ps.status, 'versionNumber', ps.version_number,
    'isVisible', ps.is_visible, 'content', ps.settings,
    'media', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'itemId', si.id, 'role', replace(si.item_key,'media-',''),
            'mediaId', si.image_asset_id, 'imageAlt', si.image_alt,
            'media', jsonb_build_object('id',ma.id,'secureUrl',ma.secure_url,'displayName',ma.display_name,'altText',ma.alt_text,'format',ma.format),
            'sortOrder', si.sort_order, 'isVisible', si.is_visible
        ) ORDER BY si.sort_order, si.id)
        FROM section_items si JOIN media_assets ma ON ma.id=si.image_asset_id
        WHERE si.section_id=ps.id AND si.item_key LIKE 'media-%'
    ),'[]'::jsonb),
    'pillars', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'itemId',si.id,'itemKey',si.item_key,'title',si.title,'description',si.body_text,
            'iconKey',si.icon_key,'mediaId',si.image_asset_id,'imageAlt',si.image_alt,
            'media',jsonb_build_object('id',ma.id,'secureUrl',ma.secure_url,'displayName',ma.display_name,'altText',ma.alt_text,'format',ma.format),
            'sortOrder',si.sort_order,'isVisible',si.is_visible
        ) ORDER BY si.sort_order,si.id)
        FROM section_items si JOIN media_assets ma ON ma.id=si.image_asset_id
        WHERE si.section_id=ps.id AND si.item_key LIKE 'pillar-%'
    ),'[]'::jsonb),
    'concerns', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'placementId',item.id,'canonicalId',c.id,'slug',c.slug,
            'title',COALESCE(item.override_title,c.name),
            'description',COALESCE(item.override_description,c.overview),
            'ctaLabel',COALESCE(item.override_cta_label,'View Subsidiary'),
            'mediaId',item.override_cover_image_id,'imageAlt',COALESCE(ma.alt_text,''),
            'media',CASE WHEN ma.id IS NULL THEN NULL ELSE jsonb_build_object('id',ma.id,'secureUrl',ma.secure_url,'displayName',ma.display_name,'altText',ma.alt_text,'format',ma.format) END,
            'sortOrder',item.sort_order,'isVisible',item.is_visible
        ) ORDER BY item.sort_order,item.id)
        FROM section_entity_selections sel
        JOIN section_entity_selection_items item ON item.selection_id=sel.id
        JOIN concerns c ON c.id=item.concern_id
        LEFT JOIN media_assets ma ON ma.id=item.override_cover_image_id
        WHERE sel.section_id=ps.id AND sel.entity_type='concern'
    ),'[]'::jsonb),
    'accreditations', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'itemId',si.id,'itemKey',si.item_key,'title',si.title,'iconKey',si.icon_key,
            'sortOrder',si.sort_order,'isVisible',si.is_visible
        ) ORDER BY si.sort_order,si.id)
        FROM section_items si WHERE si.section_id=ps.id AND si.item_key LIKE 'accreditation-%'
    ),'[]'::jsonb),
    'updatedAt',ps.updated_at,'updatedBy',ps.updated_by,
    'publishedAt',ps.published_at,'publishedBy',ps.published_by
)
FROM page_sections ps WHERE ps.id=p_section_id;
$$;

CREATE OR REPLACE FUNCTION validate_about_page_payload(p_payload JSONB)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_path TEXT[];
    v_item JSONB;
    v_count INTEGER;
    v_id UUID;
BEGIN
    IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
       OR p_payload->>'sectionKey' IS DISTINCT FROM 'about-page'
       OR jsonb_typeof(p_payload->'isVisible')<>'boolean'
       OR jsonb_typeof(p_payload->'content')<>'object'
       OR jsonb_typeof(p_payload->'media')<>'array'
       OR jsonb_typeof(p_payload->'pillars')<>'array'
       OR jsonb_typeof(p_payload->'concerns')<>'array'
       OR jsonb_typeof(p_payload->'accreditations')<>'array' THEN
        RAISE EXCEPTION 'Invalid About page payload' USING ERRCODE='22023';
    END IF;
    FOREACH v_path SLICE 1 IN ARRAY ARRAY[
        ARRAY['hero','title'],ARRAY['hero','subtitle'],
        ARRAY['overview','tag'],ARRAY['overview','heading'],ARRAY['overview','highlight'],
        ARRAY['sustainability','tag'],ARRAY['sustainability','heading'],ARRAY['sustainability','highlight'],
        ARRAY['sustainability','quote'],ARRAY['sustainability','quoteAuthor'],
        ARRAY['leadership','tag'],ARRAY['leadership','primaryQuote'],ARRAY['leadership','secondaryQuote'],
        ARRAY['leadership','authorName'],ARRAY['leadership','authorTitle'],
        ARRAY['concernsSection','tag'],ARRAY['concernsSection','heading'],
        ARRAY['accreditationsSection','tag'],ARRAY['accreditationsSection','heading'],
        ARRAY['seo','title'],ARRAY['seo','description'],ARRAY['seo','canonicalUrl']
    ] LOOP
        IF length(btrim(COALESCE(p_payload->'content'#>>v_path,''))) NOT BETWEEN 1 AND 1200 THEN
            RAISE EXCEPTION 'Required About content at % is invalid', array_to_string(v_path,'.') USING ERRCODE='22023';
        END IF;
    END LOOP;
    IF jsonb_typeof(p_payload#>'{content,overview,paragraphs}')<>'array'
       OR jsonb_array_length(p_payload#>'{content,overview,paragraphs}') NOT BETWEEN 1 AND 6
       OR jsonb_typeof(p_payload#>'{content,sustainability,paragraphs}')<>'array'
       OR jsonb_array_length(p_payload#>'{content,sustainability,paragraphs}') NOT BETWEEN 1 AND 6
       OR COALESCE(p_payload#>>'{content,seo,canonicalUrl}','') !~ '^https://[^[:space:]]+$' THEN
        RAISE EXCEPTION 'About paragraphs or SEO configuration is invalid' USING ERRCODE='22023';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_payload#>'{content,overview,paragraphs}') p WHERE length(btrim(p#>>'{}')) NOT BETWEEN 1 AND 1200)
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_payload#>'{content,sustainability,paragraphs}') p WHERE length(btrim(p#>>'{}')) NOT BETWEEN 1 AND 1200) THEN
        RAISE EXCEPTION 'About paragraphs are invalid' USING ERRCODE='22023';
    END IF;

    v_count:=jsonb_array_length(p_payload->'media');
    IF v_count<>4 OR (SELECT count(DISTINCT item->>'role') FROM jsonb_array_elements(p_payload->'media') item)<>4
       OR NOT (SELECT array_agg(item->>'role' ORDER BY item->>'role') FROM jsonb_array_elements(p_payload->'media') item)
          = ARRAY['hero','overview-back','overview-front','sustainability'] THEN
        RAISE EXCEPTION 'Exactly four named About media records are required' USING ERRCODE='22023';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'media') LOOP
        BEGIN v_id:=(v_item->>'mediaId')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Invalid About media ID' USING ERRCODE='22023'; END;
        IF v_id IS NULL OR length(btrim(COALESCE(v_item->>'imageAlt',''))) NOT BETWEEN 1 AND 180
           OR NOT EXISTS(SELECT 1 FROM media_assets WHERE id=v_id AND resource_type='image' AND is_archived=false) THEN
            RAISE EXCEPTION 'About media reference is invalid' USING ERRCODE='22023';
        END IF;
    END LOOP;

    v_count:=jsonb_array_length(p_payload->'pillars');
    IF v_count NOT BETWEEN 1 AND 6 OR (SELECT count(DISTINCT item->>'itemKey') FROM jsonb_array_elements(p_payload->'pillars') item)<>v_count
       OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'pillars') item WHERE (item->>'isVisible')::BOOLEAN) THEN
        RAISE EXCEPTION 'About pillars are invalid' USING ERRCODE='22023';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'pillars') LOOP
        BEGIN v_id:=(v_item->>'mediaId')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Invalid pillar media ID' USING ERRCODE='22023'; END;
        IF COALESCE(v_item->>'itemKey','') !~ '^pillar-[a-z0-9-]{1,64}$'
           OR length(btrim(COALESCE(v_item->>'title',''))) NOT BETWEEN 1 AND 100
           OR length(btrim(COALESCE(v_item->>'description',''))) NOT BETWEEN 1 AND 800
           OR COALESCE(v_item->>'iconKey','') !~ '^fa-[a-z0-9-]{1,60}$'
           OR length(btrim(COALESCE(v_item->>'imageAlt',''))) NOT BETWEEN 1 AND 180
           OR jsonb_typeof(v_item->'isVisible')<>'boolean'
           OR NOT EXISTS(SELECT 1 FROM media_assets WHERE id=v_id AND resource_type='image' AND is_archived=false) THEN
            RAISE EXCEPTION 'One or more About pillars are invalid' USING ERRCODE='22023';
        END IF;
    END LOOP;

    v_count:=jsonb_array_length(p_payload->'concerns');
    IF v_count NOT BETWEEN 1 AND 12 OR (SELECT count(DISTINCT item->>'canonicalId') FROM jsonb_array_elements(p_payload->'concerns') item)<>v_count
       OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'concerns') item WHERE (item->>'isVisible')::BOOLEAN) THEN
        RAISE EXCEPTION 'About concern placements are invalid' USING ERRCODE='22023';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'concerns') LOOP
        BEGIN v_id:=(v_item->>'canonicalId')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Invalid concern ID' USING ERRCODE='22023'; END;
        IF NOT EXISTS(SELECT 1 FROM concerns WHERE id=v_id AND status='published')
           OR length(btrim(COALESCE(v_item->>'title',''))) NOT BETWEEN 1 AND 120
           OR length(btrim(COALESCE(v_item->>'description',''))) NOT BETWEEN 1 AND 600
           OR length(btrim(COALESCE(v_item->>'ctaLabel',''))) NOT BETWEEN 1 AND 60
           OR jsonb_typeof(v_item->'isVisible')<>'boolean' THEN
            RAISE EXCEPTION 'One or more About concern placements are invalid' USING ERRCODE='22023';
        END IF;
        BEGIN v_id:=(v_item->>'mediaId')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Invalid concern image ID' USING ERRCODE='22023'; END;
        IF NOT EXISTS(SELECT 1 FROM media_assets WHERE id=v_id AND resource_type='image' AND is_archived=false) THEN
            RAISE EXCEPTION 'One or more concern images are invalid' USING ERRCODE='22023';
        END IF;
    END LOOP;

    v_count:=jsonb_array_length(p_payload->'accreditations');
    IF v_count NOT BETWEEN 1 AND 10 OR (SELECT count(DISTINCT item->>'itemKey') FROM jsonb_array_elements(p_payload->'accreditations') item)<>v_count
       OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'accreditations') item WHERE (item->>'isVisible')::BOOLEAN) THEN
        RAISE EXCEPTION 'About accreditations are invalid' USING ERRCODE='22023';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'accreditations') LOOP
        IF COALESCE(v_item->>'itemKey','') !~ '^accreditation-[a-z0-9-]{1,64}$'
           OR length(btrim(COALESCE(v_item->>'title',''))) NOT BETWEEN 1 AND 100
           OR COALESCE(v_item->>'iconKey','') !~ '^fa-[a-z0-9-]{1,60}$'
           OR jsonb_typeof(v_item->'isVisible')<>'boolean' THEN
            RAISE EXCEPTION 'One or more About accreditations are invalid' USING ERRCODE='22023';
        END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION replace_about_page_children(p_section_id UUID,p_payload JSONB,p_actor UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE v_selection_id UUID;
BEGIN
    DELETE FROM media_asset_usage WHERE table_name='section_items' AND record_id IN (SELECT id FROM section_items WHERE section_id=p_section_id);
    DELETE FROM media_asset_usage WHERE table_name='section_entity_selection_items' AND record_id IN (
        SELECT item.id FROM section_entity_selection_items item JOIN section_entity_selections sel ON sel.id=item.selection_id WHERE sel.section_id=p_section_id
    );
    DELETE FROM section_items WHERE section_id=p_section_id;
    DELETE FROM section_entity_selections WHERE section_id=p_section_id;

    INSERT INTO section_items(section_id,item_key,image_asset_id,image_alt,sort_order,is_visible,updated_by)
    SELECT p_section_id,'media-'||(item->>'role'),(item->>'mediaId')::UUID,btrim(item->>'imageAlt'),ordinal*10,true,p_actor
    FROM jsonb_array_elements(p_payload->'media') WITH ORDINALITY entries(item,ordinal);

    INSERT INTO section_items(section_id,item_key,title,body_text,icon_library,icon_key,image_asset_id,image_alt,sort_order,is_visible,updated_by)
    SELECT p_section_id,item->>'itemKey',btrim(item->>'title'),btrim(item->>'description'),'fontawesome',item->>'iconKey',(item->>'mediaId')::UUID,btrim(item->>'imageAlt'),ordinal*10,(item->>'isVisible')::BOOLEAN,p_actor
    FROM jsonb_array_elements(p_payload->'pillars') WITH ORDINALITY entries(item,ordinal);

    INSERT INTO section_items(section_id,item_key,title,icon_library,icon_key,sort_order,is_visible,updated_by)
    SELECT p_section_id,item->>'itemKey',btrim(item->>'title'),'fontawesome',item->>'iconKey',ordinal*10,(item->>'isVisible')::BOOLEAN,p_actor
    FROM jsonb_array_elements(p_payload->'accreditations') WITH ORDINALITY entries(item,ordinal);

    INSERT INTO section_entity_selections(section_id,entity_type) VALUES(p_section_id,'concern') RETURNING id INTO v_selection_id;
    INSERT INTO section_entity_selection_items(selection_id,concern_id,override_title,override_description,override_cover_image_id,override_cta_label,sort_order,is_visible)
    SELECT v_selection_id,(item->>'canonicalId')::UUID,btrim(item->>'title'),btrim(item->>'description'),(item->>'mediaId')::UUID,btrim(item->>'ctaLabel'),ordinal*10,(item->>'isVisible')::BOOLEAN
    FROM jsonb_array_elements(p_payload->'concerns') WITH ORDINALITY entries(item,ordinal);

    INSERT INTO media_asset_usage(media_asset_id,table_name,record_id,field_name)
    SELECT image_asset_id,'section_items',id,'image_asset_id' FROM section_items WHERE section_id=p_section_id AND image_asset_id IS NOT NULL ON CONFLICT DO NOTHING;
    INSERT INTO media_asset_usage(media_asset_id,table_name,record_id,field_name)
    SELECT item.override_cover_image_id,'section_entity_selection_items',item.id,'override_cover_image_id'
    FROM section_entity_selection_items item WHERE item.selection_id=v_selection_id AND item.override_cover_image_id IS NOT NULL ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION save_about_page_draft(p_payload JSONB,p_expected_updated_at TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
    v_actor UUID:=auth.uid(); v_role app_role; v_page_id UUID; v_source_id UUID;
    v_draft page_sections%ROWTYPE; v_published page_sections%ROWTYPE; v_draft_id UUID;
    v_next_version INTEGER; v_old JSONB; v_new JSONB; v_revision INTEGER;
BEGIN
    IF v_actor IS NULL THEN RETURN jsonb_build_object('ok',false,'status',401,'code','ADMIN_AUTH_REQUIRED','error','Authentication is required.'); END IF;
    SELECT role INTO v_role FROM admin_profiles WHERE id=v_actor AND is_active=true;
    IF v_role IS NULL OR v_role NOT IN('super_admin','content_editor') THEN RETURN jsonb_build_object('ok',false,'status',403,'code','ADMIN_ROLE_FORBIDDEN','error','An active content administrator profile is required.'); END IF;
    IF p_expected_updated_at IS NULL THEN RETURN jsonb_build_object('ok',false,'status',422,'code','VALIDATION_ERROR','error','The expected updated timestamp is required.'); END IF;
    PERFORM validate_about_page_payload(p_payload);
    BEGIN v_source_id:=(p_payload->>'id')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Invalid About section ID' USING ERRCODE='22023'; END;
    SELECT id INTO v_page_id FROM pages WHERE slug='about' AND is_published=true FOR UPDATE;
    IF v_page_id IS NULL THEN RETURN jsonb_build_object('ok',false,'status',503,'code','ABOUT_PAGE_NOT_CONFIGURED','error','The About page is not configured.'); END IF;
    IF NULLIF(p_payload->>'pageId','') IS NOT NULL AND (p_payload->>'pageId')::UUID<>v_page_id THEN RETURN jsonb_build_object('ok',false,'status',409,'code','ABOUT_PAGE_CONFLICT','error','The edited content no longer belongs to the About page.'); END IF;

    SELECT * INTO v_draft FROM page_sections WHERE page_id=v_page_id AND section_key='about-page' AND status='draft' FOR UPDATE;
    IF v_draft.id IS NOT NULL THEN
        IF v_source_id<>v_draft.id OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('ok',false,'status',409,'code','ABOUT_PAGE_CONFLICT','error','The About page draft changed after this editor loaded it.'); END IF;
        v_draft_id:=v_draft.id; v_old:=about_page_snapshot(v_draft_id);
        UPDATE page_sections SET settings=p_payload->'content',is_visible=(p_payload->>'isVisible')::BOOLEAN,updated_by=v_actor WHERE id=v_draft_id;
    ELSE
        SELECT * INTO v_published FROM page_sections WHERE page_id=v_page_id AND section_key='about-page' AND status='published' FOR UPDATE;
        IF v_published.id IS NULL THEN RETURN jsonb_build_object('ok',false,'status',503,'code','ABOUT_PAGE_NOT_CONFIGURED','error','Published About page content is not configured.'); END IF;
        IF v_source_id<>v_published.id OR v_published.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('ok',false,'status',409,'code','ABOUT_PAGE_CONFLICT','error','The published About page changed after this editor loaded it.'); END IF;
        SELECT COALESCE(max(version_number),0)+1 INTO v_next_version FROM page_sections WHERE page_id=v_page_id AND section_key='about-page';
        v_old:=about_page_snapshot(v_published.id);
        INSERT INTO page_sections(page_id,section_key,section_name,allowed_variant,sort_order,is_visible,status,version_number,settings,updated_by,supersedes_id)
        VALUES(v_page_id,'about-page','About Page','editorial',10,(p_payload->>'isVisible')::BOOLEAN,'draft',v_next_version,p_payload->'content',v_actor,v_published.id)
        RETURNING id INTO v_draft_id;
    END IF;
    PERFORM replace_about_page_children(v_draft_id,p_payload,v_actor);
    v_new:=about_page_snapshot(v_draft_id);
    SELECT COALESCE(max(version_number),0)+1 INTO v_revision FROM content_revisions WHERE table_name='page_sections' AND record_id=v_draft_id;
    INSERT INTO content_revisions(table_name,record_id,revision_data,created_by,version_number,change_summary) VALUES('page_sections',v_draft_id,v_new,v_actor,v_revision,CASE WHEN v_draft.id IS NULL THEN 'Created About page draft' ELSE 'Saved About page draft' END);
    INSERT INTO audit_logs(admin_id,action,table_name,record_id,old_values,new_values) VALUES(v_actor,CASE WHEN v_draft.id IS NULL THEN 'create_draft' ELSE 'update_draft' END,'page_sections',v_draft_id,v_old,v_new);
    RETURN jsonb_build_object('ok',true,'data',v_new);
END;
$$;

CREATE OR REPLACE FUNCTION publish_about_page_draft(p_section_id UUID,p_expected_updated_at TIMESTAMPTZ)
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
    SELECT * INTO v_draft FROM page_sections WHERE id=p_section_id AND section_key='about-page' AND status='draft' FOR UPDATE;
    IF v_draft.id IS NULL THEN RETURN jsonb_build_object('ok',false,'status',404,'code','ABOUT_PAGE_DRAFT_NOT_FOUND','error','The About page draft no longer exists.'); END IF;
    IF p_expected_updated_at IS NULL OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('ok',false,'status',409,'code','ABOUT_PAGE_CONFLICT','error','The About page draft changed after this editor loaded it.'); END IF;
    v_old:=about_page_snapshot(v_draft.id); PERFORM validate_about_page_payload(v_old);
    SELECT * INTO v_published FROM page_sections WHERE page_id=v_draft.page_id AND section_key='about-page' AND status='published' FOR UPDATE;
    IF v_published.id IS NOT NULL THEN
        v_previous:=about_page_snapshot(v_published.id);
        UPDATE page_sections SET status='archived',updated_by=v_actor WHERE id=v_published.id;
        INSERT INTO audit_logs(admin_id,action,table_name,record_id,old_values,new_values) VALUES(v_actor,'archive_published','page_sections',v_published.id,v_previous,about_page_snapshot(v_published.id));
    END IF;
    UPDATE page_sections SET status='published',published_at=clock_timestamp(),published_by=v_actor,updated_by=v_actor WHERE id=v_draft.id;
    v_new:=about_page_snapshot(v_draft.id);
    SELECT COALESCE(max(version_number),0)+1 INTO v_revision FROM content_revisions WHERE table_name='page_sections' AND record_id=v_draft.id;
    INSERT INTO content_revisions(table_name,record_id,revision_data,created_by,version_number,change_summary) VALUES('page_sections',v_draft.id,v_new,v_actor,v_revision,'Published About page');
    INSERT INTO audit_logs(admin_id,action,table_name,record_id,old_values,new_values) VALUES(v_actor,'publish','page_sections',v_draft.id,v_old,v_new);
    RETURN jsonb_build_object('ok',true,'data',v_new);
END;
$$;

REVOKE ALL ON FUNCTION about_page_snapshot(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION validate_about_page_payload(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION replace_about_page_children(UUID,JSONB,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION save_about_page_draft(JSONB,TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION publish_about_page_draft(UUID,TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION about_page_snapshot(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION save_about_page_draft(JSONB,TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_about_page_draft(UUID,TIMESTAMPTZ) TO authenticated;

DO $$
DECLARE
    v_page UUID; v_section UUID; v_selection UUID; v_snapshot JSONB;
    v_hero UUID; v_completed UUID; v_ongoing UUID; v_upcoming UUID;
BEGIN
    SELECT id INTO v_page FROM pages WHERE slug='about';
    SELECT id INTO v_hero FROM media_assets WHERE public_id='dhaka-heights/dev/hero1' AND is_archived=false;
    SELECT id INTO v_completed FROM media_assets WHERE public_id='dhaka-heights/dev/proj_completed' AND is_archived=false;
    SELECT id INTO v_ongoing FROM media_assets WHERE public_id='dhaka-heights/dev/proj_ongoing' AND is_archived=false;
    SELECT id INTO v_upcoming FROM media_assets WHERE public_id='dhaka-heights/dev/proj_upcoming' AND is_archived=false;
    IF v_page IS NULL OR v_hero IS NULL OR v_completed IS NULL OR v_ongoing IS NULL OR v_upcoming IS NULL THEN RAISE EXCEPTION 'About page and four canonical media assets are required'; END IF;
    IF EXISTS(SELECT 1 FROM page_sections WHERE page_id=v_page AND section_key='about-page' AND status='published') THEN RETURN; END IF;
    INSERT INTO page_sections(page_id,section_key,section_name,allowed_variant,sort_order,is_visible,status,version_number,settings,published_at)
    VALUES(v_page,'about-page','About Page','editorial',10,true,'published',1,jsonb_build_object(
        'hero',jsonb_build_object('title','ABOUT US','subtitle','VALUE BREEDS VOLUME'),
        'overview',jsonb_build_object('tag','WHO WE ARE','heading','Pioneering Commercial Luxury Landmarks','highlight','Commercial Luxury','paragraphs',jsonb_build_array(
            'Established with a vision to revolutionize the skyline of Dhaka, Dhaka Heights Properties Limited has emerged as a premier name in luxury residential and commercial real estate. We do not just build office office towers; we create high-performance architectural ecosystems that foster corporate growth, banking operations, and high-end retail success.',
            'Our projects, particularly in premium neighborhoods like Bashundhara R/A and Jolshiri Abashon, are characterized by smart architectural facades, advanced ventilation integration, basement parking configurations, and state-of-the-art emergency protocols.',
            'By maintaining total control over the project cycle, from structural design under Dhaka Heights Construction Ltd to client services via Dhaka Heights Business Solution, we deliver unmatched structural reliability and design prestige.'
        )),
        'sustainability',jsonb_build_object('tag','SUSTAINABILITY','heading','Green Living & Ecological Architecture','highlight','Ecological Architecture','paragraphs',jsonb_build_array(
            'At Dhaka Heights Properties Limited, we attempt to align modern architecture with nature. By integrating energy-saving smart facade systems, cross-ventilation configurations, and extensive rooftop landscaping, we reduce carbon footprint while boosting energy efficiency.',
            'Our properties feature rainwater harvesting systems, eco-friendly waste management, and custom daylight optimization layouts that lower electrical load indices by up to 25% compared to generic builders.'
        ),'quote','"We should attempt to bring nature, houses, and human beings together in a higher unity."','quoteAuthor','— Ludwig Mies van der Rohe'),
        'leadership',jsonb_build_object('tag','LEADERSHIP MESSAGE','primaryQuote','"In real estate, building is only 50% of the journey. The remaining 50% consists of architectural foresight, customer commitment, and operational integrity. At Dhaka Heights Properties Limited, we build today with the technology of tomorrow, ensuring every floor layout and glass panel complies with elite safety and productivity indices."','secondaryQuote','"We invite landowners and clients to experience the next tier of premium architectural design and join us in raising the real estate standard across Bangladesh."','authorName','Md. Shahadat Hossain','authorTitle','Dhaka Heights Properties Limited'),
        'concernsSection',jsonb_build_object('tag','OUR CONCERNS','heading','Dhaka Heights Properties Limited Subsidiaries'),
        'accreditationsSection',jsonb_build_object('tag','ACCREDITATIONS','heading','Compliances & Certifications'),
        'seo',jsonb_build_object('title','Dhaka Heights | PROPERTIES LTD','description','Dhaka Heights Properties Limited is a top real estate developer in Dhaka, offering luxury residential apartments and premium commercial spaces in Bashundhara, Jolshiri Abashon, and Gulshan.','canonicalUrl','https://dhakaheights.com/','ogTitle','Dhaka Heights | PROPERTIES LTD','ogDescription','Explore luxury residential and commercial properties by Dhaka Heights Properties Limited. Premium architecture, eco-friendly developments, and prime locations in Dhaka.')
    ),clock_timestamp()) RETURNING id INTO v_section;
    INSERT INTO section_items(section_id,item_key,image_asset_id,image_alt,sort_order,is_visible) VALUES
      (v_section,'media-hero',v_hero,'Dhaka Heights architectural landmark',10,true),
      (v_section,'media-overview-back',v_completed,'Dhaka Heights Properties Limited Project Renders',20,true),
      (v_section,'media-overview-front',v_ongoing,'Dhaka Heights Properties Limited Structural Frame',30,true),
      (v_section,'media-sustainability',v_upcoming,'Green Building Render',40,true);
    INSERT INTO section_items(section_id,item_key,title,body_text,icon_library,icon_key,image_asset_id,image_alt,sort_order,is_visible) VALUES
      (v_section,'pillar-mission','Our Mission','To construct state-of-the-art commercial high-rises incorporating sustainable materials, acoustic isolation, and energy-conserving thermal glass envelopes, guaranteeing premium spaces that drive business productivity.','fontawesome','fa-bullseye',v_ongoing,'Ongoing Dhaka Heights architectural development',10,true),
      (v_section,'pillar-promise','Brand Promise','Our brand promise is to establish trust with landowners and corporate tenants, delivering structural compliance, architectural prestige, and zero-lag tenancy operations.','fontawesome','fa-handshake',v_completed,'Completed Dhaka Heights landmark',20,true),
      (v_section,'pillar-vision','Our Vision','To stand as the absolute standard of engineering compliance and aesthetic elegance in the real estate sector of Bangladesh, setting benchmarks in construction timeline, building automation, and corporate tenancy.','fontawesome','fa-eye',v_upcoming,'Upcoming Dhaka Heights development',30,true);
    INSERT INTO section_items(section_id,item_key,title,icon_library,icon_key,sort_order,is_visible) VALUES
      (v_section,'accreditation-rajuk','RAJUK Approved','fontawesome','fa-city',10,true),
      (v_section,'accreditation-rehab','REHAB Member','fontawesome','fa-building-shield',20,true),
      (v_section,'accreditation-iso','ISO 9001:2015','fontawesome','fa-award',30,true),
      (v_section,'accreditation-acoustic','Acoustic Certified','fontawesome','fa-shield-halved',40,true),
      (v_section,'accreditation-green','Green Registered','fontawesome','fa-leaf',50,true);
    INSERT INTO section_entity_selections(section_id,entity_type) VALUES(v_section,'concern') RETURNING id INTO v_selection;
    INSERT INTO section_entity_selection_items(selection_id,concern_id,override_title,override_description,override_cover_image_id,override_cta_label,sort_order,is_visible)
    SELECT v_selection,c.id,seed.title,seed.description,ma.id,'View Subsidiary',seed.ord*10,true
    FROM (VALUES
      ('dhaka-heights-developments-limited','DH Developments Ltd','Real estate developer focusing on ultra-luxury corporate towers.','dhaka-heights/dev/proj_ariana_lofts',1),
      ('dhaka-heights-construction-limited','DH Construction Ltd','Heavy civil design, engineering, and high-performance facade execution.','dhaka-heights/dev/proj_bd_palace',2),
      ('dhaka-heights-design-and-interior','DH Design & Interior','Sleek executive cabins, functional desks, and corporate landscaping.','dhaka-heights/dev/proj_italia',3),
      ('dhaka-heights-business-solution','DH Realty & Business Solutions','Premium commercial rental management, advisory, and operations.','dhaka-heights/dev/proj_mazumder_palace',4),
      ('dhaka-heights-global-limited','DH Global Ltd','International trading of raw construction goods and industrial logistics.','dhaka-heights/dev/proj_muztaba_mansion',5),
      ('dhaka-heights-power-limited','DH Power Ltd','Integrating solar arrays, high-tension transformers, and backups.','dhaka-heights/dev/proj_sunsplash',6),
      ('dhaka-heights-maritime-limited','DH Maritime Ltd','River cargo systems transporting construction aggregates safely.','dhaka-heights/dev/proj_silver_spring',7),
      ('dhaka-heights-trading','DH Trading','Premium glass structural panels and high-grade structural rebar imports.','dhaka-heights/dev/proj_asha_purna',8)
    ) seed(slug,title,description,public_id,ord)
    JOIN concerns c ON c.slug=seed.slug JOIN media_assets ma ON ma.public_id=seed.public_id AND ma.is_archived=false;
    INSERT INTO media_asset_usage(media_asset_id,table_name,record_id,field_name)
      SELECT image_asset_id,'section_items',id,'image_asset_id' FROM section_items WHERE section_id=v_section AND image_asset_id IS NOT NULL ON CONFLICT DO NOTHING;
    INSERT INTO media_asset_usage(media_asset_id,table_name,record_id,field_name)
      SELECT override_cover_image_id,'section_entity_selection_items',id,'override_cover_image_id' FROM section_entity_selection_items WHERE selection_id=v_selection ON CONFLICT DO NOTHING;
    v_snapshot:=about_page_snapshot(v_section);
    INSERT INTO content_revisions(table_name,record_id,revision_data,version_number,change_summary) VALUES('page_sections',v_section,v_snapshot,1,'Seeded initial published About page');
    INSERT INTO audit_logs(action,table_name,record_id,new_values) VALUES('migration_seed','page_sections',v_section,v_snapshot);
END;
$$;

COMMIT;
