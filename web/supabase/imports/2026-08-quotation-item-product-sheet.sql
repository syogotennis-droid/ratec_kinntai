-- 見積書の明細行に「商品資料」(施工前写真・既存商品名・ご提案商品写真)を
-- 作成できるようにする
-- 既存のSupabaseプロジェクトに対して1回だけ実行してください。
-- 実行後、Settings → Data API → Exposed tables で quotation_items が
-- 既に公開されていれば追加設定は不要（カラム追加のみのため）。

ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS has_product_sheet BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS before_photo_path TEXT;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS existing_product_name TEXT;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS proposed_photo_path TEXT;

INSERT INTO storage.buckets (id, name, public)
  SELECT 'quotation-photos', 'quotation-photos', false
  WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'quotation-photos');

DO $$ BEGIN
  CREATE POLICY "authenticated_storage_quotation_photos" ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'quotation-photos') WITH CHECK (bucket_id = 'quotation-photos');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
