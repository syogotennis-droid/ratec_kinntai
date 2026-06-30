import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, Timestamp, serverTimestamp, writeBatch, runTransaction,
  QueryConstraint,
} from 'firebase/firestore'
import { db } from './config'

// ---- COUNTER HELPER ----
async function getNextId(counterName: string): Promise<number> {
  const counterRef = doc(db, 'counters', counterName)
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef)
    const current = snap.exists() ? ((snap.data() as any).value as number) : 0
    const next = current + 1
    tx.set(counterRef, { value: next })
    return next
  })
}

// ---- TIMESTAMP HELPER ----
function tsToString(ts: unknown): string {
  if (!ts) return new Date().toISOString()
  if (ts instanceof Timestamp) return ts.toDate().toISOString()
  if (
    typeof ts === 'object' &&
    ts !== null &&
    'toDate' in ts &&
    typeof (ts as { toDate: unknown }).toDate === 'function'
  ) {
    return (ts as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date().toISOString()
}

// ==================== USERS ====================

export async function firestoreIsSetupRequired(): Promise<boolean> {
  const snap = await getDocs(collection(db, 'users'))
  return snap.empty
}

export async function firestoreGetUsers() {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map((d) => ({ ...d.data() as any, uid: d.id }))
}

export async function firestoreGetUserById(numericId: number) {
  const q = query(collection(db, 'users'), where('id', '==', numericId))
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { ...snap.docs[0].data() as any, uid: snap.docs[0].id }
}

export async function firestoreGetUserByUid(uid: string) {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return { ...snap.data() as any, uid: snap.id }
}

export async function firestoreCreateUser(uid: string, data: Record<string, unknown>) {
  const id = await getNextId('users')
  const now = serverTimestamp()
  const userData = {
    ...data,
    uid,
    id,
    email: `${data.employee_id}@ratec.local`,
    is_active: true,
    created_at: now,
    updated_at: now,
  }
  await setDoc(doc(db, 'users', uid), userData)
  return {
    ...userData,
    id,
    uid,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export async function firestoreUpdateUser(numericId: number, data: Record<string, unknown>) {
  const q = query(collection(db, 'users'), where('id', '==', numericId))
  const snap = await getDocs(q)
  if (snap.empty) throw new Error('User not found')
  await updateDoc(snap.docs[0].ref, { ...data, updated_at: serverTimestamp() })
}

export async function firestoreDeactivateUser(numericId: number) {
  const q = query(collection(db, 'users'), where('id', '==', numericId))
  const snap = await getDocs(q)
  if (snap.empty) throw new Error('User not found')
  await updateDoc(snap.docs[0].ref, { is_active: false, updated_at: serverTimestamp() })
}

// ==================== WORK RECORDS ====================

export async function firestoreGetWorkRecords(params: {
  user_id?: number
  year_month?: string
}) {
  // user_id のみでクエリし、年月フィルタはコード側で実施（複合インデックス不要）
  const constraints: QueryConstraint[] = []
  if (params.user_id != null) constraints.push(where('user_id', '==', params.user_id))
  const q =
    constraints.length > 0
      ? query(collection(db, 'work_records'), ...constraints)
      : query(collection(db, 'work_records'))
  const snap = await getDocs(q)
  let records = snap.docs.map((d) => {
    const data = d.data() as any
    return {
      ...data,
      id: data.id as number,
      created_at: tsToString(data.created_at),
      updated_at: tsToString(data.updated_at),
    }
  })
  if (params.year_month) {
    records = records.filter((r: any) =>
      typeof r.work_date === 'string' && r.work_date.startsWith(params.year_month!)
    )
  }
  return records
}

export async function firestoreCreateWorkRecord(data: Record<string, unknown>) {
  const id = await getNextId('work_records')
  const now = serverTimestamp()
  const recordData = { ...data, id, created_at: now, updated_at: now }
  await addDoc(collection(db, 'work_records'), recordData)
  return {
    ...recordData,
    id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export async function firestoreGetWorkRecordById(numericId: number) {
  const q = query(collection(db, 'work_records'), where('id', '==', numericId))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const data = snap.docs[0].data() as any
  return {
    ...data,
    id: data.id as number,
    created_at: tsToString(data.created_at),
    updated_at: tsToString(data.updated_at),
  }
}

export async function firestoreUpdateWorkRecord(numericId: number, data: Record<string, unknown>) {
  const q = query(collection(db, 'work_records'), where('id', '==', numericId))
  const snap = await getDocs(q)
  if (snap.empty) throw new Error('WorkRecord not found')
  await updateDoc(snap.docs[0].ref, { ...data, updated_at: serverTimestamp() })
  const updated = snap.docs[0].data() as any
  return { ...updated, ...data, id: numericId, updated_at: new Date().toISOString() }
}

export async function firestoreDeleteWorkRecord(numericId: number) {
  const q = query(collection(db, 'work_records'), where('id', '==', numericId))
  const snap = await getDocs(q)
  if (snap.empty) throw new Error('WorkRecord not found')
  await deleteDoc(snap.docs[0].ref)
}

// ==================== PAYROLL RECORDS ====================

export async function firestoreGetPayrollRecords(yearMonth: string) {
  const q = query(collection(db, 'payroll_records'), where('year_month', '==', yearMonth))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data() as any
    return {
      ...data,
      confirmed_at: data.confirmed_at ? tsToString(data.confirmed_at) : null,
      created_at: tsToString(data.created_at),
      updated_at: tsToString(data.updated_at),
    }
  })
}

export async function firestoreGetPayrollRecord(yearMonth: string, userId: number) {
  const docId = `${yearMonth}_${userId}`
  const snap = await getDoc(doc(db, 'payroll_records', docId))
  if (!snap.exists()) return null
  const data = snap.data() as any
  return {
    ...data,
    confirmed_at: data.confirmed_at ? tsToString(data.confirmed_at) : null,
    created_at: tsToString(data.created_at),
    updated_at: tsToString(data.updated_at),
  }
}

export async function firestoreSetPayrollRecord(
  yearMonth: string,
  userId: number,
  data: Record<string, unknown>
) {
  const docId = `${yearMonth}_${userId}`
  const existing = await getDoc(doc(db, 'payroll_records', docId))
  const now = serverTimestamp()
  if (existing.exists()) {
    await updateDoc(doc(db, 'payroll_records', docId), { ...data, updated_at: now })
  } else {
    await setDoc(doc(db, 'payroll_records', docId), { ...data, created_at: now, updated_at: now })
  }
}

export async function firestoreConfirmPayroll(
  yearMonth: string,
  userId: number,
  confirmedByUid: string
) {
  const docId = `${yearMonth}_${userId}`
  await updateDoc(doc(db, 'payroll_records', docId), {
    status: 'confirmed',
    confirmed_at: serverTimestamp(),
    confirmed_by: confirmedByUid,
    updated_at: serverTimestamp(),
  })
}

// ==================== MONTHLY CLOSINGS ====================

export async function firestoreGetClosingStatus(yearMonth: string) {
  const q = query(collection(db, 'monthly_closings'), where('year_month', '==', yearMonth))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data() as any
    return {
      ...data,
      id: (data.id as number) ?? 0,
      user_id: data.user_id as number,
      status: data.status as string,
      closed_at: data.closed_at ? tsToString(data.closed_at) : null,
    }
  })
}

export async function firestoreCloseMonth(
  yearMonth: string,
  userId: number,
  closedByUid: string
) {
  const docId = `${yearMonth}_${userId}`
  const snap = await getDoc(doc(db, 'monthly_closings', docId))
  const now = serverTimestamp()
  if (snap.exists()) {
    await updateDoc(doc(db, 'monthly_closings', docId), {
      status: 'closed',
      closed_at: now,
      closed_by: closedByUid,
    })
  } else {
    await setDoc(doc(db, 'monthly_closings', docId), {
      year_month: yearMonth,
      user_id: userId,
      status: 'closed',
      closed_at: now,
      closed_by: closedByUid,
      id: Date.now(),
    })
  }
}

export async function firestoreReopenMonth(yearMonth: string, userId: number) {
  const docId = `${yearMonth}_${userId}`
  const snap = await getDoc(doc(db, 'monthly_closings', docId))
  if (snap.exists()) {
    await updateDoc(doc(db, 'monthly_closings', docId), {
      status: 'open',
      closed_at: null,
      closed_by: null,
    })
  } else {
    await setDoc(doc(db, 'monthly_closings', docId), {
      year_month: yearMonth,
      user_id: userId,
      status: 'open',
      closed_at: null,
      closed_by: null,
      id: Date.now(),
    })
  }
}

// ==================== SALES RECORDS ====================

export async function firestoreGetSalesRecords(params: {
  year_month?: string
  user_id?: number
}) {
  // user_id のみでクエリし、年月フィルタはコード側で実施（複合インデックス不要）
  const constraints: QueryConstraint[] = []
  if (params.user_id != null) constraints.push(where('user_id', '==', params.user_id))
  const q =
    constraints.length > 0
      ? query(collection(db, 'sales_records'), ...constraints)
      : query(collection(db, 'sales_records'))
  const snap = await getDocs(q)
  let records = snap.docs.map((d) => {
    const data = d.data() as any
    return {
      ...data,
      id: data.id as number,
      profit: (data.sales_amount || 0) - (data.material_cost || 0),
      photos: [] as Array<Record<string, unknown>>,
      created_at: tsToString(data.created_at),
      updated_at: tsToString(data.updated_at),
    }
  })
  if (params.year_month) {
    records = records.filter((r: any) =>
      typeof r.record_date === 'string' && r.record_date.startsWith(params.year_month!)
    )
  }
  // Fetch photos for each record
  for (const record of records) {
    const photosSnap = await getDocs(
      query(collection(db, 'sales_photos'), where('sales_record_id', '==', record.id))
    )
    record.photos = photosSnap.docs.map((p) => {
      const pd = p.data() as any
      return { ...pd, id: pd.id as number, created_at: tsToString(pd.created_at) }
    })
  }
  return records
}

export async function firestoreCreateSalesRecord(data: Record<string, unknown>) {
  const id = await getNextId('sales_records')
  const now = serverTimestamp()
  const recordData = { ...data, id, created_at: now, updated_at: now }
  await addDoc(collection(db, 'sales_records'), recordData)
  return {
    ...recordData,
    id,
    profit: ((data.sales_amount as number) || 0) - ((data.material_cost as number) || 0),
    photos: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export async function firestoreUpdateSalesRecord(numericId: number, data: Record<string, unknown>) {
  const q = query(collection(db, 'sales_records'), where('id', '==', numericId))
  const snap = await getDocs(q)
  if (snap.empty) throw new Error('SalesRecord not found')
  await updateDoc(snap.docs[0].ref, { ...data, updated_at: serverTimestamp() })
}

export async function firestoreDeleteSalesRecord(numericId: number) {
  const q = query(collection(db, 'sales_records'), where('id', '==', numericId))
  const snap = await getDocs(q)
  if (snap.empty) throw new Error('SalesRecord not found')
  await deleteDoc(snap.docs[0].ref)
  // Also delete associated photos
  const photosSnap = await getDocs(
    query(collection(db, 'sales_photos'), where('sales_record_id', '==', numericId))
  )
  const batch = writeBatch(db)
  photosSnap.docs.forEach((d) => batch.delete(d.ref))
  if (photosSnap.docs.length > 0) await batch.commit()
}

export async function firestoreGetSalesPhotoById(numericId: number) {
  const q = query(collection(db, 'sales_photos'), where('id', '==', numericId))
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { ...snap.docs[0].data() as any, docRef: snap.docs[0].ref }
}

export async function firestoreDeleteSalesPhoto(numericId: number) {
  const q = query(collection(db, 'sales_photos'), where('id', '==', numericId))
  const snap = await getDocs(q)
  if (!snap.empty) await deleteDoc(snap.docs[0].ref)
}

export async function firestoreAddSalesPhoto(data: {
  sales_record_id: number
  file_path: string
  original_name: string
  url: string
}) {
  const id = await getNextId('sales_photos')
  await addDoc(collection(db, 'sales_photos'), { ...data, id, created_at: serverTimestamp() })
  return id
}

export async function firestoreGetMonthlySalesSummary(yearMonth: string) {
  const [y, m] = yearMonth.split('-')
  const start = `${y}-${m}-01`
  const endMonth =
    parseInt(m) === 12
      ? `${parseInt(y) + 1}-01-01`
      : `${y}-${String(parseInt(m) + 1).padStart(2, '0')}-01`
  const q = query(
    collection(db, 'sales_records'),
    where('record_date', '>=', start),
    where('record_date', '<', endMonth)
  )
  const snap = await getDocs(q)
  const byUser: Record<
    number,
    {
      total_sales: number
      total_material: number
      total_profit: number
      record_count: number
      user_id: number
    }
  > = {}
  snap.docs.forEach((d) => {
    const data = d.data() as any
    const uid = data.user_id as number
    if (!byUser[uid])
      byUser[uid] = {
        total_sales: 0,
        total_material: 0,
        total_profit: 0,
        record_count: 0,
        user_id: uid,
      }
    byUser[uid].total_sales += data.sales_amount || 0
    byUser[uid].total_material += data.material_cost || 0
    byUser[uid].total_profit += (data.sales_amount || 0) - (data.material_cost || 0)
    byUser[uid].record_count += 1
  })
  return Object.values(byUser)
}

// ==================== BONUSES ====================

export async function firestoreGetBonuses(yearMonth: string) {
  const q = query(collection(db, 'bonuses'), where('year_month', '==', yearMonth))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data() as any
    return {
      ...data,
      id: data.id as number,
      created_at: tsToString(data.created_at),
      updated_at: tsToString(data.updated_at),
    }
  })
}

export async function firestoreSetBonus(
  yearMonth: string,
  userId: number,
  data: Record<string, unknown>,
  createdBy: string
) {
  const docId = `${yearMonth}_${userId}`
  const snap = await getDoc(doc(db, 'bonuses', docId))
  const now = serverTimestamp()
  if (snap.exists()) {
    await updateDoc(doc(db, 'bonuses', docId), { ...data, updated_at: now })
  } else {
    await setDoc(doc(db, 'bonuses', docId), {
      ...data,
      user_id: userId,
      year_month: yearMonth,
      id: Date.now(),
      created_by: createdBy,
      created_at: now,
      updated_at: now,
    })
  }
}
