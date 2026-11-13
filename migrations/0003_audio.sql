CREATE TABLE audio_files (
  key TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  content_type TEXT,
  data TEXT NOT NULL,            -- base64 (recordings are short; D1 rows are limited to ~2MB)
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_audio_attempt ON audio_files(attempt_id);
