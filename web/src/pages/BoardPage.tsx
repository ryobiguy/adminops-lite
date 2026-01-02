import { useEffect, useMemo, useState } from 'react'
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

function toDatetimeLocalValue(value: string | null | undefined) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function statusLabel(s: RequestStatus) {
  switch (s) {
    case 'new':
      return 'New'
    case 'doing':
      return 'Doing'
    case 'waiting':
      return 'Waiting'
    case 'done':
      return 'Done'
  }
}

const columns: RequestStatus[] = ['new', 'doing', 'waiting', 'done']

function Card({
  r,
  onMove,
  onEdit,
  onDelete,
}: {
  r: AdminRequest
  onMove: (id: string, status: RequestStatus) => void
  onEdit: (r: AdminRequest) => void
  onDelete: (r: AdminRequest) => void
}) {
  const due = r.due_date ? new Date(r.due_date) : null
  const dueText = due && !Number.isNaN(due.getTime()) ? due.toLocaleString() : null
  const isOverdue = due ? due.getTime() < Date.now() && r.status !== 'done' : false
  const isWaitingStale = r.status === 'waiting' ? Date.now() - new Date(r.updated_at).getTime() > 24 * 60 * 60 * 1000 : false

  return (
    <div
      className={
        'bg-white border rounded-lg p-3 shadow-sm ' +
        (isOverdue ? 'border-red-300 bg-red-50' : isWaitingStale ? 'border-amber-300 bg-amber-50' : 'border-gray-200')
      }
    >
      <div className="font-medium text-gray-900">{r.title}</div>
      <div className="text-xs text-gray-500 mt-1">
        {r.customer_name ? <div><span className="font-medium">Customer:</span> {r.customer_name}</div> : null}
        {dueText ? <div><span className="font-medium">Due:</span> {dueText}</div> : null}
        {r.tags ? <div><span className="font-medium">Tags:</span> {r.tags}</div> : null}
        {isOverdue ? <div className="text-red-700 font-medium">Overdue</div> : null}
        {!isOverdue && isWaitingStale ? <div className="text-amber-700 font-medium">Waiting 24h+</div> : null}
      </div>
      {r.details ? <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{r.details}</div> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
          onClick={() => onEdit(r)}
        >
          Edit
        </button>
        <button
          className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50"
          onClick={() => onDelete(r)}
        >
          Delete
        </button>
        {columns
          .filter((c) => c !== r.status)
          .map((c) => (
            <button
              key={c}
              className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
              onClick={() => onMove(r.id, c)}
            >
              Move to {statusLabel(c)}
            </button>
          ))}
      </div>
    </div>
  )
}

export default function BoardPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [requests, setRequests] = useState<AdminRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showArchivedClients, setShowArchivedClients] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all')

  const [title, setTitle] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [details, setDetails] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)

  const [newClientName, setNewClientName] = useState('')
  const [savingClient, setSavingClient] = useState(false)

  const [copied, setCopied] = useState(false)

  const [editing, setEditing] = useState<AdminRequest | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCustomerName, setEditCustomerName] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editDetails, setEditDetails] = useState('')
  const [editTags, setEditTags] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const openEdit = (r: AdminRequest) => {
    setEditing(r)
    setEditTitle(r.title)
    setEditCustomerName(r.customer_name || '')
    setEditDueDate(toDatetimeLocalValue(r.due_date))
    setEditDetails(r.details || '')
    setEditTags(r.tags || '')
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setSavingEdit(true)
    setError(null)
    try {
      const payload = {
        title: editTitle,
        customerName: editCustomerName || null,
        dueDate: editDueDate || null,
        details: editDetails || null,
        tags: editTags || null,
      }
      const data = await apiRequest<{ request: AdminRequest }>(`/requests/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setRequests((prev: AdminRequest[]) => prev.map((r: AdminRequest) => (r.id === editing.id ? data.request : r)))
      setEditing(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to save changes')
    } finally {
      setSavingEdit(false)
    }
  }

  const deleteRequest = async (r: AdminRequest) => {
    const ok = window.confirm(`Delete this request?\n\n${r.title}`)
    if (!ok) return
    setError(null)
    try {
      await apiRequest<{ ok: true }>(`/requests/${r.id}`, { method: 'DELETE' })
      setRequests((prev: AdminRequest[]) => prev.filter((x: AdminRequest) => x.id !== r.id))
    } catch (e: any) {
      setError(e?.message || 'Failed to delete')
    }
  }

  const selectedClient = clients.find((c) => c.id === selectedClientId) || null
  const submitUrl = selectedClient?.client_code
    ? `${window.location.origin}/submit/${selectedClient.client_code}`
    : ''

  const archiveSelectedClient = async () => {
    if (!selectedClient) return
    const ok = window.confirm(
      `End this client?\n\n${selectedClient.name}\n\nThis will hide them and disable their public submit link. Requests are kept for records.`
    )
    if (!ok) return
    setError(null)
    try {
      await apiRequest<{ client: Client }>(`/clients/${selectedClient.id}/archive`, { method: 'POST' })
      await loadClients()
      setSelectedClientId('')
      setRequests([])
    } catch (e: any) {
      setError(e?.message || 'Failed to end client')
    }
  }

  const deleteSelectedClient = async () => {
    if (!selectedClient) return
    const phrase = 'DELETE'
    const typed = window.prompt(
      `This will permanently delete the client AND ALL their requests.\n\nClient: ${selectedClient.name}\n\nType ${phrase} to confirm.`
    )
    if (typed !== phrase) return
    setError(null)
    try {
      await apiRequest<{ ok: true }>(`/clients/${selectedClient.id}`, { method: 'DELETE' })
      await loadClients()
      setSelectedClientId('')
      setRequests([])
    } catch (e: any) {
      setError(e?.message || 'Failed to delete client')
    }
  }

  const grouped = useMemo(() => {
    const map: Record<RequestStatus, AdminRequest[]> = { new: [], doing: [], waiting: [], done: [] }
    for (const r of requests) map[r.status].push(r)
    return map
  }, [requests])

  async function loadClients() {
    const data = await apiRequest<{ clients: Client[] }>(`/clients?includeArchived=${showArchivedClients ? 'true' : 'false'}`)
    setClients(data.clients)
    if (!selectedClientId && data.clients.length > 0) {
      setSelectedClientId(data.clients[0].id)
    }
  }

  async function loadRequests(clientId: string, opts?: { q?: string; status?: string }) {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ clientId })
      if (opts?.q) qs.set('q', opts.q)
      if (opts?.status) qs.set('status', opts.status)
      const data = await apiRequest<{ requests: AdminRequest[] }>(`/requests?${qs.toString()}`)
      setRequests(data.requests)
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClients().catch((e: any) => setError(e?.message || 'Failed to load clients'))
  }, [showArchivedClients])

  useEffect(() => {
    if (!selectedClientId) return
    loadRequests(selectedClientId, {
      q: search.trim() ? search.trim() : undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    })
  }, [selectedClientId])

  useEffect(() => {
    if (!selectedClientId) return
    const t = setTimeout(() => {
      loadRequests(selectedClientId, {
        q: search.trim() ? search.trim() : undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
      })
    }, 250)
    return () => clearTimeout(t)
  }, [search, statusFilter, selectedClientId])

  const createClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClientName.trim()) return
    setSavingClient(true)
    setError(null)
    try {
      const data = await apiRequest<{ client: Client }>('/clients', {
        method: 'POST',
        body: JSON.stringify({ name: newClientName }),
      })
      setClients((prev) => [data.client, ...prev])
      setSelectedClientId(data.client.id)
      setNewClientName('')
    } catch (e: any) {
      setError(e?.message || 'Failed to create client')
    } finally {
      setSavingClient(false)
    }
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClientId) {
      setError('Please select a client first')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        clientId: selectedClientId,
        title,
        customerName: customerName || null,
        dueDate: dueDate || null,
        details: details || null,
        tags: tags || null,
      }
      const data = await apiRequest<{ request: AdminRequest }>('/requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setRequests((prev) => [data.request, ...prev])
      setTitle('')
      setCustomerName('')
      setDueDate('')
      setDetails('')
      setTags('')
    } catch (e: any) {
      setError(e?.message || 'Failed to create')
    } finally {
      setSaving(false)
    }
  }

  const move = async (id: string, status: RequestStatus) => {
    setError(null)
    const optimistic = requests.map((r) => (r.id === id ? { ...r, status } : r))
    setRequests(optimistic)

    try {
      const data = await apiRequest<{ request: AdminRequest }>(`/requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setRequests((prev) => prev.map((r) => (r.id === id ? data.request : r)))
    } catch (e: any) {
      setError(e?.message || 'Failed to move')
      if (selectedClientId) {
        await loadRequests(selectedClientId, {
          q: search.trim() ? search.trim() : undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
        })
      }
    }
  }

  return (
    <div className="space-y-4">
      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-xl bg-white rounded-lg border border-gray-200 shadow-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit request</h3>
              <button
                className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
                onClick={() => setEditing(null)}
              >
                Close
              </button>
            </div>

            <form className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={saveEdit}>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Task title</label>
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Customer name</label>
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Due date/time</label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Details</label>
                <textarea
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 min-h-[110px]"
                  value={editDetails}
                  onChange={(e) => setEditDetails(e.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Tags</label>
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                />
              </div>

              <div className="md:col-span-2 flex items-center gap-2">
                <button
                  disabled={savingEdit}
                  className="text-sm px-4 py-2 rounded bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  {savingEdit ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  className="text-sm px-3 py-2 rounded border border-gray-300 hover:bg-gray-50"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Request Board</h2>
          <button
            className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
            onClick={() => {
              if (selectedClientId) {
                loadRequests(selectedClientId, {
                  q: search.trim() ? search.trim() : undefined,
                  status: statusFilter === 'all' ? undefined : statusFilter,
                })
              }
            }}
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700">Client</label>
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
          </div>

          <form className="md:col-span-2 flex gap-2" onSubmit={createClient}>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">Add new client</label>
              <input
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="e.g. Ryan's Plumbing"
              />
            </div>
            <button
              disabled={savingClient}
              className="self-end text-sm px-4 py-2 rounded bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {savingClient ? 'Adding…' : 'Add'}
            </button>
          </form>
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={!selectedClientId}
            className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-60"
            onClick={async () => {
              if (!submitUrl) return
              try {
                await navigator.clipboard.writeText(submitUrl)
                setCopied(true)
                setTimeout(() => setCopied(false), 1200)
              } catch {
                setError('Could not copy to clipboard')
              }
            }}
          >
            Copy submit link
          </button>
          {submitUrl ? (
            <span className="text-xs text-gray-600 break-all">{submitUrl}</span>
          ) : (
            <span className="text-xs text-gray-500">Select a client to see the submit link</span>
          )}
          {copied ? <span className="text-xs text-green-700">Copied</span> : null}
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <label className="text-xs text-gray-700 flex items-center gap-2">
            <input
              type="checkbox"
              checked={showArchivedClients}
              onChange={(e) => setShowArchivedClients(e.target.checked)}
            />
            Show archived clients
          </label>

          <button
            type="button"
            disabled={!selectedClientId}
            className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-60"
            onClick={archiveSelectedClient}
          >
            End client
          </button>

          <button
            type="button"
            disabled={!selectedClientId}
            className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
            onClick={deleteSelectedClient}
          >
            Delete client
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700">Search</label>
            <input
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, customer, tags"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status filter</label>
            <select
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 bg-white"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">All</option>
              <option value="new">New</option>
              <option value="doing">Doing</option>
              <option value="waiting">Waiting</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div className="text-xs text-gray-500">
            Red = overdue (not done). Amber = waiting 24h+.
          </div>
        </div>

        <form className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={create}>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Task title</label>
            <input
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Call back John about a quote"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Customer name (optional)</label>
            <input
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. John Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Due date/time (optional)</label>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Details (optional)</label>
            <textarea
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 min-h-[90px]"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Any extra context"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Tags (optional)</label>
            <input
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. calls, booking, quote"
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <button
              disabled={saving}
              className="text-sm px-4 py-2 rounded bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {saving ? 'Adding…' : 'Add request'}
            </button>
            {error ? <div className="text-sm text-red-600">{error}</div> : null}
          </div>
        </form>
      </div>

      {loading ? (
        <div className="text-sm text-gray-600">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {columns.map((c) => (
            <section key={c} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{statusLabel(c)}</h3>
                <span className="text-xs text-gray-500">{grouped[c].length}</span>
              </div>
              <div className="space-y-2">
                {grouped[c].map((r) => (
                  <Card key={r.id} r={r} onMove={move} onEdit={openEdit} onDelete={deleteRequest} />
                ))}
                {grouped[c].length === 0 ? (
                  <div className="text-xs text-gray-500">No items</div>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
