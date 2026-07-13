export type EmploymentType = 'hourly' | 'daily' | 'monthly'
export type WorkType = 'normal' | 'overtime' | 'holiday' | 'training' | 'paid_leave'
export type ClosingStatus = 'open' | 'closed'
export type InvoiceStatus = '下書き' | '発行済' | '送付済' | '入金済'
export type QuotationStatus = '作成中' | '確定' | '失注'
export type ProjectStatus = 'active' | 'completed' | 'cancelled'

export interface Profile {
  id: string
  employee_id: string
  name: string
  name_kana: string | null
  department: string | null
  employment_type: EmploymentType
  hourly_wage: number
  daily_wage: number
  transportation: number
  fixed_allowance: number
  overtime_rate: number
  late_night_rate: number
  holiday_rate: number
  is_admin: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WorkRecord {
  id: number
  user_id: string
  work_date: string
  start_time: string
  end_time: string
  break_minutes: number
  actual_minutes: number | null
  work_type: WorkType
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface MonthlyClosing {
  id: number
  year_month: string
  user_id: string
  status: ClosingStatus
  closed_at: string | null
}

export interface PayrollRecord {
  id: number
  year_month: string
  user_id: string
  regular_hours: number
  overtime_hours: number
  late_night_hours: number
  holiday_hours: number
  total_hours: number
  work_days: number
  base_salary: number
  overtime_pay: number
  late_night_pay: number
  holiday_pay: number
  transportation: number
  fixed_allowance: number
  total_salary: number
  status: string
  confirmed_at: string | null
}

export interface SalesRecord {
  id: number
  user_id: string
  record_date: string
  amount: number
  cost: number
  description: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SalesPhoto {
  id: number
  sales_record_id: number
  storage_path: string
  original_name: string
  created_at: string
}

export interface Bonus {
  id: number
  year_month: string
  user_id: string
  bonus_amount: number
  notes: string | null
}

export interface Settings {
  id: number
  company_name: string
  company_postal: string
  company_address: string
  company_tel: string
  company_fax: string
  company_email: string
  bank_name: string
  bank_branch: string
  bank_type: string
  bank_account: string
  bank_holder: string
}

export interface Company {
  id: number
  name: string
  postal: string
  address: string
  tel: string
  fax: string
  email: string
  notes: string | null
  is_active: boolean
}

export interface Project {
  id: number
  company_id: number
  name: string
  status: ProjectStatus
  notes: string | null
  created_at: string
}

export interface Supplier {
  id: number
  name: string
  supplier_type: '直販' | '代理店'
  postal: string
  address: string
  tel: string
  email: string
  notes: string | null
  is_active: boolean
}

export interface Product {
  id: number
  code: string
  name: string
  spec: string
  unit: string
  unit_price: number
  maker: string
  created_at: string
}

export interface DocumentItem {
  id: number
  sort_order: number
  name: string
  spec: string
  qty: number
  unit: string
  unit_price: number
  amount: number
}

export interface Quotation {
  id: number
  project_id: number
  supplier_id: number | null
  doc_no: string
  issue_date: string
  status: QuotationStatus
  subtotal: number
  tax_amount: number
  total_amount: number
  notes: string | null
  items?: DocumentItem[]
}

export interface PurchaseOrder {
  id: number
  project_id: number
  quotation_id: number | null
  supplier_id: number | null
  doc_no: string
  issue_date: string
  delivery_postal: string
  delivery_address: string
  subtotal: number
  tax_amount: number
  total_amount: number
  notes: string | null
  items?: DocumentItem[]
}

export interface Invoice {
  id: number
  project_id: number
  quotation_id: number | null
  doc_no: string
  issue_date: string
  status: InvoiceStatus
  subtotal: number
  tax_amount: number
  total_amount: number
  notes: string | null
  items?: DocumentItem[]
}
