-- AI grading: Claude scores writing / speaking answers against the rubric (speaking is transcribed first).
-- ai_status: NULL (not tried) · running · done · error · skipped. The teacher's manual_score stays the official score.
ALTER TABLE answers ADD COLUMN ai_score INTEGER;
ALTER TABLE answers ADD COLUMN ai_feedback TEXT;
ALTER TABLE answers ADD COLUMN ai_transcript TEXT;
ALTER TABLE answers ADD COLUMN ai_status TEXT;
ALTER TABLE answers ADD COLUMN ai_at INTEGER;
ALTER TABLE answers ADD COLUMN ai_model TEXT;
ALTER TABLE answers ADD COLUMN graded_by TEXT;
CREATE INDEX idx_answers_ai ON answers(ai_status);
