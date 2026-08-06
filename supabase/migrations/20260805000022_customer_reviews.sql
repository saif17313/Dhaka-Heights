BEGIN;

CREATE TABLE IF NOT EXISTS customer_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_designation TEXT,
    customer_location TEXT,
    customer_type TEXT,
    review_category TEXT,
    related_project TEXT,
    profile_image_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    profile_image_alt TEXT,
    review_text TEXT NOT NULL,
    rating SMALLINT,
    review_date DATE,
    selected_preview_media_id UUID,
    status content_status NOT NULL DEFAULT 'draft',
    is_featured BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES admin_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES admin_profiles(id) ON DELETE SET NULL,
    CONSTRAINT customer_reviews_slug_format CHECK (char_length(slug) <= 180 AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT customer_reviews_name_length CHECK (char_length(btrim(customer_name)) BETWEEN 1 AND 160),
    CONSTRAINT customer_reviews_text_length CHECK (char_length(btrim(review_text)) BETWEEN 1 AND 12000),
    CONSTRAINT customer_reviews_optional_lengths CHECK (
        (customer_designation IS NULL OR char_length(customer_designation) <= 180)
        AND (customer_location IS NULL OR char_length(customer_location) <= 200)
        AND (review_category IS NULL OR char_length(review_category) <= 120)
        AND (related_project IS NULL OR char_length(related_project) <= 220)
        AND (profile_image_alt IS NULL OR char_length(profile_image_alt) <= 180)
    ),
    CONSTRAINT customer_reviews_rating_range CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
    CONSTRAINT customer_reviews_sort_order_nonnegative CHECK (sort_order >= 0),
    CONSTRAINT customer_reviews_customer_type CHECK (
        customer_type IS NULL OR customer_type IN ('Apartment Buyer', 'Landowner', 'Investor', 'Other')
    )
);

CREATE TABLE IF NOT EXISTS customer_review_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES customer_reviews(id) ON DELETE CASCADE,
    media_type TEXT NOT NULL,
    image_asset_id UUID REFERENCES media_assets(id) ON DELETE CASCADE,
    youtube_url TEXT,
    youtube_video_id TEXT,
    thumbnail_url TEXT,
    caption TEXT,
    alt_text TEXT,
    sort_order INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT customer_review_media_type CHECK (media_type IN ('image', 'youtube')),
    CONSTRAINT customer_review_media_sort_order_nonnegative CHECK (sort_order >= 0),
    CONSTRAINT customer_review_media_optional_lengths CHECK (
        (youtube_url IS NULL OR char_length(youtube_url) <= 500)
        AND (thumbnail_url IS NULL OR char_length(thumbnail_url) <= 500)
        AND (caption IS NULL OR char_length(caption) <= 500)
        AND (alt_text IS NULL OR char_length(alt_text) <= 180)
    ),
    CONSTRAINT customer_review_media_youtube_id CHECK (
        youtube_video_id IS NULL OR youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'
    ),
    CONSTRAINT customer_review_media_payload CHECK (
        (media_type = 'image' AND image_asset_id IS NOT NULL AND youtube_video_id IS NULL AND youtube_url IS NULL)
        OR
        (media_type = 'youtube' AND image_asset_id IS NULL AND youtube_video_id IS NOT NULL AND youtube_url IS NOT NULL)
    )
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'customer_reviews_selected_preview_fkey'
    ) THEN
        ALTER TABLE customer_reviews
            ADD CONSTRAINT customer_reviews_selected_preview_fkey
            FOREIGN KEY (selected_preview_media_id)
            REFERENCES customer_review_media(id)
            ON DELETE SET NULL;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_customer_reviews_status_sort
    ON customer_reviews(status, sort_order, review_date DESC NULLS LAST, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_featured
    ON customer_reviews(is_featured, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_review_date
    ON customer_reviews(review_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_created_at
    ON customer_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_review_media_review
    ON customer_review_media(review_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_customer_review_media_type
    ON customer_review_media(media_type);

CREATE OR REPLACE FUNCTION set_customer_review_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := clock_timestamp();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_customer_reviews_updated_at ON customer_reviews;
CREATE TRIGGER set_customer_reviews_updated_at
BEFORE UPDATE ON customer_reviews
FOR EACH ROW EXECUTE FUNCTION set_customer_review_updated_at();

DROP TRIGGER IF EXISTS set_customer_review_media_updated_at ON customer_review_media;
CREATE TRIGGER set_customer_review_media_updated_at
BEFORE UPDATE ON customer_review_media
FOR EACH ROW EXECUTE FUNCTION set_customer_review_updated_at();

CREATE OR REPLACE FUNCTION validate_customer_review_selected_preview()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.selected_preview_media_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM customer_review_media media
        WHERE media.id = NEW.selected_preview_media_id
          AND media.review_id = NEW.id
    ) THEN
        RAISE EXCEPTION 'Selected preview media must belong to the same customer review'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_customer_review_preview ON customer_reviews;
CREATE CONSTRAINT TRIGGER validate_customer_review_preview
AFTER INSERT OR UPDATE ON customer_reviews
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_customer_review_selected_preview();

CREATE OR REPLACE FUNCTION prevent_selected_review_media_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.review_id IS DISTINCT FROM OLD.review_id
       AND EXISTS (
           SELECT 1 FROM customer_reviews
           WHERE selected_preview_media_id = OLD.id
       ) THEN
        RAISE EXCEPTION 'Selected preview media cannot be reassigned to another review'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_selected_review_media_reassignment ON customer_review_media;
CREATE TRIGGER prevent_selected_review_media_reassignment
BEFORE UPDATE OF review_id ON customer_review_media
FOR EACH ROW EXECUTE FUNCTION prevent_selected_review_media_reassignment();

CREATE OR REPLACE FUNCTION sync_customer_review_profile_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.profile_image_id IS NOT NULL THEN
        DELETE FROM media_asset_usage
        WHERE table_name = 'customer_reviews'
          AND record_id = OLD.id
          AND field_name = 'profile_image_id';
    END IF;

    IF TG_OP <> 'DELETE' AND NEW.profile_image_id IS NOT NULL THEN
        INSERT INTO media_asset_usage(media_asset_id, table_name, record_id, field_name)
        VALUES(NEW.profile_image_id, 'customer_reviews', NEW.id, 'profile_image_id')
        ON CONFLICT DO NOTHING;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_customer_review_profile_usage ON customer_reviews;
CREATE TRIGGER sync_customer_review_profile_usage
AFTER INSERT OR UPDATE OF profile_image_id OR DELETE ON customer_reviews
FOR EACH ROW EXECUTE FUNCTION sync_customer_review_profile_usage();

CREATE OR REPLACE FUNCTION sync_customer_review_media_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.image_asset_id IS NOT NULL THEN
        DELETE FROM media_asset_usage
        WHERE table_name = 'customer_review_media'
          AND record_id = OLD.id
          AND field_name = 'image_asset_id';
    END IF;

    IF TG_OP <> 'DELETE' AND NEW.image_asset_id IS NOT NULL THEN
        INSERT INTO media_asset_usage(media_asset_id, table_name, record_id, field_name)
        VALUES(NEW.image_asset_id, 'customer_review_media', NEW.id, 'image_asset_id')
        ON CONFLICT DO NOTHING;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_customer_review_media_usage ON customer_review_media;
CREATE TRIGGER sync_customer_review_media_usage
AFTER INSERT OR UPDATE OF image_asset_id OR DELETE ON customer_review_media
FOR EACH ROW EXECUTE FUNCTION sync_customer_review_media_usage();

CREATE OR REPLACE FUNCTION save_customer_review(
    p_payload JSONB,
    p_expected_updated_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_review JSONB := COALESCE(p_payload->'review', '{}'::jsonb);
    v_media_items JSONB := COALESCE(p_payload->'media', '[]'::jsonb);
    v_review_id UUID;
    v_selected_preview UUID;
    v_existing_updated_at TIMESTAMPTZ;
    v_item JSONB;
    v_media_id UUID;
    v_image_asset_id UUID;
    v_profile_image_id UUID;
    v_media_ids UUID[] := ARRAY[]::UUID[];
    v_status content_status;
BEGIN
    IF get_admin_role() IS NULL OR get_admin_role() NOT IN ('super_admin', 'content_editor') THEN
        RAISE EXCEPTION 'Administrator permission is required' USING ERRCODE = '42501';
    END IF;

    BEGIN
        v_review_id := (v_review->>'id')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'A valid customer review ID is required' USING ERRCODE = '22023';
    END;

    IF jsonb_typeof(v_media_items) <> 'array' THEN
        RAISE EXCEPTION 'Customer review media must be an array' USING ERRCODE = '22023';
    END IF;

    IF jsonb_array_length(v_media_items) > 60 THEN
        RAISE EXCEPTION 'A customer review supports at most 60 media items' USING ERRCODE = '22023';
    END IF;

    BEGIN
        v_status := COALESCE(NULLIF(v_review->>'status', ''), 'draft')::content_status;
    EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Unsupported customer review status' USING ERRCODE = '22023';
    END;

    SELECT updated_at
    INTO v_existing_updated_at
    FROM customer_reviews
    WHERE id = v_review_id
    FOR UPDATE;

    IF FOUND AND p_expected_updated_at IS NOT NULL
       AND v_existing_updated_at IS DISTINCT FROM p_expected_updated_at THEN
        RAISE EXCEPTION 'Customer review changed in another session'
            USING ERRCODE = '40001';
    END IF;

    BEGIN
        v_profile_image_id := NULLIF(v_review->>'profileImageId', '')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'The selected customer profile image is invalid'
            USING ERRCODE = '22023';
    END;

    IF v_profile_image_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM media_assets
           WHERE id = v_profile_image_id
             AND resource_type = 'image'
             AND is_archived = false
       ) THEN
        RAISE EXCEPTION 'The selected customer profile image is unavailable'
            USING ERRCODE = '23503';
    END IF;

    INSERT INTO customer_reviews(
        id, slug, customer_name, customer_designation, customer_location,
        customer_type, review_category, related_project, profile_image_id, profile_image_alt,
        review_text, rating, review_date, selected_preview_media_id, status,
        is_featured, sort_order, created_by, updated_by
    ) VALUES (
        v_review_id,
        lower(btrim(v_review->>'slug')),
        btrim(v_review->>'customerName'),
        NULLIF(btrim(v_review->>'customerDesignation'), ''),
        NULLIF(btrim(v_review->>'customerLocation'), ''),
        NULLIF(btrim(v_review->>'customerType'), ''),
        NULLIF(btrim(v_review->>'reviewCategory'), ''),
        NULLIF(btrim(v_review->>'relatedProject'), ''),
        v_profile_image_id,
        NULLIF(btrim(v_review->>'profileImageAlt'), ''),
        btrim(v_review->>'reviewText'),
        NULLIF(v_review->>'rating', '')::SMALLINT,
        NULLIF(v_review->>'reviewDate', '')::DATE,
        NULL,
        v_status,
        COALESCE((v_review->>'isFeatured')::BOOLEAN, false),
        GREATEST(COALESCE((v_review->>'sortOrder')::INTEGER, 10), 0),
        v_actor,
        v_actor
    )
    ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        customer_name = EXCLUDED.customer_name,
        customer_designation = EXCLUDED.customer_designation,
        customer_location = EXCLUDED.customer_location,
        customer_type = EXCLUDED.customer_type,
        review_category = EXCLUDED.review_category,
        related_project = EXCLUDED.related_project,
        profile_image_id = EXCLUDED.profile_image_id,
        profile_image_alt = EXCLUDED.profile_image_alt,
        review_text = EXCLUDED.review_text,
        rating = EXCLUDED.rating,
        review_date = EXCLUDED.review_date,
        status = EXCLUDED.status,
        is_featured = EXCLUDED.is_featured,
        sort_order = EXCLUDED.sort_order,
        updated_by = v_actor;

    FOR v_item IN SELECT value FROM jsonb_array_elements(v_media_items)
    LOOP
        BEGIN
            v_media_id := (v_item->>'id')::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            RAISE EXCEPTION 'Every customer review media item requires a valid ID'
                USING ERRCODE = '22023';
        END;

        IF EXISTS (
            SELECT 1 FROM customer_review_media
            WHERE id = v_media_id
              AND review_id <> v_review_id
        ) THEN
            RAISE EXCEPTION 'Customer review media belongs to another review'
                USING ERRCODE = '23514';
        END IF;

        v_media_ids := array_append(v_media_ids, v_media_id);

        IF v_item->>'mediaType' = 'image' THEN
            BEGIN
                v_image_asset_id := (v_item->>'imageAssetId')::UUID;
            EXCEPTION WHEN invalid_text_representation THEN
                RAISE EXCEPTION 'Every review photo requires a valid media asset'
                    USING ERRCODE = '22023';
            END;

            IF NOT EXISTS (
                SELECT 1 FROM media_assets
                WHERE id = v_image_asset_id
                  AND resource_type = 'image'
                  AND is_archived = false
            ) THEN
                RAISE EXCEPTION 'A selected customer review photo is unavailable'
                    USING ERRCODE = '23503';
            END IF;

            INSERT INTO customer_review_media(
                id, review_id, media_type, image_asset_id, youtube_url,
                youtube_video_id, thumbnail_url, caption, alt_text, sort_order
            ) VALUES (
                v_media_id, v_review_id, 'image', v_image_asset_id, NULL,
                NULL, NULL, NULLIF(btrim(v_item->>'caption'), ''),
                NULLIF(btrim(v_item->>'altText'), ''),
                GREATEST(COALESCE((v_item->>'sortOrder')::INTEGER, 10), 0)
            )
            ON CONFLICT (id) DO UPDATE SET
                review_id = EXCLUDED.review_id,
                media_type = EXCLUDED.media_type,
                image_asset_id = EXCLUDED.image_asset_id,
                youtube_url = NULL,
                youtube_video_id = NULL,
                thumbnail_url = NULL,
                caption = EXCLUDED.caption,
                alt_text = EXCLUDED.alt_text,
                sort_order = EXCLUDED.sort_order;
        ELSIF v_item->>'mediaType' = 'youtube' THEN
            IF COALESCE(v_item->>'youtubeVideoId', '') !~ '^[A-Za-z0-9_-]{11}$' THEN
                RAISE EXCEPTION 'Every YouTube media item requires a valid video ID'
                    USING ERRCODE = '22023';
            END IF;

            INSERT INTO customer_review_media(
                id, review_id, media_type, image_asset_id, youtube_url,
                youtube_video_id, thumbnail_url, caption, alt_text, sort_order
            ) VALUES (
                v_media_id, v_review_id, 'youtube', NULL,
                btrim(v_item->>'youtubeUrl'), btrim(v_item->>'youtubeVideoId'),
                NULLIF(btrim(v_item->>'thumbnailUrl'), ''),
                NULLIF(btrim(v_item->>'caption'), ''), NULL,
                GREATEST(COALESCE((v_item->>'sortOrder')::INTEGER, 10), 0)
            )
            ON CONFLICT (id) DO UPDATE SET
                review_id = EXCLUDED.review_id,
                media_type = EXCLUDED.media_type,
                image_asset_id = NULL,
                youtube_url = EXCLUDED.youtube_url,
                youtube_video_id = EXCLUDED.youtube_video_id,
                thumbnail_url = EXCLUDED.thumbnail_url,
                caption = EXCLUDED.caption,
                alt_text = NULL,
                sort_order = EXCLUDED.sort_order;
        ELSE
            RAISE EXCEPTION 'Unsupported customer review media type'
                USING ERRCODE = '22023';
        END IF;
    END LOOP;

    IF cardinality(v_media_ids) = 0 THEN
        DELETE FROM customer_review_media WHERE review_id = v_review_id;
    ELSE
        DELETE FROM customer_review_media
        WHERE review_id = v_review_id
          AND NOT (id = ANY(v_media_ids));
    END IF;

    BEGIN
        v_selected_preview := NULLIF(v_review->>'selectedPreviewMediaId', '')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Selected preview media ID is invalid' USING ERRCODE = '22023';
    END;

    IF v_selected_preview IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM customer_review_media
           WHERE id = v_selected_preview
             AND review_id = v_review_id
       ) THEN
        RAISE EXCEPTION 'Selected preview media is not part of this review'
            USING ERRCODE = '23514';
    END IF;

    UPDATE customer_reviews
    SET selected_preview_media_id = v_selected_preview,
        updated_by = v_actor
    WHERE id = v_review_id;

    INSERT INTO audit_logs(admin_id, action, table_name, record_id, new_values)
    VALUES(v_actor, CASE WHEN v_existing_updated_at IS NULL THEN 'create' ELSE 'update' END,
           'customer_reviews', v_review_id, p_payload);

    RETURN jsonb_build_object('ok', true, 'reviewId', v_review_id);
END;
$$;

ALTER TABLE customer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_review_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Published Customer Reviews" ON customer_reviews;
CREATE POLICY "Public Read Published Customer Reviews" ON customer_reviews
FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "Public Read Published Customer Review Media" ON customer_review_media;
CREATE POLICY "Public Read Published Customer Review Media" ON customer_review_media
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM customer_reviews review
        WHERE review.id = customer_review_media.review_id
          AND review.status = 'published'
    )
);

DROP POLICY IF EXISTS "Admin Manage Customer Reviews" ON customer_reviews;
CREATE POLICY "Admin Manage Customer Reviews" ON customer_reviews
FOR ALL
USING (get_admin_role() IN ('super_admin', 'content_editor'))
WITH CHECK (get_admin_role() IN ('super_admin', 'content_editor'));

DROP POLICY IF EXISTS "Admin Manage Customer Review Media" ON customer_review_media;
CREATE POLICY "Admin Manage Customer Review Media" ON customer_review_media
FOR ALL
USING (get_admin_role() IN ('super_admin', 'content_editor'))
WITH CHECK (get_admin_role() IN ('super_admin', 'content_editor'));

GRANT SELECT ON customer_reviews, customer_review_media TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON customer_reviews, customer_review_media TO authenticated;
REVOKE ALL ON FUNCTION save_customer_review(JSONB, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION save_customer_review(JSONB, TIMESTAMPTZ) TO authenticated;

UPDATE page_sections
SET settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{labels,customerReviewsTab}',
    to_jsonb(COALESCE(NULLIF(settings#>>'{labels,customerReviewsTab}', ''), 'Customer Reviews')),
    true
)
WHERE section_key = 'media-page';

COMMIT;
