-- 給与・賞与管理に「給与」金額を追加（税理士から確定額を受け取ったら直接入力する用）
-- 既存のSupabaseプロジェクトに対して1回だけ実行してください。
-- bonusesテーブルは既に公開済みのため、Exposed tablesの追加設定は不要（カラム追加のみのため）。

ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS salary_amount INTEGER DEFAULT 0;

NOTIFY pgrst, 'reload schema';
