BEGIN;

DROP TRIGGER IF EXISTS set_inquiries_updated_at ON inquiries;
CREATE TRIGGER set_inquiries_updated_at BEFORE UPDATE ON inquiries
FOR EACH ROW EXECUTE FUNCTION set_home_content_updated_at();

DROP POLICY IF EXISTS "Public Read Published Page Sections" ON page_sections;
CREATE POLICY "Public Read Published Page Sections" ON page_sections
    FOR SELECT USING (
        status='published'
        AND (is_visible=true OR section_key IN (
            'hero-slider','about-corporate-home','statistics-counter','featured-projects-home',
            'commitment-quote','media-highlights-home','partners-carousel','contact-section-home',
            'about-page','projects-page','concerns-page','media-page','career-page','contact-page'
        ))
        AND EXISTS (SELECT 1 FROM pages p WHERE p.id=page_sections.page_id AND p.is_published=true)
    );

DROP POLICY IF EXISTS "Public Insert Inquiries" ON inquiries;
DROP POLICY IF EXISTS "Sales Manager Manage Inquiries" ON inquiries;
DROP POLICY IF EXISTS "Sales Read Inquiries" ON inquiries;
DROP POLICY IF EXISTS "Sales Update Inquiries" ON inquiries;
CREATE POLICY "Sales Read Inquiries" ON inquiries FOR SELECT USING (get_admin_role() IN ('super_admin','sales_manager'));
CREATE POLICY "Sales Update Inquiries" ON inquiries FOR UPDATE USING (get_admin_role() IN ('super_admin','sales_manager')) WITH CHECK (get_admin_role() IN ('super_admin','sales_manager'));

CREATE OR REPLACE FUNCTION contact_page_snapshot(p_section_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
SELECT jsonb_build_object(
    'id',ps.id,'pageId',ps.page_id,'sectionKey',ps.section_key,'status',ps.status,
    'versionNumber',ps.version_number,'isVisible',ps.is_visible,'content',ps.settings,
    'updatedAt',ps.updated_at,'updatedBy',ps.updated_by,'publishedAt',ps.published_at,'publishedBy',ps.published_by
)
FROM page_sections ps WHERE ps.id=p_section_id AND ps.section_key='contact-page';
$$;

CREATE OR REPLACE FUNCTION validate_contact_page_payload(p_payload JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_content JSONB:=p_payload->'content'; v_card JSONB; v_option JSONB; v_id UUID; v_url TEXT; v_key TEXT;
BEGIN
    IF p_payload->>'sectionKey' IS DISTINCT FROM 'contact-page' THEN RAISE EXCEPTION 'Invalid Contact page section key' USING ERRCODE='22023'; END IF;
    IF jsonb_typeof(v_content)<>'object' OR jsonb_typeof(v_content->'infoCards')<>'array' OR jsonb_typeof(v_content->'subjectOptions')<>'array' THEN RAISE EXCEPTION 'Contact content must include card and subject arrays' USING ERRCODE='22023'; END IF;
    IF jsonb_array_length(v_content->'infoCards') NOT BETWEEN 1 AND 8 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_content->'infoCards') c WHERE COALESCE((c->>'isVisible')::BOOLEAN,true)) THEN RAISE EXCEPTION 'Contact page requires 1 to 8 cards and at least one visible card' USING ERRCODE='22023'; END IF;
    IF jsonb_array_length(v_content->'subjectOptions') NOT BETWEEN 1 AND 12 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_content->'subjectOptions') o WHERE COALESCE((o->>'isVisible')::BOOLEAN,true)) THEN RAISE EXCEPTION 'Contact page requires 1 to 12 subjects and at least one visible subject' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_content->'infoCards') c GROUP BY c->>'itemId' HAVING count(*)>1) OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_content->'subjectOptions') o GROUP BY o->>'itemId' HAVING count(*)>1) OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_content->'subjectOptions') o GROUP BY o->>'value' HAVING count(*)>1) THEN RAISE EXCEPTION 'Contact item IDs and subject values must be unique' USING ERRCODE='23505'; END IF;
    FOREACH v_key IN ARRAY ARRAY['title','subtitle','breadcrumbLabel'] LOOP IF COALESCE(length(btrim(v_content#>>ARRAY['header',v_key])),0) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'Contact header copy is incomplete' USING ERRCODE='22023'; END IF; END LOOP;
    FOREACH v_key IN ARRAY ARRAY['heading','description','namePlaceholder','emailPlaceholder','phonePlaceholder','subjectLabel','messagePlaceholder','submitLabel','submittingLabel','successMessage','errorMessage','previewNotice'] LOOP IF COALESCE(length(btrim(v_content#>>ARRAY['form',v_key])),0) NOT BETWEEN 1 AND 600 THEN RAISE EXCEPTION 'Contact form copy is incomplete' USING ERRCODE='22023'; END IF; END LOOP;
    FOREACH v_key IN ARRAY ARRAY['tag','heading','description','iframeUrl','iframeTitle'] LOOP IF COALESCE(length(btrim(v_content#>>ARRAY['map',v_key])),0) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Contact map configuration is incomplete' USING ERRCODE='22023'; END IF; END LOOP;
    IF v_content#>>'{map,iframeUrl}' !~ '^https://' THEN RAISE EXCEPTION 'Contact map URL must use HTTPS' USING ERRCODE='22023'; END IF;
    IF COALESCE(length(btrim(v_content#>>'{seo,title}')),0) NOT BETWEEN 1 AND 180 OR COALESCE(length(btrim(v_content#>>'{seo,description}')),0) NOT BETWEEN 1 AND 500 OR v_content#>>'{seo,canonicalUrl}' !~ '^/[a-z0-9/-]*$' THEN RAISE EXCEPTION 'Contact SEO configuration is invalid' USING ERRCODE='22023'; END IF;
    FOR v_card IN SELECT value FROM jsonb_array_elements(v_content->'infoCards') LOOP
        BEGIN v_id:=(v_card->>'itemId')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Contact card IDs must be valid UUIDs' USING ERRCODE='22023'; END;
        IF COALESCE(length(btrim(v_card->>'title')),0) NOT BETWEEN 1 AND 120 OR COALESCE(length(btrim(v_card->>'body')),0) NOT BETWEEN 1 AND 500 OR COALESCE(v_card->>'iconClass','') !~ '^fa-(solid|brands) fa-[a-z0-9-]+$' THEN RAISE EXCEPTION 'Every Contact card requires valid title, body and icon classes' USING ERRCODE='22023'; END IF;
        IF COALESCE(v_card->>'ctaTarget','_self') NOT IN('_self','_blank') THEN RAISE EXCEPTION 'Contact CTA target is invalid' USING ERRCODE='22023'; END IF;
        IF NULLIF(btrim(v_card->>'ctaLabel'),'') IS NOT NULL THEN v_url:=btrim(v_card->>'ctaUrl'); IF v_url !~ '^https://' THEN RAISE EXCEPTION 'Contact card CTA URLs must use HTTPS' USING ERRCODE='22023'; END IF; END IF;
    END LOOP;
    FOR v_option IN SELECT value FROM jsonb_array_elements(v_content->'subjectOptions') LOOP
        BEGIN v_id:=(v_option->>'itemId')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Contact subject IDs must be valid UUIDs' USING ERRCODE='22023'; END;
        IF COALESCE(v_option->>'value','') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' OR COALESCE(length(btrim(v_option->>'label')),0) NOT BETWEEN 1 AND 150 THEN RAISE EXCEPTION 'Every Contact subject requires a valid value and label' USING ERRCODE='22023'; END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION save_contact_page_draft(p_payload JSONB,p_expected_updated_at TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor UUID:=auth.uid(); v_role app_role; v_page UUID; v_source UUID; v_draft page_sections%ROWTYPE; v_published page_sections%ROWTYPE; v_id UUID; v_next INTEGER; v_old JSONB; v_new JSONB; v_revision INTEGER;
BEGIN
    IF v_actor IS NULL THEN RETURN jsonb_build_object('ok',false,'status',401,'code','ADMIN_AUTH_REQUIRED','error','Authentication is required.'); END IF;
    SELECT role INTO v_role FROM admin_profiles WHERE id=v_actor AND is_active=true;
    IF v_role IS NULL OR v_role NOT IN('super_admin','content_editor','sales_manager') THEN RETURN jsonb_build_object('ok',false,'status',403,'code','ADMIN_ROLE_FORBIDDEN','error','An active Contact administrator profile is required.'); END IF;
    PERFORM validate_contact_page_payload(p_payload);
    BEGIN v_source:=(p_payload->>'id')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Invalid Contact section ID' USING ERRCODE='22023'; END;
    SELECT id INTO v_page FROM pages WHERE slug='contact' AND is_published=true FOR UPDATE;
    IF v_page IS NULL THEN RETURN jsonb_build_object('ok',false,'status',503,'code','CONTACT_PAGE_NOT_CONFIGURED','error','The Contact page is not configured.'); END IF;
    SELECT * INTO v_draft FROM page_sections WHERE page_id=v_page AND section_key='contact-page' AND status='draft' FOR UPDATE;
    IF v_draft.id IS NOT NULL THEN
        IF v_source<>v_draft.id OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('ok',false,'status',409,'code','CONTACT_PAGE_CONFLICT','error','The Contact draft changed after this editor loaded it.'); END IF;
        v_id:=v_draft.id; v_old:=contact_page_snapshot(v_id);
        UPDATE page_sections SET settings=p_payload->'content',is_visible=COALESCE((p_payload->>'isVisible')::BOOLEAN,true),updated_by=v_actor WHERE id=v_id;
    ELSE
        SELECT * INTO v_published FROM page_sections WHERE page_id=v_page AND section_key='contact-page' AND status='published' FOR UPDATE;
        IF v_published.id IS NULL OR v_source<>v_published.id OR v_published.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('ok',false,'status',409,'code','CONTACT_PAGE_CONFLICT','error','Published Contact content changed after this editor loaded it.'); END IF;
        SELECT COALESCE(max(version_number),0)+1 INTO v_next FROM page_sections WHERE page_id=v_page AND section_key='contact-page';
        INSERT INTO page_sections(page_id,section_key,section_name,allowed_variant,sort_order,is_visible,status,version_number,settings,updated_by,supersedes_id)
        VALUES(v_page,'contact-page','Contact Page','contact-page',10,COALESCE((p_payload->>'isVisible')::BOOLEAN,true),'draft',v_next,p_payload->'content',v_actor,v_published.id) RETURNING id INTO v_id;
    END IF;
    v_new:=contact_page_snapshot(v_id);
    SELECT COALESCE(max(version_number),0)+1 INTO v_revision FROM content_revisions WHERE table_name='page_sections' AND record_id=v_id;
    INSERT INTO content_revisions(table_name,record_id,revision_data,created_by,version_number,change_summary) VALUES('page_sections',v_id,v_new,v_actor,v_revision,CASE WHEN v_draft.id IS NULL THEN 'Created Contact page draft' ELSE 'Saved Contact page draft' END);
    INSERT INTO audit_logs(admin_id,action,table_name,record_id,old_values,new_values) VALUES(v_actor,CASE WHEN v_draft.id IS NULL THEN 'create_draft' ELSE 'update_draft' END,'page_sections',v_id,v_old,v_new);
    RETURN jsonb_build_object('ok',true,'data',v_new);
END;
$$;

CREATE OR REPLACE FUNCTION publish_contact_page_draft(p_section_id UUID,p_expected_updated_at TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor UUID:=auth.uid(); v_role app_role; v_draft page_sections%ROWTYPE; v_published page_sections%ROWTYPE; v_old JSONB; v_previous JSONB; v_new JSONB; v_revision INTEGER;
BEGIN
    IF v_actor IS NULL THEN RETURN jsonb_build_object('ok',false,'status',401,'code','ADMIN_AUTH_REQUIRED','error','Authentication is required.'); END IF;
    SELECT role INTO v_role FROM admin_profiles WHERE id=v_actor AND is_active=true;
    IF v_role IS NULL OR v_role NOT IN('super_admin','content_editor','sales_manager') THEN RETURN jsonb_build_object('ok',false,'status',403,'code','ADMIN_ROLE_FORBIDDEN','error','An active Contact administrator profile is required.'); END IF;
    SELECT * INTO v_draft FROM page_sections WHERE id=p_section_id AND section_key='contact-page' AND status='draft' FOR UPDATE;
    IF v_draft.id IS NULL THEN RETURN jsonb_build_object('ok',false,'status',404,'code','CONTACT_PAGE_DRAFT_NOT_FOUND','error','The Contact draft no longer exists.'); END IF;
    IF p_expected_updated_at IS NULL OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('ok',false,'status',409,'code','CONTACT_PAGE_CONFLICT','error','The Contact draft changed after this editor loaded it.'); END IF;
    v_old:=contact_page_snapshot(v_draft.id); PERFORM validate_contact_page_payload(v_old);
    SELECT * INTO v_published FROM page_sections WHERE page_id=v_draft.page_id AND section_key='contact-page' AND status='published' FOR UPDATE;
    IF v_published.id IS NOT NULL THEN v_previous:=contact_page_snapshot(v_published.id); UPDATE page_sections SET status='archived',updated_by=v_actor WHERE id=v_published.id; INSERT INTO audit_logs(admin_id,action,table_name,record_id,old_values,new_values) VALUES(v_actor,'archive_published','page_sections',v_published.id,v_previous,contact_page_snapshot(v_published.id)); END IF;
    UPDATE page_sections SET status='published',published_at=clock_timestamp(),published_by=v_actor,updated_by=v_actor WHERE id=v_draft.id;
    v_new:=contact_page_snapshot(v_draft.id);
    SELECT COALESCE(max(version_number),0)+1 INTO v_revision FROM content_revisions WHERE table_name='page_sections' AND record_id=v_draft.id;
    INSERT INTO content_revisions(table_name,record_id,revision_data,created_by,version_number,change_summary) VALUES('page_sections',v_draft.id,v_new,v_actor,v_revision,'Published Contact page');
    INSERT INTO audit_logs(admin_id,action,table_name,record_id,old_values,new_values) VALUES(v_actor,'publish','page_sections',v_draft.id,v_old,v_new);
    RETURN jsonb_build_object('ok',true,'data',v_new);
END;
$$;

REVOKE ALL ON FUNCTION contact_page_snapshot(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION validate_contact_page_payload(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION save_contact_page_draft(JSONB,TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION publish_contact_page_draft(UUID,TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION contact_page_snapshot(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION save_contact_page_draft(JSONB,TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_contact_page_draft(UUID,TIMESTAMPTZ) TO authenticated;

DO $$
DECLARE v_page UUID; v_section UUID; v_content JSONB; v_snapshot JSONB;
BEGIN
    SELECT id INTO v_page FROM pages WHERE slug='contact';
    IF v_page IS NULL THEN RAISE EXCEPTION 'Contact page record is required'; END IF;
    IF EXISTS(SELECT 1 FROM page_sections WHERE page_id=v_page AND section_key='contact-page' AND status='published') THEN RETURN; END IF;
    v_content:=jsonb_build_object(
      'header',jsonb_build_object('title','Contact Us','subtitle','Get in Touch with Dhaka Heights Properties Limited Real Estate Operations','breadcrumbLabel','Contact Us'),
      'infoCards',jsonb_build_array(
        jsonb_build_object('itemId',gen_random_uuid(),'iconClass','fa-solid fa-location-dot','title','Corporate Office','body','New-70, Satmasjid Road, Dhanmondi, Dhaka-1209, Bangladesh.','ctaLabel','','ctaUrl','','ctaTarget','_self','ctaIconClass','','sortOrder',10,'isVisible',true),
        jsonb_build_object('itemId',gen_random_uuid(),'iconClass','fa-solid fa-phone','title','Helpline Numbers','body',E'Hotline: +880 9614 770 770\nTel: +880 2 9133445','ctaLabel','','ctaUrl','','ctaTarget','_self','ctaIconClass','','sortOrder',20,'isVisible',true),
        jsonb_build_object('itemId',gen_random_uuid(),'iconClass','fa-brands fa-whatsapp','title','WhatsApp Live Chat','body','Chat live with our commercial operations representative.','ctaLabel','Chat on WhatsApp','ctaUrl','https://wa.me/8801700000000','ctaTarget','_blank','ctaIconClass','fa-brands fa-whatsapp','sortOrder',30,'isVisible',true),
        jsonb_build_object('itemId',gen_random_uuid(),'iconClass','fa-solid fa-envelope','title','Email Services','body',E'General: info@dhakaheightsproperties.com\nLeasing: sales@dhakaheightsproperties.com','ctaLabel','','ctaUrl','','ctaTarget','_self','ctaIconClass','','sortOrder',40,'isVisible',true)
      ),
      'form',jsonb_build_object('heading','Send us a Message','description','We respond to all verified inquiry requests within one business day.','namePlaceholder','Your Full Name *','emailPlaceholder','Email Address','phonePlaceholder','Phone Number *','subjectLabel','Subject of Inquiry','messagePlaceholder','Write your message here...','submitLabel','Send Message','submittingLabel','Sending Message...','successMessage','Thank you, {name}! Your contact message regarding ''{subject}'' has been submitted. Our team will contact you back at {phone}.','errorMessage','Your message could not be submitted. Please try again.','previewNotice','Contact submission is disabled in preview mode.'),
      'subjectOptions',jsonb_build_array(
        jsonb_build_object('itemId',gen_random_uuid(),'value','general','label','General Corporate Inquiry','sortOrder',10,'isVisible',true),
        jsonb_build_object('itemId',gen_random_uuid(),'value','leasing','label','Commercial Office Space Leasing','sortOrder',20,'isVisible',true),
        jsonb_build_object('itemId',gen_random_uuid(),'value','landowner','label','Joint Venture / Landowner Partnerships','sortOrder',30,'isVisible',true),
        jsonb_build_object('itemId',gen_random_uuid(),'value','procurement','label','Vendors & Materials Supply Procurement','sortOrder',40,'isVisible',true)
      ),
      'map',jsonb_build_object('tag','Location Map','heading','Find Us on the Map','description','Our corporate headquarter is located directly in Satmasjid Road, Dhanmondi, making it highly accessible from all corridors of Dhaka.','iframeUrl','https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3651.156322971842!2d90.4172111!3d23.7916964!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3755c7a0f70deb73%3A0x30c3e492140d0255!2sGulshan%20Circle%202%2C%20Dhaka%201212!5e0!3m2!1sen!2sbd!4v1719280000000!5m2!1sen!2sbd','iframeTitle','Dhaka Heights Properties Limited Dhanmondi Office Map Pinpoint'),
      'seo',jsonb_build_object('title','Contact Us | Dhaka Heights Properties Limited','description','Contact Dhaka Heights Properties Limited for real estate, leasing, landowner partnership, and procurement inquiries.','canonicalUrl','/contact')
    );
    INSERT INTO page_sections(page_id,section_key,section_name,allowed_variant,sort_order,is_visible,status,version_number,settings,published_at)
    VALUES(v_page,'contact-page','Contact Page','contact-page',10,true,'published',1,v_content,clock_timestamp()) RETURNING id INTO v_section;
    v_snapshot:=contact_page_snapshot(v_section); PERFORM validate_contact_page_payload(v_snapshot);
    INSERT INTO content_revisions(table_name,record_id,revision_data,version_number,change_summary) VALUES('page_sections',v_section,v_snapshot,1,'Seeded initial published Contact page');
    INSERT INTO audit_logs(action,table_name,record_id,new_values) VALUES('migration_seed','page_sections',v_section,v_snapshot);
END;
$$;

COMMIT;
