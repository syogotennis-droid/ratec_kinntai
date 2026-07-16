-- 見積書明細に「商品／作業」の種別を追加
-- 既存のSupabaseプロジェクトに対して1回だけ実行してください。
-- 実行後、Settings → Data API → Exposed tables で quotation_items が
-- 既に公開されていれば追加設定は不要（カラム追加のみのため）。

ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'product';
ALTER TABLE quotation_items DROP CONSTRAINT IF EXISTS quotation_items_item_type_check;
ALTER TABLE quotation_items ADD CONSTRAINT quotation_items_item_type_check CHECK (item_type IN ('product', 'labor'));

NOTIFY pgrst, 'reload schema';
