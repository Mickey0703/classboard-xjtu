CREATE TABLE IF NOT EXISTS class_members (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  display_name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('notice', 'task')),
  priority TEXT NOT NULL CHECK (priority IN ('normal', 'important', 'urgent')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  due_at TEXT,
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'withdrawn')),
  author_email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT,
  withdrawn_at TEXT
);

CREATE TABLE IF NOT EXISTS notification_recipients (
  notification_id TEXT NOT NULL REFERENCES notifications(id),
  member_email TEXT NOT NULL,
  acknowledged_at TEXT,
  completed_at TEXT,
  PRIMARY KEY (notification_id, member_email)
);

CREATE INDEX IF NOT EXISTS idx_notifications_public ON notifications(status, pinned, published_at);
CREATE INDEX IF NOT EXISTS idx_recipients_member ON notification_recipients(member_email);
