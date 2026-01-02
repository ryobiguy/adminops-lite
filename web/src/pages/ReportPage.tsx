import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../api'

type Client = {
  id: string
  name: string
  client_code?: string | null
  created_at: string
}

type WeeklyReport = {
  client: { id: string; name: string }
  window: { days: number }
  stats: {
    created: number
    completed: number
    overdue: number
    waiting24hPlus: number
  }
  topTags: Array<{ tag: string; count: number }>
}

export default function ReportPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const summaryText = useMemo(() => {
    if (!report) return ''
    const lines: string[] = []
    lines.push(`Weekly summary (last ${report.window.days} days) — ${report.client.name}`)
    lines.push('')
    lines.push(`Created: ${report.stats.created}`)
    lines.push(`Completed: ${report.stats.completed}`)
    lines.push(`Overdue (currently): ${report.stats.overdue}`)
    lines.push(`Waiting 24h+ (currently): ${report.stats.waiting24hPlus}`)
    if (report.topTags.length) {
      lines.push('')
      lines.push('Top tags:')
      for (const t of report.topTags) {
        lines.push(`- ${t.tag} (${t.count})`)
      }
    }
    return lines.join('\n')
  }, [report])

  async function loadClients() {
    const data = await apiRequest<{ clients: Client[] }>('/clients')
    setClients(data.clients)
    if (!selectedClientId && data.clients.length > 0) {
      setSelectedClientId(data.clients[0].id)
    }
  }

  async function loadReport(clientId: string) {
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest<WeeklyReport>(`/reports/weekly?clientId=${encodeURIComponent(clientId)}`)
      setReport(data)
    } catch (e: any) {
      setError(e?.message || 'Failed to load report')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClients().catch((e: any) => setError(e?.message || 'Failed to load clients'))
  }, [])

  useEffect(() => {
    if (!selectedClientId) return
    loadReport(selectedClientId)
  }, [selectedClientId])

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Weekly Report</h2>
          <button
            className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
            onClick={() => selectedClientId && loadReport(selectedClientId)}
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

          <div className="md:col-span-2 flex items-end gap-2">
            <button
              type="button"
              disabled={!summaryText}
              className="text-sm px-3 py-2 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-60"
              onClick={async () => {
                if (!summaryText) return
                try {
                  await navigator.clipboard.writeText(summaryText)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1200)
                } catch {
                  setError('Could not copy report')
                }
              }}
            >
              Copy summary
            </button>
            {copied ? <span className="text-xs text-green-700">Copied</span> : null}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-600">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : report ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900">Stats</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="border border-gray-200 rounded p-3">
                <div className="text-gray-500">Created</div>
                <div className="text-xl font-semibold">{report.stats.created}</div>
              </div>
              <div className="border border-gray-200 rounded p-3">
                <div className="text-gray-500">Completed</div>
                <div className="text-xl font-semibold">{report.stats.completed}</div>
              </div>
              <div className="border border-red-200 bg-red-50 rounded p-3">
                <div className="text-gray-500">Overdue</div>
                <div className="text-xl font-semibold text-red-700">{report.stats.overdue}</div>
              </div>
              <div className="border border-amber-200 bg-amber-50 rounded p-3">
                <div className="text-gray-500">Waiting 24h+</div>
                <div className="text-xl font-semibold text-amber-700">{report.stats.waiting24hPlus}</div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900">Top tags</h3>
            <div className="mt-3 space-y-2">
              {report.topTags.length ? (
                report.topTags.map((t) => (
                  <div key={t.tag} className="flex items-center justify-between text-sm border border-gray-200 rounded p-2">
                    <span className="font-medium">{t.tag}</span>
                    <span className="text-gray-600">{t.count}</span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">No tags yet</div>
              )}
            </div>
          </div>

          <div className="md:col-span-2 bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900">Summary text</h3>
            <textarea
              className="mt-3 w-full rounded border border-gray-300 px-3 py-2 min-h-[180px] text-sm"
              value={summaryText}
              readOnly
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
