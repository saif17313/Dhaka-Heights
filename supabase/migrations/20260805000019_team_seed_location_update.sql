BEGIN;

DO $$
DECLARE
    v_team_asset UUID;
    v_row RECORD;
    v_before JSONB;
    v_after JSONB;
    v_revision INTEGER;
    v_cards JSONB;
    v_settings JSONB;
    v_address CONSTANT TEXT := '142, Road-5, Block-B, Bashundhara R/A, Dhaka-1229, Bangladesh.';
    v_map_url CONSTANT TEXT := 'https://www.google.com/maps?q=23.8137067,90.428437&z=17&output=embed';
    v_map_description CONSTANT TEXT := 'Visit the Dhaka Heights Properties Ltd. corporate office at 142, Road-5, Block-B, Bashundhara R/A, Dhaka-1229.';
BEGIN
    INSERT INTO media_assets (
        public_id,
        secure_url,
        resource_type,
        format,
        width,
        height,
        original_filename,
        display_name,
        folder,
        alt_text,
        tags,
        is_archived
    )
    VALUES (
        'dhaka-heights/system/team/md-shahadat-hossain-placeholder',
        '/assets/team/md-shahadat-hossain.svg',
        'image',
        'svg',
        800,
        1000,
        'md-shahadat-hossain.svg',
        'Md. Shahadat Hossain profile placeholder',
        'dhaka-heights/system/team',
        'Md. Shahadat Hossain profile placeholder',
        ARRAY['system','team','placeholder'],
        false
    )
    ON CONFLICT (public_id) DO UPDATE SET
        secure_url = EXCLUDED.secure_url,
        resource_type = EXCLUDED.resource_type,
        format = EXCLUDED.format,
        width = EXCLUDED.width,
        height = EXCLUDED.height,
        original_filename = EXCLUDED.original_filename,
        display_name = EXCLUDED.display_name,
        folder = EXCLUDED.folder,
        alt_text = EXCLUDED.alt_text,
        tags = EXCLUDED.tags,
        is_archived = false,
        updated_at = clock_timestamp()
    RETURNING id INTO v_team_asset;

    FOR v_row IN
        SELECT id
        FROM page_sections
        WHERE section_key = 'about-page'
          AND status IN ('draft','published')
        ORDER BY version_number
    LOOP
        v_before := about_page_snapshot(v_row.id);

        UPDATE page_sections
        SET settings = CASE
            WHEN COALESCE(settings, '{}'::JSONB) ? 'teamSection' THEN settings
            ELSE jsonb_set(
                COALESCE(settings, '{}'::JSONB),
                '{teamSection}',
                jsonb_build_object(
                    'tag', 'OUR TEAM',
                    'heading', 'Meet Our Leadership',
                    'intro', 'Meet the people guiding Dhaka Heights with experience, integrity, and a shared commitment to excellence.'
                ),
                true
            )
        END
        WHERE id = v_row.id;

        IF NOT EXISTS (
            SELECT 1
            FROM section_items
            WHERE section_id = v_row.id
              AND item_key LIKE 'team-%'
        ) THEN
            INSERT INTO section_items (
                section_id,
                item_key,
                title,
                subtitle,
                body_text,
                image_asset_id,
                image_alt,
                sort_order,
                is_visible
            )
            VALUES (
                v_row.id,
                'team-md-shahadat-hossain',
                'Md. Shahadat Hossain',
                'Leadership',
                'Md. Shahadat Hossain represents the leadership vision of Dhaka Heights Properties Limited, emphasizing architectural foresight, customer commitment, operational integrity, and the thoughtful use of modern technology throughout the development process.\n\nHis leadership message invites landowners and clients to experience premium architectural design and to take part in raising the standard of real estate development in Bangladesh.',
                v_team_asset,
                'Md. Shahadat Hossain profile placeholder',
                10,
                true
            );
        END IF;

        INSERT INTO media_asset_usage (media_asset_id, table_name, record_id, field_name)
        SELECT v_team_asset, 'section_items', id, 'image_asset_id'
        FROM section_items
        WHERE section_id = v_row.id
          AND item_key = 'team-md-shahadat-hossain'
        ON CONFLICT DO NOTHING;

        v_after := about_page_snapshot(v_row.id);
        IF v_before IS DISTINCT FROM v_after THEN
            SELECT COALESCE(max(version_number), 0) + 1
            INTO v_revision
            FROM content_revisions
            WHERE table_name = 'page_sections'
              AND record_id = v_row.id;

            INSERT INTO content_revisions (
                table_name,
                record_id,
                revision_data,
                version_number,
                change_summary
            )
            VALUES (
                'page_sections',
                v_row.id,
                v_after,
                v_revision,
                'Seeded initial dynamic About team member'
            );

            INSERT INTO audit_logs (action, table_name, record_id, old_values, new_values)
            VALUES ('migration_update', 'page_sections', v_row.id, v_before, v_after);
        END IF;
    END LOOP;

    FOR v_row IN
        SELECT id, settings
        FROM page_sections
        WHERE section_key = 'contact-page'
          AND status IN ('draft','published')
        ORDER BY version_number
    LOOP
        v_before := contact_page_snapshot(v_row.id);

        SELECT COALESCE(
            jsonb_agg(
                CASE
                    WHEN lower(COALESCE(card->>'title', '')) = 'corporate office'
                         OR card->>'iconClass' = 'fa-solid fa-location-dot'
                    THEN jsonb_set(card, '{body}', to_jsonb(v_address), true)
                    ELSE card
                END
                ORDER BY ordinal
            ),
            '[]'::JSONB
        )
        INTO v_cards
        FROM jsonb_array_elements(COALESCE(v_row.settings->'infoCards', '[]'::JSONB))
             WITH ORDINALITY AS entries(card, ordinal);

        v_settings := COALESCE(v_row.settings, '{}'::JSONB);
        v_settings := jsonb_set(v_settings, '{infoCards}', v_cards, true);
        v_settings := jsonb_set(v_settings, '{map,description}', to_jsonb(v_map_description), true);
        v_settings := jsonb_set(v_settings, '{map,iframeUrl}', to_jsonb(v_map_url), true);
        v_settings := jsonb_set(
            v_settings,
            '{map,iframeTitle}',
            to_jsonb('Dhaka Heights Properties Ltd. Bashundhara corporate office map'::TEXT),
            true
        );

        UPDATE page_sections
        SET settings = v_settings
        WHERE id = v_row.id;

        v_after := contact_page_snapshot(v_row.id);
        IF v_before IS DISTINCT FROM v_after THEN
            SELECT COALESCE(max(version_number), 0) + 1
            INTO v_revision
            FROM content_revisions
            WHERE table_name = 'page_sections'
              AND record_id = v_row.id;

            INSERT INTO content_revisions (
                table_name,
                record_id,
                revision_data,
                version_number,
                change_summary
            )
            VALUES (
                'page_sections',
                v_row.id,
                v_after,
                v_revision,
                'Updated Contact map and corporate office location'
            );

            INSERT INTO audit_logs (action, table_name, record_id, old_values, new_values)
            VALUES ('migration_update', 'page_sections', v_row.id, v_before, v_after);
        END IF;
    END LOOP;

    FOR v_row IN
        SELECT id
        FROM site_settings
        WHERE status IN ('draft','published')
        ORDER BY version_number
    LOOP
        v_before := site_shell_snapshot(v_row.id);

        UPDATE site_settings
        SET office_address = v_address,
            map_iframe_url = v_map_url,
            settings = jsonb_set(
                jsonb_set(
                    COALESCE(settings, '{}'::JSONB),
                    '{footer,address}',
                    to_jsonb(v_address),
                    true
                ),
                '{mobileDrawer,address}',
                to_jsonb('142, Road-5, Block-B, Bashundhara R/A, Dhaka-1229'::TEXT),
                true
            )
        WHERE id = v_row.id;

        v_after := site_shell_snapshot(v_row.id);
        IF v_before IS DISTINCT FROM v_after THEN
            SELECT COALESCE(max(version_number), 0) + 1
            INTO v_revision
            FROM content_revisions
            WHERE table_name = 'site_settings'
              AND record_id = v_row.id;

            INSERT INTO content_revisions (
                table_name,
                record_id,
                revision_data,
                version_number,
                change_summary
            )
            VALUES (
                'site_settings',
                v_row.id,
                v_after,
                v_revision,
                'Updated global corporate office location'
            );

            INSERT INTO audit_logs (action, table_name, record_id, old_values, new_values)
            VALUES ('migration_update', 'site_settings', v_row.id, v_before, v_after);
        END IF;
    END LOOP;
END;
$$;

COMMIT;
