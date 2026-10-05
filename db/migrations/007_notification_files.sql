-- Run once after 006; file bytes live separately from notification snapshots.
ALTER TABLE notifications ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]';
CREATE TABLE notification_files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size > 0 AND size <= 10485760),
  author_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE notification_file_chunks (
  file_id TEXT NOT NULL REFERENCES notification_files(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence >= 0),
  data BLOB NOT NULL CHECK (length(data) > 0 AND length(data) <= 524288),
  PRIMARY KEY (file_id, sequence)
);
