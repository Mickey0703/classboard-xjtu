-- Run once after migration 003. Existing drafts retain the all-active-members behavior.
ALTER TABLE notifications ADD COLUMN recipient_emails TEXT
  CHECK (recipient_emails IS NULL OR (json_valid(recipient_emails) AND json_type(recipient_emails) = 'array'));

DROP TRIGGER IF EXISTS snapshot_notification_recipients;
CREATE TRIGGER snapshot_notification_recipients
AFTER UPDATE OF status ON notifications
WHEN OLD.status = 'draft' AND NEW.status = 'published'
BEGIN
  SELECT CASE WHEN NEW.recipient_emails IS NOT NULL AND (
    json_array_length(NEW.recipient_emails) = 0 OR EXISTS (
      SELECT 1 FROM json_each(NEW.recipient_emails) selected
      WHERE NOT EXISTS (SELECT 1 FROM class_members WHERE email = selected.value COLLATE NOCASE AND active = 1)
    )
  ) THEN RAISE(ABORT, 'Selected recipients are empty or inactive') END;

  INSERT INTO notification_recipients (notification_id, member_email)
  SELECT NEW.id, email FROM class_members
  WHERE active = 1 AND (NEW.recipient_emails IS NULL OR email IN (SELECT value FROM json_each(NEW.recipient_emails)));
END;
