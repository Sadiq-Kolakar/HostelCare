CREATE TABLE IF NOT EXISTS complaint_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT complaint_votes_complaint_student_key UNIQUE (complaint_id, student_id)
);
CREATE INDEX IF NOT EXISTS complaint_votes_student_idx ON complaint_votes(student_id, complaint_id);
CREATE INDEX IF NOT EXISTS complaint_votes_complaint_idx ON complaint_votes(complaint_id);
