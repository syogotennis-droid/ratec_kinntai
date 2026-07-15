import { createClient } from '@/lib/supabase/server'
import { Profile, CardExpense } from '@/lib/supabase/types'
import CardExpensesClient, { CardExpenseRow } from './CardExpensesClient'

export default async function CardExpensesPage() {
  const supabase = await createClient()

  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [profilesRes, expensesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('is_active', true).order('employee_id'),
    supabase.from('card_expenses').select('*').eq('year_month', yearMonth),
  ])
  const profiles: Profile[] = profilesRes.data ?? []
  const expenses: CardExpense[] = expensesRes.data ?? []

  const rows: CardExpenseRow[] = profiles.map(profile => ({
    profile,
    expense: expenses.find(e => e.user_id === profile.id) ?? null,
  }))

  return <CardExpensesClient initialYearMonth={yearMonth} initialRows={rows} />
}
