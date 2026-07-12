-- ================================================
-- 勤怠管理
-- ================================================

-- 従業員プロフィール（auth.users の拡張）
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_kana TEXT,
  department TEXT,
  employment_type TEXT NOT NULL DEFAULT 'monthly'
    CHECK (employment_type IN ('hourly', 'daily', 'monthly')),
  hourly_wage INTEGER NOT NULL DEFAULT 0,
  daily_wage INTEGER NOT NULL DEFAULT 0,
  transportation INTEGER NOT NULL DEFAULT 0,
  fixed_allowance INTEGER NOT NULL DEFAULT 0,
  overtime_rate NUMERIC NOT NULL DEFAULT 1.25,
  late_night_rate NUMERIC NOT NULL DEFAULT 1.25,
  holiday_rate NUMERIC NOT NULL DEFAULT 1.35,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 勤務記録
CREATE TABLE work_records (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  break_minutes INTEGER NOT NULL DEFAULT 60,
  actual_minutes INTEGER,
  work_type TEXT NOT NULL DEFAULT 'normal'
    CHECK (work_type IN ('normal', 'overtime', 'holiday', 'training', 'paid_leave')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_work_records_user_date ON work_records(user_id, work_date);

-- 月次締め
CREATE TABLE monthly_closings (
  id SERIAL PRIMARY KEY,
  year_month TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  closed_by UUID REFERENCES profiles(id),
  closed_at TIMESTAMPTZ,
  UNIQUE(year_month, user_id)
);

-- 給与記録
CREATE TABLE payroll_records (
  id SERIAL PRIMARY KEY,
  year_month TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id),
  regular_hours NUMERIC DEFAULT 0,
  overtime_hours NUMERIC DEFAULT 0,
  late_night_hours NUMERIC DEFAULT 0,
  holiday_hours NUMERIC DEFAULT 0,
  total_hours NUMERIC DEFAULT 0,
  work_days INTEGER DEFAULT 0,
  base_salary INTEGER DEFAULT 0,
  overtime_pay INTEGER DEFAULT 0,
  late_night_pay INTEGER DEFAULT 0,
  holiday_pay INTEGER DEFAULT 0,
  transportation INTEGER DEFAULT 0,
  fixed_allowance INTEGER DEFAULT 0,
  total_salary INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(year_month, user_id)
);

-- 売上記録
CREATE TABLE sales_records (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id),
  record_date DATE NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 売上写真（Supabase Storage に保存、パスだけここに入れる）
CREATE TABLE sales_photos (
  id SERIAL PRIMARY KEY,
  sales_record_id INTEGER NOT NULL REFERENCES sales_records(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ボーナス
CREATE TABLE bonuses (
  id SERIAL PRIMARY KEY,
  year_month TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id),
  bonus_amount INTEGER DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(year_month, user_id)
);

-- ================================================
-- 受注管理
-- ================================================

-- 自社設定（1行固定）
CREATE TABLE settings (
  id SERIAL PRIMARY KEY,
  company_name TEXT NOT NULL DEFAULT '',
  company_postal TEXT DEFAULT '',
  company_address TEXT DEFAULT '',
  company_tel TEXT DEFAULT '',
  company_fax TEXT DEFAULT '',
  company_email TEXT DEFAULT '',
  bank_name TEXT DEFAULT '',
  bank_branch TEXT DEFAULT '',
  bank_type TEXT DEFAULT '普通',
  bank_account TEXT DEFAULT '',
  bank_holder TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO settings DEFAULT VALUES;

-- 取引先会社
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  postal TEXT DEFAULT '',
  address TEXT DEFAULT '',
  tel TEXT DEFAULT '',
  fax TEXT DEFAULT '',
  email TEXT DEFAULT '',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 案件
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 仕入先
CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  supplier_type TEXT DEFAULT '直販' CHECK (supplier_type IN ('直販', '代理店')),
  postal TEXT DEFAULT '',
  address TEXT DEFAULT '',
  tel TEXT DEFAULT '',
  email TEXT DEFAULT '',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 見積書
CREATE TABLE quotations (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  supplier_id INTEGER REFERENCES suppliers(id),
  doc_no TEXT NOT NULL,
  issue_date DATE NOT NULL,
  status TEXT DEFAULT '作成中' CHECK (status IN ('作成中', '確定', '失注')),
  subtotal INTEGER DEFAULT 0,
  tax_amount INTEGER DEFAULT 0,
  total_amount INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE quotation_items (
  id SERIAL PRIMARY KEY,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  name TEXT NOT NULL DEFAULT '',
  spec TEXT DEFAULT '',
  qty NUMERIC DEFAULT 1,
  unit TEXT DEFAULT '台',
  unit_price INTEGER DEFAULT 0,
  amount INTEGER DEFAULT 0
);

-- 発注書
CREATE TABLE purchase_orders (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  quotation_id INTEGER REFERENCES quotations(id),
  supplier_id INTEGER REFERENCES suppliers(id),
  doc_no TEXT NOT NULL,
  issue_date DATE NOT NULL,
  delivery_postal TEXT DEFAULT '',
  delivery_address TEXT DEFAULT '',
  subtotal INTEGER DEFAULT 0,
  tax_amount INTEGER DEFAULT 0,
  total_amount INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_order_items (
  id SERIAL PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  name TEXT NOT NULL DEFAULT '',
  spec TEXT DEFAULT '',
  qty NUMERIC DEFAULT 1,
  unit TEXT DEFAULT '台',
  unit_price INTEGER DEFAULT 0,
  amount INTEGER DEFAULT 0
);

-- 請求書
CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  quotation_id INTEGER REFERENCES quotations(id),
  doc_no TEXT NOT NULL,
  issue_date DATE NOT NULL,
  status TEXT DEFAULT '下書き' CHECK (status IN ('下書き', '発行済', '送付済', '入金済')),
  subtotal INTEGER DEFAULT 0,
  tax_amount INTEGER DEFAULT 0,
  total_amount INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  name TEXT NOT NULL DEFAULT '',
  spec TEXT DEFAULT '',
  qty NUMERIC DEFAULT 1,
  unit TEXT DEFAULT '台',
  unit_price INTEGER DEFAULT 0,
  amount INTEGER DEFAULT 0
);

-- ================================================
-- Row Level Security（全テーブル有効化）
-- ログイン済みユーザーのみアクセス可能
-- ================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- ログイン済みなら全操作OK（小規模業務アプリのためシンプルに）
CREATE POLICY "authenticated_all" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON work_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON monthly_closings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON payroll_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON sales_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON sales_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON bonuses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON companies FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON quotations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON quotation_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON purchase_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage バケット（写真用）
INSERT INTO storage.buckets (id, name, public) VALUES ('sales-photos', 'sales-photos', false);

CREATE POLICY "authenticated_storage" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'sales-photos') WITH CHECK (bucket_id = 'sales-photos');
