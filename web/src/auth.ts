import { apiRequest } from './api'

export type User = { id: string; email: string }

export async function login(email: string, password: string): Promise<User> {
  const data = await apiRequest<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  localStorage.setItem('adminops_token', data.token)
  localStorage.setItem('adminops_user', JSON.stringify(data.user))
  return data.user
}

export function logout() {
  localStorage.removeItem('adminops_token')
  localStorage.removeItem('adminops_user')
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem('adminops_user')
  return raw ? (JSON.parse(raw) as User) : null
}
