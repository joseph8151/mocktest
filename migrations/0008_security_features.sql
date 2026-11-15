-- Security hardening + new features (coupons, report sharing, notice, 2FA, session list, audit log, rate limits)
CREATE TABLE coupons (
  code TEXT PRIMARY KEY,                -- upper-case
  kind TEXT NOT NULL,                   -- percent | amount (KRW)
  value INTEGER NOT NULL,
  exam_type TEXT,                       -- NULL = any exam
  max_uses INTEGER,                     -- NULL = unlimited
  used INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  created_at INTEGER
);
ALTER TABLE orders ADD COLUMN coupon TEXT;
ALTER TABLE orders ADD COLUMN list_amount INTEGER;

CREATE TABLE share_links (
  token_hash TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_share_attempt ON share_links(attempt_id);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_email TEXT,
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT,
  ip TEXT,
  at INTEGER NOT NULL
);
CREATE INDEX idx_audit_at ON audit_log(at);

CREATE TABLE rate_limits (key TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX idx_rate_key ON rate_limits(key, at);

ALTER TABLE users ADD COLUMN totp_secret TEXT;
ALTER TABLE users ADD COLUMN totp_pending TEXT;
ALTER TABLE users ADD COLUMN totp_last INTEGER;
ALTER TABLE sessions ADD COLUMN created_at INTEGER;
ALTER TABLE sessions ADD COLUMN last_seen INTEGER;
ALTER TABLE sessions ADD COLUMN ip TEXT;
ALTER TABLE sessions ADD COLUMN ua TEXT;
