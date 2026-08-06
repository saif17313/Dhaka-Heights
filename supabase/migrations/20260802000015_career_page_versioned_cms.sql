BEGIN;

ALTER TABLE job_openings
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES admin_profiles(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS set_job_openings_updated_at ON job_openings;
CREATE TRIGGER set_job_openings_updated_at BEFORE UPDATE ON job_openings
FOR EACH ROW EXECUTE FUNCTION set_home_content_updated_at();
DROP TRIGGER IF EXISTS set_career_applications_updated_at ON career_applications;
CREATE TRIGGER set_career_applications_updated_at BEFORE UPDATE ON career_applications
FOR EACH ROW EXECUTE FUNCTION set_home_content_updated_at();

DROP POLICY IF EXISTS "Public Read Published Page Sections" ON page_sections;
CREATE POLICY "Public Read Published Page Sections" ON page_sections
    FOR SELECT USING (
        status='published'
        AND (is_visible=true OR section_key IN (
            'hero-slider','about-corporate-home','statistics-counter','featured-projects-home',
            'commitment-quote','media-highlights-home','partners-carousel','contact-section-home',
            'about-page','projects-page','concerns-page','media-page','career-page'
        ))
        AND EXISTS (SELECT 1 FROM pages p WHERE p.id=page_sections.page_id AND p.is_published=true)
    );

DROP POLICY IF EXISTS "Public Read Active Job Openings" ON job_openings;
CREATE POLICY "Public Read Active Job Openings" ON job_openings FOR SELECT USING (is_active=true);
DROP POLICY IF EXISTS "HR Manager Manage Job Openings" ON job_openings;
DROP POLICY IF EXISTS "Admin Read Job Openings" ON job_openings;
CREATE POLICY "Admin Read Job Openings" ON job_openings FOR SELECT USING (get_admin_role() IN ('super_admin','content_editor','hr_manager'));

DROP POLICY IF EXISTS "Public Insert Career Applications" ON career_applications;
DROP POLICY IF EXISTS "HR Manager Manage Applications" ON career_applications;
DROP POLICY IF EXISTS "HR Read Career Applications" ON career_applications;
DROP POLICY IF EXISTS "HR Update Career Applications" ON career_applications;
CREATE POLICY "HR Read Career Applications" ON career_applications FOR SELECT USING (get_admin_role() IN ('super_admin','hr_manager'));
CREATE POLICY "HR Update Career Applications" ON career_applications FOR UPDATE USING (get_admin_role() IN ('super_admin','hr_manager')) WITH CHECK (get_admin_role() IN ('super_admin','hr_manager'));

CREATE OR REPLACE FUNCTION career_page_snapshot(p_section_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
SELECT jsonb_build_object(
    'id',ps.id,'pageId',ps.page_id,'sectionKey',ps.section_key,'status',ps.status,
    'versionNumber',ps.version_number,'isVisible',ps.is_visible,'content',ps.settings,
    'updatedAt',ps.updated_at,'updatedBy',ps.updated_by,'publishedAt',ps.published_at,'publishedBy',ps.published_by
)
FROM page_sections ps WHERE ps.id=p_section_id AND ps.section_key='career-page';
$$;

CREATE OR REPLACE FUNCTION validate_career_page_payload(p_payload JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_content JSONB:=p_payload->'content'; v_job JSONB; v_benefit JSONB; v_media UUID; v_id UUID; v_count INTEGER;
BEGIN
    IF p_payload->>'sectionKey' IS DISTINCT FROM 'career-page' THEN RAISE EXCEPTION 'Invalid Career page section key' USING ERRCODE='22023'; END IF;
    IF jsonb_typeof(v_content)<>'object' OR jsonb_typeof(v_content->'jobs')<>'array' OR jsonb_typeof(v_content#>'{philosophy,benefits}')<>'array' THEN RAISE EXCEPTION 'Career content must include jobs and benefits arrays' USING ERRCODE='22023'; END IF;
    v_count:=jsonb_array_length(v_content->'jobs');
    IF v_count NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Career page supports between 1 and 30 vacancies' USING ERRCODE='22023'; END IF;
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_content->'jobs') j WHERE COALESCE((j->>'isVisible')::BOOLEAN,true)) THEN RAISE EXCEPTION 'At least one vacancy must be visible' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_content->'jobs') j GROUP BY j->>'jobId' HAVING count(*)>1) THEN RAISE EXCEPTION 'Vacancy IDs must be unique' USING ERRCODE='23505'; END IF;
    IF jsonb_array_length(v_content#>'{philosophy,benefits}') NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Career page supports between 1 and 10 benefits' USING ERRCODE='22023'; END IF;
    BEGIN v_media:=(v_content#>>'{header,mediaId}')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'A valid Career header image is required' USING ERRCODE='22023'; END;
    IF NOT EXISTS(SELECT 1 FROM media_assets WHERE id=v_media AND resource_type='image' AND is_archived=false) THEN RAISE EXCEPTION 'The Career header image is unavailable' USING ERRCODE='23503'; END IF;
    BEGIN v_media:=(v_content#>>'{philosophy,mediaId}')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'A valid Career culture image is required' USING ERRCODE='22023'; END;
    IF NOT EXISTS(SELECT 1 FROM media_assets WHERE id=v_media AND resource_type='image' AND is_archived=false) THEN RAISE EXCEPTION 'The Career culture image is unavailable' USING ERRCODE='23503'; END IF;
    IF COALESCE(length(btrim(v_content#>>'{header,title}')),0) NOT BETWEEN 1 AND 100 OR COALESCE(length(btrim(v_content#>>'{header,subtitle}')),0) NOT BETWEEN 1 AND 240 OR COALESCE(length(btrim(v_content#>>'{header,imageAlt}')),0) NOT BETWEEN 1 AND 180 THEN RAISE EXCEPTION 'Career header fields are invalid' USING ERRCODE='22023'; END IF;
    IF COALESCE(length(btrim(v_content#>>'{philosophy,tag}')),0) NOT BETWEEN 1 AND 80 OR COALESCE(length(btrim(v_content#>>'{philosophy,heading}')),0) NOT BETWEEN 1 AND 180 OR COALESCE(length(btrim(v_content#>>'{philosophy,imageAlt}')),0) NOT BETWEEN 1 AND 180 OR jsonb_typeof(v_content#>'{philosophy,paragraphs}')<>'array' OR jsonb_array_length(v_content#>'{philosophy,paragraphs}')<1 THEN RAISE EXCEPTION 'Career culture fields are invalid' USING ERRCODE='22023'; END IF;
    FOR v_benefit IN SELECT value FROM jsonb_array_elements(v_content#>'{philosophy,benefits}') LOOP
        IF COALESCE(length(btrim(v_benefit->>'text')),0) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Every Career benefit requires text' USING ERRCODE='22023'; END IF;
    END LOOP;
    FOR v_job IN SELECT value FROM jsonb_array_elements(v_content->'jobs') LOOP
        BEGIN v_id:=(v_job->>'jobId')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Vacancy IDs must be valid UUIDs' USING ERRCODE='22023'; END;
        IF COALESCE(length(btrim(v_job->>'title')),0) NOT BETWEEN 1 AND 200 OR COALESCE(length(btrim(v_job->>'department')),0) NOT BETWEEN 1 AND 100 OR COALESCE(length(btrim(v_job->>'location')),0) NOT BETWEEN 1 AND 180 OR COALESCE(length(btrim(v_job->>'experience')),0) NOT BETWEEN 1 AND 100 OR COALESCE(length(btrim(v_job->>'description')),0) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Every vacancy requires title, department, location, experience and description' USING ERRCODE='22023'; END IF;
        IF COALESCE(v_job->>'tagClass','') NOT IN('engineering','operations','design') THEN RAISE EXCEPTION 'Vacancy tag style is invalid' USING ERRCODE='22023'; END IF;
        IF jsonb_typeof(v_job->'responsibilities')<>'array' OR jsonb_typeof(v_job->'requirements')<>'array' THEN RAISE EXCEPTION 'Vacancy responsibilities and requirements must be arrays' USING ERRCODE='22023'; END IF;
        IF NULLIF(v_job->>'closingDate','') IS NOT NULL THEN BEGIN PERFORM (v_job->>'closingDate')::DATE; EXCEPTION WHEN invalid_datetime_format THEN RAISE EXCEPTION 'Vacancy closing date is invalid' USING ERRCODE='22023'; END; END IF;
    END LOOP;
    IF COALESCE(length(btrim(v_content#>>'{form,heading}')),0)=0 OR COALESCE(length(btrim(v_content#>>'{form,submitLabel}')),0)=0 OR COALESCE(length(btrim(v_content#>>'{form,successMessage}')),0)=0 THEN RAISE EXCEPTION 'Career application copy is incomplete' USING ERRCODE='22023'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION replace_career_page_media_usage(p_section_id UUID,p_payload JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
    DELETE FROM media_asset_usage WHERE table_name='page_sections' AND record_id=p_section_id AND field_name LIKE 'career-page:%';
    INSERT INTO media_asset_usage(media_asset_id,table_name,record_id,field_name) VALUES((p_payload#>>'{content,header,mediaId}')::UUID,'page_sections',p_section_id,'career-page:header') ON CONFLICT DO NOTHING;
    INSERT INTO media_asset_usage(media_asset_id,table_name,record_id,field_name) VALUES((p_payload#>>'{content,philosophy,mediaId}')::UUID,'page_sections',p_section_id,'career-page:philosophy') ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION sync_career_job_catalog(p_content JSONB,p_actor UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_job JSONB; v_id UUID;
BEGIN
    FOR v_job IN SELECT value FROM jsonb_array_elements(p_content->'jobs') LOOP
        v_id:=(v_job->>'jobId')::UUID;
        INSERT INTO job_openings(id,title,department,location,job_type,experience_required,closing_date,description,responsibilities,requirements,is_active,sort_order,updated_by)
        VALUES(v_id,btrim(v_job->>'title'),btrim(v_job->>'department'),btrim(v_job->>'location'),COALESCE(NULLIF(btrim(v_job->>'jobType'),''),'Full-Time'),btrim(v_job->>'experience'),NULLIF(v_job->>'closingDate','')::DATE,btrim(v_job->>'description'),v_job->'responsibilities',v_job->'requirements',COALESCE((v_job->>'isVisible')::BOOLEAN,true),(v_job->>'sortOrder')::INTEGER,p_actor)
        ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,department=EXCLUDED.department,location=EXCLUDED.location,job_type=EXCLUDED.job_type,experience_required=EXCLUDED.experience_required,closing_date=EXCLUDED.closing_date,description=EXCLUDED.description,responsibilities=EXCLUDED.responsibilities,requirements=EXCLUDED.requirements,is_active=EXCLUDED.is_active,sort_order=EXCLUDED.sort_order,updated_by=p_actor;
    END LOOP;
    UPDATE job_openings SET is_active=false,updated_by=p_actor WHERE id NOT IN (SELECT (j->>'jobId')::UUID FROM jsonb_array_elements(p_content->'jobs') j);
END;
$$;

CREATE OR REPLACE FUNCTION save_career_page_draft(p_payload JSONB,p_expected_updated_at TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor UUID:=auth.uid(); v_role app_role; v_page UUID; v_source UUID; v_draft page_sections%ROWTYPE; v_published page_sections%ROWTYPE; v_id UUID; v_next INTEGER; v_old JSONB; v_new JSONB; v_revision INTEGER;
BEGIN
    IF v_actor IS NULL THEN RETURN jsonb_build_object('ok',false,'status',401,'code','ADMIN_AUTH_REQUIRED','error','Authentication is required.'); END IF;
    SELECT role INTO v_role FROM admin_profiles WHERE id=v_actor AND is_active=true;
    IF v_role IS NULL OR v_role NOT IN('super_admin','content_editor','hr_manager') THEN RETURN jsonb_build_object('ok',false,'status',403,'code','ADMIN_ROLE_FORBIDDEN','error','An active Career administrator profile is required.'); END IF;
    PERFORM validate_career_page_payload(p_payload);
    BEGIN v_source:=(p_payload->>'id')::UUID; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Invalid Career section ID' USING ERRCODE='22023'; END;
    SELECT id INTO v_page FROM pages WHERE slug='career' AND is_published=true FOR UPDATE;
    IF v_page IS NULL THEN RETURN jsonb_build_object('ok',false,'status',503,'code','CAREER_PAGE_NOT_CONFIGURED','error','The Career page is not configured.'); END IF;
    SELECT * INTO v_draft FROM page_sections WHERE page_id=v_page AND section_key='career-page' AND status='draft' FOR UPDATE;
    IF v_draft.id IS NOT NULL THEN
        IF v_source<>v_draft.id OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('ok',false,'status',409,'code','CAREER_PAGE_CONFLICT','error','The Career draft changed after this editor loaded it.'); END IF;
        v_id:=v_draft.id; v_old:=career_page_snapshot(v_id);
        UPDATE page_sections SET settings=p_payload->'content',is_visible=COALESCE((p_payload->>'isVisible')::BOOLEAN,true),updated_by=v_actor WHERE id=v_id;
    ELSE
        SELECT * INTO v_published FROM page_sections WHERE page_id=v_page AND section_key='career-page' AND status='published' FOR UPDATE;
        IF v_published.id IS NULL OR v_source<>v_published.id OR v_published.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('ok',false,'status',409,'code','CAREER_PAGE_CONFLICT','error','Published Career content changed after this editor loaded it.'); END IF;
        SELECT COALESCE(max(version_number),0)+1 INTO v_next FROM page_sections WHERE page_id=v_page AND section_key='career-page';
        INSERT INTO page_sections(page_id,section_key,section_name,allowed_variant,sort_order,is_visible,status,version_number,settings,updated_by,supersedes_id)
        VALUES(v_page,'career-page','Career Page and Vacancies','career-listing',10,COALESCE((p_payload->>'isVisible')::BOOLEAN,true),'draft',v_next,p_payload->'content',v_actor,v_published.id) RETURNING id INTO v_id;
    END IF;
    PERFORM replace_career_page_media_usage(v_id,p_payload);
    v_new:=career_page_snapshot(v_id);
    SELECT COALESCE(max(version_number),0)+1 INTO v_revision FROM content_revisions WHERE table_name='page_sections' AND record_id=v_id;
    INSERT INTO content_revisions(table_name,record_id,revision_data,created_by,version_number,change_summary) VALUES('page_sections',v_id,v_new,v_actor,v_revision,CASE WHEN v_draft.id IS NULL THEN 'Created Career page draft' ELSE 'Saved Career page draft' END);
    INSERT INTO audit_logs(admin_id,action,table_name,record_id,old_values,new_values) VALUES(v_actor,CASE WHEN v_draft.id IS NULL THEN 'create_draft' ELSE 'update_draft' END,'page_sections',v_id,v_old,v_new);
    RETURN jsonb_build_object('ok',true,'data',v_new);
END;
$$;

CREATE OR REPLACE FUNCTION publish_career_page_draft(p_section_id UUID,p_expected_updated_at TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor UUID:=auth.uid(); v_role app_role; v_draft page_sections%ROWTYPE; v_published page_sections%ROWTYPE; v_old JSONB; v_previous JSONB; v_new JSONB; v_revision INTEGER;
BEGIN
    IF v_actor IS NULL THEN RETURN jsonb_build_object('ok',false,'status',401,'code','ADMIN_AUTH_REQUIRED','error','Authentication is required.'); END IF;
    SELECT role INTO v_role FROM admin_profiles WHERE id=v_actor AND is_active=true;
    IF v_role IS NULL OR v_role NOT IN('super_admin','content_editor','hr_manager') THEN RETURN jsonb_build_object('ok',false,'status',403,'code','ADMIN_ROLE_FORBIDDEN','error','An active Career administrator profile is required.'); END IF;
    SELECT * INTO v_draft FROM page_sections WHERE id=p_section_id AND section_key='career-page' AND status='draft' FOR UPDATE;
    IF v_draft.id IS NULL THEN RETURN jsonb_build_object('ok',false,'status',404,'code','CAREER_PAGE_DRAFT_NOT_FOUND','error','The Career draft no longer exists.'); END IF;
    IF p_expected_updated_at IS NULL OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('ok',false,'status',409,'code','CAREER_PAGE_CONFLICT','error','The Career draft changed after this editor loaded it.'); END IF;
    v_old:=career_page_snapshot(v_draft.id); PERFORM validate_career_page_payload(v_old); PERFORM sync_career_job_catalog(v_draft.settings,v_actor);
    SELECT * INTO v_published FROM page_sections WHERE page_id=v_draft.page_id AND section_key='career-page' AND status='published' FOR UPDATE;
    IF v_published.id IS NOT NULL THEN v_previous:=career_page_snapshot(v_published.id); UPDATE page_sections SET status='archived',updated_by=v_actor WHERE id=v_published.id; INSERT INTO audit_logs(admin_id,action,table_name,record_id,old_values,new_values) VALUES(v_actor,'archive_published','page_sections',v_published.id,v_previous,career_page_snapshot(v_published.id)); END IF;
    UPDATE page_sections SET status='published',published_at=clock_timestamp(),published_by=v_actor,updated_by=v_actor WHERE id=v_draft.id;
    v_new:=career_page_snapshot(v_draft.id);
    SELECT COALESCE(max(version_number),0)+1 INTO v_revision FROM content_revisions WHERE table_name='page_sections' AND record_id=v_draft.id;
    INSERT INTO content_revisions(table_name,record_id,revision_data,created_by,version_number,change_summary) VALUES('page_sections',v_draft.id,v_new,v_actor,v_revision,'Published Career page and canonical vacancy catalogue');
    INSERT INTO audit_logs(admin_id,action,table_name,record_id,old_values,new_values) VALUES(v_actor,'publish','page_sections',v_draft.id,v_old,v_new);
    RETURN jsonb_build_object('ok',true,'data',v_new);
END;
$$;

REVOKE ALL ON FUNCTION career_page_snapshot(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION validate_career_page_payload(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION replace_career_page_media_usage(UUID,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION sync_career_job_catalog(JSONB,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION save_career_page_draft(JSONB,TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION publish_career_page_draft(UUID,TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION career_page_snapshot(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION save_career_page_draft(JSONB,TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_career_page_draft(UUID,TIMESTAMPTZ) TO authenticated;

DO $$
DECLARE v_page UUID; v_section UUID; v_header UUID; v_culture UUID; v_jobs JSONB; v_content JSONB; v_snapshot JSONB;
BEGIN
    SELECT id INTO v_page FROM pages WHERE slug='career';
    SELECT id INTO v_header FROM media_assets WHERE public_id='dhaka-heights/dev/media_bg' AND is_archived=false;
    SELECT id INTO v_culture FROM media_assets WHERE public_id='dhaka-heights/dev/hero2' AND is_archived=false;
    IF v_page IS NULL OR v_header IS NULL OR v_culture IS NULL THEN RAISE EXCEPTION 'Career page and canonical media assets are required'; END IF;
    IF EXISTS(SELECT 1 FROM page_sections WHERE page_id=v_page AND section_key='career-page' AND status='published') THEN RETURN; END IF;
    v_jobs:=jsonb_build_array(
      jsonb_build_object('jobId',gen_random_uuid(),'department','Engineering','tagClass','engineering','title','Senior Structural Designer','location','Dhanmondi Head Office','experience','6+ Years Exp','description','Responsible for earthquake load calculations, wind tunnel simulation reviews, and double glazed panel frame drawings audits.','jobType','Full-Time','closingDate',NULL,'optionLabel','Senior Structural Designer (Engineering)','responsibilities',jsonb_build_array('Review structural load calculations','Audit glazing frame drawings'),'requirements',jsonb_build_array('6+ years of structural design experience'),'sortOrder',10,'isVisible',true),
      jsonb_build_object('jobId',gen_random_uuid(),'department','Operations','tagClass','operations','title','Commercial Leasing Executive','location','Dhanmondi Head Office','experience','3+ Years Exp','description','Formulate lease agreements and coordinate tenant onboarding for premium bank branches and flagship retail showrooms.','jobType','Full-Time','closingDate',NULL,'optionLabel','Commercial Leasing Executive (Operations)','responsibilities',jsonb_build_array('Coordinate tenant onboarding','Prepare commercial lease agreements'),'requirements',jsonb_build_array('3+ years of commercial leasing experience'),'sortOrder',20,'isVisible',true),
      jsonb_build_object('jobId',gen_random_uuid(),'department','Design','tagClass','design','title','Corporate Interior Planner','location','Dhanmondi Head Office','experience','2+ Years Exp','description','Aesthetic zoning of executive suites, landscaping, lobby lounges, and open workstation floorplans design.','jobType','Full-Time','closingDate',NULL,'optionLabel','Corporate Interior Planner (Design)','responsibilities',jsonb_build_array('Plan corporate interiors and landscaping','Develop executive suite layouts'),'requirements',jsonb_build_array('2+ years of corporate interior planning experience'),'sortOrder',30,'isVisible',true)
    );
    v_content:=jsonb_build_object(
      'header',jsonb_build_object('title','Careers','subtitle','Build the Future of Premium Architecture with Dhaka Heights Properties Limited','breadcrumbLabel','Career','mediaId',v_header,'imageAlt','Dhaka Heights corporate skyline'),
      'philosophy',jsonb_build_object('tag','Our People','heading','Unlocking Innovation & Professional Growth','paragraphs',jsonb_build_array('At Dhaka Heights Properties Limited, we believe that structural marvels are only made possible by exceptional individuals. Our team consists of structural engineers, site planners, interior designers, and real estate operations professionals.','We foster a collaborative culture that rewards analytical foresight, construction timelines compliance, and transparent customer service operations. Join us in shaping Dhaka’s skyline.'),'benefits',jsonb_build_array(jsonb_build_object('id','benefit-health','text','Comprehensive health insurance coverage','isVisible',true),jsonb_build_object('id','benefit-incentives','text','Performance incentives per project milestone','isVisible',true),jsonb_build_object('id','benefit-training','text','Corporate training with structural materials specialists','isVisible',true)),'mediaId',v_culture,'imageAlt','Collaborative corporate space'),
      'jobsSection',jsonb_build_object('tag','Join Us','heading','Currently Open Opportunities'),
      'jobs',v_jobs,
      'form',jsonb_build_object('heading','Apply for Openings','description','Complete the registration form and upload your professional resume.','namePlaceholder','Candidate Name *','emailPlaceholder','Email Address *','phonePlaceholder','Phone Number *','positionLabel','Applying Position *','coverLetterPlaceholder','Describe your qualifications / cover letter message...','resumeLabel','Resume Attachment (PDF / DOCX) *','selectedPrefix','Selected:','uploadPrompt','Drag & Drop Resume or Click to Browse','uploadHelp','Allowed formats: PDF, DOCX (Max size: 5MB)','generalOptionLabel','Other / General CV','submitLabel','Send Application','submittingLabel','Sending Application...','successMessage','Application submitted successfully! HR team will review your CV.','errorMessage','Your application could not be submitted. Please try again.','previewNotice','Application submission is disabled in preview mode.'),
      'seo',jsonb_build_object('title','Careers | Dhaka Heights Properties Limited','description','Explore engineering, design, operations, and real estate career opportunities at Dhaka Heights Properties Limited.','canonicalUrl','/career')
    );
    INSERT INTO page_sections(page_id,section_key,section_name,allowed_variant,sort_order,is_visible,status,version_number,settings,published_at)
    VALUES(v_page,'career-page','Career Page and Vacancies','career-listing',10,true,'published',1,v_content,clock_timestamp()) RETURNING id INTO v_section;
    v_snapshot:=career_page_snapshot(v_section);
    PERFORM validate_career_page_payload(v_snapshot); PERFORM replace_career_page_media_usage(v_section,v_snapshot); PERFORM sync_career_job_catalog(v_content,NULL);
    INSERT INTO content_revisions(table_name,record_id,revision_data,version_number,change_summary) VALUES('page_sections',v_section,v_snapshot,1,'Seeded initial published Career page and three vacancies');
    INSERT INTO audit_logs(action,table_name,record_id,new_values) VALUES('migration_seed','page_sections',v_section,v_snapshot);
END;
$$;

COMMIT;
