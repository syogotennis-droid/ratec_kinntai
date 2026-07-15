-- カード経費（従業員ごとに会社支給クレカ1枚の月次合計を管理者が入力）
-- 既存のSupabaseプロジェクトに対して1回だけ実行してください。
-- 実行後、Settings → Data API → Exposed tables で card_expenses を公開すること。

CREATE TABLE IF NOT EXISTS card_expenses (
  id SERIAL PRIMARY KEY,
  year_month TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id),
  amount INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(year_month, user_id)
);

ALTER TABLE card_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON card_expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
