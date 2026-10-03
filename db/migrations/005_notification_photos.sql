-- Run once after migration 004. Existing notifications and receipts are preserved.
ALTER TABLE notifications ADD COLUMN photos TEXT NOT NULL DEFAULT '[]';
ALTER TABLE notification_recipients ADD COLUMN completion_photos TEXT NOT NULL DEFAULT '[]';
