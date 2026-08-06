BEGIN;

ALTER TABLE concerns
    ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES admin_profiles(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS set_concerns_updated_at ON concerns;
CREATE TRIGGER set_concerns_updated_at BEFORE UPDATE ON concerns
FOR EACH ROW EXECUTE FUNCTION set_home_content_updated_at();

DROP POLICY IF EXISTS "Public Read Published Page Sections" ON page_sections;
CREATE POLICY "Public Read Published Page Sections" ON page_sections
    FOR SELECT USING (
        status='published'
        AND (is_visible=true OR section_key IN (
            'hero-slider','about-corporate-home','statistics-counter','featured-projects-home',
            'commitment-quote','media-highlights-home','partners-carousel','contact-section-home',
            'about-page','projects-page','concerns-page'
        ))
        AND EXISTS (SELECT 1 FROM pages p WHERE p.id=page_sections.page_id AND p.is_published=true)
    );

DROP POLICY IF EXISTS "Public Read Published Concerns" ON concerns;
CREATE POLICY "Public Read Published Concerns" ON concerns FOR SELECT USING (status='published' AND is_visible=true);
DROP POLICY IF EXISTS "Admin Full Access Concerns" ON concerns;
DROP POLICY IF EXISTS "Admin Read Concerns" ON concerns;
CREATE POLICY "Admin Read Concerns" ON concerns FOR SELECT USING (get_admin_role() IN ('super_admin','content_editor','sales_manager'));

CREATE OR REPLACE FUNCTION concerns_page_snapshot(p_section_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
SELECT jsonb_build_object(
    'id',ps.id,'pageId',ps.page_id,'sectionKey',ps.section_key,'status',ps.status,
    'versionNumber',ps.version_number,'isVisible',ps.is_visible,'content',ps.settings,
    'updatedAt',ps.updated_at,'updatedBy',ps.updated_by,'publishedAt',ps.published_at,'publishedBy',ps.published_by
)
FROM page_sections ps WHERE ps.id=p_section_id AND ps.section_key='concerns-page';
$$;

CREATE OR REPLACE FUNCTION validate_concerns_page_payload(p_payload JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE v_content JSONB:=p_payload->'content'; v_concern JSONB; v_service JSONB; v_project JSONB; v_media UUID; v_id UUID; v_count INTEGER;
BEGIN
    IF p_payload->>'sectionKey' IS DISTINCT FROM 'concerns-page' THEN RAISE EXCEPTION 'Invalid Concerns page section key' USING ERRCODE='22023'; END IF;
    IF jsonb_typeof(v_content)<>'object' OR jsonb_typeof(v_content->'concerns')<>'array' THEN RAISE EXCEPTION 'Concerns page content must contain a concerns array' USING ERRCODE='22023'; END IF;
    v_count:=jsonb_array_length(v_content->'concerns');
    IF v_count<1 OR v_count>30 THEN RAISE EXCEPTION 'Concerns must contain between 1 and 30 records' USING ERRCODE='22023'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_content->'concerns') c GROUP BY lower(c->>'slug') HAVING count(*)>1) THEN RAISE EXCEPTION 'Concern slugs must be unique' USING ERRCODE='23505'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_content->'concerns') c GROUP BY c->>'concernId' HAVING count(*)>1) THEN RAISE EXCEPTION 'Concern IDs must be unique' USING ERRCODE='23505'; END IF;
    BEGIN v_media:=(v_content#>>'{header,mediaId}')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'A valid header image is required' USING ERRCODE='22023'; END;
    IF NOT EXISTS(SELECT 1 FROM media_assets WHERE id=v_media AND resource_type='image' AND is_archived=false) THEN RAISE EXCEPTION 'The header image is unavailable' USING ERRCODE='23503'; END IF;
    FOR v_concern IN SELECT value FROM jsonb_array_elements(v_content->'concerns') LOOP
        BEGIN v_id:=(v_concern->>'concernId')::UUID; v_media:=(v_concern->>'coverMediaId')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Concern and media IDs must be valid' USING ERRCODE='22023'; END;
        IF COALESCE(v_concern->>'slug','') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN RAISE EXCEPTION 'Every concern requires a valid slug' USING ERRCODE='22023'; END IF;
        IF COALESCE(length(btrim(v_concern->>'name')),0) NOT BETWEEN 1 AND 140 OR COALESCE(length(btrim(v_concern->>'subtitle')),0) NOT BETWEEN 1 AND 220 OR COALESCE(length(btrim(v_concern->>'overview')),0) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Concern name, subtitle and overview are required' USING ERRCODE='22023'; END IF;
        IF COALESCE(length(btrim(v_concern->>'coverAlt')),0) NOT BETWEEN 1 AND 180 THEN RAISE EXCEPTION 'Concern image alt text is required' USING ERRCODE='22023'; END IF;
        IF NOT EXISTS(SELECT 1 FROM media_assets WHERE id=v_media AND resource_type='image' AND is_archived=false) THEN RAISE EXCEPTION 'A concern image is unavailable' USING ERRCODE='23503'; END IF;
        IF jsonb_typeof(v_concern->'features')<>'array' OR jsonb_array_length(v_concern->'features') NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Each concern needs between 1 and 12 features' USING ERRCODE='22023'; END IF;
        IF jsonb_typeof(v_concern->'services')<>'array' OR jsonb_array_length(v_concern->'services') NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Each concern needs between 1 and 12 services' USING ERRCODE='22023'; END IF;
        FOR v_service IN SELECT value FROM jsonb_array_elements(v_concern->'services') LOOP
            IF COALESCE(length(btrim(v_service->>'title')),0)=0 OR COALESCE(length(btrim(v_service->>'description')),0)=0 OR COALESCE(v_service->>'icon','') !~ '^fa-[a-z0-9-]+$' THEN RAISE EXCEPTION 'Every service needs a title, description and valid icon' USING ERRCODE='22023'; END IF;
        END LOOP;
        IF jsonb_typeof(v_concern->'relatedProjects')<>'array' THEN RAISE EXCEPTION 'Related projects must be an array' USING ERRCODE='22023'; END IF;
        FOR v_project IN SELECT value FROM jsonb_array_elements(v_concern->'relatedProjects') LOOP
            BEGIN v_id:=(v_project->>'projectId')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Related project IDs must be valid' USING ERRCODE='22023'; END;
            IF NOT EXISTS(SELECT 1 FROM projects WHERE id=v_id AND status='published') THEN RAISE EXCEPTION 'A related project is unavailable' USING ERRCODE='23503'; END IF;
        END LOOP;
    END LOOP;
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_content->'concerns') c
        CROSS JOIN LATERAL jsonb_array_elements(c->'relatedProjects') p
        GROUP BY p->>'projectId' HAVING count(*)>1
    ) THEN RAISE EXCEPTION 'A project can belong to only one concern' USING ERRCODE='23505'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION replace_concerns_page_media_usage(p_section_id UUID,p_payload JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
    DELETE FROM media_asset_usage WHERE table_name='page_sections' AND record_id=p_section_id AND field_name LIKE 'concerns-page:%';
    INSERT INTO media_asset_usage(media_asset_id,table_name,record_id,field_name)
    VALUES((p_payload#>>'{content,header,mediaId}')::UUID,'page_sections',p_section_id,'concerns-page:header') ON CONFLICT DO NOTHING;
    INSERT INTO media_asset_usage(media_asset_id,table_name,record_id,field_name)
    SELECT (c->>'coverMediaId')::UUID,'page_sections',p_section_id,'concerns-page:'||(c->>'concernId')||':cover'
    FROM jsonb_array_elements(p_payload#>'{content,concerns}') c ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION sync_concerns_catalog(p_content JSONB,p_actor UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_concern JSONB; v_project JSONB; v_id UUID;
BEGIN
    FOR v_concern IN SELECT value FROM jsonb_array_elements(p_content->'concerns') LOOP
        v_id:=(v_concern->>'concernId')::UUID;
        INSERT INTO concerns(id,slug,name,subtitle,overview,cover_image_id,features_list,status,sort_order,is_visible,updated_by)
        VALUES(v_id,btrim(v_concern->>'slug'),btrim(v_concern->>'name'),btrim(v_concern->>'subtitle'),btrim(v_concern->>'overview'),(v_concern->>'coverMediaId')::UUID,v_concern->'features',CASE WHEN COALESCE((v_concern->>'isVisible')::BOOLEAN,true) THEN 'published'::content_status ELSE 'archived'::content_status END,(v_concern->>'sortOrder')::INTEGER,COALESCE((v_concern->>'isVisible')::BOOLEAN,true),p_actor)
        ON CONFLICT(id) DO UPDATE SET slug=EXCLUDED.slug,name=EXCLUDED.name,subtitle=EXCLUDED.subtitle,overview=EXCLUDED.overview,cover_image_id=EXCLUDED.cover_image_id,features_list=EXCLUDED.features_list,status=EXCLUDED.status,sort_order=EXCLUDED.sort_order,is_visible=EXCLUDED.is_visible,updated_by=p_actor;
        DELETE FROM media_asset_usage WHERE table_name='concerns' AND record_id=v_id AND field_name='cover_image_id';
        INSERT INTO media_asset_usage(media_asset_id,table_name,record_id,field_name) VALUES((v_concern->>'coverMediaId')::UUID,'concerns',v_id,'cover_image_id') ON CONFLICT DO NOTHING;
    END LOOP;
    UPDATE concerns SET status='archived',is_visible=false,updated_by=p_actor WHERE id NOT IN (SELECT (c->>'concernId')::UUID FROM jsonb_array_elements(p_content->'concerns') c);
    UPDATE projects SET concern_id=NULL WHERE concern_id IS NOT NULL;
    FOR v_concern IN SELECT value FROM jsonb_array_elements(p_content->'concerns') LOOP
        FOR v_project IN SELECT value FROM jsonb_array_elements(v_concern->'relatedProjects') LOOP
            UPDATE projects SET concern_id=(v_concern->>'concernId')::UUID WHERE id=(v_project->>'projectId')::UUID;
        END LOOP;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION save_concerns_page_draft(p_payload JSONB,p_expected_updated_at TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor UUID:=auth.uid(); v_role app_role; v_page UUID; v_source UUID; v_draft page_sections%ROWTYPE; v_published page_sections%ROWTYPE; v_id UUID; v_next INTEGER; v_old JSONB; v_new JSONB; v_revision INTEGER;
BEGIN
    IF v_actor IS NULL THEN RETURN jsonb_build_object('ok',false,'status',401,'code','ADMIN_AUTH_REQUIRED','error','Authentication is required.'); END IF;
    SELECT role INTO v_role FROM admin_profiles WHERE id=v_actor AND is_active=true;
    IF v_role IS NULL OR v_role NOT IN('super_admin','content_editor') THEN RETURN jsonb_build_object('ok',false,'status',403,'code','ADMIN_ROLE_FORBIDDEN','error','An active content administrator profile is required.'); END IF;
    PERFORM validate_concerns_page_payload(p_payload);
    BEGIN v_source:=(p_payload->>'id')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Invalid Concerns section ID' USING ERRCODE='22023'; END;
    SELECT id INTO v_page FROM pages WHERE slug='concern' AND is_published=true FOR UPDATE;
    IF v_page IS NULL THEN RETURN jsonb_build_object('ok',false,'status',503,'code','CONCERNS_PAGE_NOT_CONFIGURED','error','The Concerns page is not configured.'); END IF;
    SELECT * INTO v_draft FROM page_sections WHERE page_id=v_page AND section_key='concerns-page' AND status='draft' FOR UPDATE;
    IF v_draft.id IS NOT NULL THEN
        IF v_source<>v_draft.id OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('ok',false,'status',409,'code','CONCERNS_PAGE_CONFLICT','error','The Concerns draft changed after this editor loaded it.'); END IF;
        v_id:=v_draft.id; v_old:=concerns_page_snapshot(v_id);
        UPDATE page_sections SET settings=p_payload->'content',is_visible=COALESCE((p_payload->>'isVisible')::BOOLEAN,true),updated_by=v_actor WHERE id=v_id;
    ELSE
        SELECT * INTO v_published FROM page_sections WHERE page_id=v_page AND section_key='concerns-page' AND status='published' FOR UPDATE;
        IF v_published.id IS NULL OR v_source<>v_published.id OR v_published.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('ok',false,'status',409,'code','CONCERNS_PAGE_CONFLICT','error','Published Concerns content changed after this editor loaded it.'); END IF;
        SELECT COALESCE(max(version_number),0)+1 INTO v_next FROM page_sections WHERE page_id=v_page AND section_key='concerns-page';
        INSERT INTO page_sections(page_id,section_key,section_name,allowed_variant,sort_order,is_visible,status,version_number,settings,updated_by,supersedes_id)
        VALUES(v_page,'concerns-page','Sister Concerns Catalogue','detail-catalogue',10,COALESCE((p_payload->>'isVisible')::BOOLEAN,true),'draft',v_next,p_payload->'content',v_actor,v_published.id) RETURNING id INTO v_id;
    END IF;
    PERFORM replace_concerns_page_media_usage(v_id,p_payload);
    v_new:=concerns_page_snapshot(v_id);
    SELECT COALESCE(max(version_number),0)+1 INTO v_revision FROM content_revisions WHERE table_name='page_sections' AND record_id=v_id;
    INSERT INTO content_revisions(table_name,record_id,revision_data,created_by,version_number,change_summary) VALUES('page_sections',v_id,v_new,v_actor,v_revision,CASE WHEN v_draft.id IS NULL THEN 'Created Concerns catalogue draft' ELSE 'Saved Concerns catalogue draft' END);
    INSERT INTO audit_logs(admin_id,action,table_name,record_id,old_values,new_values) VALUES(v_actor,CASE WHEN v_draft.id IS NULL THEN 'create_draft' ELSE 'update_draft' END,'page_sections',v_id,v_old,v_new);
    RETURN jsonb_build_object('ok',true,'data',v_new);
END;
$$;

CREATE OR REPLACE FUNCTION publish_concerns_page_draft(p_section_id UUID,p_expected_updated_at TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor UUID:=auth.uid(); v_role app_role; v_draft page_sections%ROWTYPE; v_published page_sections%ROWTYPE; v_old JSONB; v_previous JSONB; v_new JSONB; v_revision INTEGER;
BEGIN
    IF v_actor IS NULL THEN RETURN jsonb_build_object('ok',false,'status',401,'code','ADMIN_AUTH_REQUIRED','error','Authentication is required.'); END IF;
    SELECT role INTO v_role FROM admin_profiles WHERE id=v_actor AND is_active=true;
    IF v_role IS NULL OR v_role NOT IN('super_admin','content_editor') THEN RETURN jsonb_build_object('ok',false,'status',403,'code','ADMIN_ROLE_FORBIDDEN','error','An active content administrator profile is required.'); END IF;
    SELECT * INTO v_draft FROM page_sections WHERE id=p_section_id AND section_key='concerns-page' AND status='draft' FOR UPDATE;
    IF v_draft.id IS NULL THEN RETURN jsonb_build_object('ok',false,'status',404,'code','CONCERNS_PAGE_DRAFT_NOT_FOUND','error','The Concerns draft no longer exists.'); END IF;
    IF p_expected_updated_at IS NULL OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('ok',false,'status',409,'code','CONCERNS_PAGE_CONFLICT','error','The Concerns draft changed after this editor loaded it.'); END IF;
    v_old:=concerns_page_snapshot(v_draft.id); PERFORM validate_concerns_page_payload(v_old); PERFORM sync_concerns_catalog(v_draft.settings,v_actor);
    SELECT * INTO v_published FROM page_sections WHERE page_id=v_draft.page_id AND section_key='concerns-page' AND status='published' FOR UPDATE;
    IF v_published.id IS NOT NULL THEN v_previous:=concerns_page_snapshot(v_published.id); UPDATE page_sections SET status='archived',updated_by=v_actor WHERE id=v_published.id; INSERT INTO audit_logs(admin_id,action,table_name,record_id,old_values,new_values) VALUES(v_actor,'archive_published','page_sections',v_published.id,v_previous,concerns_page_snapshot(v_published.id)); END IF;
    UPDATE page_sections SET status='published',published_at=clock_timestamp(),published_by=v_actor,updated_by=v_actor WHERE id=v_draft.id;
    v_new:=concerns_page_snapshot(v_draft.id);
    SELECT COALESCE(max(version_number),0)+1 INTO v_revision FROM content_revisions WHERE table_name='page_sections' AND record_id=v_draft.id;
    INSERT INTO content_revisions(table_name,record_id,revision_data,created_by,version_number,change_summary) VALUES('page_sections',v_draft.id,v_new,v_actor,v_revision,'Published Concerns page and canonical catalogue');
    INSERT INTO audit_logs(admin_id,action,table_name,record_id,old_values,new_values) VALUES(v_actor,'publish','page_sections',v_draft.id,v_old,v_new);
    RETURN jsonb_build_object('ok',true,'data',v_new);
END;
$$;

REVOKE ALL ON FUNCTION concerns_page_snapshot(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION validate_concerns_page_payload(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION replace_concerns_page_media_usage(UUID,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION sync_concerns_catalog(JSONB,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION save_concerns_page_draft(JSONB,TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION publish_concerns_page_draft(UUID,TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION concerns_page_snapshot(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION save_concerns_page_draft(JSONB,TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_concerns_page_draft(UUID,TIMESTAMPTZ) TO authenticated;

DO $$
DECLARE v_page UUID; v_section UUID; v_header UUID; v_ongoing UUID; v_completed UUID; v_upcoming UUID; v_hero1 UUID; v_hero2 UUID; v_hero3 UUID; v_concerns JSONB; v_content JSONB; v_snapshot JSONB;
BEGIN
    SELECT id INTO v_page FROM pages WHERE slug='concern';
    SELECT id INTO v_header FROM media_assets WHERE public_id='dhaka-heights/dev/media_bg' AND is_archived=false;
    SELECT id INTO v_ongoing FROM media_assets WHERE public_id='dhaka-heights/dev/proj_ongoing' AND is_archived=false;
    SELECT id INTO v_completed FROM media_assets WHERE public_id='dhaka-heights/dev/proj_completed' AND is_archived=false;
    SELECT id INTO v_upcoming FROM media_assets WHERE public_id='dhaka-heights/dev/proj_upcoming' AND is_archived=false;
    SELECT id INTO v_hero1 FROM media_assets WHERE public_id='dhaka-heights/dev/hero1' AND is_archived=false;
    SELECT id INTO v_hero2 FROM media_assets WHERE public_id='dhaka-heights/dev/hero2' AND is_archived=false;
    SELECT id INTO v_hero3 FROM media_assets WHERE public_id='dhaka-heights/dev/hero3' AND is_archived=false;
    IF v_page IS NULL OR v_header IS NULL OR v_ongoing IS NULL OR v_completed IS NULL OR v_upcoming IS NULL OR v_hero1 IS NULL OR v_hero2 IS NULL OR v_hero3 IS NULL THEN RAISE EXCEPTION 'Concern page and canonical media assets are required'; END IF;
    IF EXISTS(SELECT 1 FROM page_sections WHERE page_id=v_page AND section_key='concerns-page' AND status='published') THEN RETURN; END IF;

    SELECT jsonb_agg(jsonb_build_object(
        'concernId',c.id,'slug',c.slug,'name',c.name,'subtitle',c.subtitle,
        'overview',CASE c.slug
          WHEN 'dhaka-heights-developments-limited' THEN 'Dhaka Heights Developments Limited is the flagship real estate development arm of the group, established to acquire premium sites and build state-of-the-art residential apartments and corporate offices in Bashundhara, Gulshan, and other parts of Dhaka. We coordinate the cycle from site evaluation and land acquisition to project branding and investor coordination.'
          WHEN 'dhaka-heights-construction-limited' THEN 'Dhaka Heights Construction Limited handles all heavy civil engineering, pile foundations, basement works, and structural framing for the group. Our engineering team specializes in deep basement excavation using advanced shoring walls, concrete mix formulation, and premium materials.'
          WHEN 'dhaka-heights-design-and-interior' THEN 'Dhaka Heights Design & Interior provides premium interior design, corporate fitouts, grand lobby lounges, and aesthetic landscaping. We focus on maximizing space utility, ergonomics, energy conservation, and corporate branding inside our spaces.'
          WHEN 'dhaka-heights-business-solution' THEN 'Dhaka Heights Business Solution coordinates the lease, sale, and daily operation of commercial and residential slots. We act as a professional bridge between institutional real estate investors, corporate tenants, retail operators, and structural operations managers.'
          WHEN 'dhaka-heights-global-limited' THEN 'Dhaka Heights Global Limited manages the international procurement of heavy building machinery, high-performance elevator units, fire exit doors, central HVAC compressors, and electrical transformers, importing only verified safety aggregates.'
          WHEN 'dhaka-heights-power-limited' THEN 'Dhaka Heights Power Limited guarantees uninterrupted operations across all properties. We construct custom high-tension sub-stations, deploy automated synchronized generators, and integrate rooftop grid-tied solar matrices.'
          WHEN 'dhaka-heights-maritime-limited' THEN 'Dhaka Heights Maritime Limited maintains bulk river transport vessels to move sand, stone, clinker, and reinforcing rebar aggregates from import points directly to regional construction depots, keeping project supply chains uninterrupted.'
          ELSE 'Dhaka Heights Trading focuses on importing specialized architectural building materials. We provide local contractors with double-glazed glass panels, acoustic frame channels, fire retardant boards, and premium stainless hardware fittings.' END,
        'features',c.features_list,
        'services',CASE c.slug
          WHEN 'dhaka-heights-developments-limited' THEN '[{"icon":"fa-building","title":"Residential Development","description":"Acquisition and execution of prime high-rise residential properties in premium neighborhoods."},{"icon":"fa-handshake","title":"Landowner Partnerships","description":"Mutually beneficial joint ventures with landowners providing transparent asset growth."},{"icon":"fa-file-shield","title":"Regulatory Compliance","description":"Complete RAJUK approvals, structural certifications, and environment safety."},{"icon":"fa-chart-line","title":"Investment Advisory","description":"Assisting buyers and institutional funds in acquiring premium yield real estate assets."}]'::jsonb
          WHEN 'dhaka-heights-construction-limited' THEN '[{"icon":"fa-compass-drafting","title":"Civil Engineering","description":"Structural framing using high-tensile rebar and premium cement grades."},{"icon":"fa-shield-halved","title":"Structural Safety","description":"Precision engineering of earthquake resistant structures."},{"icon":"fa-cubes","title":"Foundation Works","description":"Deep cast-in-situ piles and multi-basement shoring execution."},{"icon":"fa-list-check","title":"Quality Controls","description":"Rigorous non-destructive testing, concrete core tests, and load checks."}]'::jsonb
          WHEN 'dhaka-heights-design-and-interior' THEN '[{"icon":"fa-desktop","title":"Corporate Workstations","description":"Designing ergonomic, high-density yet spacious staff workstation configurations."},{"icon":"fa-chair","title":"Executive Suites","description":"Bespoke marble boardrooms, custom wood desks, and sound-insulating executive cabins."},{"icon":"fa-bed","title":"Residential Interiors","description":"Modern living room layouts, custom kitchen cabinets, and premium bathroom styling."},{"icon":"fa-spa","title":"Landscape Planning","description":"Integrating urban green spaces, hanging gardens, and indoor planter matrices."}]'::jsonb
          WHEN 'dhaka-heights-business-solution' THEN '[{"icon":"fa-key","title":"Tenancy Acquisitions","description":"Sourcing premium banks, retail franchises, and corporate offices to occupy slots."},{"icon":"fa-file-signature","title":"Lease Negotiations","description":"Formulating transparent, long-term commercial lease covenants."},{"icon":"fa-bell-concierge","title":"Facility Supervision","description":"Supervising security entries, cleaning teams, elevator maintenance, and mechanicals."},{"icon":"fa-screwdriver-wrench","title":"Asset Upkeeps","description":"Continuous renovation and modern upgrading of building systems."}]'::jsonb
          WHEN 'dhaka-heights-global-limited' THEN '[{"icon":"fa-gear","title":"Machinery Importation","description":"Acquiring high-speed Otis & Sigma elevator units, automatic diesel generators, and tower cranes."},{"icon":"fa-ship","title":"Supply Logistics","description":"Coordinating border clearances and cargo transfers to active project sites."},{"icon":"fa-clipboard-check","title":"Procurement Integrity","description":"Strict vetting of structural steel grades and low-e glass sheets."},{"icon":"fa-globe","title":"Trade Consultancy","description":"Providing indenting services for other real estate aggregates."}]'::jsonb
          WHEN 'dhaka-heights-power-limited' THEN '[{"icon":"fa-bolt-lightning","title":"High Tension Substations","description":"Deploying robust transformers and safety panels inside properties."},{"icon":"fa-plug","title":"Synchronized Generator Backups","description":"Smart auto-changeovers ensuring 100% full-load backup in less than 5 seconds."},{"icon":"fa-solar-panel","title":"Solar Array Deployments","description":"Rooftop green energy systems reducing corporate carbon output."},{"icon":"fa-gauge-high","title":"Energy Auditing","description":"Monitoring power factor controls and structural electrical loads."}]'::jsonb
          WHEN 'dhaka-heights-maritime-limited' THEN '[{"icon":"fa-anchor","title":"Bulk Aggregate Shipping","description":"Moving tons of sand, stone, and raw concrete aggregates via water corridors."},{"icon":"fa-dharmachakra","title":"Vessel Management","description":"Operating certified cargo barges and aggregate vessels."},{"icon":"fa-warehouse","title":"Depot Coordination","description":"Connecting river aggregate ports to city land supply trucks."},{"icon":"fa-lock","title":"Supply Security","description":"Insulating construction timelines from road traffic or truck strikes."}]'::jsonb
          ELSE '[{"icon":"fa-window-maximize","title":"Facade Component Trading","description":"Venting low-e vacuum double glass panels and structural silicone."},{"icon":"fa-bars-staggered","title":"Structural Materials Indents","description":"Providing high-strength architectural steel components."},{"icon":"fa-fire-extinguisher","title":"Fire Safety Hardware","description":"Importing certified fire escape doors and panic bar assemblies."},{"icon":"fa-truck-flatbed","title":"Fitout Materials Supply","description":"Venting high-grade commercial floor tiles and marble."}]'::jsonb END,
        'coverMediaId',CASE c.slug WHEN 'dhaka-heights-developments-limited' THEN v_ongoing WHEN 'dhaka-heights-construction-limited' THEN v_completed WHEN 'dhaka-heights-design-and-interior' THEN v_hero2 WHEN 'dhaka-heights-business-solution' THEN v_upcoming WHEN 'dhaka-heights-global-limited' THEN v_hero3 WHEN 'dhaka-heights-power-limited' THEN v_hero1 WHEN 'dhaka-heights-maritime-limited' THEN v_ongoing ELSE v_hero2 END,
        'coverAlt',c.name,'relatedProjects',CASE c.slug
          WHEN 'dhaka-heights-developments-limited' THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('projectId',p.id,'badgeText',CASE WHEN p.slug IN('dhaka-heights-italia','dhaka-heights-sunsplash') THEN 'Ongoing' ELSE p.badge_text END,'locationText',CASE p.slug WHEN 'dhaka-heights-bd-palace' THEN 'Bashundhara R/A, Dhaka' WHEN 'dhaka-heights-italia' THEN 'Bashundhara R/A, Dhaka' WHEN 'dhaka-heights-sunsplash' THEN 'Plot 136/A, Sonia Sobhan 5th Avenue, Block I, Bashundhara R/A, Dhaka' WHEN 'dhaka-heights-silver-spring' THEN 'Block H, Bashundhara R/A, Dhaka' ELSE p.location_address END,'type',CASE p.slug WHEN 'dhaka-heights-bd-palace' THEN 'Luxury Residential Apartments' WHEN 'dhaka-heights-italia' THEN 'Premium Residential Suites' ELSE p.project_type END) ORDER BY p.sort_order) FROM projects p WHERE p.slug IN('dhaka-heights-ariana-lofts','dhaka-heights-bd-palace','dhaka-heights-italia','dhaka-heights-mazumder-palace','dhaka-heights-muztaba-mansion','dhaka-heights-sunsplash','dhaka-heights-silver-spring','dhaka-heights-asha-purna-ii')),'[]'::jsonb)
          WHEN 'dhaka-heights-construction-limited' THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('projectId',p.id,'badgeText','Ongoing','locationText',p.location_address,'type',CASE p.slug WHEN 'dhaka-heights-pinnacle' THEN 'Premium Residential High-Rise' ELSE p.project_type END) ORDER BY p.sort_order) FROM projects p WHERE p.slug IN('dhaka-heights-green-heaven','dhaka-heights-pinnacle')),'[]'::jsonb)
          ELSE '[]'::jsonb END,
        'sortOrder',c.sort_order,'isVisible',true
    ) ORDER BY c.sort_order) INTO v_concerns FROM concerns c WHERE c.status='published';

    v_content:=jsonb_build_object(
      'header',jsonb_build_object('mediaId',v_header,'imageAlt','Dhaka Heights sister concerns corporate skyline'),
      'labels',jsonb_build_object('aboutBreadcrumb','About Us','concernsBreadcrumb','Sister Concerns','profileTag','Subsidiary Profile','overviewHeading','Scope of Operational Capabilities','servicesTag','Specializations','servicesHeading','Services & Operations','portfolioTag','PORTFOLIO','portfolioHeading','Featured Projects','notFoundTitle','Concern Not Found','notFoundBody','The requested sister concern details do not exist.','returnLabel','Return to About Us'),
      'concerns',v_concerns
    );
    INSERT INTO page_sections(page_id,section_key,section_name,allowed_variant,sort_order,is_visible,status,version_number,settings,published_at)
    VALUES(v_page,'concerns-page','Sister Concerns Catalogue','detail-catalogue',10,true,'published',1,v_content,clock_timestamp()) RETURNING id INTO v_section;
    PERFORM validate_concerns_page_payload(concerns_page_snapshot(v_section)); PERFORM replace_concerns_page_media_usage(v_section,concerns_page_snapshot(v_section)); PERFORM sync_concerns_catalog(v_content,NULL);
    v_snapshot:=concerns_page_snapshot(v_section);
    INSERT INTO content_revisions(table_name,record_id,revision_data,version_number,change_summary) VALUES('page_sections',v_section,v_snapshot,1,'Seeded initial published Concerns catalogue');
    INSERT INTO audit_logs(action,table_name,record_id,new_values) VALUES('migration_seed','page_sections',v_section,v_snapshot);
END;
$$;

COMMIT;
