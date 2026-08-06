BEGIN;

-- Phase 1I: make site_settings the version root for the global public shell.
-- Navigation, footer groups/links, and social links belong to one immutable
-- settings version, so draft edits cannot leak into the published website.
ALTER TABLE site_settings
    ADD COLUMN IF NOT EXISTS status content_status,
    ADD COLUMN IF NOT EXISTS version_number INTEGER,
    ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS seo_og_image_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES admin_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES admin_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS supersedes_id UUID REFERENCES site_settings(id) ON DELETE SET NULL;

ALTER TABLE navigation_items
    ADD COLUMN IF NOT EXISTS site_settings_id UUID REFERENCES site_settings(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS item_key TEXT,
    ADD COLUMN IF NOT EXISTS mobile_label TEXT,
    ADD COLUMN IF NOT EXISTS mobile_mode TEXT NOT NULL DEFAULT 'link';

ALTER TABLE footer_groups
    ADD COLUMN IF NOT EXISTS site_settings_id UUID REFERENCES site_settings(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS group_key TEXT;

ALTER TABLE footer_links
    ADD COLUMN IF NOT EXISTS link_key TEXT,
    ADD COLUMN IF NOT EXISTS target TEXT NOT NULL DEFAULT '_self';

ALTER TABLE social_links
    ADD COLUMN IF NOT EXISTS site_settings_id UUID REFERENCES site_settings(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS item_key TEXT,
    ADD COLUMN IF NOT EXISTS target TEXT NOT NULL DEFAULT '_self';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_version_positive') THEN
        ALTER TABLE site_settings ADD CONSTRAINT site_settings_version_positive CHECK (version_number > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_settings_object') THEN
        ALTER TABLE site_settings ADD CONSTRAINT site_settings_settings_object CHECK (jsonb_typeof(settings) = 'object');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'navigation_items_item_key_format') THEN
        ALTER TABLE navigation_items ADD CONSTRAINT navigation_items_item_key_format CHECK (item_key IS NULL OR item_key ~ '^nav-[a-z0-9-]{1,64}$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'navigation_items_mobile_mode_valid') THEN
        ALTER TABLE navigation_items ADD CONSTRAINT navigation_items_mobile_mode_valid CHECK (mobile_mode IN ('link', 'dropdown'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'footer_groups_group_key_format') THEN
        ALTER TABLE footer_groups ADD CONSTRAINT footer_groups_group_key_format CHECK (group_key IS NULL OR group_key ~ '^footer-group-[a-z0-9-]{1,64}$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'footer_links_link_key_format') THEN
        ALTER TABLE footer_links ADD CONSTRAINT footer_links_link_key_format CHECK (link_key IS NULL OR link_key ~ '^footer-link-[a-z0-9-]{1,64}$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'footer_links_target_valid') THEN
        ALTER TABLE footer_links ADD CONSTRAINT footer_links_target_valid CHECK (target IN ('_self', '_blank'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_links_item_key_format') THEN
        ALTER TABLE social_links ADD CONSTRAINT social_links_item_key_format CHECK (item_key IS NULL OR item_key ~ '^social-[a-z0-9-]{1,64}$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_links_target_valid') THEN
        ALTER TABLE social_links ADD CONSTRAINT social_links_target_valid CHECK (target IN ('_self', '_blank'));
    END IF;
END;
$$;

-- Preserve both pre-existing duplicate singleton rows as history.
WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY updated_at, id)::INTEGER AS version_number
      FROM site_settings
     WHERE status IS NULL
)
UPDATE site_settings target
   SET status = 'archived', version_number = ranked.version_number
  FROM ranked
 WHERE target.id = ranked.id;

ALTER TABLE site_settings
    ALTER COLUMN status SET DEFAULT 'draft',
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN version_number SET DEFAULT 1,
    ALTER COLUMN version_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_site_settings_version ON site_settings(version_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_site_settings_active_draft ON site_settings(status) WHERE status = 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS uq_site_settings_active_published ON site_settings(status) WHERE status = 'published';
CREATE UNIQUE INDEX IF NOT EXISTS uq_navigation_version_key ON navigation_items(site_settings_id, item_key) WHERE item_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_footer_group_version_key ON footer_groups(site_settings_id, group_key) WHERE group_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_footer_link_group_key ON footer_links(group_id, link_key) WHERE link_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_social_version_key ON social_links(site_settings_id, item_key) WHERE item_key IS NOT NULL;

DROP TRIGGER IF EXISTS trg_site_settings_updated_at ON site_settings;
CREATE TRIGGER trg_site_settings_updated_at BEFORE UPDATE ON site_settings
FOR EACH ROW EXECUTE FUNCTION set_home_content_updated_at();

-- Public readers see only one published shell version and its visible children.
DROP POLICY IF EXISTS "Public Read Site Settings" ON site_settings;
CREATE POLICY "Public Read Published Site Settings" ON site_settings FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "Public Read Visible Navigation" ON navigation_items;
CREATE POLICY "Public Read Published Navigation" ON navigation_items FOR SELECT USING (
    is_visible = true AND EXISTS (
        SELECT 1 FROM site_settings settings
         WHERE settings.id = navigation_items.site_settings_id AND settings.status = 'published'
    )
);
DROP POLICY IF EXISTS "Public Read Visible Footer Groups" ON footer_groups;
CREATE POLICY "Public Read Published Footer Groups" ON footer_groups FOR SELECT USING (
    is_visible = true AND EXISTS (
        SELECT 1 FROM site_settings settings
         WHERE settings.id = footer_groups.site_settings_id AND settings.status = 'published'
    )
);
DROP POLICY IF EXISTS "Public Read Visible Footer Links" ON footer_links;
CREATE POLICY "Public Read Published Footer Links" ON footer_links FOR SELECT USING (
    is_visible = true AND EXISTS (
        SELECT 1 FROM footer_groups groups
        JOIN site_settings settings ON settings.id = groups.site_settings_id
         WHERE groups.id = footer_links.group_id AND groups.is_visible = true AND settings.status = 'published'
    )
);
DROP POLICY IF EXISTS "Public Read Visible Social Links" ON social_links;
CREATE POLICY "Public Read Published Social Links" ON social_links FOR SELECT USING (
    is_visible = true AND EXISTS (
        SELECT 1 FROM site_settings settings
         WHERE settings.id = social_links.site_settings_id AND settings.status = 'published'
    )
);

CREATE OR REPLACE FUNCTION site_shell_snapshot(p_settings_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT jsonb_build_object(
        'id', ss.id,
        'status', ss.status,
        'versionNumber', ss.version_number,
        'brand', (ss.settings -> 'brand') || jsonb_build_object(
            'logoMediaId', ss.logo_asset_id,
            'faviconMediaId', ss.favicon_asset_id,
            'logoMedia', CASE WHEN logo.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', logo.id, 'secureUrl', logo.secure_url, 'displayName', logo.display_name,
                'altText', logo.alt_text, 'format', logo.format
            ) END,
            'faviconMedia', CASE WHEN favicon.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', favicon.id, 'secureUrl', favicon.secure_url, 'displayName', favicon.display_name,
                'altText', favicon.alt_text, 'format', favicon.format
            ) END
        ),
        'metadata', (ss.settings -> 'metadata') || jsonb_build_object(
            'ogImageMediaId', ss.seo_og_image_id,
            'ogImageMedia', CASE WHEN og.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', og.id, 'secureUrl', og.secure_url, 'displayName', og.display_name,
                'altText', og.alt_text, 'format', og.format
            ) END
        ),
        'preloader', ss.settings -> 'preloader',
        'mobileDrawer', ss.settings -> 'mobileDrawer',
        'quickInquiry', ss.settings -> 'quickInquiry',
        'footer', ss.settings -> 'footer',
        'navigation', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', parent.id, 'itemKey', parent.item_key, 'label', parent.label,
                    'mobileLabel', parent.mobile_label, 'url', parent.url, 'target', parent.target,
                    'mobileMode', parent.mobile_mode, 'sortOrder', parent.sort_order,
                    'isVisible', parent.is_visible,
                    'children', COALESCE((
                        SELECT jsonb_agg(jsonb_build_object(
                            'id', child.id, 'itemKey', child.item_key, 'label', child.label,
                            'mobileLabel', child.mobile_label, 'url', child.url, 'target', child.target,
                            'mobileMode', child.mobile_mode, 'sortOrder', child.sort_order,
                            'isVisible', child.is_visible
                        ) ORDER BY child.sort_order, child.id)
                        FROM navigation_items child WHERE child.parent_id = parent.id
                    ), '[]'::jsonb)
                ) ORDER BY parent.sort_order, parent.id
            ) FROM navigation_items parent
            WHERE parent.site_settings_id = ss.id AND parent.parent_id IS NULL
        ), '[]'::jsonb),
        'footerGroups', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', groups.id, 'groupKey', groups.group_key, 'title', groups.title,
                'sortOrder', groups.sort_order, 'isVisible', groups.is_visible,
                'links', COALESCE((
                    SELECT jsonb_agg(jsonb_build_object(
                        'id', links.id, 'linkKey', links.link_key, 'label', links.label,
                        'url', links.url, 'target', links.target,
                        'sortOrder', links.sort_order, 'isVisible', links.is_visible
                    ) ORDER BY links.sort_order, links.id)
                    FROM footer_links links WHERE links.group_id = groups.id
                ), '[]'::jsonb)
            ) ORDER BY groups.sort_order, groups.id)
            FROM footer_groups groups WHERE groups.site_settings_id = ss.id
        ), '[]'::jsonb),
        'socialLinks', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', social.id, 'itemKey', social.item_key,
                'platformName', social.platform_name, 'url', social.url,
                'iconKey', social.icon_key, 'target', social.target,
                'sortOrder', social.sort_order, 'isVisible', social.is_visible
            ) ORDER BY social.sort_order, social.id)
            FROM social_links social WHERE social.site_settings_id = ss.id
        ), '[]'::jsonb),
        'updatedAt', ss.updated_at,
        'updatedBy', ss.updated_by,
        'publishedAt', ss.published_at,
        'publishedBy', ss.published_by
    )
    FROM site_settings ss
    LEFT JOIN media_assets logo ON logo.id = ss.logo_asset_id
    LEFT JOIN media_assets favicon ON favicon.id = ss.favicon_asset_id
    LEFT JOIN media_assets og ON og.id = ss.seo_og_image_id
    WHERE ss.id = p_settings_id;
$$;

CREATE OR REPLACE FUNCTION validate_site_shell_payload(p_payload JSONB)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_section TEXT;
    v_required_sections TEXT[] := ARRAY['brand','metadata','preloader','mobileDrawer','quickInquiry','footer'];
    v_item JSONB;
    v_child JSONB;
    v_group JSONB;
    v_link JSONB;
BEGIN
    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
       OR jsonb_typeof(p_payload -> 'navigation') <> 'array'
       OR jsonb_typeof(p_payload -> 'footerGroups') <> 'array'
       OR jsonb_typeof(p_payload -> 'socialLinks') <> 'array' THEN
        RAISE EXCEPTION 'Invalid Site Shell payload' USING ERRCODE = '22023';
    END IF;
    FOREACH v_section IN ARRAY v_required_sections LOOP
        IF jsonb_typeof(p_payload -> v_section) <> 'object' THEN
            RAISE EXCEPTION 'Site Shell section % is required', v_section USING ERRCODE = '22023';
        END IF;
    END LOOP;
    IF length(btrim(COALESCE(p_payload #>> '{brand,companyName}', ''))) NOT BETWEEN 1 AND 120
       OR length(btrim(COALESCE(p_payload #>> '{brand,brandTitle}', ''))) NOT BETWEEN 1 AND 80
       OR length(btrim(COALESCE(p_payload #>> '{brand,brandSubtitle}', ''))) NOT BETWEEN 1 AND 80
       OR length(btrim(COALESCE(p_payload #>> '{brand,tagline}', ''))) NOT BETWEEN 1 AND 120
       OR length(btrim(COALESCE(p_payload #>> '{brand,logoAlt}', ''))) NOT BETWEEN 1 AND 180
       OR length(btrim(COALESCE(p_payload #>> '{metadata,title}', ''))) NOT BETWEEN 1 AND 160
       OR length(btrim(COALESCE(p_payload #>> '{metadata,description}', ''))) NOT BETWEEN 1 AND 500
       OR COALESCE(p_payload #>> '{metadata,canonicalUrl}', '') !~ '^https://[^[:space:]]+$'
       OR length(btrim(COALESCE(p_payload #>> '{metadata,ogTitle}', ''))) NOT BETWEEN 1 AND 160
       OR length(btrim(COALESCE(p_payload #>> '{metadata,ogDescription}', ''))) NOT BETWEEN 1 AND 500
       OR length(btrim(COALESCE(p_payload #>> '{preloader,title}', ''))) NOT BETWEEN 1 AND 160
       OR length(btrim(COALESCE(p_payload #>> '{preloader,subtitle}', ''))) NOT BETWEEN 1 AND 120
       OR jsonb_typeof(p_payload #> '{preloader,durationMs}') <> 'number'
       OR (p_payload #>> '{preloader,durationMs}')::INTEGER NOT BETWEEN 500 AND 5000 THEN
        RAISE EXCEPTION 'Site Shell branding, metadata, or preloader fields are invalid' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_payload -> 'navigation') NOT BETWEEN 1 AND 12
       OR jsonb_array_length(p_payload -> 'footerGroups') NOT BETWEEN 1 AND 6
       OR jsonb_array_length(p_payload -> 'socialLinks') NOT BETWEEN 1 AND 10 THEN
        RAISE EXCEPTION 'Site Shell repeated content counts are invalid' USING ERRCODE = '22023';
    END IF;
    IF (SELECT count(DISTINCT item ->> 'itemKey') FROM jsonb_array_elements(p_payload -> 'navigation') item) <> jsonb_array_length(p_payload -> 'navigation')
       OR (SELECT count(DISTINCT item ->> 'groupKey') FROM jsonb_array_elements(p_payload -> 'footerGroups') item) <> jsonb_array_length(p_payload -> 'footerGroups')
       OR (SELECT count(DISTINCT item ->> 'itemKey') FROM jsonb_array_elements(p_payload -> 'socialLinks') item) <> jsonb_array_length(p_payload -> 'socialLinks') THEN
        RAISE EXCEPTION 'Site Shell repeated keys must be unique' USING ERRCODE = '22023';
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload -> 'navigation') LOOP
        IF COALESCE(v_item ->> 'itemKey', '') !~ '^nav-[a-z0-9-]{1,64}$'
           OR length(btrim(COALESCE(v_item ->> 'label', ''))) NOT BETWEEN 1 AND 80
           OR length(btrim(COALESCE(v_item ->> 'mobileLabel', ''))) NOT BETWEEN 1 AND 80
           OR COALESCE(v_item ->> 'url', '') !~ '^(#|/|https://)'
           OR COALESCE(v_item ->> 'target', '') NOT IN ('_self','_blank')
           OR COALESCE(v_item ->> 'mobileMode', '') NOT IN ('link','dropdown')
           OR jsonb_typeof(v_item -> 'isVisible') <> 'boolean'
           OR jsonb_typeof(v_item -> 'children') <> 'array'
           OR jsonb_array_length(v_item -> 'children') > 12 THEN
            RAISE EXCEPTION 'One or more navigation records are invalid' USING ERRCODE = '22023';
        END IF;
        FOR v_child IN SELECT value FROM jsonb_array_elements(v_item -> 'children') LOOP
            IF COALESCE(v_child ->> 'itemKey', '') !~ '^nav-[a-z0-9-]{1,64}$'
               OR length(btrim(COALESCE(v_child ->> 'label', ''))) NOT BETWEEN 1 AND 80
               OR length(btrim(COALESCE(v_child ->> 'mobileLabel', ''))) NOT BETWEEN 1 AND 80
               OR COALESCE(v_child ->> 'url', '') !~ '^(#|/|https://)'
               OR COALESCE(v_child ->> 'target', '') NOT IN ('_self','_blank')
               OR jsonb_typeof(v_child -> 'isVisible') <> 'boolean' THEN
                RAISE EXCEPTION 'One or more navigation child records are invalid' USING ERRCODE = '22023';
            END IF;
        END LOOP;
    END LOOP;
    FOR v_group IN SELECT value FROM jsonb_array_elements(p_payload -> 'footerGroups') LOOP
        IF COALESCE(v_group ->> 'groupKey', '') !~ '^footer-group-[a-z0-9-]{1,64}$'
           OR length(btrim(COALESCE(v_group ->> 'title', ''))) NOT BETWEEN 1 AND 80
           OR jsonb_typeof(v_group -> 'isVisible') <> 'boolean'
           OR jsonb_typeof(v_group -> 'links') <> 'array'
           OR jsonb_array_length(v_group -> 'links') NOT BETWEEN 1 AND 12 THEN
            RAISE EXCEPTION 'One or more footer groups are invalid' USING ERRCODE = '22023';
        END IF;
        FOR v_link IN SELECT value FROM jsonb_array_elements(v_group -> 'links') LOOP
            IF COALESCE(v_link ->> 'linkKey', '') !~ '^footer-link-[a-z0-9-]{1,64}$'
               OR length(btrim(COALESCE(v_link ->> 'label', ''))) NOT BETWEEN 1 AND 100
               OR COALESCE(v_link ->> 'url', '') !~ '^(#|/|https://)'
               OR COALESCE(v_link ->> 'target', '') NOT IN ('_self','_blank')
               OR jsonb_typeof(v_link -> 'isVisible') <> 'boolean' THEN
                RAISE EXCEPTION 'One or more footer links are invalid' USING ERRCODE = '22023';
            END IF;
        END LOOP;
    END LOOP;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload -> 'socialLinks') LOOP
        IF COALESCE(v_item ->> 'itemKey', '') !~ '^social-[a-z0-9-]{1,64}$'
           OR length(btrim(COALESCE(v_item ->> 'platformName', ''))) NOT BETWEEN 1 AND 60
           OR COALESCE(v_item ->> 'url', '') !~ '^(#|https://)'
           OR COALESCE(v_item ->> 'iconKey', '') !~ '^fa-[a-z0-9-]{1,60}$'
           OR COALESCE(v_item ->> 'target', '') NOT IN ('_self','_blank')
           OR jsonb_typeof(v_item -> 'isVisible') <> 'boolean' THEN
            RAISE EXCEPTION 'One or more social links are invalid' USING ERRCODE = '22023';
        END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION replace_site_shell_children(p_settings_id UUID, p_payload JSONB, p_actor UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_item JSONB;
    v_child JSONB;
    v_group JSONB;
    v_link JSONB;
    v_parent_id UUID;
    v_group_id UUID;
    v_parent_order INTEGER := 0;
    v_child_order INTEGER;
    v_group_order INTEGER := 0;
    v_link_order INTEGER;
    v_social_order INTEGER := 0;
BEGIN
    DELETE FROM navigation_items WHERE site_settings_id = p_settings_id;
    DELETE FROM footer_groups WHERE site_settings_id = p_settings_id;
    DELETE FROM social_links WHERE site_settings_id = p_settings_id;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload -> 'navigation') LOOP
        v_parent_order := v_parent_order + 10;
        INSERT INTO navigation_items (site_settings_id,item_key,label,mobile_label,url,target,mobile_mode,sort_order,is_visible)
        VALUES (p_settings_id,v_item->>'itemKey',btrim(v_item->>'label'),btrim(v_item->>'mobileLabel'),v_item->>'url',v_item->>'target',v_item->>'mobileMode',v_parent_order,(v_item->>'isVisible')::BOOLEAN)
        RETURNING id INTO v_parent_id;
        v_child_order := 0;
        FOR v_child IN SELECT value FROM jsonb_array_elements(v_item -> 'children') LOOP
            v_child_order := v_child_order + 10;
            INSERT INTO navigation_items (site_settings_id,parent_id,item_key,label,mobile_label,url,target,mobile_mode,sort_order,is_visible)
            VALUES (p_settings_id,v_parent_id,v_child->>'itemKey',btrim(v_child->>'label'),btrim(v_child->>'mobileLabel'),v_child->>'url',v_child->>'target','link',v_child_order,(v_child->>'isVisible')::BOOLEAN);
        END LOOP;
    END LOOP;
    FOR v_group IN SELECT value FROM jsonb_array_elements(p_payload -> 'footerGroups') LOOP
        v_group_order := v_group_order + 10;
        INSERT INTO footer_groups (site_settings_id,group_key,title,sort_order,is_visible)
        VALUES (p_settings_id,v_group->>'groupKey',btrim(v_group->>'title'),v_group_order,(v_group->>'isVisible')::BOOLEAN)
        RETURNING id INTO v_group_id;
        v_link_order := 0;
        FOR v_link IN SELECT value FROM jsonb_array_elements(v_group -> 'links') LOOP
            v_link_order := v_link_order + 10;
            INSERT INTO footer_links (group_id,link_key,label,url,target,sort_order,is_visible)
            VALUES (v_group_id,v_link->>'linkKey',btrim(v_link->>'label'),v_link->>'url',v_link->>'target',v_link_order,(v_link->>'isVisible')::BOOLEAN);
        END LOOP;
    END LOOP;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload -> 'socialLinks') LOOP
        v_social_order := v_social_order + 10;
        INSERT INTO social_links (site_settings_id,item_key,platform_name,url,icon_key,target,sort_order,is_visible)
        VALUES (p_settings_id,v_item->>'itemKey',btrim(v_item->>'platformName'),v_item->>'url',v_item->>'iconKey',v_item->>'target',v_social_order,(v_item->>'isVisible')::BOOLEAN);
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION save_site_shell_draft(p_payload JSONB, p_expected_updated_at TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_role app_role;
    v_source_id UUID;
    v_logo_id UUID;
    v_favicon_id UUID;
    v_og_id UUID;
    v_draft site_settings%ROWTYPE;
    v_published site_settings%ROWTYPE;
    v_draft_id UUID;
    v_next_version INTEGER;
    v_shell_settings JSONB;
    v_old_snapshot JSONB;
    v_new_snapshot JSONB;
    v_revision_number INTEGER;
BEGIN
    IF v_actor IS NULL THEN RETURN jsonb_build_object('ok',false,'status',401,'code','ADMIN_AUTH_REQUIRED','error','Authentication is required.'); END IF;
    SELECT role INTO v_role FROM admin_profiles WHERE id=v_actor AND is_active=true;
    IF v_role IS NULL OR v_role NOT IN ('super_admin','content_editor') THEN RETURN jsonb_build_object('ok',false,'status',403,'code','ADMIN_ROLE_FORBIDDEN','error','An active content administrator profile is required.'); END IF;
    IF p_expected_updated_at IS NULL THEN RETURN jsonb_build_object('ok',false,'status',422,'code','VALIDATION_ERROR','error','The expected updated timestamp is required.'); END IF;
    PERFORM validate_site_shell_payload(p_payload);
    BEGIN
        v_source_id := (p_payload->>'id')::UUID;
        v_logo_id := (p_payload#>>'{brand,logoMediaId}')::UUID;
        v_favicon_id := COALESCE(NULLIF(p_payload#>>'{brand,faviconMediaId}','')::UUID,v_logo_id);
        v_og_id := (p_payload#>>'{metadata,ogImageMediaId}')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Site Shell media or source identifier is invalid' USING ERRCODE='22023';
    END;
    IF v_source_id IS NULL OR v_logo_id IS NULL OR v_og_id IS NULL THEN RAISE EXCEPTION 'Site Shell source, logo, and social image are required' USING ERRCODE='22023'; END IF;
    IF (SELECT count(*) FROM media_assets WHERE id IN (v_logo_id,v_favicon_id,v_og_id) AND resource_type='image' AND is_archived=false) <> (SELECT count(DISTINCT id) FROM unnest(ARRAY[v_logo_id,v_favicon_id,v_og_id]) ids(id)) THEN
        RAISE EXCEPTION 'Site Shell media must reference unarchived image assets' USING ERRCODE='22023';
    END IF;
    v_shell_settings := jsonb_build_object('brand',p_payload->'brand','metadata',p_payload->'metadata','preloader',p_payload->'preloader','mobileDrawer',p_payload->'mobileDrawer','quickInquiry',p_payload->'quickInquiry','footer',p_payload->'footer');
    SELECT * INTO v_draft FROM site_settings WHERE status='draft' FOR UPDATE;
    IF v_draft.id IS NOT NULL THEN
        IF v_source_id<>v_draft.id OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('ok',false,'status',409,'code','SITE_SHELL_CONFLICT','error','The Site Shell draft changed after this editor loaded it.'); END IF;
        v_draft_id:=v_draft.id; v_old_snapshot:=site_shell_snapshot(v_draft_id);
        UPDATE site_settings SET site_title=btrim(p_payload#>>'{metadata,title}'),company_name=btrim(p_payload#>>'{brand,companyName}'),tagline=btrim(p_payload#>>'{brand,tagline}'),primary_phone=btrim(p_payload#>>'{quickInquiry,phone}'),primary_email=btrim(p_payload#>>'{footer,email}'),office_address=btrim(p_payload#>>'{footer,address}'),logo_asset_id=v_logo_id,favicon_asset_id=v_favicon_id,seo_og_image_id=v_og_id,settings=v_shell_settings,updated_by=v_actor WHERE id=v_draft_id;
    ELSE
        SELECT * INTO v_published FROM site_settings WHERE status='published' FOR UPDATE;
        IF v_published.id IS NULL THEN RETURN jsonb_build_object('ok',false,'status',503,'code','SITE_SHELL_NOT_CONFIGURED','error','The published Site Shell is not configured.'); END IF;
        IF v_source_id<>v_published.id OR v_published.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('ok',false,'status',409,'code','SITE_SHELL_CONFLICT','error','The published Site Shell changed after this editor loaded it.'); END IF;
        SELECT COALESCE(max(version_number),0)+1 INTO v_next_version FROM site_settings;
        v_old_snapshot:=site_shell_snapshot(v_published.id);
        INSERT INTO site_settings (site_title,tagline,company_name,founding_year,primary_phone,secondary_phone,primary_email,sales_email,hr_email,office_address,map_iframe_url,logo_asset_id,favicon_asset_id,seo_og_image_id,status,version_number,settings,updated_by,supersedes_id)
        VALUES (btrim(p_payload#>>'{metadata,title}'),btrim(p_payload#>>'{brand,tagline}'),btrim(p_payload#>>'{brand,companyName}'),v_published.founding_year,btrim(p_payload#>>'{quickInquiry,phone}'),v_published.secondary_phone,btrim(p_payload#>>'{footer,email}'),v_published.sales_email,v_published.hr_email,btrim(p_payload#>>'{footer,address}'),v_published.map_iframe_url,v_logo_id,v_favicon_id,v_og_id,'draft',v_next_version,v_shell_settings,v_actor,v_published.id)
        RETURNING id INTO v_draft_id;
    END IF;
    PERFORM replace_site_shell_children(v_draft_id,p_payload,v_actor);
    DELETE FROM media_asset_usage WHERE table_name='site_settings' AND record_id=v_draft_id;
    INSERT INTO media_asset_usage(media_asset_id,table_name,record_id,field_name) VALUES
        (v_logo_id,'site_settings',v_draft_id,'logo_asset_id'),
        (v_favicon_id,'site_settings',v_draft_id,'favicon_asset_id'),
        (v_og_id,'site_settings',v_draft_id,'seo_og_image_id')
    ON CONFLICT DO NOTHING;
    v_new_snapshot:=site_shell_snapshot(v_draft_id);
    SELECT COALESCE(max(version_number),0)+1 INTO v_revision_number FROM content_revisions WHERE table_name='site_settings' AND record_id=v_draft_id;
    INSERT INTO content_revisions(table_name,record_id,revision_data,created_by,version_number,change_summary) VALUES('site_settings',v_draft_id,v_new_snapshot,v_actor,v_revision_number,CASE WHEN v_draft.id IS NULL THEN 'Created global Site Shell draft' ELSE 'Saved global Site Shell draft' END);
    INSERT INTO audit_logs(admin_id,action,table_name,record_id,old_values,new_values) VALUES(v_actor,CASE WHEN v_draft.id IS NULL THEN 'create_draft' ELSE 'update_draft' END,'site_settings',v_draft_id,v_old_snapshot,v_new_snapshot);
    RETURN jsonb_build_object('ok',true,'data',v_new_snapshot);
END;
$$;

CREATE OR REPLACE FUNCTION publish_site_shell_draft(p_settings_id UUID,p_expected_updated_at TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
    v_actor UUID:=auth.uid(); v_role app_role; v_draft site_settings%ROWTYPE; v_previous site_settings%ROWTYPE;
    v_old JSONB; v_previous_snapshot JSONB; v_new JSONB; v_revision INTEGER;
BEGIN
    IF v_actor IS NULL THEN RETURN jsonb_build_object('ok',false,'status',401,'code','ADMIN_AUTH_REQUIRED','error','Authentication is required.'); END IF;
    SELECT role INTO v_role FROM admin_profiles WHERE id=v_actor AND is_active=true;
    IF v_role IS NULL OR v_role NOT IN ('super_admin','content_editor') THEN RETURN jsonb_build_object('ok',false,'status',403,'code','ADMIN_ROLE_FORBIDDEN','error','An active content administrator profile is required.'); END IF;
    SELECT * INTO v_draft FROM site_settings WHERE id=p_settings_id AND status='draft' FOR UPDATE;
    IF v_draft.id IS NULL THEN RETURN jsonb_build_object('ok',false,'status',404,'code','SITE_SHELL_DRAFT_NOT_FOUND','error','The Site Shell draft no longer exists.'); END IF;
    IF p_expected_updated_at IS NULL OR v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('ok',false,'status',409,'code','SITE_SHELL_CONFLICT','error','The Site Shell draft changed after this editor loaded it.'); END IF;
    PERFORM validate_site_shell_payload(site_shell_snapshot(v_draft.id));
    IF v_draft.logo_asset_id IS NULL OR v_draft.favicon_asset_id IS NULL OR v_draft.seo_og_image_id IS NULL THEN RETURN jsonb_build_object('ok',false,'status',422,'code','SITE_SHELL_INVALID','error','Logo, favicon, and social image are required.'); END IF;
    v_old:=site_shell_snapshot(v_draft.id);
    SELECT * INTO v_previous FROM site_settings WHERE status='published' FOR UPDATE;
    IF v_previous.id IS NOT NULL THEN
        v_previous_snapshot:=site_shell_snapshot(v_previous.id);
        UPDATE site_settings SET status='archived',updated_by=v_actor WHERE id=v_previous.id;
        INSERT INTO audit_logs(admin_id,action,table_name,record_id,old_values,new_values) VALUES(v_actor,'archive_published','site_settings',v_previous.id,v_previous_snapshot,site_shell_snapshot(v_previous.id));
    END IF;
    UPDATE site_settings SET status='published',published_at=clock_timestamp(),published_by=v_actor,updated_by=v_actor WHERE id=v_draft.id;
    v_new:=site_shell_snapshot(v_draft.id);
    SELECT COALESCE(max(version_number),0)+1 INTO v_revision FROM content_revisions WHERE table_name='site_settings' AND record_id=v_draft.id;
    INSERT INTO content_revisions(table_name,record_id,revision_data,created_by,version_number,change_summary) VALUES('site_settings',v_draft.id,v_new,v_actor,v_revision,'Published global Site Shell');
    INSERT INTO audit_logs(admin_id,action,table_name,record_id,old_values,new_values) VALUES(v_actor,'publish','site_settings',v_draft.id,v_old,v_new);
    RETURN jsonb_build_object('ok',true,'data',v_new);
END;
$$;

REVOKE ALL ON FUNCTION site_shell_snapshot(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION validate_site_shell_payload(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION replace_site_shell_children(UUID,JSONB,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION save_site_shell_draft(JSONB,TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION publish_site_shell_draft(UUID,TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_site_shell_draft(JSONB,TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_site_shell_draft(UUID,TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION site_shell_snapshot(UUID) TO service_role;

DO $$
DECLARE
    v_shell_id UUID; v_logo_id UUID; v_og_id UUID; v_group_id UUID; v_max_version INTEGER; v_snapshot JSONB;
BEGIN
    IF EXISTS(SELECT 1 FROM site_settings WHERE status='published') THEN RETURN; END IF;
    SELECT id INTO v_logo_id FROM media_assets WHERE public_id='dhaka-heights/dev/logo' AND is_archived=false;
    SELECT id INTO v_og_id FROM media_assets WHERE public_id='dhaka-heights/dev/hero1' AND is_archived=false;
    IF v_logo_id IS NULL OR v_og_id IS NULL THEN RAISE EXCEPTION 'Exact logo and Hero social image assets are required for Site Shell seed'; END IF;
    SELECT COALESCE(max(version_number),0)+1 INTO v_max_version FROM site_settings;
    INSERT INTO site_settings(site_title,tagline,company_name,founding_year,primary_phone,secondary_phone,primary_email,sales_email,hr_email,office_address,logo_asset_id,favicon_asset_id,seo_og_image_id,status,version_number,settings,published_at)
    VALUES('Dhaka Heights | PROPERTIES LTD','YOUR PRESTIGIOUS LIVING','Dhaka Heights Properties Limited',2008,'+880 9614 770 770','+880 1711 000000','info@dhakaheightsproperties.com','sales@dhakaheights.com','careers@dhakaheights.com','New-70, Satmasjid Road, Dhanmondi, Dhaka-1209, Bangladesh.',v_logo_id,v_logo_id,v_og_id,'published',v_max_version,jsonb_build_object(
        'brand',jsonb_build_object('companyName','Dhaka Heights Properties Limited','brandTitle','DHAKA HEIGHTS','brandSubtitle','PROPERTIES LTD','tagline','YOUR PRESTIGIOUS LIVING','logoAlt','Dhaka Heights Properties Limited Logo','logoMediaId',v_logo_id,'faviconMediaId',v_logo_id),
        'metadata',jsonb_build_object('title','Dhaka Heights | PROPERTIES LTD','description','Dhaka Heights Properties Limited is a top real estate developer in Dhaka, offering luxury residential apartments and premium commercial spaces in Bashundhara, Jolshiri Abashon, and Gulshan.','canonicalUrl','https://dhakaheights.com/','ogTitle','Dhaka Heights | PROPERTIES LTD','ogDescription','Explore luxury residential and commercial properties by Dhaka Heights Properties Limited. Premium architecture, eco-friendly developments, and prime locations in Dhaka.','ogImageMediaId',v_og_id),
        'preloader',jsonb_build_object('title','DHAKA HEIGHTS PROPERTIES LIMITED','subtitle','YOUR PRESTIGIOUS LIVING','durationMs',1500),
        'mobileDrawer',jsonb_build_object('address','Gulshan Circle-2, Dhaka','phone','+880 9614 666 777'),
        'quickInquiry',jsonb_build_object('tabLabel','INQUIRE','title','Hotline Contact','phone','+880 9614 770 770','ctaLabel','Request Layouts','targetId','contact'),
        'footer',jsonb_build_object('brandDescription','Reinventing the landscape of premium residential and commercial architecture with a strict commitment to quality, engineering efficiency, and luxury aesthetics.','address','New-70, Satmasjid Road, Dhanmondi, Dhaka-1209, Bangladesh.','phone','+880 9614 770 770','email','info@dhakaheightsproperties.com','website','www.dhakaheightsproperties.com','copyright','© 2026 Dhaka Heights Properties Limited. All Rights Reserved.','developerName','Effy Tech','developerUrl','https://www.effytechbd.com/')
    ),clock_timestamp()) RETURNING id INTO v_shell_id;

    INSERT INTO navigation_items(site_settings_id,item_key,label,mobile_label,url,target,mobile_mode,sort_order,is_visible) VALUES
    (v_shell_id,'nav-home','Home','Home','/','_self','link',10,true),
    (v_shell_id,'nav-about','About','About','/about','_self','link',20,true),
    (v_shell_id,'nav-concern','Concern','Concern','#','_self','dropdown',30,true),
    (v_shell_id,'nav-projects','Projects','Projects','/projects','_self','dropdown',40,true),
    (v_shell_id,'nav-media','Media','Media','/media-center','_self','link',50,true),
    (v_shell_id,'nav-career','Career','Career','/career','_self','link',60,true),
    (v_shell_id,'nav-contact','Contact','Contact','/contact','_self','link',70,true);
    INSERT INTO navigation_items(site_settings_id,parent_id,item_key,label,mobile_label,url,target,mobile_mode,sort_order,is_visible)
    SELECT v_shell_id,parent.id,child.item_key,child.label,child.mobile_label,child.url,'_self','link',child.sort_order,true
    FROM navigation_items parent
    CROSS JOIN (VALUES
        ('nav-project-ongoing','Ongoing','Ongoing Projects','/projects?status=ongoing',10),
        ('nav-project-completed','Completed','Completed Projects','/projects?status=completed',20),
        ('nav-project-upcoming','Upcoming','Upcoming Projects','/projects?status=upcoming',30)
    ) child(item_key,label,mobile_label,url,sort_order)
    WHERE parent.site_settings_id=v_shell_id AND parent.item_key='nav-projects';
    INSERT INTO navigation_items(site_settings_id,parent_id,item_key,label,mobile_label,url,target,mobile_mode,sort_order,is_visible)
    SELECT v_shell_id,parent.id,child.item_key,child.label,child.label,child.url,'_self','link',child.sort_order,true
    FROM navigation_items parent
    CROSS JOIN (VALUES
        ('nav-media-news','Latest News','/media-center?cat=news',10),
        ('nav-media-blogs','Blogs & Articles','/media-center?cat=blogs',20),
        ('nav-media-videos','Virtual Tours','/media-center?cat=videos',30)
    ) child(item_key,label,url,sort_order)
    WHERE parent.site_settings_id=v_shell_id AND parent.item_key='nav-media';

    INSERT INTO footer_groups(site_settings_id,group_key,title,sort_order,is_visible) VALUES(v_shell_id,'footer-group-properties','Properties',10,true) RETURNING id INTO v_group_id;
    INSERT INTO footer_links(group_id,link_key,label,url,target,sort_order,is_visible) VALUES
    (v_group_id,'footer-link-ongoing','Ongoing Towers','/projects?status=ongoing','_self',10,true),
    (v_group_id,'footer-link-completed','Completed Projects','/projects?status=completed','_self',20,true),
    (v_group_id,'footer-link-upcoming','Upcoming Towers','/projects?status=upcoming','_self',30,true),
    (v_group_id,'footer-link-features','Building Features','/#services','_self',40,true),
    (v_group_id,'footer-link-safety','Safety & Compliance','/about','_self',50,true);
    INSERT INTO footer_groups(site_settings_id,group_key,title,sort_order,is_visible) VALUES(v_shell_id,'footer-group-corporate','Corporate Links',20,true) RETURNING id INTO v_group_id;
    INSERT INTO footer_links(group_id,link_key,label,url,target,sort_order,is_visible) VALUES
    (v_group_id,'footer-link-about','About Company','/about','_self',10,true),
    (v_group_id,'footer-link-news','Latest News','/media-center?cat=news','_self',20,true),
    (v_group_id,'footer-link-blogs','Blogs & Insights','/media-center?cat=blogs','_self',30,true),
    (v_group_id,'footer-link-career','Career Openings','/career','_self',40,true),
    (v_group_id,'footer-link-contact','Contact Helpline','/contact','_self',50,true);
    INSERT INTO social_links(site_settings_id,item_key,platform_name,url,icon_key,target,sort_order,is_visible) VALUES
    (v_shell_id,'social-facebook','Facebook','#','fa-facebook-f','_self',10,true),
    (v_shell_id,'social-linkedin','LinkedIn','#','fa-linkedin-in','_self',20,true),
    (v_shell_id,'social-instagram','Instagram','#','fa-instagram','_self',30,true),
    (v_shell_id,'social-youtube','Youtube','#','fa-youtube','_self',40,true);
    INSERT INTO media_asset_usage(media_asset_id,table_name,record_id,field_name) VALUES
    (v_logo_id,'site_settings',v_shell_id,'logo_asset_id'),(v_logo_id,'site_settings',v_shell_id,'favicon_asset_id'),(v_og_id,'site_settings',v_shell_id,'seo_og_image_id') ON CONFLICT DO NOTHING;
    v_snapshot:=site_shell_snapshot(v_shell_id);
    INSERT INTO content_revisions(table_name,record_id,revision_data,version_number,change_summary) VALUES('site_settings',v_shell_id,v_snapshot,1,'Seeded initial published global Site Shell');
    INSERT INTO audit_logs(admin_id,action,table_name,record_id,new_values) VALUES(NULL,'migration_seed','site_settings',v_shell_id,v_snapshot);
END;
$$;

COMMIT;
