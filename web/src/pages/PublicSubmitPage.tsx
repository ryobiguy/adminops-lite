import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { API_URL } from '../config'

type Client = { id: string; name: string; pinRequired?: boolean }

type ApiError = { error?: { message?: string } }

async function publicRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as any) },
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (data as ApiError)?.error?.message || 'Request failed'
    throw new Error(msg)
  }
  return data as T
}

export default function PublicSubmitPage() {
  const { clientCode } = useParams()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [details, setDetails] = useState('')
  const [pin, setPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!clientCode) return
    setLoading(true)
    setError(null)
    publicRequest<{ client: Client }>(`/public/clients/by-code/${encodeURIComponent(clientCode)}`)
      .then((d) => setClient(d.client))
      .catch((e: any) => setError(e?.message || 'Failed to load client'))
      .finally(() => setLoading(false))
  }, [clientCode])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientCode) return
    setSaving(true)
    setError(null)
    try {
      await publicRequest(`/public/clients/by-code/${encodeURIComponent(clientCode)}/requests`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          customerName: customerName || null,
          dueDate: dueDate || null,
          details: details || null,
          pin: pin || null,
        }),
      })
      setSubmitted(true)
      setTitle('')
      setCustomerName('')
      setDueDate('')
      setDetails('')
      setPin('')
    } catch (e: any) {
      setError(e?.message || 'Failed to submit')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-600">Loading…</div>
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-red-600">{error}</div>
  }

  if (!client) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-600">Client not found</div>
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <h1 className="text-xl font-semibold text-gray-900">Request a booking / quote</h1>
        <p className="text-sm text-gray-600 mt-1">For: <span className="font-medium">{client.name}</span></p>

        {submitted ? (
          <div className="mt-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
            Request submitted.
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={submit}>
          {client.pinRequired ? (
            <div>
              <label className="block text-sm font-medium text-gray-700">PIN</label>
              <input
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN"
                inputMode="numeric"
              />
              <div className="text-xs text-gray-500 mt-1">This business requires a PIN to submit.</div>
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-gray-700">What do you need?</label>
            <input
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. I'd like a quote for... / I'd like to book..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Customer name (optional)</label>
            <input
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Mrs Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Needed by (optional)</label>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Details (optional)</label>
            <textarea
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 min-h-[110px]"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Any extra info"
            />
          </div>

          {error ? <div className="text-sm text-red-600">{error}</div> : null}

          <button
            disabled={saving}
            className="w-full rounded bg-gray-900 text-white py-2 hover:bg-gray-800 disabled:opacity-60"
          >
            {saving ? 'Submitting…' : 'Submit request'}
          </button>

          <div className="text-xs text-gray-500">
            This request goes to the admin team and will be handled as soon as possible.
          </div>
        </form>
      </div>
    </div>
  )
}
