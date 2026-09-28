CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, teacher TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '',
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_period INTEGER NOT NULL, end_period INTEGER NOT NULL,
  start_week INTEGER NOT NULL, end_week INTEGER NOT NULL,
  week_type TEXT NOT NULL CHECK (week_type IN ('all', 'odd', 'even'))
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '',
  start_at TEXT NOT NULL, due_at TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_courses_day ON courses(weekday, start_period);
CREATE INDEX IF NOT EXISTS idx_events_due ON events(due_at);
