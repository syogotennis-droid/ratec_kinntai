import { createClient } from '@/lib/supabase/server'
import { Profile, Bonus } from '@/lib/supabase/types'
import BonusesClient, { BonusRow } from './BonusesClient'

function prevYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number)
  return `${y - 1}-${String(m).padStart(2, '0')}`
}

export default async function BonusesPage() {
  const supabase = await createClient()

  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastYearMonth = prevYearMonth(yearMonth)

  const [profilesRes, bonusesRes, lastYearBonusesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('is_active', true).order('employee_id'),
    supabase.from('bonuses').select('*').eq('year_month', yearMonth),
    supabase.from('bonuses').select('*').eq('year_month', lastYearMonth),
  ])
  const profiles: Profile[] = profilesRes.data ?? []
  const bonuses: Bonus[] = bonusesRes.data ?? []
  const lastYearBonuses: Bonus[] = lastYearBonusesRes.data ?? []

  const rows: BonusRow[] = profiles.map(profile => ({
    profile,
    bonus: bonuses.find(b => b.user_id === profile.id) ?? null,
    lastYearBonus: lastYearBonuses.find(b => b.user_id === profile.id) ?? null,
  }))

  return <BonusesClient initialYearMonth={yearMonth} initialRows={rows} />
}
