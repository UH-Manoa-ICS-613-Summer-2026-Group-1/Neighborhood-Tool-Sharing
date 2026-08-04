// src/pages/Admin/SuspendUsersTab.tsx
// Admin tab: lists every user with a Suspend / Activate action per row.
//
//   GET  /api/admin/users           (status filter + pagination)
//   POST /api/admin/users/{id}/suspend
//   POST /api/admin/users/{id}/activate
//
// Guard rails that mirror the backend:
//   - An admin cannot suspend their own account (button hidden for self).
//   - Other ADMIN accounts are not given a suspend button here.

import { useEffect, useState } from 'react'
import {
    fetchAdminUsers,
    suspendUser,
    activateUser,
    type UserProfile,
} from '../../api/admin'

const PAGE_SIZE = 20

const STATUS_OPTIONS = [
    { value: '', label: 'All statuses' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'SUSPENDED', label: 'Suspended' },
]

// Coloured badge for a user's status
function StatusBadge({ code }: { code: string }) {
    const styles =
        code === 'SUSPENDED'
            ? 'bg-red-400/20 text-red-300 border-red-400/30'
            : 'bg-green-400/20 text-green-300 border-green-400/30'
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${styles}`}>{code}</span>
}

interface Props {
    // The signed-in admin — used to hide the action button on their own row
    currentUserId: string
}

export default function SuspendUsersTab({ currentUserId }: Props) {
    const [users, setUsers] = useState<UserProfile[]>([])
    const [error, setError] = useState('')

    const [statusFilter, setStatusFilter] = useState('')
    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(false)

    // Bumping this re-runs the fetch effect (used after a suspend/activate).
    const [reloadNonce, setReloadNonce] = useState(0)
    const reload = () => setReloadNonce(n => n + 1)

    // Loading is derived, not set: we're loading until the effect records the
    // current query as done. This keeps setState out of the effect's sync body
    // (react-hooks/set-state-in-effect), matching the Dashboard's approach.
    const queryKey = `${statusFilter}|${offset}|${reloadNonce}`
    const [loadedKey, setLoadedKey] = useState<string | null>(null)
    const loading = loadedKey !== queryKey

    // id of the row whose action is in flight (disables just that button)
    const [actingId, setActingId] = useState<string | null>(null)
    const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

    useEffect(() => {
        let cancelled = false
        const run = async () => {
            try {
                const data = await fetchAdminUsers({
                    status: statusFilter || undefined,
                    limit: PAGE_SIZE,
                    offset,
                })
                if (cancelled) return
                setUsers(data)
                setHasMore(data.length === PAGE_SIZE)
                setError('')
            } catch (err) {
                if (cancelled) return
                setError(err instanceof Error ? err.message : 'Failed to load users.')
            } finally {
                if (!cancelled) setLoadedKey(queryKey)
            }
        }
        run()
        return () => {
            cancelled = true
        }
    }, [statusFilter, offset, queryKey])

    const handleSuspend = async (user: UserProfile) => {
        const name = `${user.user_first_name} ${user.user_last_name}`
        if (!window.confirm(`Suspend ${name}? Their active reservations will be cancelled and their tools hidden.`))
            return

        setActingId(user.user_id)
        setBanner(null)
        try {
            const res = await suspendUser(user.user_id)
            setBanner({ kind: 'ok', text: res.message })
            reload()
        } catch (err) {
            setBanner({ kind: 'err', text: err instanceof Error ? err.message : 'Failed to suspend user.' })
        } finally {
            setActingId(null)
        }
    }

    const handleActivate = async (user: UserProfile) => {
        setActingId(user.user_id)
        setBanner(null)
        try {
            const res = await activateUser(user.user_id)
            setBanner({ kind: 'ok', text: res.message })
            reload()
        } catch (err) {
            setBanner({ kind: 'err', text: err instanceof Error ? err.message : 'Failed to activate user.' })
        } finally {
            setActingId(null)
        }
    }

    return (
        <div>
            <p className="text-sm text-gray-400 mb-4">
                Suspend a member to remove their listings from public view and cancel their active reservations.
            </p>

            {/* Filter bar */}
            <div className="flex flex-wrap gap-3 mb-4">
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
            </div>

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

            {loading && <p className="text-center text-gray-400 py-10">Loading users...</p>}
            {!loading && error && <p role="alert" className="text-center text-red-400 py-10">{error}</p>}

            {!loading && !error && users.length === 0 && (
                <p className="text-center text-gray-400 py-10">No users match this filter.</p>
            )}

            {/* User table */}
            {!loading && !error && users.length > 0 && (
                <div className="overflow-x-auto border border-white/10 rounded-lg">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-400 border-b border-white/10 bg-black/20">
                                <th className="px-4 py-3 font-semibold">Name</th>
                                <th className="px-4 py-3 font-semibold">Email</th>
                                <th className="px-4 py-3 font-semibold">Role</th>
                                <th className="px-4 py-3 font-semibold">Status</th>
                                <th className="px-4 py-3 font-semibold text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => {
                                const isSelf = user.user_id === currentUserId
                                const isAdmin = user.role_code === 'ADMIN'
                                const isSuspended = user.status_code === 'SUSPENDED'
                                const busy = actingId === user.user_id

                                return (
                                    <tr key={user.user_id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                                        <td className="px-4 py-3 text-white">
                                            {user.user_first_name} {user.user_last_name}
                                        </td>
                                        <td className="px-4 py-3 text-gray-300">{user.user_email}</td>
                                        <td className="px-4 py-3 text-gray-400">{user.role_name}</td>
                                        <td className="px-4 py-3">
                                            <StatusBadge code={user.status_code} />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {isSelf ? (
                                                <span className="text-xs text-gray-500">You</span>
                                            ) : isAdmin && !isSuspended ? (
                                                <span className="text-xs text-gray-500">Administrator</span>
                                            ) : isSuspended ? (
                                                <button
                                                    onClick={() => handleActivate(user)}
                                                    disabled={busy}
                                                    className="px-3 py-1.5 text-xs font-semibold rounded border border-green-400/40 text-green-300 hover:bg-green-400 hover:text-[#1a1f26] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                                >
                                                    {busy ? 'Working...' : 'Activate'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleSuspend(user)}
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