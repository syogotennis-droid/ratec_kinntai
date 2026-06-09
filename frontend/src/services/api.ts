import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response interceptor for auth errors
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  login: (employee_id: string, password: string) =>
    api.post('/auth/login', new URLSearchParams({ username: employee_id, password })),
  me: () => api.get('/auth/me'),
}

export const usersApi = {
  list: () => api.get('/users'),
  create: (data: any) => api.post('/users', data),
  get: (id: number) => api.get(`/users/${id}`),
  update: (id: number, data: any) => api.put(`/users/${id}`, data),
  deactivate: (id: number) => api.delete(`/users/${id}`),
}

export const workRecordsApi = {
  list: (params: { user_id?: number; year_month?: string }) =>
    api.get('/work-records', { params }),
  create: (data: any) => api.post('/work-records', data),
  get: (id: number) => api.get(`/work-records/${id}`),
  update: (id: number, data: any) => api.put(`/work-records/${id}`, data),
  delete: (id: number) => api.delete(`/work-records/${id}`),
  calendar: (userId: number, yearMonth: string) =>
    api.get(`/work-records/calendar/${userId}/${yearMonth}`),
}

export const payrollApi = {
  list: (yearMonth: string) => api.get(`/payroll/${yearMonth}`),
  calculate: (yearMonth: string) => api.post(`/payroll/${yearMonth}/calculate`),
  get: (yearMonth: string, userId: number) => api.get(`/payroll/${yearMonth}/${userId}`),
  adjust: (yearMonth: string, userId: number, data: any) =>
    api.put(`/payroll/${yearMonth}/${userId}/adjust`, data),
  confirm: (yearMonth: string, userId: number) =>
    api.post(`/payroll/${yearMonth}/${userId}/confirm`),
  summary: (yearMonth: string) => api.get(`/payroll/${yearMonth}/summary`),
}

export const closingApi = {
  status: (yearMonth: string) => api.get(`/closing/${yearMonth}`),
  close: (yearMonth: string, userId: number) =>
    api.post(`/closing/${yearMonth}/${userId}/close`),
  reopen: (yearMonth: string, userId: number) =>
    api.post(`/closing/${yearMonth}/${userId}/reopen`),
  closeAll: (yearMonth: string) => api.post(`/closing/${yearMonth}/close-all`),
}

export const exportApi = {
  workRecords: (yearMonth: string) =>
    api.get(`/export/work-records/${yearMonth}`, { responseType: 'blob' }),
  payroll: (yearMonth: string) =>
    api.get(`/export/payroll/${yearMonth}`, { responseType: 'blob' }),
}

export const salesApi = {
  list: (params: { year_month?: string; user_id?: number }) =>
    api.get('/sales', { params }),
  create: (data: any) => api.post('/sales', data),
  update: (id: number, data: any) => api.put(`/sales/${id}`, data),
  delete: (id: number) => api.delete(`/sales/${id}`),
  uploadPhotos: (id: number, files: File[]) => {
    const form = new FormData()
    files.forEach(f => form.append('photos', f))
    return api.post(`/sales/${id}/photos`, form)
  },
  deletePhoto: (photoId: number) => api.delete(`/sales/photos/${photoId}`),
  monthly: (yearMonth: string) => api.get(`/sales/monthly/${yearMonth}`),
  exportCsv: (yearMonth: string) =>
    api.get(`/sales/export/${yearMonth}`, { responseType: 'blob' }),
}

export const bonusApi = {
  list: (yearMonth: string) => api.get(`/bonuses/${yearMonth}`),
  update: (yearMonth: string, userId: number, data: any) =>
    api.put(`/bonuses/${yearMonth}/${userId}`, data),
  exportCsv: (yearMonth: string) =>
    api.get(`/bonuses/export/${yearMonth}`, { responseType: 'blob' }),
}

export default api
