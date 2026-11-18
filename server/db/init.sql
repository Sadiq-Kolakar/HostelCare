CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','warden','staff')),
  room TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_code TEXT NOT NULL UNIQUE,
  student_id UUID NOT NULL REFERENCES users(id),
  category TEXT NOT NULL CHECK (category IN ('Electrical','Plumbing','Internet','Furniture','Cleaning','Other')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  attachment_url TEXT,
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High')),
  status TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted','Under Review','Assigned','In Progress','Resolved','Closed','Reopened')),
  assigned_to UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  feedback TEXT,
  feedback_rating INT CHECK (feedback_rating BETWEEN 1 AND 5)
);
CREATE TABLE complaint_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id),
  status TEXT NOT NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX complaints_student_idx ON complaints(student_id, created_at DESC);
CREATE INDEX complaints_assignee_idx ON complaints(assigned_to, created_at DESC);
CREATE INDEX complaints_status_idx ON complaints(status, created_at);
CREATE INDEX notifications_user_idx ON notifications(user_id, created_at DESC);
