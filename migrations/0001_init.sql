CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',      -- student | admin
  status TEXT NOT NULL DEFAULT 'active',     -- active | suspended
  grade TEXT,
  phone TEXT,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  exam_type TEXT NOT NULL,                   -- MAP | CAT4 | WIDA
  title TEXT NOT NULL,
  description TEXT,
  price_krw INTEGER NOT NULL,
  price_usd_cents INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  valid_days INTEGER NOT NULL DEFAULT 90,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  provider TEXT NOT NULL,                    -- stripe | portone | admin
  provider_ref TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,                    -- KRW | USD
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | paid | refunded | failed
  created_at INTEGER NOT NULL,
  paid_at INTEGER
);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_ref ON orders(provider, provider_ref);

CREATE TABLE entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  order_id TEXT UNIQUE REFERENCES orders(id),
  exam_type TEXT NOT NULL,
  attempts_total INTEGER NOT NULL,
  attempts_used INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_ent_user ON entitlements(user_id);

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  exam_type TEXT NOT NULL,
  section TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'mcq',          -- mcq | text | audio
  difficulty INTEGER NOT NULL DEFAULT 3,     -- 1..5
  passage TEXT,
  stem TEXT NOT NULL,
  image_svg TEXT,
  choices TEXT,                              -- JSON array of strings ("svg:<svg..>" allowed)
  answer INTEGER,                            -- index into choices
  explanation TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_q_sel ON questions(exam_type, section, active, difficulty);

CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  entitlement_id TEXT NOT NULL REFERENCES entitlements(id),
  exam_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress', -- in_progress | submitted | graded
  state TEXT NOT NULL,                        -- JSON
  score TEXT,                                 -- JSON
  started_at INTEGER NOT NULL,
  finished_at INTEGER
);
CREATE INDEX idx_att_user ON attempts(user_id);

CREATE TABLE answers (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id),
  section TEXT NOT NULL,
  kind TEXT NOT NULL,
  difficulty INTEGER NOT NULL,
  choice INTEGER,
  text TEXT,
  audio_key TEXT,
  correct INTEGER,                            -- 1/0, NULL for manual
  manual_score INTEGER,                       -- 1..6 rubric for writing/speaking
  feedback TEXT,
  time_ms INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE(attempt_id, question_id)
);
CREATE INDEX idx_ans_attempt ON answers(attempt_id);

CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,                        -- provider event id, for idempotency
  created_at INTEGER NOT NULL
);
