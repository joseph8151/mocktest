-- 고객센터 form: tickets from visitors who are not signed in (e.g. cannot log in). user_id is '' for those.
ALTER TABLE support_tickets ADD COLUMN guest_email TEXT;
ALTER TABLE support_tickets ADD COLUMN guest_name TEXT;
ALTER TABLE support_tickets ADD COLUMN ref TEXT;
