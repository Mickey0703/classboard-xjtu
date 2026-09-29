CREATE TRIGGER IF NOT EXISTS snapshot_notification_recipients
AFTER UPDATE OF status ON notifications
WHEN OLD.status = 'draft' AND NEW.status = 'published'
BEGIN
  INSERT INTO notification_recipients (notification_id, member_email)
  SELECT NEW.id, email FROM class_members WHERE active = 1;
END;
