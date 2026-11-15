-- at most one in-progress attempt per user and exam (closes the double-start race)
UPDATE attempts SET status='submitted' WHERE status='in_progress' AND rowid NOT IN (SELECT MAX(rowid) FROM attempts WHERE status='in_progress' GROUP BY user_id, exam_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_attempt ON attempts(user_id, exam_type) WHERE status='in_progress';
