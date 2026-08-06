BEGIN;

-- Fix 02: extend the existing versioned About-page CMS with an optional,
-- media-backed team collection. Existing About content remains valid and the
-- public section stays hidden until at least one visible team member exists.

UPDATE page_sections
SET settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{teamSection}',
    COALESCE(
        settings->'teamSection',
        jsonb_build_object(
            'tag', 'OUR TEAM',
            'heading', 'Leadership & Management',
            'intro', 'Meet the people guiding Dhaka Heights with experience, integrity, and a shared commitment to excellence.'
        )
    ),
    true
)
WHERE section_key = 'about-page'
  AND NOT (COALESCE(settings, '{}'::jsonb) ? 'teamSection');

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
    'teamMembers', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'itemId',si.id,'itemKey',si.item_key,'name',si.title,'role',si.subtitle,
            'biography',si.body_text,'mediaId',si.image_asset_id,'imageAlt',si.image_alt,
            'media',jsonb_build_object('id',ma.id,'secureUrl',ma.secure_url,'displayName',ma.display_name,'altText',ma.alt_text,'format',ma.format),
            'sortOrder',si.sort_order,'isVisible',si.is_visible
        ) ORDER BY si.sort_order,si.id)
        FROM section_items si JOIN media_assets ma ON ma.id=si.image_asset_id
        WHERE si.section_id=ps.id AND si.item_key LIKE 'team-%'
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
       OR jsonb_typeof(p_payload->'teamMembers')<>'array'
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
        ARRAY['teamSection','tag'],ARRAY['teamSection','heading'],
        ARRAY['concernsSection','tag'],ARRAY['concernsSection','heading'],
        ARRAY['accreditationsSection','tag'],ARRAY['accreditationsSection','heading'],
        ARRAY['seo','title'],ARRAY['seo','description'],ARRAY['seo','canonicalUrl']
    ] LOOP
        IF length(btrim(COALESCE(p_payload->'content'#>>v_path,''))) NOT BETWEEN 1 AND 1200 THEN
            RAISE EXCEPTION 'Required About content at % is invalid', array_to_string(v_path,'.') USING ERRCODE='22023';
        END IF;
    END LOOP;

    IF length(btrim(COALESCE(p_payload#>>'{content,teamSection,intro}',''))) > 600
       OR jsonb_typeof(p_payload#>'{content,overview,paragraphs}')<>'array'
       OR jsonb_array_length(p_payload#>'{content,overview,paragraphs}') NOT BETWEEN 1 AND 6
       OR jsonb_typeof(p_payload#>'{content,sustainability,paragraphs}')<>'array'
       OR jsonb_array_length(p_payload#>'{content,sustainability,paragraphs}') NOT BETWEEN 1 AND 6
       OR COALESCE(p_payload#>>'{content,seo,canonicalUrl}','') !~ '^https://[^[:space:]]+$' THEN
        RAISE EXCEPTION 'About paragraphs, team heading, or SEO configuration is invalid' USING ERRCODE='22023';
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

    v_count:=jsonb_array_length(p_payload->'teamMembers');
    IF v_count NOT BETWEEN 0 AND 24
       OR (v_count>0 AND (SELECT count(DISTINCT item->>'itemKey') FROM jsonb_array_elements(p_payload->'teamMembers') item)<>v_count) THEN
        RAISE EXCEPTION 'About team members are invalid' USING ERRCODE='22023';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'teamMembers') LOOP
        BEGIN v_id:=(v_item->>'mediaId')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Invalid team member image ID' USING ERRCODE='22023'; END;
        IF COALESCE(v_item->>'itemKey','') !~ '^team-[a-z0-9-]{1,64}$'
           OR length(btrim(COALESCE(v_item->>'name',''))) NOT BETWEEN 1 AND 120
           OR length(btrim(COALESCE(v_item->>'role',''))) NOT BETWEEN 1 AND 120
           OR length(btrim(COALESCE(v_item->>'biography',''))) NOT BETWEEN 1 AND 6000
           OR length(btrim(COALESCE(v_item->>'imageAlt',''))) NOT BETWEEN 1 AND 180
           OR jsonb_typeof(v_item->'isVisible')<>'boolean'
           OR NOT EXISTS(SELECT 1 FROM media_assets WHERE id=v_id AND resource_type='image' AND is_archived=false) THEN
            RAISE EXCEPTION 'One or more About team members are invalid' USING ERRCODE='22023';
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

    INSERT INTO section_items(section_id,item_key,title,subtitle,body_text,image_asset_id,image_alt,sort_order,is_visible,updated_by)
    SELECT p_section_id,item->>'itemKey',btrim(item->>'name'),btrim(item->>'role'),btrim(item->>'biography'),(item->>'mediaId')::UUID,btrim(item->>'imageAlt'),ordinal*10,(item->>'isVisible')::BOOLEAN,p_actor
    FROM jsonb_array_elements(p_payload->'teamMembers') WITH ORDINALITY entries(item,ordinal);

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

REVOKE ALL ON FUNCTION about_page_snapshot(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION validate_about_page_payload(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION replace_about_page_children(UUID,JSONB,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION about_page_snapshot(UUID) TO service_role;

COMMIT;
