-- 案件(projects)を削除したら、紐づく見積書・注文書・請求書(とその明細)も
-- 連動して削除されるようにする。逆(明細→案件)は連動しない。
ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_project_id_fkey;
ALTER TABLE quotations ADD CONSTRAINT quotations_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_project_id_fkey;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_project_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
