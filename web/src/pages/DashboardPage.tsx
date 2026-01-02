import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api'

type RequestStatus = 'new' | 'doing' | 'waiting' | 'done'

type Client = {
  id: string
  name: string
  client_code?: string | null
  created_at: string
}

type AdminRequest = {
  id: string
  title: string
  details: string | null
  customer_name: string | null
  due_date: string | null
  tags?: string | null
  status: RequestStatus
  created_at: string
  updated_at: string
}

function isOverdue(r: AdminRequest) {
  if (!r.due_date) return false
  const due = new Date(r.due_date)
  if (Number.isNaN(due.getTime())) return false
  return r.status !== 'done' && due.getTime() < Date.now()
}

function isWaitingStale(r: AdminRequest) {
  if (r.status !== 'waiting') return false
  const updated = new Date(r.updated_at)
  if (Number.isNaN(updated.getTime())) return false
  return Date.now() - updated.getTime() > 24 * 60 * 60 * 1000
}

export default function DashboardPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [items, setItems] = useState<AdminRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [pin, setPin] = useState<string | null>(null)
  const [copiedPin, setCopiedPin] = useState(false)
  const [rotatingPin, setRotatingPin] = useState(false)

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  )

  const intakeUrl = selectedClient?.client_code
    ? `${window.location.origin}/submit/${selectedClient.client_code}`
    : ''

  async function loadClients() {
    const data = await apiRequest<{ clients: Client[] }>('/clients')
    setClients(data.clients)
    if (!selectedClientId && data.clients.length > 0) {
      setSelectedClientId(data.clients[0].id)
    }
  }

  async function loadItems(clientId: string) {
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest<{ requests: AdminRequest[] }>(
        `/requests?clientId=${encodeURIComponent(clientId)}`
      )
      setItems(data.requests)
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClients().catch((e: any) => setError(e?.message || 'Failed to load clients'))
  }, [])

  useEffect(() => {
    if (!selectedClientId) return
    loadItems(selectedClientId)
  }, [selectedClientId])

  useEffect(() => {
    if (!selectedClientId) return
    setPin(null)
    apiRequest<{ pin: string | null }>(`/clients/${encodeURIComponent(selectedClientId)}/pin`)
      .then((d) => setPin(d.pin))
      .catch((e: any) => setError(e?.message || 'Failed to load PIN'))
  }, [selectedClientId])

  const stats = useMemo(() => {
    const overdue = items.filter(isOverdue)
    const waiting = items.filter((r) => r.status === 'waiting')
    const waitingStale = items.filter(isWaitingStale)

    const dueToday = items.filter((r) => {
      if (!r.due_date || r.status === 'done') return false
      const d = new Date(r.due_date)
      if (Number.isNaN(d.getTime())) return false
      const now = new Date()
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
    })

    const newItems = items.filter((r) => r.status === 'new')

    return {
      newCount: newItems.length,
      overdueCount: overdue.length,
      waitingCount: waiting.length,
      waitingStaleCount: waitingStale.length,
      dueTodayCount: dueToday.length,
      overdue,
      waitingStale,
      dueToday,
      newItems,
    }
  }, [items])

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Admin inbox summary</h2>
            <p className="text-sm text-gray-600 mt-1">
              Track callbacks, follow-ups, and anything the client needs you to handle.
            </p>
          </div>
          <button
            className="text-sm px-3 py-2 rounded border border-gray-300 hover:bg-gray-50"
            onClick={() => selectedClientId && loadItems(selectedClientId)}
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-1">
            <label className="block text-sm font-medium text-gray-700">Business</label>
            <select
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 bg-white"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/board"
                className="text-sm px-3 py-2 rounded border border-gray-300 hover:bg-gray-50"
              >
                Open Admin Inbox
              </Link>
              <Link
                to="/reports"
                className="text-sm px-3 py-2 rounded border border-gray-300 hover:bg-gray-50"
              >
                Weekly Report
              </Link>
              <Link
                to="/help"
                className="text-sm px-3 py-2 rounded border border-gray-300 hover:bg-gray-50"
              >
                How it works
              </Link>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs font-medium text-gray-700">Client intake link (owner-only)</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!intakeUrl}
                  className="text-sm px-3 py-2 rounded bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
                  onClick={async () => {
                    if (!intakeUrl) return
                    try {
                      await navigator.clipboard.writeText(intakeUrl)
                      setCopiedLink(true)
                      setTimeout(() => setCopiedLink(false), 1200)
                    } catch {
                      setError('Could not copy link')
                    }
                  }}
                >
                  Copy link
                </button>
                {copiedLink ? <span className="text-xs text-green-700">Copied</span> : null}
                {intakeUrl ? <span className="text-xs text-gray-600 break-all">{intakeUrl}</span> : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="text-xs text-gray-700">
                  PIN: <span className="font-semibold">{pin || '—'}</span>
                </div>
                <button
                  type="button"
                  disabled={!pin}
                  className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-white disabled:opacity-60"
                  onClick={async () => {
                    if (!pin) return
                    try {
                      await navigator.clipboard.writeText(pin)
                      setCopiedPin(true)
                      setTimeout(() => setCopiedPin(false), 1200)
                    } catch {
                      setError('Could not copy PIN')
                    }
                  }}
                >
                  Copy PIN
                </button>
                {copiedPin ? <span className="text-xs text-green-700">Copied</span> : null}

                <button
                  type="button"
                  disabled={!selectedClientId || rotatingPin}
                  className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-white disabled:opacity-60"
                  onClick={async () => {
                    if (!selectedClientId) return
                    const ok = window.confirm('Rotate PIN? The old PIN will stop working immediately.')
                    if (!ok) return
                    setRotatingPin(true)
                    setError(null)
                    try {
                      await apiRequest(`/clients/${encodeURIComponent(selectedClientId)}/rotate-pin`, { method: 'POST' })
                      const d = await apiRequest<{ pin: string | null }>(`/clients/${encodeURIComponent(selectedClientId)}/pin`)
                      setPin(d.pin)
                    } catch (e: any) {
                      setError(e?.message || 'Failed to rotate PIN')
                    } finally {
                      setRotatingPin(false)
                    }
                  }}
                >
                  {rotatingPin ? 'Rotating…' : 'Rotate PIN'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
      </div>

      {loading ? (
        <div className="text-sm text-gray-600">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs text-gray-500">New</div>
            <div className="text-2xl font-semibold">{stats.newCount}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs text-gray-500">Due today</div>
            <div className="text-2xl font-semibold">{stats.dueTodayCount}</div>
          </div>
          <div className="bg-white border border-red-200 bg-red-50 rounded-lg p-4">
            <div className="text-xs text-gray-600">Overdue</div>
            <div className="text-2xl font-semibold text-red-700">{stats.overdueCount}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs text-gray-500">Waiting on you</div>
            <div className="text-2xl font-semibold">{stats.waitingCount}</div>
          </div>
          <div className="bg-white border border-amber-200 bg-amber-50 rounded-lg p-4">
            <div className="text-xs text-gray-600">Waiting 24h+</div>
            <div className="text-2xl font-semibold text-amber-700">{stats.waitingStaleCount}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold">Overdue items</h3>
          <div className="mt-3 space-y-2">
            {stats.overdue.length ? (
              stats.overdue.slice(0, 8).map((r) => (
                <div key={r.id} className="text-sm border border-red-200 bg-red-50 rounded p-2">
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-gray-600">{r.customer_name || '—'}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500">No overdue items</div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold">Waiting on you (24h+)</h3>
          <div className="mt-3 space-y-2">
            {stats.waitingStale.length ? (
              stats.waitingStale.slice(0, 8).map((r) => (
                <div key={r.id} className="text-sm border border-amber-200 bg-amber-50 rounded p-2">
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-gray-600">{r.customer_name || '—'}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500">Nothing stuck waiting</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold">Admin Inbox</h3>
        <p className="text-sm text-gray-600 mt-1">
          The detailed board view is where your admin work happens. Owners can just watch the numbers and approve items in “Waiting on you”.
        </p>
      </div>
    </div>
  )
}
