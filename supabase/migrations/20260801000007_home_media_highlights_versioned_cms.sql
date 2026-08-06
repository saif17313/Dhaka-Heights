BEGIN;

-- Phase 1F: ordered Home media placements backed by canonical media_posts.
ALTER TABLE section_entity_selection_items
    ADD COLUMN IF NOT EXISTS override_category TEXT,
    ADD COLUMN IF NOT EXISTS override_cta_url TEXT;

ALTER TABLE media_posts
    DROP CONSTRAINT IF EXISTS media_posts_cover_image_id_fkey,
    ADD CONSTRAINT media_posts_cover_image_id_fkey
        FOREIGN KEY (cover_image_id) REFERENCES media_assets(id) ON DELETE RESTRICT;

ALTER TABLE section_entity_selection_items
    DROP CONSTRAINT IF EXISTS section_entity_selection_items_media_post_id_fkey,
    ADD CONSTRAINT section_entity_selection_items_media_post_id_fkey
        FOREIGN KEY (media_post_id) REFERENCES media_posts(id) ON DELETE RESTRICT,
    DROP CONSTRAINT IF EXISTS section_entity_selection_items_override_cover_image_id_fkey,
    ADD CONSTRAINT section_entity_selection_items_override_cover_image_id_fkey
        FOREIGN KEY (override_cover_image_id) REFERENCES media_assets(id) ON DELETE RESTRICT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'section_entity_selection_items_one_entity'
    ) THEN
        ALTER TABLE section_entity_selection_items
            ADD CONSTRAINT section_entity_selection_items_one_entity
            CHECK (num_nonnulls(project_id, concern_id, media_post_id) = 1);
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_selection_media_post
    ON section_entity_selection_items (selection_id, media_post_id)
    WHERE media_post_id IS NOT NULL;

CREATE OR REPLACE FUNCTION validate_section_entity_selection_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_entity_type TEXT;
BEGIN
    SELECT entity_type INTO v_entity_type
      FROM section_entity_selections
     WHERE id = NEW.selection_id;

    IF v_entity_type IS NULL THEN
        RAISE EXCEPTION 'Selection does not exist' USING ERRCODE = '23503';
    END IF;

    IF (v_entity_type = 'project' AND NEW.project_id IS NULL)
       OR (v_entity_type = 'concern' AND NEW.concern_id IS NULL)
       OR (v_entity_type = 'media_post' AND NEW.media_post_id IS NULL) THEN
        RAISE EXCEPTION 'Selection item entity does not match its selection type' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_section_entity_selection_item_trigger ON section_entity_selection_items;
CREATE TRIGGER validate_section_entity_selection_item_trigger
    BEFORE INSERT OR UPDATE OF selection_id, project_id, concern_id, media_post_id
    ON section_entity_selection_items
    FOR EACH ROW EXECUTE FUNCTION validate_section_entity_selection_item();

-- Hidden published CMS sections remain readable as metadata so the loader can
-- distinguish an intentionally disabled section from missing configuration.
DROP POLICY IF EXISTS "Public Read Published Page Sections" ON page_sections;
CREATE POLICY "Public Read Published Page Sections" ON page_sections
    FOR SELECT
    USING (
        status = 'published'
        AND (
            is_visible = true
            OR section_key IN (
                'hero-slider', 'about-corporate-home', 'statistics-counter',
                'featured-projects-home', 'commitment-quote', 'media-highlights-home'
            )
        )
        AND EXISTS (
            SELECT 1 FROM pages
             WHERE pages.id = page_sections.page_id
               AND pages.is_published = true
        )
    );

CREATE OR REPLACE FUNCTION home_media_highlights_snapshot(p_section_id UUID)
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
        'viewAllLabel', COALESCE(ps.settings #>> '{view_all,label}', ''),
        'viewAllUrl', COALESCE(ps.settings #>> '{view_all,url}', ''),
        'updatedAt', ps.updated_at,
        'updatedBy', ps.updated_by,
        'publishedAt', ps.published_at,
        'publishedBy', ps.published_by,
        'articles', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'placementId', sei.id,
                    'mediaPostId', mp.id,
                    'sortOrder', sei.sort_order,
                    'isVisible', sei.is_visible,
                    'overrideTitle', sei.override_title,
                    'overrideDescription', sei.override_description,
                    'overrideCategory', sei.override_category,
                    'overrideCoverMediaId', sei.override_cover_image_id,
                    'overrideCtaLabel', sei.override_cta_label,
                    'overrideCtaUrl', sei.override_cta_url,
                    'mediaPost', jsonb_build_object(
                        'id', mp.id,
                        'slug', mp.slug,
                        'title', mp.title,
                        'category', mp.category,
                        'publishedDate', mp.published_date,
                        'excerpt', COALESCE(mp.excerpt, ''),
                        'status', mp.status,
                        'coverMediaId', mp.cover_image_id,
                        'coverMedia', CASE WHEN ma.id IS NULL THEN NULL ELSE jsonb_build_object(
                            'id', ma.id,
                            'secureUrl', ma.secure_url,
                            'displayName', COALESCE(ma.display_name, ma.original_filename),
                            'altText', COALESCE(ma.alt_text, ''),
                            'width', ma.width,
                            'height', ma.height
                        ) END
                    )
                ) ORDER BY sei.sort_order, sei.id
            )
              FROM section_entity_selections ses
              JOIN section_entity_selection_items sei ON sei.selection_id = ses.id
              JOIN media_posts mp ON mp.id = sei.media_post_id
              LEFT JOIN media_assets ma ON ma.id = COALESCE(sei.override_cover_image_id, mp.cover_image_id)
             WHERE ses.section_id = ps.id
               AND ses.entity_type = 'media_post'
        ), '[]'::jsonb)
    )
      FROM page_sections ps
     WHERE ps.id = p_section_id;
$$;

CREATE OR REPLACE FUNCTION save_home_media_highlights_draft(
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
    v_selection_id UUID;
    v_next_version INTEGER;
    v_selected_count INTEGER;
    v_old_snapshot JSONB;
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
    IF p_expected_updated_at IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 422, 'code', 'VALIDATION_ERROR', 'error', 'The expected updated timestamp is required.');
    END IF;

    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
       OR p_payload ->> 'sectionKey' IS DISTINCT FROM 'media-highlights-home' THEN
        RAISE EXCEPTION 'Invalid Home Media Highlights payload' USING ERRCODE = '22023';
    END IF;

    BEGIN
        v_source_id := (p_payload ->> 'id')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Home Media Highlights payload contains an invalid section identifier' USING ERRCODE = '22023';
    END;

    IF v_source_id IS NULL
       OR jsonb_typeof(p_payload -> 'isVisible') IS DISTINCT FROM 'boolean'
       OR jsonb_typeof(p_payload -> 'articles') IS DISTINCT FROM 'array'
       OR length(btrim(COALESCE(p_payload ->> 'tagText', ''))) NOT BETWEEN 1 AND 80
       OR length(btrim(COALESCE(p_payload ->> 'heading', ''))) NOT BETWEEN 1 AND 140
       OR length(btrim(COALESCE(p_payload ->> 'viewAllLabel', ''))) NOT BETWEEN 1 AND 40
       OR NOT home_hero_cta_url_valid(btrim(COALESCE(p_payload ->> 'viewAllUrl', ''))) THEN
        RAISE EXCEPTION 'Home Media Highlights section fields are invalid' USING ERRCODE = '22023';
    END IF;

    v_selected_count := jsonb_array_length(p_payload -> 'articles');
    IF v_selected_count NOT BETWEEN 1 AND 12 THEN
        RAISE EXCEPTION 'Select between 1 and 12 Home media posts' USING ERRCODE = '22023';
    END IF;

    IF (SELECT count(DISTINCT article ->> 'mediaPostId') FROM jsonb_array_elements(p_payload -> 'articles') article) <> v_selected_count
       OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(p_payload -> 'articles') article
             WHERE COALESCE(article ->> 'mediaPostId', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                OR jsonb_typeof(article -> 'isVisible') IS DISTINCT FROM 'boolean'
                OR length(btrim(COALESCE(article ->> 'overrideTitle', ''))) > 220
                OR length(btrim(COALESCE(article ->> 'overrideDescription', ''))) > 1000
                OR length(btrim(COALESCE(article ->> 'overrideCategory', ''))) > 80
                OR length(btrim(COALESCE(article ->> 'overrideCtaLabel', ''))) > 40
                OR (
                    NULLIF(btrim(COALESCE(article ->> 'overrideCtaUrl', '')), '') IS NOT NULL
                    AND NOT home_hero_cta_url_valid(btrim(article ->> 'overrideCtaUrl'))
                )
                OR (
                    NULLIF(article ->> 'overrideCoverMediaId', '') IS NOT NULL
                    AND COALESCE(article ->> 'overrideCoverMediaId', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                )
       )
       OR NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(p_payload -> 'articles') article
             WHERE (article ->> 'isVisible')::BOOLEAN = true
       ) THEN
        RAISE EXCEPTION 'Home media placements are invalid, duplicated, or all hidden' USING ERRCODE = '22023';
    END IF;

    PERFORM mp.id
      FROM media_posts mp
      JOIN media_assets ma ON ma.id = COALESCE(
          (SELECT NULLIF(article ->> 'overrideCoverMediaId', '')::UUID
             FROM jsonb_array_elements(p_payload -> 'articles') article
            WHERE (article ->> 'mediaPostId')::UUID = mp.id),
          mp.cover_image_id
      )
     WHERE mp.id IN (
        SELECT (article ->> 'mediaPostId')::UUID
          FROM jsonb_array_elements(p_payload -> 'articles') article
     )
     ORDER BY mp.id
     FOR SHARE OF mp, ma;

    IF (
        SELECT count(*)
          FROM media_posts mp
          JOIN media_assets ma ON ma.id = COALESCE(
              (SELECT NULLIF(article ->> 'overrideCoverMediaId', '')::UUID
                 FROM jsonb_array_elements(p_payload -> 'articles') article
                WHERE (article ->> 'mediaPostId')::UUID = mp.id),
              mp.cover_image_id
          )
         WHERE mp.id IN (
            SELECT (article ->> 'mediaPostId')::UUID
              FROM jsonb_array_elements(p_payload -> 'articles') article
         )
           AND mp.status = 'published'
           AND ma.is_archived = false
           AND ma.resource_type = 'image'
    ) <> v_selected_count THEN
        RAISE EXCEPTION 'Every Home placement must reference a published media post with an active cover image' USING ERRCODE = '23503';
    END IF;

    SELECT id INTO v_page_id FROM pages WHERE slug = 'home' FOR UPDATE;
    IF v_page_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 503, 'code', 'HOME_PAGE_NOT_CONFIGURED', 'error', 'The Home page record is not configured.');
    END IF;
    IF NULLIF(p_payload ->> 'pageId', '') IS NOT NULL
       AND (p_payload ->> 'pageId')::UUID <> v_page_id THEN
        RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_MEDIA_HIGHLIGHTS_CONFLICT', 'error', 'The edited section no longer belongs to the current Home page.');
    END IF;

    SELECT * INTO v_draft
      FROM page_sections
     WHERE page_id = v_page_id AND section_key = 'media-highlights-home' AND status = 'draft'
     FOR UPDATE;

    IF v_draft.id IS NOT NULL THEN
        IF v_source_id <> v_draft.id OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN
            RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_MEDIA_HIGHLIGHTS_CONFLICT', 'error', 'The Media Highlights draft changed after this editor loaded it.');
        END IF;
        v_draft_id := v_draft.id;
        v_old_snapshot := home_media_highlights_snapshot(v_draft_id);
        UPDATE page_sections
           SET tag_text = btrim(p_payload ->> 'tagText'),
               heading = btrim(p_payload ->> 'heading'),
               is_visible = (p_payload ->> 'isVisible')::BOOLEAN,
               settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
                   'view_all', jsonb_build_object(
                       'label', btrim(p_payload ->> 'viewAllLabel'),
                       'url', btrim(p_payload ->> 'viewAllUrl')
                   )
               ),
               updated_by = v_actor
         WHERE id = v_draft_id;

        DELETE FROM media_asset_usage
         WHERE table_name = 'section_entity_selection_items'
           AND record_id IN (
               SELECT sei.id
                 FROM section_entity_selection_items sei
                 JOIN section_entity_selections ses ON ses.id = sei.selection_id
                WHERE ses.section_id = v_draft_id AND ses.entity_type = 'media_post'
           );
        DELETE FROM section_entity_selections WHERE section_id = v_draft_id AND entity_type = 'media_post';
    ELSE
        SELECT * INTO v_published
          FROM page_sections
         WHERE page_id = v_page_id AND section_key = 'media-highlights-home' AND status = 'published'
         FOR UPDATE;
        IF v_published.id IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'status', 503, 'code', 'HOME_MEDIA_HIGHLIGHTS_NOT_CONFIGURED', 'error', 'The published Home Media Highlights section is not configured.');
        END IF;
        IF v_source_id <> v_published.id OR v_published.updated_at IS DISTINCT FROM p_expected_updated_at THEN
            RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_MEDIA_HIGHLIGHTS_CONFLICT', 'error', 'The published Media Highlights section changed after this editor loaded it.');
        END IF;

        SELECT COALESCE(max(version_number), 0) + 1 INTO v_next_version
          FROM page_sections
         WHERE page_id = v_page_id AND section_key = 'media-highlights-home';
        v_old_snapshot := home_media_highlights_snapshot(v_published.id);

        INSERT INTO page_sections (
            page_id, section_key, section_name, tag_text, heading, allowed_variant,
            sort_order, is_visible, status, version_number, settings, updated_by, supersedes_id
        ) VALUES (
            v_page_id, 'media-highlights-home', v_published.section_name,
            btrim(p_payload ->> 'tagText'), btrim(p_payload ->> 'heading'),
            v_published.allowed_variant, v_published.sort_order,
            (p_payload ->> 'isVisible')::BOOLEAN, 'draft', v_next_version,
            COALESCE(v_published.settings, '{}'::jsonb) || jsonb_build_object(
                'view_all', jsonb_build_object(
                    'label', btrim(p_payload ->> 'viewAllLabel'),
                    'url', btrim(p_payload ->> 'viewAllUrl')
                )
            ),
            v_actor, v_published.id
        ) RETURNING id INTO v_draft_id;
    END IF;

    INSERT INTO section_entity_selections (section_id, entity_type)
    VALUES (v_draft_id, 'media_post') RETURNING id INTO v_selection_id;

    INSERT INTO section_entity_selection_items (
        selection_id, media_post_id, override_title, override_description,
        override_category, override_cover_image_id, override_cta_label,
        override_cta_url, sort_order, is_visible
    )
    SELECT v_selection_id,
           (article ->> 'mediaPostId')::UUID,
           NULLIF(btrim(article ->> 'overrideTitle'), ''),
           NULLIF(btrim(article ->> 'overrideDescription'), ''),
           NULLIF(btrim(article ->> 'overrideCategory'), ''),
           NULLIF(article ->> 'overrideCoverMediaId', '')::UUID,
           NULLIF(btrim(article ->> 'overrideCtaLabel'), ''),
           NULLIF(btrim(article ->> 'overrideCtaUrl'), ''),
           ordinal * 10,
           (article ->> 'isVisible')::BOOLEAN
      FROM jsonb_array_elements(p_payload -> 'articles') WITH ORDINALITY AS entries(article, ordinal);

    INSERT INTO media_asset_usage (media_asset_id, table_name, record_id, field_name)
    SELECT override_cover_image_id, 'section_entity_selection_items', id, 'override_cover_image_id'
      FROM section_entity_selection_items
     WHERE selection_id = v_selection_id AND override_cover_image_id IS NOT NULL
    ON CONFLICT (media_asset_id, table_name, record_id, field_name) DO NOTHING;

    v_new_snapshot := home_media_highlights_snapshot(v_draft_id);
    SELECT COALESCE(max(version_number), 0) + 1 INTO v_revision_number
      FROM content_revisions
     WHERE table_name = 'page_sections' AND record_id = v_draft_id;
    INSERT INTO content_revisions (
        table_name, record_id, revision_data, created_by, version_number, change_summary
    ) VALUES (
        'page_sections', v_draft_id, v_new_snapshot, v_actor, v_revision_number,
        CASE WHEN v_draft.id IS NULL THEN 'Created Home Media Highlights draft' ELSE 'Saved Home Media Highlights draft' END
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

CREATE OR REPLACE FUNCTION publish_home_media_highlights_draft(
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
    v_selection_id UUID;
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
     WHERE id = p_section_id AND section_key = 'media-highlights-home' AND status = 'draft'
     FOR UPDATE;
    IF v_draft.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 404, 'code', 'HOME_MEDIA_HIGHLIGHTS_DRAFT_NOT_FOUND', 'error', 'The Home Media Highlights draft no longer exists.');
    END IF;
    IF v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN
        RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'HOME_MEDIA_HIGHLIGHTS_CONFLICT', 'error', 'The Media Highlights draft changed after this editor loaded it.');
    END IF;

    SELECT id INTO v_selection_id
      FROM section_entity_selections
     WHERE section_id = v_draft.id AND entity_type = 'media_post';

    IF v_selection_id IS NULL
       OR (SELECT count(*) FROM section_entity_selection_items WHERE selection_id = v_selection_id) NOT BETWEEN 1 AND 12
       OR NOT EXISTS (SELECT 1 FROM section_entity_selection_items WHERE selection_id = v_selection_id AND is_visible = true)
       OR EXISTS (
            SELECT 1
              FROM section_entity_selection_items sei
              LEFT JOIN media_posts mp ON mp.id = sei.media_post_id
              LEFT JOIN media_assets ma ON ma.id = COALESCE(sei.override_cover_image_id, mp.cover_image_id)
             WHERE sei.selection_id = v_selection_id
               AND (mp.id IS NULL OR mp.status <> 'published' OR ma.id IS NULL OR ma.is_archived = true OR ma.resource_type <> 'image')
       ) THEN
        RETURN jsonb_build_object('ok', false, 'status', 422, 'code', 'HOME_MEDIA_HIGHLIGHTS_INVALID', 'error', 'The Media Highlights draft contains invalid canonical media placements.');
    END IF;

    v_old_snapshot := home_media_highlights_snapshot(v_draft.id);
    SELECT * INTO v_previous_published
      FROM page_sections
     WHERE page_id = v_draft.page_id AND section_key = v_draft.section_key AND status = 'published'
     FOR UPDATE;
    IF v_previous_published.id IS NOT NULL THEN
        v_previous_snapshot := home_media_highlights_snapshot(v_previous_published.id);
        UPDATE page_sections SET status = 'archived', updated_by = v_actor WHERE id = v_previous_published.id;
        INSERT INTO audit_logs (admin_id, action, table_name, record_id, old_values, new_values)
        VALUES (v_actor, 'archive_published', 'page_sections', v_previous_published.id,
            v_previous_snapshot, home_media_highlights_snapshot(v_previous_published.id));
    END IF;

    UPDATE page_sections
       SET status = 'published', published_at = clock_timestamp(),
           published_by = v_actor, updated_by = v_actor
     WHERE id = v_draft.id;

    v_new_snapshot := home_media_highlights_snapshot(v_draft.id);
    SELECT COALESCE(max(version_number), 0) + 1 INTO v_revision_number
      FROM content_revisions
     WHERE table_name = 'page_sections' AND record_id = v_draft.id;
    INSERT INTO content_revisions (
        table_name, record_id, revision_data, created_by, version_number, change_summary
    ) VALUES ('page_sections', v_draft.id, v_new_snapshot, v_actor, v_revision_number, 'Published Home Media Highlights section');
    INSERT INTO audit_logs (admin_id, action, table_name, record_id, old_values, new_values)
    VALUES (v_actor, 'publish', 'page_sections', v_draft.id, v_old_snapshot, v_new_snapshot);
    RETURN jsonb_build_object('ok', true, 'data', v_new_snapshot);
END;
$$;

REVOKE ALL ON FUNCTION home_media_highlights_snapshot(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION save_home_media_highlights_draft(JSONB, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION publish_home_media_highlights_draft(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_home_media_highlights_draft(JSONB, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_home_media_highlights_draft(UUID, TIMESTAMPTZ) TO authenticated;

-- Backfill canonical covers and seed the exact current three-card Home output.
DO $$
DECLARE
    v_page_id UUID;
    v_section_id UUID;
    v_selection_id UUID;
    v_hero1 UUID;
    v_hero2 UUID;
    v_hero3 UUID;
    v_snapshot JSONB;
BEGIN
    SELECT id INTO STRICT v_hero1 FROM media_assets
     WHERE public_id = 'dhaka-heights/dev/hero1' AND resource_type = 'image' AND is_archived = false;
    SELECT id INTO STRICT v_hero2 FROM media_assets
     WHERE public_id = 'dhaka-heights/dev/hero2' AND resource_type = 'image' AND is_archived = false;
    SELECT id INTO STRICT v_hero3 FROM media_assets
     WHERE public_id = 'dhaka-heights/dev/hero3' AND resource_type = 'image' AND is_archived = false;

    INSERT INTO media_posts (
        slug, title, category, published_date, excerpt, content_body,
        cover_image_id, is_featured, status
    ) VALUES (
        'how-to-choose-best-real-estate-company-for-flat-purchase-in-bashundhara-ra',
        'How to choose best real estate company for flat purchase in Bashundhara R/A',
        'Blogs & Articles',
        DATE '2026-03-15',
        'Start by researching the reputation of the developer you are considering. Look for information about their track record, previous projects, and customer reviews...',
        'Start by researching the reputation of the developer you are considering. Look for information about their track record, previous projects, and customer reviews.',
        v_hero3,
        true,
        'published'
    ) ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        category = EXCLUDED.category,
        published_date = EXCLUDED.published_date,
        excerpt = EXCLUDED.excerpt,
        cover_image_id = EXCLUDED.cover_image_id,
        status = 'published',
        updated_at = clock_timestamp();

    UPDATE media_posts
       SET cover_image_id = CASE slug
           WHEN 'flats-sale-at-an-affordable-price-in-bashundhara-residential-area-dhaka' THEN v_hero1
           WHEN 'ground-breaking-ceremony-of-dhaka-heights-green-heaven' THEN v_hero2
           WHEN 'top-10-building-construction-companies-in-bashundhara-dhaka-bangladesh-2023' THEN v_hero2
           WHEN 'top-20-real-estate-companies-in-dhaka-bangladesh-2023' THEN v_hero3
           ELSE cover_image_id
       END,
       updated_at = clock_timestamp()
     WHERE slug IN (
        'flats-sale-at-an-affordable-price-in-bashundhara-residential-area-dhaka',
        'ground-breaking-ceremony-of-dhaka-heights-green-heaven',
        'top-10-building-construction-companies-in-bashundhara-dhaka-bangladesh-2023',
        'top-20-real-estate-companies-in-dhaka-bangladesh-2023'
     );

    INSERT INTO media_asset_usage (media_asset_id, table_name, record_id, field_name)
    SELECT cover_image_id, 'media_posts', id, 'cover_image_id'
      FROM media_posts
     WHERE cover_image_id IS NOT NULL
    ON CONFLICT (media_asset_id, table_name, record_id, field_name) DO NOTHING;

    SELECT id INTO v_page_id FROM pages WHERE slug = 'home';
    IF v_page_id IS NULL THEN
        RAISE EXCEPTION 'Home page is required before seeding Media Highlights';
    END IF;
    IF EXISTS (
        SELECT 1 FROM page_sections
         WHERE page_id = v_page_id AND section_key = 'media-highlights-home' AND status = 'published'
    ) THEN
        RETURN;
    END IF;

    INSERT INTO page_sections (
        page_id, section_key, section_name, tag_text, heading, sort_order,
        is_visible, status, version_number, settings, published_at
    ) VALUES (
        v_page_id, 'media-highlights-home', 'Media Highlights', 'MEDIA CENTER',
        'News & Industry Insights', 60, true, 'published', 1,
        jsonb_build_object('view_all', jsonb_build_object('label', 'View All Updates', 'url', '/media-center')),
        clock_timestamp()
    ) RETURNING id INTO v_section_id;

    INSERT INTO section_entity_selections (section_id, entity_type)
    VALUES (v_section_id, 'media_post') RETURNING id INTO v_selection_id;

    INSERT INTO section_entity_selection_items (
        selection_id, media_post_id, override_description, override_category,
        override_cover_image_id, override_cta_label, override_cta_url,
        sort_order, is_visible
    )
    SELECT v_selection_id, mp.id, seed.description, seed.category,
           seed.cover_id, 'Read Article', seed.cta_url, seed.sort_order, true
      FROM (VALUES
        (
          'ground-breaking-ceremony-of-dhaka-heights-green-heaven',
          'Dhaka Heights Construction Limited proudly hosted the launching ceremony of its newest project, Dhaka Heights Green Heaven. Designed as a perfect blend of lake views and urban greenery...',
          'Press Release', v_hero2, '/media-center?cat=news', 10
        ),
        (
          'how-to-choose-best-real-estate-company-for-flat-purchase-in-bashundhara-ra',
          'Start by researching the reputation of the developer you are considering. Look for information about their track record, previous projects, and customer reviews...',
          'Blog', v_hero3, '/media-center?cat=blogs', 20
        ),
        (
          'top-20-real-estate-companies-in-dhaka-bangladesh-2023',
          'Finding a reliable developer to realize their aspirations of owning a building is the dream of every landowner in Bangladesh. Dhaka Heights Development Limited shifts the narrative...',
          'Industry Insights', v_hero1, '/media-center?cat=news', 30
        )
      ) AS seed(slug, description, category, cover_id, cta_url, sort_order)
      JOIN media_posts mp ON mp.slug = seed.slug;

    IF (SELECT count(*) FROM section_entity_selection_items WHERE selection_id = v_selection_id) <> 3 THEN
        RAISE EXCEPTION 'The exact three canonical media placements are required';
    END IF;

    INSERT INTO media_asset_usage (media_asset_id, table_name, record_id, field_name)
    SELECT override_cover_image_id, 'section_entity_selection_items', id, 'override_cover_image_id'
      FROM section_entity_selection_items
     WHERE selection_id = v_selection_id AND override_cover_image_id IS NOT NULL
    ON CONFLICT (media_asset_id, table_name, record_id, field_name) DO NOTHING;

    v_snapshot := home_media_highlights_snapshot(v_section_id);
    INSERT INTO content_revisions (
        table_name, record_id, revision_data, version_number, change_summary
    ) VALUES ('page_sections', v_section_id, v_snapshot, 1, 'Seeded initial published Home Media Highlights section');
    INSERT INTO audit_logs (admin_id, action, table_name, record_id, new_values)
    VALUES (NULL, 'migration_seed', 'page_sections', v_section_id, v_snapshot);
END;
$$;

COMMIT;
