-- Recorded audio for listening passages (WIDA / TOEFL Junior). key = '<exam>-<fnv1a of passage text>' (src/lib/listening.js).
-- Uploaded from 관리자 → 리스닝 음원; served at /api/listening/<key>.mp3. Without a file the browser reads the script aloud (TTS).
CREATE TABLE listening_audio (
  key TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  data TEXT NOT NULL,            -- base64 (D1 rows are limited to ~2MB, so files are capped at 1.4MB)
  bytes INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
