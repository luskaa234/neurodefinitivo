-- Global app settings (single row)
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow app settings read" ON app_settings
  FOR SELECT USING (true);

CREATE POLICY "Allow app settings write" ON app_settings
  FOR ALL USING (true) WITH CHECK (true);
