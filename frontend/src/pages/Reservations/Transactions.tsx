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
//   Note: Cancel button is only shown for REQUESTED or APPROVED (frontend guard)
//         Backend enforces all other scenarios
//
// US 4 — Approve or Deny a Reservation (tool owner only)
//   Scenario 1: Owner approves REQUESTED → status APPROVED, borrower notified
//   Scenario 2: Owner denies REQUESTED → status DENIED, borrower notified
//   Scenario 3 & 4: Non-owner cannot approve/deny → Approve/Deny buttons not shown to non-owners
//   Scenario 5 & 6: Cannot approve/deny non-REQUESTED → buttons only shown for REQUESTED
//   Scenario 7: Auto-deny overlapping requests → handled entirely by backend
//
// US 5 — Confirm Return (tool owner only)
//   Scenario 1: Owner marks PICKED_UP as RETURNED, borrower notified
//   Scenario 2: Non-owner cannot confirm return → button not shown to non-owners
//   Scenario 3: Cannot confirm return unless PICKED_UP → button only shown for PICKED_UP
//
// US 7 — Confirm Pickup (borrower only)
//   Scenario 1: Borrower marks APPROVED as PICKED_UP, owner notified
//   Scenario 2: Non-borrower cannot mark pickup → button not shown to non-borrowers
//   Scenario 3: Cannot pick up REQUESTED → button only shown for APPROVED
//   Scenario 4: Cannot pick up already PICKED_UP → button only shown for APPROVED
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

// ---------------------------------------------------------------------------
// Status badge color map — matches the app's dark theme
// Each status has a distinct color so users can quickly scan their reservations
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

    // We need the current user's ID to determine if they are the owner or borrower
    // This controls which action buttons are shown for each reservation
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)

    // Per-reservation action state — tracks loading and errors independently
    // so one reservation's action doesn't affect another
    const [actionError, setActionError] = useState<Record<string, string>>({})
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

    // Load reservations (US 9, 10) and current user ID in parallel on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                const [reservationsData, userData] = await Promise.all([
                    fetchReservations(),   // GET /api/reservations
                    fetchCurrentUser(),    // GET /api/users/me
                ])
                setReservations(reservationsData)
                setCurrentUserId(userData.user_id)
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Failed to load reservations.')
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    // Generic action handler — used for approve, deny, cancel, pickup, return
    // On success: updates the reservation in the list without refetching the whole list
    // On failure: shows the backend error message on the specific reservation card
    const handleAction = async (
        reservationId: string,
        action: (id: string) => Promise<ReservationDetails>
    ) => {
        setActionError(prev => ({ ...prev, [reservationId]: '' }))
        setActionLoading(prev => ({ ...prev, [reservationId]: true }))
        try {
            const updated = await action(reservationId)
            // Replace just the updated reservation in the list
            setReservations(prev =>
                prev.map(r => r.reservation_id === reservationId ? updated : r)
            )
        } catch (err: unknown) {
            // Shows backend error messages for scenarios handled server-side
            // e.g. US 7 Scenario 5: pickup outside date range
            setActionError(prev => ({
                ...prev,
                [reservationId]: err instanceof Error ? err.message : 'Action failed.',
            }))
        } finally {
            setActionLoading(prev => ({ ...prev, [reservationId]: false }))
        }
    }

    // Format ISO date string to human-readable e.g. "Jul 20, 2026"
    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
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

    // Empty state — no reservations yet
    if (reservations.length === 0) {
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
                        {/* Tool name + status badge */}
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                            <div>
                                {/* Clicking the tool name goes to its detail page */}
                                <button
                                    onClick={() => navigate(`/tools/${r.tool_id}`)}
                                    className="text-sm font-bold text-white hover:text-[#e8a838] transition-colors cursor-pointer text-left"
                                >
                                    {r.tool_title}
                                </button>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {r.tool_type_name} &bull;{' '}
                                    {/* Show the other party:
                                        owner sees borrower name (US 9),
                                        borrower sees owner name (US 10) */}
                                    {isOwner
                                        ? `Requested by ${r.borrower_first_name} ${r.borrower_last_name}`
                                        : `Owned by ${r.owner_first_name} ${r.owner_last_name}`}
                                </p>
                            </div>

                            {/* Status badge — distinct color per status for quick scanning */}
                            <span className={`text-[0.65rem] font-bold px-2 py-1 rounded uppercase ${statusColors[r.reservation_status] ?? 'bg-gray-400/20 text-gray-300'}`}>
                                {r.reservation_status}
                            </span>
                        </div>

                        {/* Date range */}
                        <p className="text-xs text-gray-400 mb-3">
                            {formatDate(r.reservation_start_date)} &rarr; {formatDate(r.reservation_end_date)}
                        </p>

                        {/* Per-reservation action error — shown below the dates */}
                        {err && (
                            <p role="alert" aria-live="assertive" className="mb-3 text-xs text-red-400">
                                {err}
                            </p>
                        )}

                        {/* -------------------------------------------------------
                            Action buttons — shown based on role and current status
                            Frontend only shows valid actions (backend enforces all rules)
                            ------------------------------------------------------- */}
                        <div className="flex flex-wrap gap-2">

                            {/* US 4 Scenario 1: Owner approves REQUESTED reservation
                                US 4 Scenario 3: Only shown to owner (non-owner cannot approve) */}
                            {isOwner && r.reservation_status === 'REQUESTED' && (
                                <button
                                    onClick={() => handleAction(r.reservation_id, approveReservation)}
                                    disabled={isLoading}
                                    className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 text-green-300 text-xs font-semibold rounded hover:bg-green-500/30 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {isLoading ? '...' : 'Approve'}
                                </button>
                            )}

                            {/* US 4 Scenario 2: Owner denies REQUESTED reservation
                                US 4 Scenario 4: Only shown to owner (non-owner cannot deny)
                                US 4 Scenario 5 & 6: Only shown for REQUESTED status */}
                            {isOwner && r.reservation_status === 'REQUESTED' && (
                                <button
                                    onClick={() => handleAction(r.reservation_id, denyReservation)}
                                    disabled={isLoading}
                                    className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-semibold rounded hover:bg-red-500/30 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {isLoading ? '...' : 'Deny'}
                                </button>
                            )}

                            {/* US 5 Scenario 1: Owner confirms return when PICKED_UP
                                US 5 Scenario 2: Only shown to owner
                                US 5 Scenario 3: Only shown for PICKED_UP status */}
                            {isOwner && r.reservation_status === 'PICKED_UP' && (
                                <button
                                    onClick={() => handleAction(r.reservation_id, returnReservation)}
                                    disabled={isLoading}
                                    className="px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold rounded hover:bg-purple-500/30 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {isLoading ? '...' : 'Confirm Return'}
                                </button>
                            )}

                            {/* US 7 Scenario 1: Borrower confirms pickup when APPROVED
                                US 7 Scenario 2: Only shown to borrower
                                US 7 Scenario 3 & 4: Only shown for APPROVED status
                                US 7 Scenario 5: Outside date range → backend rejects with error */}
                            {isBorrower && r.reservation_status === 'APPROVED' && (
                                <button
                                    onClick={() => handleAction(r.reservation_id, pickupReservation)}
                                    disabled={isLoading}
                                    className="px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 text-xs font-semibold rounded hover:bg-yellow-500/30 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {isLoading ? '...' : 'Confirm Pickup'}
                                </button>
                            )}

                            {/* US 3 Scenarios 1 & 5: Owner or borrower cancels REQUESTED or APPROVED
                                US 3 Scenarios 2 & 6: Cannot cancel after PICKED_UP → not shown
                                US 3 Scenarios 3 & 7: Cannot cancel RETURNED → not shown
                                US 3 Scenarios 4 & 8: Cannot cancel CANCELLED → not shown
                                Backend enforces all rules; frontend only shows button for valid states */}
                            {(isOwner || isBorrower) &&
                                ['REQUESTED', 'APPROVED'].includes(r.reservation_status) && (
                                <button
                                    onClick={() => handleAction(r.reservation_id, cancelReservation)}
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
        </div>
    )
}
