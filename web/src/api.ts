import { API_URL } from './config'

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('adminops_token')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (options.headers) {
    Object.assign(headers, options.headers)
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data?.error?.message || 'Request failed')
  }

  return data as T
}
