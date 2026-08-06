BEGIN;

-- The About page "Our Team" section is fully CMS-driven (section_items rows
-- scoped to the about-page's published page_sections row, grouped by a
-- team-category-* item and sorted by sort_order) but only had one category
-- and one member. Adds two more categories and six more members, each with
-- a branded monogram placeholder image (public/assets/team/*.svg) so the
-- public team grid isn't sparse. All rows are ordinary section_items and can
-- be edited, reordered, or removed from Admin -> About Page -> Team like any
-- other team member.
DO $$
DECLARE
    v_section_id UUID;
    v_asset_ariful UUID;
    v_asset_nusrat UUID;
    v_asset_rezaul UUID;
    v_asset_farzana UUID;
    v_asset_imran UUID;
    v_asset_tahmina UUID;
BEGIN
    SELECT ps.id INTO v_section_id
    FROM page_sections ps
    JOIN pages p ON p.id = ps.page_id
    WHERE p.slug = 'about'
      AND ps.section_key = 'about-page'
      AND ps.status = 'published'
    ORDER BY ps.version_number DESC
    LIMIT 1;

    IF v_section_id IS NULL THEN
        RAISE NOTICE 'No published about-page section found; skipping team seed.';
        RETURN;
    END IF;

    INSERT INTO media_assets (public_id, secure_url, resource_type, format, width, height, original_filename, display_name, folder, alt_text, caption, tags, is_archived)
    VALUES
        ('dhaka-heights/system/team/ariful-islam-placeholder', '/assets/team/ariful-islam.svg', 'image', 'svg', 800, 1000, 'ariful-islam.svg', 'Ariful Islam profile placeholder', 'dhaka-heights/system/team', 'Ariful Islam profile placeholder', '', ARRAY['system','team','placeholder'], false),
        ('dhaka-heights/system/team/nusrat-jahan-placeholder', '/assets/team/nusrat-jahan.svg', 'image', 'svg', 800, 1000, 'nusrat-jahan.svg', 'Nusrat Jahan profile placeholder', 'dhaka-heights/system/team', 'Nusrat Jahan profile placeholder', '', ARRAY['system','team','placeholder'], false),
        ('dhaka-heights/system/team/rezaul-karim-placeholder', '/assets/team/rezaul-karim.svg', 'image', 'svg', 800, 1000, 'rezaul-karim.svg', 'Rezaul Karim profile placeholder', 'dhaka-heights/system/team', 'Rezaul Karim profile placeholder', '', ARRAY['system','team','placeholder'], false),
        ('dhaka-heights/system/team/farzana-yasmin-placeholder', '/assets/team/farzana-yasmin.svg', 'image', 'svg', 800, 1000, 'farzana-yasmin.svg', 'Farzana Yasmin profile placeholder', 'dhaka-heights/system/team', 'Farzana Yasmin profile placeholder', '', ARRAY['system','team','placeholder'], false),
        ('dhaka-heights/system/team/imran-hossain-khan-placeholder', '/assets/team/imran-hossain-khan.svg', 'image', 'svg', 800, 1000, 'imran-hossain-khan.svg', 'Imran Hossain Khan profile placeholder', 'dhaka-heights/system/team', 'Imran Hossain Khan profile placeholder', '', ARRAY['system','team','placeholder'], false),
        ('dhaka-heights/system/team/tahmina-akter-placeholder', '/assets/team/tahmina-akter.svg', 'image', 'svg', 800, 1000, 'tahmina-akter.svg', 'Tahmina Akter profile placeholder', 'dhaka-heights/system/team', 'Tahmina Akter profile placeholder', '', ARRAY['system','team','placeholder'], false)
    ON CONFLICT (public_id) DO NOTHING;

    SELECT id INTO v_asset_ariful FROM media_assets WHERE public_id = 'dhaka-heights/system/team/ariful-islam-placeholder';
    SELECT id INTO v_asset_nusrat FROM media_assets WHERE public_id = 'dhaka-heights/system/team/nusrat-jahan-placeholder';
    SELECT id INTO v_asset_rezaul FROM media_assets WHERE public_id = 'dhaka-heights/system/team/rezaul-karim-placeholder';
    SELECT id INTO v_asset_farzana FROM media_assets WHERE public_id = 'dhaka-heights/system/team/farzana-yasmin-placeholder';
    SELECT id INTO v_asset_imran FROM media_assets WHERE public_id = 'dhaka-heights/system/team/imran-hossain-khan-placeholder';
    SELECT id INTO v_asset_tahmina FROM media_assets WHERE public_id = 'dhaka-heights/system/team/tahmina-akter-placeholder';

    INSERT INTO section_items (section_id, item_key, title, body_text, image_alt, sort_order, is_visible, icon_library)
    VALUES
        (v_section_id, 'team-category-engineering-design', 'Engineering and Design', '', '', 20, true, 'lucide'),
        (v_section_id, 'team-category-sales-customer-relations', 'Sales and Customer Relations', '', '', 30, true, 'lucide')
    ON CONFLICT (section_id, item_key) DO NOTHING;

    INSERT INTO section_items (section_id, item_key, title, subtitle, body_text, tag_text, image_asset_id, image_alt, sort_order, is_visible, icon_library)
    VALUES
        (v_section_id, 'team-ariful-islam', 'Ariful Islam', 'Managing Director',
         'Ariful Islam oversees day-to-day operations across every active Dhaka Heights development, coordinating between the engineering, sales, and land acquisition teams to keep project timelines on schedule. With over a decade in Dhaka''s real estate sector, he has been directly involved in structuring more than a dozen joint land-development partnerships.' || E'\n\n' ||
         'His approach centers on operational discipline: transparent progress reporting to clients, strict adherence to RAJUK compliance, and a hands-on presence at every site milestone from groundbreaking to handover.',
         'team-category-leadership-management', v_asset_ariful, 'Ariful Islam profile placeholder', 20, true, 'lucide'),

        (v_section_id, 'team-nusrat-jahan', 'Nusrat Jahan', 'Director of Finance',
         'Nusrat Jahan leads financial planning, cost control, and investor reporting for Dhaka Heights Properties Limited, ensuring every project remains funded end-to-end without compromising on construction quality. She has restructured the company''s payment-plan systems to give buyers clearer, more flexible installment options.' || E'\n\n' ||
         'She believes financial transparency is as important as structural integrity - every client-facing cost breakdown she signs off on is built to be understood without a finance background.',
         'team-category-leadership-management', v_asset_nusrat, 'Nusrat Jahan profile placeholder', 30, true, 'lucide'),

        (v_section_id, 'team-rezaul-karim', 'Rezaul Karim', 'Chief Structural Engineer',
         'Rezaul Karim leads structural design and site engineering across Dhaka Heights projects, with a focus on seismic-resilient framing and energy-conserving building envelopes. He has personally supervised foundation and superstructure work on several of the company''s flagship high-rises.' || E'\n\n' ||
         'His engineering philosophy is straightforward: no shortcut is worth taking on structural safety, regardless of how it affects the construction timeline.',
         'team-category-engineering-design', v_asset_rezaul, 'Rezaul Karim profile placeholder', 10, true, 'lucide'),

        (v_section_id, 'team-farzana-yasmin', 'Farzana Yasmin', 'Lead Architect',
         'Farzana Yasmin shapes the architectural identity of every Dhaka Heights project, balancing natural light, cross-ventilation, and space efficiency within Dhaka''s dense urban plots. Her design reviews are known for prioritizing how families will actually live in a unit, not just how it renders on paper.' || E'\n\n' ||
         'She works closely with the structural and sales teams from the earliest concept stage so that architectural promises made to buyers are ones the engineering team can reliably deliver.',
         'team-category-engineering-design', v_asset_farzana, 'Farzana Yasmin profile placeholder', 20, true, 'lucide'),

        (v_section_id, 'team-imran-hossain-khan', 'Imran Hossain Khan', 'Head of Sales',
         'Imran Hossain Khan leads the sales team responsible for guiding buyers and investors from their first site visit through to registration. He has built the team''s consultative approach around honest unit-availability information and realistic handover timelines rather than high-pressure tactics.' || E'\n\n' ||
         'He regularly represents Dhaka Heights at property expos across Dhaka, and considers repeat referrals from past buyers the clearest measure of the sales team''s integrity.',
         'team-category-sales-customer-relations', v_asset_imran, 'Imran Hossain Khan profile placeholder', 10, true, 'lucide'),

        (v_section_id, 'team-tahmina-akter', 'Tahmina Akter', 'Customer Relations Manager',
         'Tahmina Akter manages post-sale customer relations, from handover walkthroughs to ongoing maintenance requests after residents move in. She built the company''s structured after-sales follow-up process specifically because most developers stop responding once the keys are handed over.' || E'\n\n' ||
         'Her team''s response-time targets are tracked the same way sales targets are - she treats a resident''s maintenance complaint with the same urgency as a new buyer''s inquiry.',
         'team-category-sales-customer-relations', v_asset_tahmina, 'Tahmina Akter profile placeholder', 20, true, 'lucide')
    ON CONFLICT (section_id, item_key) DO NOTHING;
END;
$$;

COMMIT;
