import { useState } from 'react'
import { login, type User } from '../auth'

export default function LoginPage({ onLoggedIn }: { onLoggedIn: (u: User) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = await login(email, password)
      onLoggedIn(user)
    } catch (err: any) {
      setError(err?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <h1 className="text-xl font-semibold text-gray-900">AdminOps Lite</h1>
        <p className="text-sm text-gray-600 mt-1">Sign in</p>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : null}

          <button
            disabled={loading}
            className="w-full rounded bg-gray-900 text-white py-2 hover:bg-gray-800 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="text-xs text-gray-500">
            Use the credentials in <code>adminops-lite/api/.env</code>
          </div>
        </form>
      </div>
    </div>
  )
}
