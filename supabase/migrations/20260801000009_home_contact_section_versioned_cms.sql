BEGIN;

-- Phase 1H: versioned Home Contact content and form configuration. Inquiry
-- submissions remain operational records and are never copied into CMS versions.
DROP POLICY IF EXISTS "Public Read Published Page Sections" ON page_sections;
CREATE POLICY "Public Read Published Page Sections" ON page_sections
    FOR SELECT
    USING (
        status = 'published'
        AND (
            is_visible = true
            OR section_key IN (
                'hero-slider', 'about-corporate-home', 'statistics-counter',
                'featured-projects-home', 'commitment-quote',
                'media-highlights-home', 'partners-carousel',
                'contact-section-home'
            )
        )
        AND EXISTS (
            SELECT 1 FROM pages
             WHERE pages.id = page_sections.page_id
               AND pages.is_published = true
        )
    );

CREATE OR REPLACE FUNCTION home_contact_section_snapshot(p_section_id UUID)
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
        'description', ps.description,
        'copy', jsonb_build_object(
            'formHeading', ps.settings ->> 'form_heading',
            'formDescription', ps.settings ->> 'form_description',
            'nameLabel', ps.settings ->> 'name_label',
            'emailLabel', ps.settings ->> 'email_label',
            'phoneLabel', ps.settings ->> 'phone_label',
            'sizeLabel', ps.settings ->> 'size_label',
            'messageLabel', ps.settings ->> 'message_label',
            'nameError', ps.settings ->> 'name_error',
            'emailError', ps.settings ->> 'email_error',
            'phoneError', ps.settings ->> 'phone_error',
            'sizeError', ps.settings ->> 'size_error',
            'submitLabel', ps.settings ->> 'submit_label',
            'submittingLabel', ps.settings ->> 'submitting_label',
            'successTitle', ps.settings ->> 'success_title',
            'successBody', ps.settings ->> 'success_body',
            'closeLabel', ps.settings ->> 'close_label',
            'mapLakeLabel', ps.settings ->> 'map_lake_label',
            'mapRoadLabel', ps.settings ->> 'map_road_label',
            'mapTooltip', ps.settings ->> 'map_tooltip'
        ),
        'details', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'itemId', si.id,
                    'itemKey', si.item_key,
                    'label', si.title,
                    'value', si.body_text,
                    'iconKey', si.icon_key,
                    'sortOrder', si.sort_order,
                    'isVisible', si.is_visible
                ) ORDER BY si.sort_order, si.id
            )
              FROM section_items si
             WHERE si.section_id = ps.id AND si.item_key LIKE 'detail-%'
        ), '[]'::jsonb),
        'spaceOptions', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'itemId', si.id,
                    'itemKey', si.item_key,
                    'label', si.title,
                    'value', si.primary_cta_url,
                    'sortOrder', si.sort_order,
                    'isVisible', si.is_visible
                ) ORDER BY si.sort_order, si.id
            )
              FROM section_items si
             WHERE si.section_id = ps.id AND si.item_key LIKE 'option-%'
        ), '[]'::jsonb),
        'updatedAt', ps.updated_at,
        'updatedBy', ps.updated_by,
        'publishedAt', ps.published_at,
        'publishedBy', ps.published_by
    )
      FROM page_sections ps
     WHERE ps.id = p_section_id;
$$;

CREATE OR REPLACE FUNCTION save_home_contact_section_draft(
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
    v_item JSONB;
    v_copy_key TEXT;
    v_copy_keys TEXT[] := ARRAY[
        'formHeading','formDescription','nameLabel','emailLabel','phoneLabel',
        'sizeLabel','messageLabel','nameError','emailError','phoneError','sizeError',
        'submitLabel','submittingLabel','successTitle','successBody','closeLabel',
        'mapLakeLabel','mapRoadLabel','mapTooltip'
    ];
    v_settings JSONB;
    v_detail_count INTEGER;
    v_option_count INTEGER;
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
       OR p_payload ->> 'sectionKey' IS DISTINCT FROM 'contact-section-home' THEN
        RAISE EXCEPTION 'Invalid Home Contact Section payload' USING ERRCODE = '22023';
    END IF;

    BEGIN
        v_source_id := (p_payload ->> 'id')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Home Contact payload contains an invalid section identifier' USING ERRCODE = '22023';
    END;

    IF v_source_id IS NULL
       OR jsonb_typeof(p_payload -> 'isVisible') IS DISTINCT FROM 'boolean'
       OR jsonb_typeof(p_payload -> 'copy') IS DISTINCT FROM 'object'
       OR jsonb_typeof(p_payload -> 'details') IS DISTINCT FROM 'array'
       OR jsonb_typeof(p_payload -> 'spaceOptions') IS DISTINCT FROM 'array'
       OR length(btrim(COALESCE(p_payload ->> 'tagText', ''))) NOT BETWEEN 1 AND 80
       OR length(btrim(COALESCE(p_payload ->> 'heading', ''))) NOT BETWEEN 1 AND 140
       OR length(btrim(COALESCE(p_payload ->> 'description', ''))) NOT BETWEEN 1 AND 500 THEN
        RAISE EXCEPTION 'Home Contact section fields are invalid' USING ERRCODE = '22023';
    END IF;

    FOREACH v_copy_key IN ARRAY v_copy_keys LOOP
        IF jsonb_typeof(p_payload -> 'copy' -> v_copy_key) IS DISTINCT FROM 'string'
           OR length(btrim(COALESCE(p_payload -> 'copy' ->> v_copy_key, ''))) NOT BETWEEN 1 AND 500 THEN
            RAISE EXCEPTION 'Home Contact copy field % is invalid', v_copy_key USING ERRCODE = '22023';
        END IF;
    END LOOP;

    v_detail_count := jsonb_array_length(p_payload -> 'details');
    IF v_detail_count NOT BETWEEN 1 AND 6
       OR (SELECT count(DISTINCT item ->> 'itemKey') FROM jsonb_array_elements(p_payload -> 'details') item) <> v_detail_count
       OR NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(p_payload -> 'details') item
             WHERE jsonb_typeof(item -> 'isVisible') = 'boolean'
               AND (item ->> 'isVisible')::BOOLEAN = true
       ) THEN
        RAISE EXCEPTION 'Home Contact requires 1 to 6 unique details and at least one visible detail' USING ERRCODE = '22023';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload -> 'details') LOOP
        IF jsonb_typeof(v_item) <> 'object'
           OR COALESCE(v_item ->> 'itemKey', '') !~ '^detail-[a-z0-9-]{1,64}$'
           OR length(btrim(COALESCE(v_item ->> 'label', ''))) NOT BETWEEN 1 AND 100
           OR length(btrim(COALESCE(v_item ->> 'value', ''))) NOT BETWEEN 1 AND 250
           OR COALESCE(v_item ->> 'iconKey', '') !~ '^fa-[a-z0-9-]{1,60}$'
           OR jsonb_typeof(v_item -> 'isVisible') IS DISTINCT FROM 'boolean' THEN
            RAISE EXCEPTION 'One or more Home Contact details are invalid' USING ERRCODE = '22023';
        END IF;
    END LOOP;

    v_option_count := jsonb_array_length(p_payload -> 'spaceOptions');
    IF v_option_count NOT BETWEEN 1 AND 10
       OR (SELECT count(DISTINCT item ->> 'itemKey') FROM jsonb_array_elements(p_payload -> 'spaceOptions') item) <> v_option_count
       OR (SELECT count(DISTINCT item ->> 'value') FROM jsonb_array_elements(p_payload -> 'spaceOptions') item) <> v_option_count
       OR NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(p_payload -> 'spaceOptions') item
             WHERE jsonb_typeof(item -> 'isVisible') = 'boolean'
               AND (item ->> 'isVisible')::BOOLEAN = true
       ) THEN
        RAISE EXCEPTION 'Home Contact requires 1 to 10 unique options and at least one visible option' USING ERRCODE = '22023';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload -> 'spaceOptions') LOOP
        IF jsonb_typeof(v_item) <> 'object'
           OR COALESCE(v_item ->> 'itemKey', '') !~ '^option-[a-z0-9-]{1,64}$'
           OR length(btrim(COALESCE(v_item ->> 'label', ''))) NOT BETWEEN 1 AND 100
           OR COALESCE(v_item ->> 'value', '') !~ '^[a-zA-Z0-9_-]{1,60}$'
           OR jsonb_typeof(v_item -> 'isVisible') IS DISTINCT FROM 'boolean' THEN
            RAISE EXCEPTION 'One or more Home Contact space options are invalid' USING ERRCODE = '22023';
        END IF;
    END LOOP;

    v_settings := jsonb_build_object(
        'form_heading', btrim(p_payload #>> '{copy,formHeading}'),
        'form_description', btrim(p_payload #>> '{copy,formDescription}'),
        'name_label', btrim(p_payload #>> '{copy,nameLabel}'),
        'email_label', btrim(p_payload #>> '{copy,emailLabel}'),
        'phone_label', btrim(p_payload #>> '{copy,phoneLabel}'),
        'size_label', btrim(p_payload #>> '{copy,sizeLabel}'),
        'message_label', btrim(p_payload #>> '{copy,messageLabel}'),
        'name_error', btrim(p_payload #>> '{copy,nameError}'),
        'email_error', btrim(p_payload #>> '{copy,emailError}'),
        'phone_error', btrim(p_payload #>> '{copy,phoneError}'),
        'size_error', btrim(p_payload #>> '{copy,sizeError}'),
        'submit_label', btrim(p_payload #>> '{copy,submitLabel}'),
        'submitting_label', btrim(p_payload #>> '{copy,submittingLabel}'),
        'success_title', btrim(p_payload #>> '{copy,successTitle}'),
        'success_body', btrim(p_payload #>> '{copy,successBody}'),
        'close_label', btrim(p_payload #>> '{copy,closeLabel}'),
        'map_lake_label', btrim(p_payload #>> '{copy,mapLakeLabel}'),
        'map_road_label', btrim(p_payload #>> '{copy,mapRoadLabel}'),
        'map_tooltip', btrim(p_payload #>> '{copy,mapTooltip}')
    );

    SELECT id INTO v_page_id FROM pages WHERE slug = 'home' FOR UPDATE;
    IF v_page_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 503, 'code', 'HOME_PAGE_NOT_CONFIGURED', 'error', 'The Home page record is not configured.');
    END IF;
    IF NULLIF(p_payload ->> 'pageId', '') IS NOT NULL AND (p_payload ->> 'pageId')::UUID <> v_page_id THEN
        RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_CONTACT_SECTION_CONFLICT', 'error', 'The edited section no longer belongs to the current Home page.');
    END IF;

    SELECT * INTO v_draft FROM page_sections
     WHERE page_id = v_page_id AND section_key = 'contact-section-home' AND status = 'draft'
     FOR UPDATE;
    IF v_draft.id IS NOT NULL THEN
        IF v_source_id <> v_draft.id OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN
            RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_CONTACT_SECTION_CONFLICT', 'error', 'The Contact Section draft changed after this editor loaded it.');
        END IF;
        v_draft_id := v_draft.id;
        v_old_snapshot := home_contact_section_snapshot(v_draft_id);
        UPDATE page_sections SET
            tag_text = btrim(p_payload ->> 'tagText'),
            heading = btrim(p_payload ->> 'heading'),
            description = btrim(p_payload ->> 'description'),
            settings = v_settings,
            is_visible = (p_payload ->> 'isVisible')::BOOLEAN,
            updated_by = v_actor
         WHERE id = v_draft_id;
        DELETE FROM section_items WHERE section_id = v_draft_id;
    ELSE
        SELECT * INTO v_published FROM page_sections
         WHERE page_id = v_page_id AND section_key = 'contact-section-home' AND status = 'published'
         FOR UPDATE;
        IF v_published.id IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'status', 503, 'code', 'HOME_CONTACT_SECTION_NOT_CONFIGURED', 'error', 'The published Home Contact Section is not configured.');
        END IF;
        IF v_source_id <> v_published.id OR v_published.updated_at IS DISTINCT FROM p_expected_updated_at THEN
            RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_CONTACT_SECTION_CONFLICT', 'error', 'The published Contact Section changed after this editor loaded it.');
        END IF;
        SELECT COALESCE(max(version_number), 0) + 1 INTO v_next_version FROM page_sections
         WHERE page_id = v_page_id AND section_key = 'contact-section-home';
        v_old_snapshot := home_contact_section_snapshot(v_published.id);
        INSERT INTO page_sections (
            page_id, section_key, section_name, tag_text, heading, description,
            allowed_variant, sort_order, is_visible, status, version_number,
            settings, updated_by, supersedes_id
        ) VALUES (
            v_page_id, 'contact-section-home', v_published.section_name,
            btrim(p_payload ->> 'tagText'), btrim(p_payload ->> 'heading'),
            btrim(p_payload ->> 'description'), v_published.allowed_variant,
            v_published.sort_order, (p_payload ->> 'isVisible')::BOOLEAN,
            'draft', v_next_version, v_settings, v_actor, v_published.id
        ) RETURNING id INTO v_draft_id;
    END IF;

    INSERT INTO section_items (
        section_id, item_key, title, body_text, icon_library, icon_key,
        sort_order, is_visible, updated_by
    )
    SELECT v_draft_id, item ->> 'itemKey', btrim(item ->> 'label'),
           btrim(item ->> 'value'), 'fontawesome', item ->> 'iconKey',
           ordinal * 10, (item ->> 'isVisible')::BOOLEAN, v_actor
      FROM jsonb_array_elements(p_payload -> 'details') WITH ORDINALITY AS entries(item, ordinal);

    INSERT INTO section_items (
        section_id, item_key, title, primary_cta_url, sort_order, is_visible, updated_by
    )
    SELECT v_draft_id, item ->> 'itemKey', btrim(item ->> 'label'),
           item ->> 'value', ordinal * 10, (item ->> 'isVisible')::BOOLEAN, v_actor
      FROM jsonb_array_elements(p_payload -> 'spaceOptions') WITH ORDINALITY AS entries(item, ordinal);

    v_new_snapshot := home_contact_section_snapshot(v_draft_id);
    SELECT COALESCE(max(version_number), 0) + 1 INTO v_revision_number FROM content_revisions
     WHERE table_name = 'page_sections' AND record_id = v_draft_id;
    INSERT INTO content_revisions (table_name, record_id, revision_data, created_by, version_number, change_summary)
    VALUES ('page_sections', v_draft_id, v_new_snapshot, v_actor, v_revision_number,
        CASE WHEN v_draft.id IS NULL THEN 'Created Home Contact Section draft' ELSE 'Saved Home Contact Section draft' END);
    INSERT INTO audit_logs (admin_id, action, table_name, record_id, old_values, new_values)
    VALUES (v_actor, CASE WHEN v_draft.id IS NULL THEN 'create_draft' ELSE 'update_draft' END,
        'page_sections', v_draft_id, v_old_snapshot, v_new_snapshot);
    RETURN jsonb_build_object('ok', true, 'data', v_new_snapshot);
END;
$$;

CREATE OR REPLACE FUNCTION publish_home_contact_section_draft(
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
    v_required_setting TEXT;
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

    SELECT * INTO v_draft FROM page_sections
     WHERE id = p_section_id AND section_key = 'contact-section-home' AND status = 'draft'
     FOR UPDATE;
    IF v_draft.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 404, 'code', 'HOME_CONTACT_SECTION_DRAFT_NOT_FOUND', 'error', 'The Home Contact Section draft no longer exists.');
    END IF;
    IF v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN
        RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_CONTACT_SECTION_CONFLICT', 'error', 'The Contact Section draft changed after this editor loaded it.');
    END IF;
    IF length(btrim(COALESCE(v_draft.tag_text, ''))) NOT BETWEEN 1 AND 80
       OR length(btrim(COALESCE(v_draft.heading, ''))) NOT BETWEEN 1 AND 140
       OR length(btrim(COALESCE(v_draft.description, ''))) NOT BETWEEN 1 AND 500
       OR jsonb_typeof(v_draft.settings) <> 'object'
       OR (SELECT count(*) FROM section_items WHERE section_id = v_draft.id AND item_key LIKE 'detail-%') NOT BETWEEN 1 AND 6
       OR NOT EXISTS (SELECT 1 FROM section_items WHERE section_id = v_draft.id AND item_key LIKE 'detail-%' AND is_visible)
       OR (SELECT count(*) FROM section_items WHERE section_id = v_draft.id AND item_key LIKE 'option-%') NOT BETWEEN 1 AND 10
       OR NOT EXISTS (SELECT 1 FROM section_items WHERE section_id = v_draft.id AND item_key LIKE 'option-%' AND is_visible)
       OR EXISTS (
            SELECT 1 FROM section_items WHERE section_id = v_draft.id AND (
                (item_key LIKE 'detail-%' AND (
                    item_key !~ '^detail-[a-z0-9-]{1,64}$'
                    OR length(btrim(COALESCE(title, ''))) NOT BETWEEN 1 AND 100
                    OR length(btrim(COALESCE(body_text, ''))) NOT BETWEEN 1 AND 250
                    OR COALESCE(icon_key, '') !~ '^fa-[a-z0-9-]{1,60}$'
                )) OR (item_key LIKE 'option-%' AND (
                    item_key !~ '^option-[a-z0-9-]{1,64}$'
                    OR length(btrim(COALESCE(title, ''))) NOT BETWEEN 1 AND 100
                    OR COALESCE(primary_cta_url, '') !~ '^[a-zA-Z0-9_-]{1,60}$'
                ))
            )
       ) THEN
        RETURN jsonb_build_object('ok', false, 'status', 422, 'code', 'HOME_CONTACT_SECTION_INVALID', 'error', 'The Contact Section draft contains invalid content.');
    END IF;
    FOREACH v_required_setting IN ARRAY ARRAY[
        'form_heading','form_description','name_label','email_label','phone_label',
        'size_label','message_label','name_error','email_error','phone_error','size_error',
        'submit_label','submitting_label','success_title','success_body','close_label',
        'map_lake_label','map_road_label','map_tooltip'
    ] LOOP
        IF length(btrim(COALESCE(v_draft.settings ->> v_required_setting, ''))) NOT BETWEEN 1 AND 500 THEN
            RETURN jsonb_build_object('ok', false, 'status', 422, 'code', 'HOME_CONTACT_SECTION_INVALID', 'error', 'The Contact Section draft has missing form or map copy.');
        END IF;
    END LOOP;

    v_old_snapshot := home_contact_section_snapshot(v_draft.id);
    SELECT * INTO v_previous_published FROM page_sections
     WHERE page_id = v_draft.page_id AND section_key = v_draft.section_key AND status = 'published'
     FOR UPDATE;
    IF v_previous_published.id IS NOT NULL THEN
        v_previous_snapshot := home_contact_section_snapshot(v_previous_published.id);
        UPDATE page_sections SET status = 'archived', updated_by = v_actor WHERE id = v_previous_published.id;
        INSERT INTO audit_logs (admin_id, action, table_name, record_id, old_values, new_values)
        VALUES (v_actor, 'archive_published', 'page_sections', v_previous_published.id,
            v_previous_snapshot, home_contact_section_snapshot(v_previous_published.id));
    END IF;
    UPDATE page_sections SET status = 'published', published_at = clock_timestamp(),
        published_by = v_actor, updated_by = v_actor WHERE id = v_draft.id;
    v_new_snapshot := home_contact_section_snapshot(v_draft.id);
    SELECT COALESCE(max(version_number), 0) + 1 INTO v_revision_number FROM content_revisions
     WHERE table_name = 'page_sections' AND record_id = v_draft.id;
    INSERT INTO content_revisions (table_name, record_id, revision_data, created_by, version_number, change_summary)
    VALUES ('page_sections', v_draft.id, v_new_snapshot, v_actor, v_revision_number, 'Published Home Contact Section');
    INSERT INTO audit_logs (admin_id, action, table_name, record_id, old_values, new_values)
    VALUES (v_actor, 'publish', 'page_sections', v_draft.id, v_old_snapshot, v_new_snapshot);
    RETURN jsonb_build_object('ok', true, 'data', v_new_snapshot);
END;
$$;

REVOKE ALL ON FUNCTION home_contact_section_snapshot(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION save_home_contact_section_draft(JSONB, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION publish_home_contact_section_draft(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_home_contact_section_draft(JSONB, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_home_contact_section_draft(UUID, TIMESTAMPTZ) TO authenticated;

DO $$
DECLARE
    v_page_id UUID;
    v_section_id UUID;
    v_snapshot JSONB;
BEGIN
    SELECT id INTO v_page_id FROM pages WHERE slug = 'home';
    IF v_page_id IS NULL THEN
        RAISE EXCEPTION 'Home page is required before seeding the Contact Section';
    END IF;
    IF EXISTS (
        SELECT 1 FROM page_sections
         WHERE page_id = v_page_id AND section_key = 'contact-section-home' AND status = 'published'
    ) THEN
        RETURN;
    END IF;

    INSERT INTO page_sections (
        page_id, section_key, section_name, tag_text, heading, description,
        sort_order, is_visible, status, version_number, settings,
        published_at, published_by
    ) VALUES (
        v_page_id, 'contact-section-home', 'Contact Section', 'GET IN TOUCH',
        'Schedule a Private View',
        'We invite you to experience the spatial prestige of our ready spaces. Walk in or reserve a consultation with our property advisers.',
        80, true, 'published', 1,
        jsonb_build_object(
            'form_heading', 'Request Property Layouts',
            'form_description', 'Fill out the form below to receive detailed architectural layout plans, floor plans, and pricing quotes for ready slots.',
            'name_label', 'Full Name',
            'email_label', 'Corporate Email',
            'phone_label', 'Phone Number',
            'size_label', 'Required Space Size',
            'message_label', 'Your Corporate Requirements (Optional)',
            'name_error', 'Please enter your name.',
            'email_error', 'Please enter a valid corporate email.',
            'phone_error', 'Please enter a valid phone number.',
            'size_error', 'Please select a space requirement.',
            'submit_label', 'Request Details',
            'submitting_label', 'Sending Request...',
            'success_title', 'Request Received Successfully',
            'success_body', 'Thank you for contacting Dhaka Heights Properties Limited. Our corporate representative will send layout PDFs to your email and contact you shortly.',
            'close_label', 'Close',
            'map_lake_label', 'Gulshan Lake',
            'map_road_label', 'Gulshan Avenue',
            'map_tooltip', 'Dhaka Heights Properties Limited (Amanullah Trade Center)'
        ),
        clock_timestamp(), NULL
    ) RETURNING id INTO v_section_id;

    INSERT INTO section_items (
        section_id, item_key, title, body_text, icon_library, icon_key, sort_order, is_visible
    ) VALUES
    (v_section_id, 'detail-headquarters', 'Corporate Headquarters', 'Amanullah Trade Center, 10th Floor, Gulshan Circle-2, Dhaka-1212', 'fontawesome', 'fa-location-dot', 10, true),
    (v_section_id, 'detail-hotline', 'Hotline / Booking Call', '+880 9614 666 777 (9 AM - 8 PM)', 'fontawesome', 'fa-phone-volume', 20, true),
    (v_section_id, 'detail-email', 'Email Queries', 'info@dhakaheights.com', 'fontawesome', 'fa-envelope', 30, true);

    INSERT INTO section_items (
        section_id, item_key, title, primary_cta_url, sort_order, is_visible
    ) VALUES
    (v_section_id, 'option-1910-sft', '1910 SFT (Ready Slot)', '1910', 10, true),
    (v_section_id, 'option-3700-sft', '3700 SFT (Ready Floor Slot)', '3700', 20, true),
    (v_section_id, 'option-multiple-floors', 'Multiple Floors / Flagship Slots', 'multiple', 30, true),
    (v_section_id, 'option-general-inquiry', 'General Corporate Inquiry', 'other', 40, true);

    v_snapshot := home_contact_section_snapshot(v_section_id);
    INSERT INTO content_revisions (table_name, record_id, revision_data, version_number, change_summary)
    VALUES ('page_sections', v_section_id, v_snapshot, 1, 'Seeded initial published Home Contact Section');
    INSERT INTO audit_logs (admin_id, action, table_name, record_id, new_values)
    VALUES (NULL, 'migration_seed', 'page_sections', v_section_id, v_snapshot);
END;
$$;

COMMIT;
