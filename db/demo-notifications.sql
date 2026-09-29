INSERT OR IGNORE INTO class_members (email, display_name, active) VALUES
  ('student@example.com', '演示同学甲', 1),
  ('classmate@example.com', '演示同学乙', 1);

INSERT OR IGNORE INTO notifications (id, kind, priority, title, body, due_at, pinned, status, author_email, created_at, published_at) VALUES
  ('demo-notice-1', 'notice', 'urgent', '班级会议地点调整（演示）', '明天的班级会议改在主楼 A101。请大家阅读后确认知悉。', NULL, 1, 'published', 'monitor@example.com', '2026-09-29T09:00:00+08:00', '2026-09-29T09:00:00+08:00'),
  ('demo-task-1', 'task', 'important', '提交班级信息表（演示）', '请按班委提供的表格填写；这里不录入个人隐私资料。', '2026-10-05T18:00:00+08:00', 0, 'published', 'monitor@example.com', '2026-09-29T09:05:00+08:00', '2026-09-29T09:05:00+08:00');

INSERT OR IGNORE INTO notification_recipients (notification_id, member_email) VALUES
  ('demo-notice-1', 'student@example.com'), ('demo-notice-1', 'classmate@example.com'),
  ('demo-task-1', 'student@example.com'), ('demo-task-1', 'classmate@example.com');
