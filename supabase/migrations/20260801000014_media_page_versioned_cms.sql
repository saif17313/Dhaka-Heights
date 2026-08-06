BEGIN;

ALTER TABLE media_posts
    ADD COLUMN IF NOT EXISTS cover_alt TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES admin_profiles(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS set_media_posts_updated_at ON media_posts;
CREATE TRIGGER set_media_posts_updated_at BEFORE UPDATE ON media_posts
FOR EACH ROW EXECUTE FUNCTION set_home_content_updated_at();

DROP POLICY IF EXISTS "Public Read Published Page Sections" ON page_sections;
CREATE POLICY "Public Read Published Page Sections" ON page_sections
    FOR SELECT USING (
        status='published'
        AND (is_visible=true OR section_key IN (
            'hero-slider','about-corporate-home','statistics-counter','featured-projects-home',
            'commitment-quote','media-highlights-home','partners-carousel','contact-section-home',
            'about-page','projects-page','concerns-page','media-page'
        ))
        AND EXISTS (SELECT 1 FROM pages p WHERE p.id=page_sections.page_id AND p.is_published=true)
    );

DROP POLICY IF EXISTS "Public Read Published Media Posts" ON media_posts;
CREATE POLICY "Public Read Published Media Posts" ON media_posts
    FOR SELECT USING (status='published' AND is_visible=true);
DROP POLICY IF EXISTS "Admin Full Access Media Posts" ON media_posts;
DROP POLICY IF EXISTS "Admin Read Media Posts" ON media_posts;
CREATE POLICY "Admin Read Media Posts" ON media_posts
    FOR SELECT USING (get_admin_role() IN ('super_admin','content_editor'));

CREATE OR REPLACE FUNCTION media_page_snapshot(p_section_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
SELECT jsonb_build_object(
    'id',ps.id,'pageId',ps.page_id,'sectionKey',ps.section_key,'status',ps.status,
    'versionNumber',ps.version_number,'isVisible',ps.is_visible,'content',ps.settings,
    'updatedAt',ps.updated_at,'updatedBy',ps.updated_by,'publishedAt',ps.published_at,'publishedBy',ps.published_by
)
FROM page_sections ps WHERE ps.id=p_section_id AND ps.section_key='media-page';
$$;

CREATE OR REPLACE FUNCTION validate_media_page_payload(p_payload JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
    v_content JSONB:=p_payload->'content'; v_article JSONB; v_video JSONB;
    v_media UUID; v_id UUID; v_articles INTEGER; v_videos INTEGER;
BEGIN
    IF p_payload->>'sectionKey' IS DISTINCT FROM 'media-page' THEN RAISE EXCEPTION 'Invalid Media page section key' USING ERRCODE='22023'; END IF;
    IF jsonb_typeof(v_content)<>'object' OR jsonb_typeof(v_content->'articles')<>'array' OR jsonb_typeof(v_content->'videos')<>'array' THEN
        RAISE EXCEPTION 'Media page content must include article and video arrays' USING ERRCODE='22023';
    END IF;
    v_articles:=jsonb_array_length(v_content->'articles'); v_videos:=jsonb_array_length(v_content->'videos');
    IF v_articles NOT BETWEEN 1 AND 100 OR v_videos>30 THEN RAISE EXCEPTION 'Media page supports 1-100 articles and up to 30 videos' USING ERRCODE='22023'; END IF;
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_content->'articles') a WHERE COALESCE((a->>'isVisible')::BOOLEAN,true)) THEN RAISE EXCEPTION 'At least one article must be visible' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_content->'articles') a GROUP BY a->>'postId' HAVING count(*)>1)
       OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_content->'articles') a GROUP BY lower(a->>'slug') HAVING count(*)>1)
       OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_content->'videos') v GROUP BY v->>'videoId' HAVING count(*)>1)
    THEN RAISE EXCEPTION 'Media IDs and article slugs must be unique' USING ERRCODE='23505'; END IF;
    BEGIN v_media:=(v_content#>>'{header,mediaId}')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'A valid Media header image is required' USING ERRCODE='22023'; END;
    IF NOT EXISTS(SELECT 1 FROM media_assets WHERE id=v_media AND resource_type='image' AND is_archived=false) THEN RAISE EXCEPTION 'The Media header image is unavailable' USING ERRCODE='23503'; END IF;
    IF COALESCE(length(btrim(v_content#>>'{header,title}')),0) NOT BETWEEN 1 AND 100
       OR COALESCE(length(btrim(v_content#>>'{header,subtitle}')),0) NOT BETWEEN 1 AND 240
       OR COALESCE(length(btrim(v_content#>>'{header,imageAlt}')),0) NOT BETWEEN 1 AND 180
       OR COALESCE((v_content->>'itemsPerPage')::INTEGER,0) NOT BETWEEN 1 AND 12
    THEN RAISE EXCEPTION 'Media header and page-size fields are invalid' USING ERRCODE='22023'; END IF;
    IF jsonb_typeof(v_content#>'{detail,closingParagraphs}')<>'array' OR jsonb_array_length(v_content#>'{detail,closingParagraphs}')<1 THEN
        RAISE EXCEPTION 'Media detail closing copy is required' USING ERRCODE='22023';
    END IF;
    FOR v_article IN SELECT value FROM jsonb_array_elements(v_content->'articles') LOOP
        BEGIN v_id:=(v_article->>'postId')::UUID; v_media:=(v_article->>'coverMediaId')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Article and cover IDs must be valid' USING ERRCODE='22023'; END;
        IF COALESCE(length(btrim(v_article->>'slug')),0) NOT BETWEEN 1 AND 1000 OR position('/' in v_article->>'slug')>0 THEN RAISE EXCEPTION 'Every article requires a URL-safe segment without slashes' USING ERRCODE='22023'; END IF;
        IF COALESCE(length(btrim(v_article->>'title')),0) NOT BETWEEN 1 AND 300 OR COALESCE(length(btrim(v_article->>'content')),0)<1 OR COALESCE(length(btrim(v_article->>'coverAlt')),0) NOT BETWEEN 1 AND 180 THEN RAISE EXCEPTION 'Article title, body and cover alt text are required' USING ERRCODE='22023'; END IF;
        IF v_article->>'category' NOT IN('Latest News','Blogs & Articles') THEN RAISE EXCEPTION 'Unsupported Media article category' USING ERRCODE='22023'; END IF;
        BEGIN PERFORM (v_article->>'publishedDate')::DATE; EXCEPTION WHEN invalid_datetime_format THEN RAISE EXCEPTION 'Every article requires a valid published date' USING ERRCODE='22023'; END;
        IF NOT EXISTS(SELECT 1 FROM media_assets WHERE id=v_media AND resource_type='image' AND is_archived=false) THEN RAISE EXCEPTION 'An article cover image is unavailable' USING ERRCODE='23503'; END IF;
    END LOOP;
    FOR v_video IN SELECT value FROM jsonb_array_elements(v_content->'videos') LOOP
        BEGIN v_id:=(v_video->>'videoId')::UUID; v_media:=(v_video->>'thumbnailMediaId')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Video and thumbnail IDs must be valid' USING ERRCODE='22023'; END;
        IF COALESCE(length(btrim(v_video->>'title')),0) NOT BETWEEN 1 AND 240 OR COALESCE(length(btrim(v_video->>'duration')),0) NOT BETWEEN 1 AND 20 OR COALESCE(length(btrim(v_video->>'thumbnailAlt')),0) NOT BETWEEN 1 AND 180 OR COALESCE(v_video->>'embedUrl','') !~ '^https://' THEN RAISE EXCEPTION 'Video title, duration, thumbnail alt and HTTPS embed URL are required' USING ERRCODE='22023'; END IF;
        IF NOT EXISTS(SELECT 1 FROM media_assets WHERE id=v_media AND resource_type='image' AND is_archived=false) THEN RAISE EXCEPTION 'A video thumbnail is unavailable' USING ERRCODE='23503'; END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION replace_media_page_media_usage(p_section_id UUID,p_payload JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
    DELETE FROM media_asset_usage WHERE table_name='page_sections' AND record_id=p_section_id AND field_name LIKE 'media-page:%';
    INSERT INTO media_asset_usage(media_asset_id,table_name,record_id,field_name)
    VALUES((p_payload#>>'{content,header,mediaId}')::UUID,'page_sections',p_section_id,'media-page:header') ON CONFLICT DO NOTHING;
    INSERT INTO media_asset_usage(media_asset_id,table_name,record_id,field_name)
    SELECT (a->>'coverMediaId')::UUID,'page_sections',p_section_id,'media-page:article:'||(a->>'postId')||':cover'
    FROM jsonb_array_elements(p_payload#>'{content,articles}') a ON CONFLICT DO NOTHING;
    INSERT INTO media_asset_usage(media_asset_id,table_name,record_id,field_name)
    SELECT (v->>'thumbnailMediaId')::UUID,'page_sections',p_section_id,'media-page:video:'||(v->>'videoId')||':thumbnail'
    FROM jsonb_array_elements(p_payload#>'{content,videos}') v ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION sync_media_catalog(p_content JSONB,p_actor UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_article JSONB; v_id UUID;
BEGIN
    FOR v_article IN SELECT value FROM jsonb_array_elements(p_content->'articles') LOOP
        v_id:=(v_article->>'postId')::UUID;
        INSERT INTO media_posts(id,slug,title,category,published_date,excerpt,content_body,cover_image_id,cover_alt,is_featured,status,sort_order,is_visible,updated_by)
        VALUES(v_id,btrim(v_article->>'slug'),btrim(v_article->>'title'),v_article->>'category',(v_article->>'publishedDate')::DATE,v_article->>'excerpt',v_article->>'content',(v_article->>'coverMediaId')::UUID,btrim(v_article->>'coverAlt'),COALESCE((v_article->>'isFeatured')::BOOLEAN,false),CASE WHEN COALESCE((v_article->>'isVisible')::BOOLEAN,true) THEN 'published'::content_status ELSE 'archived'::content_status END,(v_article->>'sortOrder')::INTEGER,COALESCE((v_article->>'isVisible')::BOOLEAN,true),p_actor)
        ON CONFLICT(id) DO UPDATE SET slug=EXCLUDED.slug,title=EXCLUDED.title,category=EXCLUDED.category,published_date=EXCLUDED.published_date,excerpt=EXCLUDED.excerpt,content_body=EXCLUDED.content_body,cover_image_id=EXCLUDED.cover_image_id,cover_alt=EXCLUDED.cover_alt,is_featured=EXCLUDED.is_featured,status=EXCLUDED.status,sort_order=EXCLUDED.sort_order,is_visible=EXCLUDED.is_visible,updated_by=p_actor;
        DELETE FROM media_asset_usage WHERE table_name='media_posts' AND record_id=v_id AND field_name='cover_image_id';
        INSERT INTO media_asset_usage(media_asset_id,table_name,record_id,field_name) VALUES((v_article->>'coverMediaId')::UUID,'media_posts',v_id,'cover_image_id') ON CONFLICT DO NOTHING;
    END LOOP;
    UPDATE media_posts SET status='archived',is_visible=false,updated_by=p_actor WHERE id NOT IN (SELECT (a->>'postId')::UUID FROM jsonb_array_elements(p_content->'articles') a);
END;
$$;

CREATE OR REPLACE FUNCTION save_media_page_draft(p_payload JSONB,p_expected_updated_at TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor UUID:=auth.uid(); v_role app_role; v_page UUID; v_source UUID; v_draft page_sections%ROWTYPE; v_published page_sections%ROWTYPE; v_id UUID; v_next INTEGER; v_old JSONB; v_new JSONB; v_revision INTEGER;
BEGIN
    IF v_actor IS NULL THEN RETURN jsonb_build_object('ok',false,'status',401,'code','ADMIN_AUTH_REQUIRED','error','Authentication is required.'); END IF;
    SELECT role INTO v_role FROM admin_profiles WHERE id=v_actor AND is_active=true;
    IF v_role IS NULL OR v_role NOT IN('super_admin','content_editor') THEN RETURN jsonb_build_object('ok',false,'status',403,'code','ADMIN_ROLE_FORBIDDEN','error','An active content administrator profile is required.'); END IF;
    PERFORM validate_media_page_payload(p_payload);
    BEGIN v_source:=(p_payload->>'id')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Invalid Media section ID' USING ERRCODE='22023'; END;
    SELECT id INTO v_page FROM pages WHERE slug='media-center' AND is_published=true FOR UPDATE;
    IF v_page IS NULL THEN RETURN jsonb_build_object('ok',false,'status',503,'code','MEDIA_PAGE_NOT_CONFIGURED','error','The Media Center page is not configured.'); END IF;
    SELECT * INTO v_draft FROM page_sections WHERE page_id=v_page AND section_key='media-page' AND status='draft' FOR UPDATE;
    IF v_draft.id IS NOT NULL THEN
        IF v_source<>v_draft.id OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('ok',false,'status',409,'code','MEDIA_PAGE_CONFLICT','error','The Media Center draft changed after this editor loaded it.'); END IF;
        v_id:=v_draft.id; v_old:=media_page_snapshot(v_id);
        UPDATE page_sections SET settings=p_payload->'content',is_visible=COALESCE((p_payload->>'isVisible')::BOOLEAN,true),updated_by=v_actor WHERE id=v_id;
    ELSE
        SELECT * INTO v_published FROM page_sections WHERE page_id=v_page AND section_key='media-page' AND status='published' FOR UPDATE;
        IF v_published.id IS NULL OR v_source<>v_published.id OR v_published.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('ok',false,'status',409,'code','MEDIA_PAGE_CONFLICT','error','Published Media Center content changed after this editor loaded it.'); END IF;
        SELECT COALESCE(max(version_number),0)+1 INTO v_next FROM page_sections WHERE page_id=v_page AND section_key='media-page';
        INSERT INTO page_sections(page_id,section_key,section_name,allowed_variant,sort_order,is_visible,status,version_number,settings,updated_by,supersedes_id)
        VALUES(v_page,'media-page','Media Center Catalogue','listing-and-detail',10,COALESCE((p_payload->>'isVisible')::BOOLEAN,true),'draft',v_next,p_payload->'content',v_actor,v_published.id) RETURNING id INTO v_id;
    END IF;
    PERFORM replace_media_page_media_usage(v_id,p_payload);
    v_new:=media_page_snapshot(v_id);
    SELECT COALESCE(max(version_number),0)+1 INTO v_revision FROM content_revisions WHERE table_name='page_sections' AND record_id=v_id;
    INSERT INTO content_revisions(table_name,record_id,revision_data,created_by,version_number,change_summary) VALUES('page_sections',v_id,v_new,v_actor,v_revision,CASE WHEN v_draft.id IS NULL THEN 'Created Media Center draft' ELSE 'Saved Media Center draft' END);
    INSERT INTO audit_logs(admin_id,action,table_name,record_id,old_values,new_values) VALUES(v_actor,CASE WHEN v_draft.id IS NULL THEN 'create_draft' ELSE 'update_draft' END,'page_sections',v_id,v_old,v_new);
    RETURN jsonb_build_object('ok',true,'data',v_new);
END;
$$;

CREATE OR REPLACE FUNCTION publish_media_page_draft(p_section_id UUID,p_expected_updated_at TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor UUID:=auth.uid(); v_role app_role; v_draft page_sections%ROWTYPE; v_published page_sections%ROWTYPE; v_old JSONB; v_previous JSONB; v_new JSONB; v_revision INTEGER;
BEGIN
    IF v_actor IS NULL THEN RETURN jsonb_build_object('ok',false,'status',401,'code','ADMIN_AUTH_REQUIRED','error','Authentication is required.'); END IF;
    SELECT role INTO v_role FROM admin_profiles WHERE id=v_actor AND is_active=true;
    IF v_role IS NULL OR v_role NOT IN('super_admin','content_editor') THEN RETURN jsonb_build_object('ok',false,'status',403,'code','ADMIN_ROLE_FORBIDDEN','error','An active content administrator profile is required.'); END IF;
    SELECT * INTO v_draft FROM page_sections WHERE id=p_section_id AND section_key='media-page' AND status='draft' FOR UPDATE;
    IF v_draft.id IS NULL THEN RETURN jsonb_build_object('ok',false,'status',404,'code','MEDIA_PAGE_DRAFT_NOT_FOUND','error','The Media Center draft no longer exists.'); END IF;
    IF p_expected_updated_at IS NULL OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('ok',false,'status',409,'code','MEDIA_PAGE_CONFLICT','error','The Media Center draft changed after this editor loaded it.'); END IF;
    v_old:=media_page_snapshot(v_draft.id); PERFORM validate_media_page_payload(v_old); PERFORM sync_media_catalog(v_draft.settings,v_actor);
    SELECT * INTO v_published FROM page_sections WHERE page_id=v_draft.page_id AND section_key='media-page' AND status='published' FOR UPDATE;
    IF v_published.id IS NOT NULL THEN v_previous:=media_page_snapshot(v_published.id); UPDATE page_sections SET status='archived',updated_by=v_actor WHERE id=v_published.id; INSERT INTO audit_logs(admin_id,action,table_name,record_id,old_values,new_values) VALUES(v_actor,'archive_published','page_sections',v_published.id,v_previous,media_page_snapshot(v_published.id)); END IF;
    UPDATE page_sections SET status='published',published_at=clock_timestamp(),published_by=v_actor,updated_by=v_actor WHERE id=v_draft.id;
    v_new:=media_page_snapshot(v_draft.id);
    SELECT COALESCE(max(version_number),0)+1 INTO v_revision FROM content_revisions WHERE table_name='page_sections' AND record_id=v_draft.id;
    INSERT INTO content_revisions(table_name,record_id,revision_data,created_by,version_number,change_summary) VALUES('page_sections',v_draft.id,v_new,v_actor,v_revision,'Published Media Center page and canonical article catalogue');
    INSERT INTO audit_logs(admin_id,action,table_name,record_id,old_values,new_values) VALUES(v_actor,'publish','page_sections',v_draft.id,v_old,v_new);
    RETURN jsonb_build_object('ok',true,'data',v_new);
END;
$$;

REVOKE ALL ON FUNCTION media_page_snapshot(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION validate_media_page_payload(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION replace_media_page_media_usage(UUID,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION sync_media_catalog(JSONB,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION save_media_page_draft(JSONB,TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION publish_media_page_draft(UUID,TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION media_page_snapshot(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION save_media_page_draft(JSONB,TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_media_page_draft(UUID,TIMESTAMPTZ) TO authenticated;

DO $$
DECLARE
    v_page UUID; v_section UUID; v_header UUID; v_hero1 UUID; v_hero2 UUID; v_hero3 UUID; v_completed UUID; v_ongoing UUID;
    v_raw JSONB:=$seed$[{"slug":"flats-sale-at-an-affordable-price-in-bashundhara-residential-area-dhaka","title":"Flats sale at an affordable price in Bashundhara residential area Dhaka","category":"Blogs & Articles","date":"March 15, 2026","image":"/assets/hero1.png","content":"From selling small flats to buying luxurious properties has always been at the top of the highest priorities of land proprietors. Not only the landlord but also those who live their lives in the rental apartment dreaming of their own small home, especially in Dhaka city or its surrounding areas. With the passage of time, the prices of flats in Bashundhara R/A have changed due to developmental enhancements, access to high-standard schools, universities, medical hospitals, and shopping complexes.\n\nBashundhara Residential Area remains a top choice for growing families seeking premium urban coordinates, peaceful neighborhoods, and structured safety parameters. Dhaka Heights Developments provides affordable luxury configurations ranging from 1500 to 2400 SFT flats with top structural safety specifications, synchronized back-up power, and beautifully landscaped common areas, making your dream of owning a premium home a seamless reality.","publishedDate":"2026-03-15"},{"slug":"ground-breaking-ceremony-of-dhaka-heights-green-heaven","title":"Ground Breaking Ceremony of Dhaka Heights Green Heaven","category":"Latest News","date":"16 February 2026","image":"/assets/hero2.png","content":"Dhaka Heights Construction Limited proudly hosted the launching ceremony of its newest project, Dhaka Heights Green Heaven. Designed as a perfect blend of serene lake views and urban greenery, this project introduces a refined lifestyle enriched with modern amenities.\n\nOn 16 February 2026, Dhaka Heights Construction Limited hosted the groundbreaking ceremony of its newest project, Dhaka Heights Green Heaven, in Jolshiri Abashon. The groundbreaking was marked with prayers and corporate addresses by our Managing Director Md. Shahadat Hossain along with senior engineering consultants. The project features natural light integration, structural compliance certificates, and a custom water treatment loop.","publishedDate":"2026-02-16"},{"slug":"dhaka-heights-construction-ltd-jcl-is-a-bangladeshi-real-estate-developer-company-established-in-the-year-2008","title":"Dhaka Heights construction ltd (JCL) is a Bangladeshi real estate developer company established in the year 2008","category":"Latest News","date":"March 15, 2026","image":"/assets/hero1.png","content":"DHAKA HEIGHTS Construction LTD (JCL) is a Bangladeshi real estate developer company established in the year 2008. Within a short span of 18 years, JCL has developed various numbers of projects in Dhaka, ranging from residential, and commercial to land development.\n\nOur structural safety guidelines integrate state-of-the-art earthquake resistance calculations, dual-loop electrical sub-stations, structural wind-load designs, and high-performance glass installations, delivering absolute safety, structural stability, and design prestige to corporate partners and landowners.","publishedDate":"2026-03-15"},{"slug":"জমকালো-আয়োজনে-ঢাকা হাইটস-গ্রুপের-১৯তম-প্রতিষ্ঠাবার্ষিকী-পালন","title":"জমকালো আয়োজনে ঢাকা হাইটস প্রোপার্টিজ লিমিটেডের ১৯তম প্রতিষ্ঠাবার্ষিকী পালন","category":"Latest News","date":"March 15, 2026","image":"/assets/hero2.png","content":"দেশের আবাসন শিল্পের অন্যতম শীর্ষ প্রতিষ্ঠান ঢাকা হাইটস প্রোপার্টিজ লিমিটেড (Dhaka Heights Properties Limited) ১৮ বছর পেরিয়ে ১৯ বছরে পদার্পণ করেছে। দীর্ঘ এই পথচলা এবং সাফল্যের ধারাবাহিকতাকে উদযাপন করতে রাজধানীর জলসিড়ি সেন্ট্রাল গল্ফ ক্লাবে এক জমকালো অনুষ্ঠানের আয়োজন করা হয়।\n\nউক্ত অনুষ্ঠানে ঢাকা হাইটস প্রোপার্টিজ লিমিটেডের চেয়ারম্যান ও ব্যবস্থাপনা পরিচালক আলহাজ্ব মো: শাহাদাত হোসেন প্রধান অতিথি হিসেবে উপস্থিত ছিলেন। তিনি তাঁর বক্তব্যে জানান যে, ঢাকা হাইটস প্রোপার্টিজ লিমিটেড সবসময়ই গুনগত মান, আধুনিক সুযোগ-সুবিধা এবং নির্দিষ্ট সময়ে গ্রাহকদের ফ্ল্যাট বুঝিয়ে দিতে প্রতিজ্ঞাবদ্ধ। গ্রাহক এবং ভূমি মালিকদের আস্থার কারণেই ঢাকা হাইটস প্রোপার্টিজ লিমিটেড আজকে এই অবস্থানে আসতে পেরেছে। ঢাকা হাইটস প্রোপার্টিজ লিমিটেডের সকল কর্মকর্তা, শুভানুধ্যায়ী ও গ্রাহকদের প্রতি কৃতজ্ঞতা প্রকাশ করেন তিনি।","publishedDate":"2026-03-15"},{"slug":"১৮-বছর-পেরিয়ে-১৯-এ-ঢাকা হাইটস-গ্রুপ-জমকালো-আয়োজনে-প্রতিষ্ঠাবার্ষিকী-পালন","title":"১৮ বছর পেরিয়ে ১৯-এ ঢাকা হাইটস প্রোপার্টিজ লিমিটেড: জমকালো আয়োজনে প্রতিষ্ঠাবার্ষিকী পালন","category":"Latest News","date":"March 15, 2026","image":"/assets/hero3.png","content":"দেশের আবাসন শিল্পের অন্যতম শীর্ষ প্রতিষ্ঠান ঢাকা হাইটস প্রোপার্টিজ লিমিটেড (Dhaka Heights Properties Limited) ১৮ বছর পেরিয়ে ১৯ বছরে পদার্পণ করেছে। দীর্ঘ এই পথচলা এবং সাফল্যের ধারাবাহিকতাকে উদযাপন করতে রাজধানীর জলসিড়ি সেন্ট্রাল গল্ফ ক্লাবে এক জমকালো অনুষ্ঠানের আয়োজন করা হয়।\n\nঅনুষ্ঠানে ঢাকা হাইটস প্রোপার্টিজ লিমিটেডের ব্যবস্থাপনা পরিচালক মো: শাহাদাত হোসেন বলেন, 'গ্রাহকদের সন্তুষ্টি ও সময়মতো মানসম্মত আবাসন বুঝিয়ে দেয়াই আমাদের মূল লক্ষ্য।' দেশের অগ্রযাত্রায় আবাসন খাতের অবদান উল্লেখ করে তিনি ভবিষ্যতেও পরিবেশবান্ধব ও টেকসই প্রকল্প নির্মাণে ঢাকা হাইটস প্রোপার্টিজ লিমিটেডের প্রতিশ্রুতি পুনর্ব্যক্ত করেন।","publishedDate":"2026-03-15"},{"slug":"top-10-building-construction-companies-in-bashundhara-dhaka-bangladesh-2023","title":"Top 10 Building Construction Companies in Bashundhara, Dhaka, Bangladesh – 2023","category":"Blogs & Articles","date":"March 15, 2026","image":"/assets/hero2.png","content":"Bashundhara Residential Area has become the epicenter of modern living in Dhaka, creating high demand for premium building developers. Choosing a constructor requires analyzing safety credentials, timely handovers, and material quality.\n\nDhaka Heights Construction Limited has earned its spot in the top tier through a strict compliance log, standard double-basement shoring calculations, premium high-tensile steel reinforce placement, and a high-performance workforce.","publishedDate":"2026-03-15"},{"slug":"top-20-real-estate-companies-in-dhaka-bangladesh-2023","title":"Top 20 real estate companies in Dhaka, Bangladesh 2023","category":"Blogs & Articles","date":"March 15, 2026","image":"/assets/hero3.png","content":"Finding a reliable developer to realize their aspirations of owning a building is the dream of every landowner in Bangladesh due to the buzz surrounding this industry.\n\nDhaka Heights Development Limited came to Bangladesh real estate market with the motto 'Your Prestigious Living' in an effort to shift the narrative. Dhaka Heights Development Limited has completely redefined customer service, transparency in project schedules, and premium structural engineering standards in the capital. Our projects in Bashundhara and Jolshiri showcase structural durability and high appreciation yields.","publishedDate":"2026-03-15"},{"slug":"we-deeply-value-your-trust-partnership-encouragement","title":"We Deeply Value Your Trust, Partnership & Encouragement","category":"Latest News","date":"March 15, 2026","image":"/assets/hero1.png","content":"We would like to express our sincere appreciation to The Corporate Consultancy, City Bank PLC, United Finance PLC, Prime Bank PLC, DBH Finance PLC and all other institutions & well-wishers for their gracious birthday wishes, continued trust, professionalism and valued collaboration.\n\nYour unwavering support and commitment to excellence significantly contribute to our joint success in shaping modern living standards across Dhaka.","publishedDate":"2026-03-15"},{"slug":"land-owner-satisfying-review-dhaka-heights-group-ii-dhaka-heights-silver-spring","title":"Land Owner Satisfying Review | | Project Handover | II Dhaka Heights Silver Spring","category":"Latest News","date":"March 15, 2026","image":"/assets/hero2.png","content":"Dhaka Heights Properties Limited held a key handover ceremony for landowners at Dhaka Heights Silver Spring. The landowners expressed deep satisfaction with the timely execution of construction blocks, transparent communication, and premium interior marble setups.\n\nWe remain committed to delivering the highest caliber of residential units that safeguard landowner trusts and reflect modern architectural sophistication.","publishedDate":"2026-03-15"},{"slug":"land-owner-satisfying-review-dhaka-heights-group-ii-dhaka-heights-sunsplash","title":"Land Owner Satisfying Review | | Project Handover | II Dhaka Heights Sunsplash","category":"Latest News","date":"March 15, 2026","image":"/assets/hero3.png","content":"Landowners at Dhaka Heights Sunsplash shared detailed reviews praising Dhaka Heights Construction for implementing smart home safety frameworks, continuous backup generator lines, and premium bathroom tiles.\n\nEvery handover is a milestone of Dhaka Heights Properties Limited's commitment to building lasting partnerships with our landowners.","publishedDate":"2026-03-15"},{"slug":"dhaka-heights-muztaba-mansion-basement-casting-honorable-managing-director-sir-visit-the-project","title":"Dhaka Heights Muztaba Mansion || Basement Casting || Honorable Managing Director Sir visit the Project","category":"Latest News","date":"March 15, 2026","image":"/assets/hero1.png","content":"Honorable Managing Director Md. Shahadat Hossain visited the Dhaka Heights Muztaba Mansion site to inspect the basement concrete casting works. He emphasized structural steel alignment and safety parameters.\n\nThe engineering team confirmed that the project compiles with structural durability standards and concrete density checks.","publishedDate":"2026-03-15"},{"slug":"dhaka-heights-asha-purna-ii-project-handover-ceremony","title":"Dhaka Heights Asha Purna II Project Handover Ceremony","category":"Latest News","date":"March 15, 2026","image":"/assets/hero2.png","content":"Dhaka Heights Properties Limited hosted the key handover ceremony for Dhaka Heights Asha Purna II in Bashundhara R/A. The residential units were successfully delivered with standard electrical fittings and luxury lobby fixtures.\n\nWe appreciate the support of pre-booked buyers and landowners in making this project a huge architectural success.","publishedDate":"2026-03-15"},{"slug":"client-satisfying-review-dhaka-heights-sun-splash-handover","title":"Client Satisfying Review || Dhaka Heights Sun Splash Handover","category":"Latest News","date":"March 15, 2026","image":"/assets/hero3.png","content":"Client satisfaction remains our prime motto. Our buyers shared reviews noting that the building structure, elevator transition, and landscaped rooftops exceeded their quality expectations.\n\nEvery positive feedback drives Dhaka Heights Developments to continuously elevate residential luxury boundaries in Dhaka.","publishedDate":"2026-03-15"},{"slug":"land-owner-satisfying-review-project-handover","title":"Land Owner Satisfying Review | | Project Handover |","category":"Latest News","date":"March 15, 2026","image":"/assets/hero1.png","content":"Landowners expressed heartfelt appreciation to Dhaka Heights Developments for transparent deal completions, structural integrity, and dedicated facilities management support post-handover.\n\nWe construct architectural landmarks that stand the test of time and provide a legacy of asset security.","publishedDate":"2026-03-15"},{"slug":"how-to-choose-best-real-estate-company-for-flat-purchase-in-bashundhara-residential-area-dhaka","title":"How to choose best real estate company for flat purchase in Bashundhara residential area Dhaka","category":"Blogs & Articles","date":"March 15, 2026","image":"/assets/hero3.png","content":"1. Research the reputation of the company: Start by researching the reputation of the company you are considering. Look for information about their track record, previous projects, and customer reviews.\n2. Check construction standards: Verify safety compliance cards, structural calculation logs, and raw cement grades.\n3. Transparent terms: Review landowner/buyer contracts to prevent layout shifts. Dhaka Heights Developments Ltd maintains 100% transparent schedules.","publishedDate":"2026-03-15"},{"slug":"the-10-best-real-estate-companies-in-bangladesh-2023","title":"The 10 best real estate companies in Bangladesh 2023","category":"Blogs & Articles","date":"March 15, 2026","image":"/assets/hero1.png","content":"Housing is a core human necessity. Everyone dreams of owning a home that combines beauty, layout efficiency, and premium security systems.\n\nThe leading real estate companies in Bangladesh are recognized by construction speed, interior quality, and corporate integrity. Dhaka Heights developments remains in the elite top-10 list by constantly delivering on landowner promises and building landmark spaces.","publishedDate":"2026-03-15"}]$seed$::jsonb; v_articles JSONB:='[]'::jsonb; v_article JSONB; v_content JSONB; v_snapshot JSONB;
    v_post UUID; v_cover UUID; v_index INTEGER:=0;
BEGIN
    SELECT id INTO v_page FROM pages WHERE slug='media-center';
    SELECT id INTO v_header FROM media_assets WHERE public_id='dhaka-heights/dev/media_bg' AND is_archived=false;
    SELECT id INTO v_hero1 FROM media_assets WHERE public_id='dhaka-heights/dev/hero1' AND is_archived=false;
    SELECT id INTO v_hero2 FROM media_assets WHERE public_id='dhaka-heights/dev/hero2' AND is_archived=false;
    SELECT id INTO v_hero3 FROM media_assets WHERE public_id='dhaka-heights/dev/hero3' AND is_archived=false;
    SELECT id INTO v_completed FROM media_assets WHERE public_id='dhaka-heights/dev/proj_completed' AND is_archived=false;
    SELECT id INTO v_ongoing FROM media_assets WHERE public_id='dhaka-heights/dev/proj_ongoing' AND is_archived=false;
    IF v_page IS NULL OR v_header IS NULL OR v_hero1 IS NULL OR v_hero2 IS NULL OR v_hero3 IS NULL OR v_completed IS NULL OR v_ongoing IS NULL THEN RAISE EXCEPTION 'Media page and canonical media assets are required'; END IF;
    IF EXISTS(SELECT 1 FROM page_sections WHERE page_id=v_page AND section_key='media-page' AND status='published') THEN RETURN; END IF;
    FOR v_article IN SELECT value FROM jsonb_array_elements(v_raw) LOOP
        v_index:=v_index+1;
        SELECT id INTO v_post FROM media_posts WHERE slug=v_article->>'slug';
        v_post:=COALESCE(v_post,gen_random_uuid());
        v_cover:=CASE v_article->>'image' WHEN '/assets/hero1.png' THEN v_hero1 WHEN '/assets/hero2.png' THEN v_hero2 ELSE v_hero3 END;
        v_articles:=v_articles||jsonb_build_array(jsonb_build_object(
            'postId',v_post,'slug',v_article->>'slug','title',v_article->>'title','category',v_article->>'category',
            'displayDate',v_article->>'date','publishedDate',v_article->>'publishedDate',
            'excerpt',left(regexp_replace(v_article->>'content','\s+',' ','g'),180),
            'content',v_article->>'content','coverMediaId',v_cover,'coverAlt',v_article->>'title',
            'author','Dhaka Heights Properties Limited Press Desk','isFeatured',v_index<=3,
            'sortOrder',v_index*10,'isVisible',true
        ));
    END LOOP;
    v_content:=jsonb_build_object(
      'header',jsonb_build_object('title','Media Center','subtitle','Latest Corporate Announcements, Real Estate Blogs, and Virtual Tours','breadcrumbLabel','Media Center','mediaId',v_header,'imageAlt','Dhaka Heights Media Center skyline'),
      'itemsPerPage',3,
      'labels',jsonb_build_object('newsTab','News & Press','blogsTab','Blogs & Articles','videosTab','Virtual Tours','newsReadLabel','Read Press Release','blogReadLabel','Read Full Article','videoFormatLabel','Format: Virtual 360 Walkthrough','previousLabel','Prev','nextLabel','Next','closeVideoLabel','Close walkthrough','loadingLabel','Loading Media Center...'),
      'seo',jsonb_build_object('title','Media Center | Dhaka Heights Properties Limited','description','Read Dhaka Heights corporate news, property insights, construction updates and virtual project tours.','canonicalUrl','/media-center'),
      'detail',jsonb_build_object(
        'publishedPrefix','Published on','mediaBreadcrumb','Media Center','detailBreadcrumb','Detail View','defaultAuthor','Dhaka Heights Properties Limited Press Desk',
        'pullQuote','Our mission is to construct spaces that transcend time, marrying premium raw components with state-of-the-art architecture to offer a lifestyle of unparalleled prestige.',
        'pullQuoteAuthor','Md. Shahadat Hossain, Managing Director',
        'closingParagraphs',jsonb_build_array(
          'This landmark development continues Dhaka Heights Properties Limited''s rich legacy of engineering innovation and luxury styling. Over the past 18 years, our group has consistently focused on delivering structural resilience and architectural elegance. Every project is executed with a strict adherence to international building codes, utilizing high-performance materials, premium structural glazing, and green building systems to ensure long-term value for our clients and landowners.',
          'Our team of dedicated engineers and architects works in unison to ensure that each space is not only visually striking but also optimized for ultimate comfort and functional efficiency. As we look to the future, Dhaka Heights Properties Limited remains committed to shaping the skyline of Dhaka with sustainable, state-of-the-art living environments.'
        ),
        'backLabel','Back to Media Center','shareLabel','Share:','notFoundTitle','Article Not Found','notFoundBody','The requested media article does not exist.','returnLabel','Return to Media Center'
      ),
      'articles',v_articles,
      'videos',jsonb_build_array(
        jsonb_build_object('videoId',gen_random_uuid(),'title','Dhaka Heights Sun Splash Handover','duration','4:15','thumbnailMediaId',v_completed,'thumbnailAlt','Dhaka Heights Sun Splash handover virtual tour','embedUrl','https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1','sortOrder',10,'isVisible',true),
        jsonb_build_object('videoId',gen_random_uuid(),'title','Green Heaven Groundbreaking Ceremony','duration','3:30','thumbnailMediaId',v_ongoing,'thumbnailAlt','Green Heaven groundbreaking virtual tour','embedUrl','https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1','sortOrder',20,'isVisible',true),
        jsonb_build_object('videoId',gen_random_uuid(),'title','Muztaba Mansion Basement Casting','duration','2:10','thumbnailMediaId',v_hero1,'thumbnailAlt','Muztaba Mansion basement casting virtual tour','embedUrl','https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1','sortOrder',30,'isVisible',true)
      )
    );
    INSERT INTO page_sections(page_id,section_key,section_name,allowed_variant,sort_order,is_visible,status,version_number,settings,published_at)
    VALUES(v_page,'media-page','Media Center Catalogue','listing-and-detail',10,true,'published',1,v_content,clock_timestamp()) RETURNING id INTO v_section;
    v_snapshot:=media_page_snapshot(v_section);
    PERFORM validate_media_page_payload(v_snapshot); PERFORM replace_media_page_media_usage(v_section,v_snapshot); PERFORM sync_media_catalog(v_content,NULL);
    INSERT INTO content_revisions(table_name,record_id,revision_data,version_number,change_summary) VALUES('page_sections',v_section,v_snapshot,1,'Seeded initial published Media Center catalogue');
    INSERT INTO audit_logs(action,table_name,record_id,new_values) VALUES('migration_seed','page_sections',v_section,v_snapshot);
END;
$$;

COMMIT;

