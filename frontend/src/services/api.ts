import { auth, app } from '../firebase/config'
import { initializeApp, deleteApp } from 'firebase/app'
import {
  firestoreGetUsers,
  firestoreGetUserById,
  firestoreCreateUser,
  firestoreUpdateUser,
  firestoreDeactivateUser,
  firestoreGetUserByUid,
  firestoreGetWorkRecords,
  firestoreCreateWorkRecord,
  firestoreGetWorkRecordById,
  firestoreUpdateWorkRecord,
  firestoreDeleteWorkRecord,
  firestoreGetPayrollRecords,
  firestoreGetPayrollRecord,
  firestoreSetPayrollRecord,
  firestoreConfirmPayroll,
  firestoreGetClosingStatus,
  firestoreCloseMonth,
  firestoreReopenMonth,
  firestoreGetSalesRecords,
  firestoreCreateSalesRecord,
  firestoreUpdateSalesRecord,
  firestoreDeleteSalesRecord,
  firestoreGetMonthlySalesSummary,
  firestoreGetBonuses,
  firestoreSetBonus,
} from '../firebase/firestore'
import { uploadSalesPhoto, deleteSalesPhoto } from '../firebase/storage'
import { aggregateMonthlyHours, calculatePayroll, calculateActualMinutes } from '../firebase/calculation'
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth'

// Wrap result in { data } to match axios-like interface
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrap(data: unknown): { data: any } {
  return { data } as { data: any }
}

// CSV helper - defined once, used in exportApi, salesApi, bonusApi
function toCsvRow(values: (string | number | null | undefined)[]): string {
  return values.map(v => {
    const s = String(v ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
    return s
  }).join(',')
}

// ==================== AUTH API ====================

export const authApi = {
  login: async (_employee_id: string, _password: string) => {
    // Handled by AuthContext directly, but kept for compat
    return wrap({ access_token: '' })
  },
  me: async () => {
    const currentUser = auth.currentUser
    if (!currentUser) throw new Error('Not authenticated')
    const userData = await firestoreGetUserByUid(currentUser.uid)
    if (!userData) throw new Error('User not found')
    return wrap(userData)
  },
}

// ==================== USERS API ====================

export const usersApi = {
  list: async () => {
    const users = await firestoreGetUsers()
    return wrap(users)
  },
  create: async (data: Record<string, unknown>) => {
    // Use secondary app instance to avoid signing out the current admin
    const secondaryApp = initializeApp(app.options, 'secondary-' + Date.now())
    const secondaryAuth = getAuth(secondaryApp)
    try {
      const email = `${data.employee_id}@ratec.local`
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, (data.password as string) || 'changeme123')
      const { password: _pw, ...userData } = data
      const user = await firestoreCreateUser(cred.user.uid, userData)
      return wrap(user)
    } finally {
      await deleteApp(secondaryApp)
    }
  },
  get: async (id: number) => {
    const user = await firestoreGetUserById(id)
    if (!user) throw new Error('User not found')
    return wrap(user)
  },
  update: async (id: number, data: Record<string, unknown>) => {
    const { password: _pw, ...updateData } = data
    await firestoreUpdateUser(id, updateData)
    // Updating other users' passwords requires Admin SDK - skipped for client-side
    const updated = await firestoreGetUserById(id)
    return wrap(updated)
  },
  deactivate: async (id: number) => {
    await firestoreDeactivateUser(id)
    return wrap({ success: true })
  },
}

// ==================== WORK RECORDS API ====================

export const workRecordsApi = {
  list: async (params: { user_id?: number; year_month?: string }) => {
    const records = await firestoreGetWorkRecords(params)
    return wrap(records)
  },
  create: async (data: Record<string, unknown>) => {
    const actual_minutes = calculateActualMinutes(
      data.start_time as string,
      data.end_time as string,
      (data.break_minutes as number) || 0
    )
    const currentUser = auth.currentUser
    const record = await firestoreCreateWorkRecord({
      ...data,
      actual_minutes,
      created_by: currentUser ? currentUser.uid : null,
    })
    return wrap(record)
  },
  get: async (id: number) => {
    const record = await firestoreGetWorkRecordById(id)
    if (!record) throw new Error('WorkRecord not found')
    return wrap(record)
  },
  update: async (id: number, data: Record<string, unknown>) => {
    const actual_minutes = calculateActualMinutes(
      data.start_time as string,
      data.end_time as string,
      (data.break_minutes as number) || 0
    )
    const updated = await firestoreUpdateWorkRecord(id, { ...data, actual_minutes })
    return wrap(updated)
  },
  delete: async (id: number) => {
    await firestoreDeleteWorkRecord(id)
    return wrap({ success: true })
  },
  calendar: async (userId: number, yearMonth: string) => {
    const records = await firestoreGetWorkRecords({ user_id: userId, year_month: yearMonth })
    return wrap(records)
  },
}

// ==================== PAYROLL API ====================

export const payrollApi = {
  list: async (yearMonth: string) => {
    const records = await firestoreGetPayrollRecords(yearMonth)
    return wrap(records)
  },
  calculate: async (yearMonth: string) => {
    // Get all active non-admin users
    const usersData = await firestoreGetUsers()
    const activeUsers = (usersData as Array<Record<string, unknown>>).filter(u => u.is_active && !u.is_admin)

    for (const user of activeUsers) {
      const workRecords = await firestoreGetWorkRecords({ user_id: user.id as number, year_month: yearMonth })
      const hours = aggregateMonthlyHours(workRecords)
      const payrollCalc = calculatePayroll(user, hours)

      const existing = await firestoreGetPayrollRecord(yearMonth, user.id as number)
      const payrollData: Record<string, unknown> = {
        year_month: yearMonth,
        user_id: user.id as number,
        ...hours,
        ...payrollCalc,
        additional_notes: existing?.additional_notes ?? null,
        status: existing?.status === 'confirmed' ? 'confirmed' : 'calculated',
        confirmed_at: existing?.confirmed_at ?? null,
        confirmed_by: existing?.confirmed_by ?? null,
      }
      await firestoreSetPayrollRecord(yearMonth, user.id as number, payrollData)
    }
    return wrap({ success: true })
  },
  get: async (yearMonth: string, userId: number) => {
    const record = await firestoreGetPayrollRecord(yearMonth, userId)
    if (!record) throw new Error('PayrollRecord not found')
    return wrap(record)
  },
  adjust: async (yearMonth: string, userId: number, data: Record<string, unknown>) => {
    const existing = await firestoreGetPayrollRecord(yearMonth, userId)
    if (!existing) throw new Error('PayrollRecord not found')
    const allowances = data.allowances as number ?? existing.allowances as number ?? 0
    const deductions = data.deductions as number ?? existing.deductions as number ?? 0
    const gross_pay =
      ((existing.base_salary as number) || 0) +
      ((existing.overtime_pay as number) || 0) +
      ((existing.late_night_pay as number) || 0) +
      ((existing.holiday_pay as number) || 0) +
      ((existing.transportation as number) || 0) +
      (allowances || 0) -
      (deductions || 0)
    await firestoreSetPayrollRecord(yearMonth, userId, {
      ...existing,
      allowances,
      deductions,
      additional_notes: data.additional_notes ?? existing.additional_notes ?? null,
      gross_pay,
    } as Record<string, unknown>)
    const updated = await firestoreGetPayrollRecord(yearMonth, userId)
    return wrap(updated)
  },
  confirm: async (yearMonth: string, userId: number) => {
    const currentUser = auth.currentUser
    await firestoreConfirmPayroll(yearMonth, userId, currentUser?.uid ?? '')
    return wrap({ success: true })
  },
  summary: async (yearMonth: string) => {
    const usersData = await firestoreGetUsers()
    const activeUsers = (usersData as Array<Record<string, unknown>>).filter(u => u.is_active && !u.is_admin)
    const closingStatus = await firestoreGetClosingStatus(yearMonth)
    const closingMap: Record<number, string> = {}
    closingStatus.forEach(c => { closingMap[c.user_id] = c.status })

    const summaries = await Promise.all(activeUsers.map(async (user) => {
      const workRecords = await firestoreGetWorkRecords({ user_id: user.id as number, year_month: yearMonth })
      const hours = aggregateMonthlyHours(workRecords)
      return {
        user_id: user.id as number,
        user_name: user.name as string,
        year_month: yearMonth,
        total_hours: hours.total_hours,
        regular_hours: hours.regular_hours,
        overtime_hours: hours.overtime_hours,
        late_night_hours: hours.late_night_hours,
        holiday_hours: hours.holiday_hours,
        work_days: hours.work_days,
        closing_status: closingMap[user.id as number] ?? 'open',
      }
    }))
    return wrap(summaries)
  },
}

// ==================== CLOSING API ====================

export const closingApi = {
  status: async (yearMonth: string) => {
    const statuses = await firestoreGetClosingStatus(yearMonth)
    return wrap(statuses)
  },
  close: async (yearMonth: string, userId: number) => {
    const currentUser = auth.currentUser
    await firestoreCloseMonth(yearMonth, userId, currentUser?.uid ?? '')
    return wrap({ success: true })
  },
  reopen: async (yearMonth: string, userId: number) => {
    await firestoreReopenMonth(yearMonth, userId)
    return wrap({ success: true })
  },
  closeAll: async (yearMonth: string) => {
    const usersData = await firestoreGetUsers()
    const activeUsers = (usersData as Array<Record<string, unknown>>).filter(u => u.is_active && !u.is_admin)
    const currentUser = auth.currentUser
    await Promise.all(activeUsers.map(u => firestoreCloseMonth(yearMonth, u.id as number, currentUser?.uid ?? '')))
    return wrap({ success: true })
  },
}

// ==================== EXPORT API ====================

export const exportApi = {
  workRecords: async (yearMonth: string) => {
    const usersData = await firestoreGetUsers()
    const userMap: Record<number, Record<string, unknown>> = {}
    ;(usersData as Array<Record<string, unknown>>).forEach(u => { userMap[u.id as number] = u })
    const records = await firestoreGetWorkRecords({ year_month: yearMonth })
    const header = toCsvRow(['日付', '社員番号', '氏名', '開始', '終了', '休憩(分)', '実働(分)', '区分', '備考'])
    const rows = (records as Array<Record<string, unknown>>).map(r => {
      const u = userMap[r.user_id as number]
      return toCsvRow([
        r.work_date as string,
        u?.employee_id as string ?? '',
        u?.name as string ?? '',
        r.start_time as string,
        r.end_time as string,
        r.break_minutes as number,
        r.actual_minutes as number,
        r.work_type as string,
        r.notes as string ?? '',
      ])
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    return wrap(blob)
  },
  payroll: async (yearMonth: string) => {
    const usersData = await firestoreGetUsers()
    const userMap: Record<number, Record<string, unknown>> = {}
    ;(usersData as Array<Record<string, unknown>>).forEach(u => { userMap[u.id as number] = u })
    const records = await firestoreGetPayrollRecords(yearMonth)
    const header = toCsvRow(['社員番号', '氏名', '通常時間', '残業時間', '深夜時間', '休日時間', '基本給', '残業手当', '深夜手当', '休日手当', '交通費', '諸手当', '控除', '支給総額', '状態'])
    const rows = (records as Array<Record<string, unknown>>).map(r => {
      const u = userMap[r.user_id as number]
      return toCsvRow([
        u?.employee_id as string ?? '',
        u?.name as string ?? '',
        r.regular_hours as number,
        r.overtime_hours as number,
        r.late_night_hours as number,
        r.holiday_hours as number,
        r.base_salary as number,
        r.overtime_pay as number,
        r.late_night_pay as number,
        r.holiday_pay as number,
        r.transportation as number,
        r.allowances as number,
        r.deductions as number,
        r.gross_pay as number,
        r.status as string,
      ])
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    return wrap(blob)
  },
}

// ==================== SALES API ====================

export const salesApi = {
  list: async (params: { year_month?: string; user_id?: number }) => {
    const records = await firestoreGetSalesRecords(params)
    const usersData = await firestoreGetUsers()
    const userMap: Record<number, Record<string, unknown>> = {}
    ;(usersData as Array<Record<string, unknown>>).forEach(u => { userMap[u.id as number] = u })
    const enriched = (records as Array<Record<string, unknown>>).map(r => ({
      ...r,
      user_name: userMap[r.user_id as number]?.name ?? '',
      employee_id: userMap[r.user_id as number]?.employee_id ?? '',
    }))
    return wrap(enriched)
  },
  create: async (data: Record<string, unknown>) => {
    const currentUser = auth.currentUser
    const record = await firestoreCreateSalesRecord({ ...data, created_by: currentUser?.uid ?? '' })
    return wrap(record)
  },
  update: async (id: number, data: Record<string, unknown>) => {
    await firestoreUpdateSalesRecord(id, data)
    return wrap({ success: true })
  },
  delete: async (id: number) => {
    await firestoreDeleteSalesRecord(id)
    return wrap({ success: true })
  },
  uploadPhotos: async (id: number, files: File[]) => {
    const results = await Promise.all(files.map(f => uploadSalesPhoto(id, f)))
    return wrap(results)
  },
  deletePhoto: async (photoId: number) => {
    await deleteSalesPhoto(photoId)
    return wrap({ success: true })
  },
  monthly: async (yearMonth: string) => {
    const summaries = await firestoreGetMonthlySalesSummary(yearMonth)
    const usersData = await firestoreGetUsers()
    const userMap: Record<number, Record<string, unknown>> = {}
    ;(usersData as Array<Record<string, unknown>>).forEach(u => { userMap[u.id as number] = u })
    const enriched = summaries.map(s => ({
      ...s,
      user_name: userMap[s.user_id]?.name ?? '',
      employee_id: userMap[s.user_id]?.employee_id ?? '',
    }))
    return wrap(enriched)
  },
  exportCsv: async (yearMonth: string) => {
    const usersData = await firestoreGetUsers()
    const userMap: Record<number, Record<string, unknown>> = {}
    ;(usersData as Array<Record<string, unknown>>).forEach(u => { userMap[u.id as number] = u })
    const records = await firestoreGetSalesRecords({ year_month: yearMonth })
    const header = toCsvRow(['日付', '社員番号', '氏名', '売上金額', '材料費', '利益', '備考'])
    const rows = (records as Array<Record<string, unknown>>).map(r => {
      const u = userMap[r.user_id as number]
      return toCsvRow([
        r.record_date as string,
        u?.employee_id as string ?? '',
        u?.name as string ?? '',
        r.sales_amount as number,
        r.material_cost as number,
        r.profit as number,
        r.notes as string ?? '',
      ])
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    return wrap(blob)
  },
}

// ==================== BONUS API ====================

export const bonusApi = {
  list: async (yearMonth: string) => {
    const bonuses = await firestoreGetBonuses(yearMonth)
    return wrap(bonuses)
  },
  update: async (yearMonth: string, userId: number, data: Record<string, unknown>) => {
    const currentUser = auth.currentUser
    await firestoreSetBonus(yearMonth, userId, data, currentUser?.uid ?? '')
    return wrap({ success: true })
  },
  exportCsv: async (yearMonth: string) => {
    const usersData = await firestoreGetUsers()
    const userMap: Record<number, Record<string, unknown>> = {}
    ;(usersData as Array<Record<string, unknown>>).forEach(u => { userMap[u.id as number] = u })
    const bonuses = await firestoreGetBonuses(yearMonth)
    const header = toCsvRow(['社員番号', '氏名', 'ボーナス金額', '備考'])
    const rows = (bonuses as Array<Record<string, unknown>>).map(b => {
      const u = userMap[b.user_id as number]
      return toCsvRow([
        u?.employee_id as string ?? '',
        u?.name as string ?? '',
        b.bonus_amount as number,
        b.notes as string ?? '',
      ])
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    return wrap(blob)
  },
}

export default {}
