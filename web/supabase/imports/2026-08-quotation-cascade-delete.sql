-- 見積書(quotations)を削除したら、その見積書から作成された注文書・請求書
-- (紐づくquotation_id)も連動して削除されるようにする。
-- 逆(注文書・請求書→見積書)は連動しない。
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_quotation_id_fkey;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_quotation_id_fkey
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_quotation_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_quotation_id_fkey
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE;
