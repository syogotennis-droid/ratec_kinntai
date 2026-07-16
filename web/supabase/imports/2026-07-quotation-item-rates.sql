-- 見積書明細に「メーカー希望小売価格に対する仕切掛け率・仕入掛け率」を追加
-- 既存のSupabaseプロジェクトに対して1回だけ実行してください。
-- 実行後、Settings → Data API → Exposed tables で quotation_items が
-- 既に公開されていれば追加設定は不要（カラム追加のみのため）。

ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS markup_rate NUMERIC NOT NULL DEFAULT 0.3;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS purchase_rate NUMERIC NOT NULL DEFAULT 0.2;

NOTIFY pgrst, 'reload schema';
