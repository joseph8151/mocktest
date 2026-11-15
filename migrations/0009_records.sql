-- Keep every record: indexes for the activity log, append-only protection, soft-delete markers.
CREATE INDEX idx_audit_actor ON audit_log(actor_id, at);
CREATE INDEX idx_audit_action ON audit_log(action, at);
CREATE INDEX idx_audit_target ON audit_log(target, at);
ALTER TABLE users ADD COLUMN deleted_at INTEGER;
ALTER TABLE share_links ADD COLUMN revoked_at INTEGER;
-- The activity log can only grow: rows cannot be deleted, and only actor_email may be masked (account withdrawal).
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OF id, actor_id, action, target, detail, ip, at ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
