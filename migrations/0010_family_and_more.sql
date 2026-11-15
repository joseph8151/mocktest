-- Email verification, guardian consent (under 14), family (parent → children), classes (teacher → students),
-- ticket sharing, gift codes, practice mode, support tickets, Kakao login, exam integrity, one-device exam lock.
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
ALTER TABLE users ADD COLUMN under14 INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN guardian_email TEXT;
ALTER TABLE users ADD COLUMN consent_at INTEGER;
ALTER TABLE users ADD COLUMN parent_id TEXT;
ALTER TABLE users ADD COLUMN kakao_id TEXT;
CREATE INDEX idx_users_parent ON users(parent_id);
CREATE UNIQUE INDEX idx_users_kakao ON users(kakao_id) WHERE kakao_id IS NOT NULL;
-- accounts that existed before verification was introduced are treated as verified
UPDATE users SET email_verified_at=created_at WHERE email_verified_at IS NULL;

CREATE TABLE tokens (
  token_hash TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,          -- verify_email | guardian_consent
  user_id TEXT NOT NULL,
  data TEXT,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_tokens_user ON tokens(user_id, purpose);

CREATE TABLE guardian_consents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  guardian_email TEXT,
  guardian_name TEXT,
  relation TEXT,
  method TEXT NOT NULL,           -- email_link | parent_account | admin
  ip TEXT,
  at INTEGER NOT NULL
);

ALTER TABLE sessions ADD COLUMN acting_parent TEXT;
ALTER TABLE attempts ADD COLUMN session_hash TEXT;
ALTER TABLE attempts ADD COLUMN integrity TEXT;
ALTER TABLE entitlements ADD COLUMN origin_order_id TEXT;
ALTER TABLE entitlements ADD COLUMN source TEXT;
CREATE INDEX idx_ent_origin ON entitlements(origin_order_id);
ALTER TABLE orders ADD COLUMN gift INTEGER NOT NULL DEFAULT 0;

CREATE TABLE gift_codes (
  code TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  order_id TEXT,
  created_by TEXT,
  note TEXT,
  redeemed_by TEXT,
  redeemed_at INTEGER,
  revoked INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_gift_order ON gift_codes(order_id);
CREATE INDEX idx_gift_creator ON gift_codes(created_by);

CREATE TABLE classes (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_classes_teacher ON classes(teacher_id);
CREATE TABLE class_members (
  class_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  left_at INTEGER,
  PRIMARY KEY (class_id, user_id)
);
CREATE INDEX idx_members_user ON class_members(user_id);

CREATE TABLE practice_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  exam_type TEXT NOT NULL,
  section TEXT NOT NULL,
  difficulty INTEGER,
  correct INTEGER NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX idx_practice_user ON practice_log(user_id, at);

CREATE TABLE support_tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',   -- open | answered | closed
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_support_user ON support_tickets(user_id);
CREATE INDEX idx_support_status ON support_tickets(status, updated_at);
CREATE TABLE support_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  staff INTEGER NOT NULL DEFAULT 0,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_support_msgs ON support_messages(ticket_id, created_at);
