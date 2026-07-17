-- 見積書明細に「型式検索で選んだ商品の公式サイト詳細ページURL」を保存できるようにする
-- 既存のSupabaseプロジェクトに対して1回だけ実行してください。
-- 実行後、Settings → Data API → Exposed tables で quotation_items が
-- 既に公開されていれば追加設定は不要（カラム追加のみのため）。

ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS product_url TEXT;

NOTIFY pgrst, 'reload schema';
