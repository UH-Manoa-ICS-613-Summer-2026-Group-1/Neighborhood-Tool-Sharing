// src/pages/Admin/SuspendToolsTab.tsx
// Admin tab: lists every tool with a Suspend / Activate action per row.
//
//   GET  /api/admin/tools           (status filter + keyword search + pagination)
//   POST /api/admin/tools/{id}/suspend
//   POST /api/admin/tools/{id}/activate  (reinstates a suspended tool as HIDDEN)

import { useEffect, useState } from 'react'
import {
    fetchAdminTools,
    suspendTool,
    activateTool,
    type ToolDetails,
} from '../../api/admin'

const PAGE_SIZE = 20

const STATUS_OPTIONS = [
    { value: '', label: 'All statuses' },
    { value: 'AVAILABLE', label: 'Available' },
    { value: 'HIDDEN', label: 'Hidden' },
    { value: 'SUSPENDED', label: 'Suspended' },
]

// Coloured badge for a tool's status
function StatusBadge({ code }: { code: string }) {
    const map: Record<string, string> = {
        AVAILABLE: 'bg-green-400/20 text-green-300 border-green-400/30',
        HIDDEN: 'bg-gray-400/20 text-gray-300 border-gray-400/30',
        SUSPENDED: 'bg-red-400/20 text-red-300 border-red-400/30',
    }
    const styles = map[code] ?? 'bg-gray-400/20 text-gray-300 border-gray-400/30'
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${styles}`}>{code}</span>
}

export default function SuspendToolsTab() {
    const [tools, setTools] = useState<ToolDetails[]>([])
    const [error, setError] = useState('')

    const [statusFilter, setStatusFilter] = useState('')
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(false)

    // Bumping this re-runs the fetch effect (used after a suspend/activate).
    const [reloadNonce, setReloadNonce] = useState(0)
    const reload = () => setReloadNonce(n => n + 1)

    // Loading is derived, not set: we're loading until the effect records the
    // current query as done. This keeps setState out of the effect's sync body
    // (react-hooks/set-state-in-effect), matching the Dashboard's approach.
    const queryKey = `${statusFilter}|${search}|${offset}|${reloadNonce}`
    const [loadedKey, setLoadedKey] = useState<string | null>(null)
    const loading = loadedKey !== queryKey

    const [actingId, setActingId] = useState<string | null>(null)
    const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

    useEffect(() => {
        let cancelled = false
        const run = async () => {
            try {
                const data = await fetchAdminTools({
                    status: statusFilter || undefined,
                    search: search || undefined,
                    limit: PAGE_SIZE,
                    offset,
                })
                if (cancelled) return
                setTools(data)
                setHasMore(data.length === PAGE_SIZE)
                setError('')
            } catch (err) {
                if (cancelled) return
                setError(err instanceof Error ? err.message : 'Failed to load tools.')
            } finally {
                if (!cancelled) setLoadedKey(queryKey)
            }
        }
        run()
        return () => {
            cancelled = true
        }
    }, [statusFilter, search, offset, queryKey])

    const applySearch = (e: React.FormEvent) => {
        e.preventDefault()
        setOffset(0)
        setSearch(searchInput.trim())
    }

    const handleSuspend = async (tool: ToolDetails) => {
        if (!window.confirm(`Suspend "${tool.tool_title}"? Active reservations for it will be cancelled.`)) return

        setActingId(tool.tool_id)
        setBanner(null)
        try {
            const res = await suspendTool(tool.tool_id)
            setBanner({ kind: 'ok', text: res.message })
            reload()
        } catch (err) {
            setBanner({ kind: 'err', text: err instanceof Error ? err.message : 'Failed to suspend tool.' })
        } finally {
            setActingId(null)
        }
    }

    const handleActivate = async (tool: ToolDetails) => {
        setActingId(tool.tool_id)
        setBanner(null)
        try {
            const res = await activateTool(tool.tool_id)
            setBanner({ kind: 'ok', text: res.message })
            reload()
        } catch (err) {
            setBanner({ kind: 'err', text: err instanceof Error ? err.message : 'Failed to activate tool.' })
        } finally {
            setActingId(null)
        }
    }

    return (
        <div>
            <p className="text-sm text-gray-400 mb-4">
                Suspend a listing to remove it from the neighborhood and cancel its active reservations. Activating a
                suspended tool restores it as <span className="text-gray-300">Hidden</span> so the owner can republish it.
            </p>

            {/* Filter + search bar */}
            <form onSubmit={applySearch} className="flex flex-wrap gap-3 mb-4">
                <input
                    className="flex-1 min-w-48 px-3 py-2 bg-black/25 border border-white/10 rounded text-sm placeholder-[#8f8f8f] focus:outline-none focus:ring-2 focus:ring-[#e8a838]"
                    placeholder="Search title or description..."
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                />
                <select
                    className="px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e8a838]"
                    value={statusFilter}
                    onChange={e => {
                        setStatusFilter(e.target.value)
                        setOffset(0)
                    }}
                >
                    {STATUS_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
                <button
                    type="submit"
                    className="px-4 py-2 bg-black/25 border border-[#e8a838] text-[#e8a838] rounded text-sm font-semibold hover:bg-[#e8a838] hover:text-white transition-colors cursor-pointer"
                >
                    Search
                </button>
            </form>

            {/* Action result banner */}
            {banner && (
                <div
                    role="alert"
                    aria-live="polite"
                    className={`flex items-center justify-between mb-4 px-4 py-3 rounded text-sm ${
                        banner.kind === 'ok'
                            ? 'bg-green-400/10 border border-green-400/30 text-green-400'
                            : 'bg-red-400/10 border border-red-400/30 text-red-400'
                    }`}
                >
                    <span>{banner.text}</span>
                    <button onClick={() => setBanner(null)} className="ml-4 opacity-70 hover:opacity-100 cursor-pointer" aria-label="Dismiss">
                        ✕
                    </button>
                </div>
            )}

            {loading && <p className="text-center text-gray-400 py-10">Loading tools...</p>}
            {!loading && error && <p role="alert" className="text-center text-red-400 py-10">{error}</p>}

            {!loading && !error && tools.length === 0 && (
                <p className="text-center text-gray-400 py-10">No tools match this filter.</p>
            )}

            {/* Tool table */}
            {!loading && !error && tools.length > 0 && (
                <div className="overflow-x-auto border border-white/10 rounded-lg">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-400 border-b border-white/10 bg-black/20">
                                <th className="px-4 py-3 font-semibold">Tool</th>
                                <th className="px-4 py-3 font-semibold">Owner</th>
                                <th className="px-4 py-3 font-semibold">Category</th>
                                <th className="px-4 py-3 font-semibold">Status</th>
                                <th className="px-4 py-3 font-semibold text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tools.map(tool => {
                                const isSuspended = tool.tool_status === 'SUSPENDED'
                                const busy = actingId === tool.tool_id

                                return (
                                    <tr key={tool.tool_id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                                        <td className="px-4 py-3 text-white max-w-xs truncate">{tool.tool_title}</td>
                                        <td className="px-4 py-3 text-gray-300">
                                            {tool.owner_first_name} {tool.owner_last_name}
                                        </td>
                                        <td className="px-4 py-3 text-gray-400">{tool.tool_type_name}</td>
                                        <td className="px-4 py-3">
                                            <StatusBadge code={tool.tool_status} />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {isSuspended ? (
                                                <button
                                                    onClick={() => handleActivate(tool)}
                                                    disabled={busy}
                                                    className="px-3 py-1.5 text-xs font-semibold rounded border border-green-400/40 text-green-300 hover:bg-green-400 hover:text-[#1a1f26] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                                >
                                                    {busy ? 'Working...' : 'Activate'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleSuspend(tool)}
                                                    disabled={busy}
                                                    className="px-3 py-1.5 text-xs font-semibold rounded border border-red-400/40 text-red-300 hover:bg-red-400 hover:text-[#1a1f26] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                                >
                                                    {busy ? 'Working...' : 'Suspend'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {!loading && !error && (offset > 0 || hasMore) && (
                <div className="flex justify-center items-center gap-4 mt-6">
                    <button
                        onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                        disabled={offset === 0}
                        className="px-4 py-2 text-xs font-semibold border border-white/10 rounded text-gray-300 hover:border-[#e8a838] hover:text-[#e8a838] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                        ← Previous
                    </button>
                    <span className="text-xs text-gray-500">Page {Math.floor(offset / PAGE_SIZE) + 1}</span>
                    <button
                        onClick={() => setOffset(offset + PAGE_SIZE)}
                        disabled={!hasMore}
                        className="px-4 py-2 text-xs font-semibold border border-white/10 rounded text-gray-300 hover:border-[#e8a838] hover:text-[#e8a838] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    )
}