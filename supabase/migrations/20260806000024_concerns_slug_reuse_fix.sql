BEGIN;

-- Bug fix: removing a concern in the admin catalogue editor only archives its
-- `concerns` row (status='archived', is_visible=false) rather than deleting
-- it, since the row's id is the join key for related projects/media usage.
-- If an admin later adds a *new* concern reusing that same slug, publishing
-- fails: sync_concerns_catalog() inserts by the new concernId, which does not
-- collide on `ON CONFLICT(id)`, but the `concerns.slug` UNIQUE constraint
-- still rejects it because the old archived row still holds that slug. The
-- unique_violation was unhandled, surfacing to the admin as a confusing
-- "Concerns page mutation failed" conflict instead of succeeding.
--
-- Fix: before syncing, drop any archived concerns whose slug is about to be
-- reused by a different concernId in the incoming payload. Archived concerns
-- are already fully hidden from the public site, and related rows cascade
-- safely (project_media/project link via projects.concern_id ON DELETE SET
-- NULL; section_entity_selection_items ON DELETE CASCADE), so this is safe.
CREATE OR REPLACE FUNCTION sync_concerns_catalog(p_content JSONB,p_actor UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_concern JSONB; v_project JSONB; v_id UUID;
BEGIN
    DELETE FROM concerns
    WHERE status='archived'
      AND slug IN (SELECT btrim(c->>'slug') FROM jsonb_array_elements(p_content->'concerns') c)
      AND id NOT IN (SELECT (c->>'concernId')::UUID FROM jsonb_array_elements(p_content->'concerns') c);

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

COMMIT;
