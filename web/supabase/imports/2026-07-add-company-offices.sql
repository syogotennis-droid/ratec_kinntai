-- 事業所（会社ごとに複数の住所を持てるようにする）
-- 既存のSupabaseプロジェクトに対して1回だけ実行してください。

CREATE TABLE IF NOT EXISTS company_offices (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  postal TEXT DEFAULT '',
  address TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE company_offices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON company_offices FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS office_id INTEGER REFERENCES company_offices(id);
