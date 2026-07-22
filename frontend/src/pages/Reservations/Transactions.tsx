// src/pages/Reservations/Transactions.tsx
// Shows all reservations for the current user — both as borrower and as tool owner
// Used inside the Transactions tab on the Dashboard page
//
// User Stories covered in this file:
//
// US 3 — Cancel a Reservation
//   Scenario 1 & 5: Owner or borrower can cancel REQUESTED or APPROVED → status CANCELLED
//   Scenario 2 & 6: Cannot cancel after PICKED_UP → backend rejects
//   Scenario 3 & 7: Cannot cancel RETURNED → backend rejects
//   Scenario 4 & 8: Cannot cancel already CANCELLED → backend rejects
//
// US 4 — Approve or Deny a Reservation (tool owner only)
//   Scenario 1: Owner approves REQUESTED → status APPROVED
//   Scenario 2: Owner denies REQUESTED → status DENIED
//   Scenario 3 & 4: Non-owner cannot approve/deny → buttons not shown
//   Scenario 5 & 6: Cannot approve/deny non-REQUESTED → buttons only shown for REQUESTED
//   Scenario 7: Auto-deny overlapping requests → handled by backend
//
// US 5 — Confirm Return (tool owner only)
//   Scenario 1: Owner marks PICKED_UP as RETURNED
//   Scenario 2: Non-owner cannot confirm return → button not shown
//   Scenario 3: Cannot confirm return unless PICKED_UP → button only shown for PICKED_UP
//
// US 7 — Confirm Pickup (borrower only)
//   Scenario 1: Borrower marks APPROVED as PICKED_UP
//   Scenario 2: Non-borrower cannot mark pickup → button not shown
//   Scenario 3 & 4: Only shown for APPROVED status
//   Scenario 5: Pickup outside date range → backend rejects with error message
//
// US 9 — Tool owner views incoming reservations on their tools
// US 10 — Borrower views their own reservation requests

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    fetchReservations,
    approveReservation,
    denyReservation,
    cancelReservation,
    pickupReservation,
    returnReservation,
    type ReservationDetails,
} from '../../api/reservations'
import { fetchCurrentUser } from '../../api/users'

// Number of reservations shown per page
const PAGE_SIZE = 10

// ---------------------------------------------------------------------------
// Status badge color map — matches the app's dark theme
// ---------------------------------------------------------------------------
const statusColors: Record<string, string> = {
    REQUESTED: 'bg-blue-400/20 text-blue-300 border border-blue-400/30',
    APPROVED:  'bg-green-400/20 text-green-300 border border-green-400/30',
    PICKED_UP: 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30',
    RETURNED:  'bg-purple-400/20 text-purple-300 border border-purple-400/30',
    DENIED:    'bg-red-400/20 text-red-300 border border-red-400/30',
    CANCELED:  'bg-gray-400/20 text-gray-300 border border-gray-400/30',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Transactions() {
    const navigate = useNavigate()

    const [reservations, setReservations] = useState<ReservationDetails[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Current user ID — determines if the user is owner or borrower per reservation
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)

    // Per-reservation action state
    const [actionError, setActionError] = useState<Record<string, string>>({})
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

    // Pagination state
    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(false)

    // Load reservations and current user ID
    // Re-runs whenever offset changes (pagination)
    useEffect(() => {
        const loadData = async () => {
            setLoading(true)
            try {
                const [reservationsData, userData] = await Promise.all([
                    // GET /api/reservations with limit and offset for pagination
                    fetchReservations({ limit: PAGE_SIZE, offset }),
                    fetchCurrentUser(),
                ])
                setReservations(reservationsData)
                setCurrentUserId(userData.user_id)
                // If we got a full page, there may be more results
                setHasMore(reservationsData.length === PAGE_SIZE)
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Failed to load reservations.')
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [offset])

    // Generic action handler — approve, deny, cancel, pickup, return
    //
    // FIXED — 07/21/2026
    // Action endpoints return MessageResponse { message: "..." } not ReservationDetails.
    // Previously replacing the card with the API response caused
    // "undefined undefined Invalid Date" to show.
    // Fix: update only the status field locally using the newStatus parameter.
    const handleAction = async (
        reservationId: string,
        action: (id: string) => Promise<ReservationDetails>,
        newStatus: string
    ) => {
        setActionError(prev => ({ ...prev, [reservationId]: '' }))
        setActionLoading(prev => ({ ...prev, [reservationId]: true }))
        try {
            await action(reservationId)
            // Update only the status — preserves tool name, dates, parties
            setReservations(prev =>
                prev.map(r =>
                    r.reservation_id === reservationId
                        ? { ...r, reservation_status: newStatus }
                        : r
                )
            )
        } catch (err: unknown) {
            setActionError(prev => ({
                ...prev,
                [reservationId]: err instanceof Error ? err.message : 'Action failed.',
            }))
        } finally {
            setActionLoading(prev => ({ ...prev, [reservationId]: false }))
        }
    }

    // Format ISO date string to "Jul 20, 2026"
    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
        })

    // ---------------------------------------------------------------------------
    // Render states
    // ---------------------------------------------------------------------------

    if (loading) {
        return <p className="text-center text-gray-400 py-10">Loading transactions...</p>
    }

    if (error) {
        return <p role="alert" className="text-center text-red-400 py-10">{error}</p>
    }

    // Empty state
    if (reservations.length === 0 && offset === 0) {
        return (
            <div className="p-10 bg-black/15 border border-white/5 rounded-lg text-center">
                <span className="block text-3xl mb-3">📋</span>
                <h2 className="text-lg font-semibold text-[#e8a838] mb-2">No Transactions Yet</h2>
                <p className="text-xs text-gray-400 mb-4">
                    Browse your neighborhood tools and request a reservation to get started.
                </p>
                <button
                    onClick={() => navigate('/dashboard?tab=neighborhood')}
                    className="px-4 py-2 bg-[#e8a838] hover:bg-[#d6962f] text-white rounded text-sm font-bold transition-colors cursor-pointer"
                >
                    Browse Tools
                </button>
            </div>
        )
    }

    // ---------------------------------------------------------------------------
    // Reservation list — US 9 (owner view) and US 10 (borrower view) combined
    // ---------------------------------------------------------------------------
    return (
        <div className="flex flex-col gap-4">

            {reservations.map(r => {
                const isOwner    = r.owner_id === currentUserId
                const isBorrower = r.borrower_id === currentUserId
                const isLoading  = actionLoading[r.reservation_id]
                const err        = actionError[r.reservation_id]

                return (
                    <div
                        key={r.reservation_id}
                        className="p-4 bg-black/20 border border-white/10 rounded-lg"
                    >
                        {/* Tool name + role label + status badge */}
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                            <div>
                                <button
                                    onClick={() => navigate(`/tools/${r.tool_id}`)}
                                    className="text-sm font-bold text-white hover:text-[#e8a838] transition-colors cursor-pointer text-left"
                                >
                                    {r.tool_title}
                                </button>

                                {/* Role label — ADDED 07/21/2026 (Kylie feedback)
                                    Makes it easy to tell incoming vs outgoing reservations */}
                                <span className={`text-[0.6rem] font-semibold px-1.5 py-0.5 rounded mr-1 ml-1 ${isOwner ? 'bg-orange-400/20 text-orange-300' : 'bg-teal-400/20 text-teal-300'}`}>
                                    {isOwner ? 'Outgoing' : 'Incoming'}
                                </span>

                                <p className="text-xs text-gray-400 mt-0.5">
                                    {r.tool_type_name} &bull;{' '}
                                    {isOwner
                                        ? `Requested by ${r.borrower_first_name} ${r.borrower_last_name}`
                                        : `Owned by ${r.owner_first_name} ${r.owner_last_name}`}
                                </p>
                            </div>

                            {/* Status badge */}
                            <span className={`text-[0.65rem] font-bold px-2 py-1 rounded uppercase ${statusColors[r.reservation_status] ?? 'bg-gray-400/20 text-gray-300'}`}>
                                {r.reservation_status}
                            </span>
                        </div>

                        {/* Date range */}
                        <p className="text-xs text-gray-400 mb-3">
                            {formatDate(r.reservation_start_date)} &rarr; {formatDate(r.reservation_end_date)}
                        </p>

                        {/* Per-reservation action error */}
                        {err && (
                            <p role="alert" aria-live="assertive" className="mb-3 text-xs text-red-400">
                                {err}
                            </p>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-2">

                            {/* US 4 Scenario 1: Approve — owner only, REQUESTED only */}
                            {isOwner && r.reservation_status === 'REQUESTED' && (
                                <button
                                    onClick={() => handleAction(r.reservation_id, approveReservation, 'APPROVED')}
                                    disabled={isLoading}
                                    className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 text-green-300 text-xs font-semibold rounded hover:bg-green-500/30 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {isLoading ? '...' : 'Approve'}
                                </button>
                            )}

                            {/* US 4 Scenario 2: Deny — owner only, REQUESTED only */}
                            {isOwner && r.reservation_status === 'REQUESTED' && (
                                <button
                                    onClick={() => handleAction(r.reservation_id, denyReservation, 'DENIED')}
                                    disabled={isLoading}
                                    className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-semibold rounded hover:bg-red-500/30 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {isLoading ? '...' : 'Deny'}
                                </button>
                            )}

                            {/* US 5 Scenario 1: Confirm Return — owner only, PICKED_UP only */}
                            {isOwner && r.reservation_status === 'PICKED_UP' && (
                                <button
                                    onClick={() => handleAction(r.reservation_id, returnReservation, 'RETURNED')}
                                    disabled={isLoading}
                                    className="px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold rounded hover:bg-purple-500/30 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {isLoading ? '...' : 'Confirm Return'}
                                </button>
                            )}

                            {/* US 7 Scenario 1: Confirm Pickup — borrower only, APPROVED only */}
                            {isBorrower && r.reservation_status === 'APPROVED' && (
                                <button
                                    onClick={() => handleAction(r.reservation_id, pickupReservation, 'PICKED_UP')}
                                    disabled={isLoading}
                                    className="px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 text-xs font-semibold rounded hover:bg-yellow-500/30 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {isLoading ? '...' : 'Confirm Pickup'}
                                </button>
                            )}

                            {/* US 3: Cancel — owner or borrower, REQUESTED or APPROVED only */}
                            {(isOwner || isBorrower) &&
                                ['REQUESTED', 'APPROVED'].includes(r.reservation_status) && (
                                <button
                                    onClick={() => handleAction(r.reservation_id, cancelReservation, 'CANCELED')}
                                    disabled={isLoading}
                                    className="px-3 py-1.5 bg-gray-500/20 border border-gray-500/30 text-gray-300 text-xs font-semibold rounded hover:bg-gray-500/30 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {isLoading ? '...' : 'Cancel'}
                                </button>
                            )}
                        </div>
                    </div>
                )
            })}

            {/* Pagination — Previous and Next buttons
                ADDED 07/21/2026 (Kylie feedback: older reservations not visible)
                Shows 10 reservations at a time using API limit/offset params */}
            {(offset > 0 || hasMore) && (
                <div className="flex justify-center items-center gap-4 mt-2">
                    <button
                        onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                        disabled={offset === 0}
                        className="px-4 py-2 text-xs font-semibold border border-white/10 rounded text-gray-300 hover:border-[#e8a838] hover:text-[#e8a838] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                        ← Previous
                    </button>
                    <span className="text-xs text-gray-500">
                        Page {Math.floor(offset / PAGE_SIZE) + 1}
                    </span>
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
