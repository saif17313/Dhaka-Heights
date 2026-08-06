BEGIN;

-- Adds two new inquiry submission types for the dedicated Buyer and
-- Landowner enquiry pages (/contact/buyer, /contact/landowner). Both feed
-- into the existing canonical `inquiries` table and the existing admin
-- Inquiries Inbox (src/app/admin/inquiries) - no new table or admin section
-- is needed since that inbox already aggregates every submission type in
-- one place.
ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_submission_type_check;
ALTER TABLE inquiries ADD CONSTRAINT inquiries_submission_type_check
    CHECK (submission_type IN ('contact', 'project_inquiry', 'callback_request', 'layout_request', 'buyer_lead', 'landowner_lead'));

COMMIT;
