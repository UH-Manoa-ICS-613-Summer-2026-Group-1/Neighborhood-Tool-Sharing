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
import { useNavigate } from 'react-router'
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
import { fetchReservationReviews, type ReviewDetails } from '../../api/review'

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

// Status options for the status filter dropdown
const STATUS_OPTIONS = [
    'REQUESTED',
    'APPROVED',
    'PICKED_UP',
    'RETURNED',
    'DENIED',
    'CANCELED',
] as const
 
// Role filter values map to the API's role param.
// owner  = INCOMING (requests on the user's tools)
// borrower = OUTGOING (the user's own requests)
type RoleFilter = '' | 'owner' | 'borrower'

// Per-reservation review status, derived from GET /reservations/{id}/reviews.
// mine   = the review the current user wrote (if any)
// theirs = the review the OTHER party wrote about the current user (if any)
type ReviewPair = {
    mine: ReviewDetails | null
    theirs: ReviewDetails | null
    loaded: boolean
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

    // Per-reservation review status (only fetched for RETURNED reservations)
    const [reviewState, setReviewState] = useState<Record<string, ReviewPair>>({})

    // Filters applied server-side via the reservations API
    const [roleFilter, setRoleFilter] = useState<RoleFilter>('')
    const [statusFilter, setStatusFilter] = useState('')

    // Pagination state
    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(false)

    const filtersActive = roleFilter !== '' || statusFilter !== ''

    // Load reservations and current user ID
    // Re-runs whenever offset changes (pagination)
    useEffect(() => {
        const loadData = async () => {
            setLoading(true)
            try {
                const [reservationsData, userData] = await Promise.all([
                    // GET /api/reservations with role/status filters + pagination
                    fetchReservations({
                        role: roleFilter || undefined,
                        status: statusFilter || undefined,
                        limit: PAGE_SIZE,
                        offset,
                    }),
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
    }, [offset, roleFilter, statusFilter])

    // Load review status for every RETURNED reservation currently on screen.
    // Runs after reservations load and whenever the list changes (e.g. after a
    // return is confirmed, or the user comes back from the review page).
    useEffect(() => {
        if (!currentUserId) return
 
        const returned = reservations.filter(r => r.reservation_status === 'RETURNED')
        if (returned.length === 0) return
 
        let cancelled = false
        const loadReviews = async () => {
            const entries = await Promise.all(
                returned.map(async r => {
                    try {
                        const reviews = await fetchReservationReviews(r.reservation_id)
                        const mine = reviews.find(rv => rv.reviewer_id === currentUserId) ?? null
                        const theirs = reviews.find(rv => rv.reviewer_id !== currentUserId) ?? null
                        return [r.reservation_id, { mine, theirs, loaded: true }] as const
                    } catch {
                        // On failure fall back to "no reviews" so the button still works.
                        return [r.reservation_id, { mine: null, theirs: null, loaded: true }] as const
                    }
                })
            )
            if (cancelled) return
            setReviewState(prev => {
                const next = { ...prev }
                for (const [id, val] of entries) next[id] = val
                return next
            })
        }
        loadReviews()
 
        return () => {
            cancelled = true
        }
    }, [reservations, currentUserId])

    // Changing a filter resets to the first page.
    const changeRoleFilter = (value: RoleFilter) => {
        setRoleFilter(value)
        setOffset(0)
    }
    const changeStatusFilter = (value: string) => {
        setStatusFilter(value)
        setOffset(0)
    }
    const clearFilters = () => {
        setRoleFilter('')
        setStatusFilter('')
        setOffset(0)
    }

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
    
    // Order the visible list by creation time, newest first.
    const orderedReservations = [...reservations].sort(
        (a, b) =>
            new Date(b.reservation_created_at).getTime() -
            new Date(a.reservation_created_at).getTime()
    )

    // ---------------------------------------------------------------------------
    // Render states
    // ---------------------------------------------------------------------------

    if (error) {
        return <p role="alert" className="text-center text-red-400 py-10">{error}</p>
    }

    // First-visit empty state, only when there are genuinely no reservations
    // (no filters applied, first page). Keeps the original onboarding prompt.
    if (!loading && reservations.length === 0 && offset === 0 && !filtersActive) {
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
 
            {/* Filter bar — Role (direction) and Status */}
            <div className="flex flex-wrap items-center gap-3">
                <select
                    aria-label="Filter by role"
                    value={roleFilter}
                    onChange={e => changeRoleFilter(e.target.value as RoleFilter)}
                    className="px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e8a838]"
                >
                    <option value="">All requests</option>
                    <option value="owner">Incoming (on my tools)</option>
                    <option value="borrower">Outgoing (my requests)</option>
                </select>
 
                <select
                    aria-label="Filter by status"
                    value={statusFilter}
                    onChange={e => changeStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e8a838]"
                >
                    <option value="">Any status</option>
                    {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
 
                {filtersActive && (
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="px-3 py-2 text-xs font-semibold text-gray-400 hover:text-[#e8a838] transition-colors cursor-pointer"
                    >
                        Clear filters
                    </button>
                )}
            </div>
 
            {loading && (
                <p className="text-center text-gray-400 py-10">Loading transactions...</p>
            )}
 
            {/* Empty state when filters exclude everything */}
            {!loading && orderedReservations.length === 0 && (filtersActive || offset > 0) && (
                <div className="p-10 bg-black/15 border border-white/5 rounded-lg text-center">
                    <p className="text-sm text-gray-300 mb-1">No transactions match these filters.</p>
                    {filtersActive && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="text-xs font-semibold text-[#e8a838] hover:underline cursor-pointer"
                        >
                            Clear filters
                        </button>
                    )}
                </div>
            )}
 
            {!loading && orderedReservations.map(r => {
                const isOwner    = r.owner_id === currentUserId
                const isBorrower = r.borrower_id === currentUserId
                const isLoading  = actionLoading[r.reservation_id]
                const err        = actionError[r.reservation_id]
 
                // Direction from the current user's point of view:
                //   owner    -> INCOMING (a borrower is requesting the user's tool)
                //   borrower -> OUTGOING (the user's own request to an owner)
                const directionLabel = isOwner ? 'Incoming' : 'Outgoing'
                const directionClass = isOwner
                    ? 'bg-teal-400/20 text-teal-300'
                    : 'bg-orange-400/20 text-orange-300'

                // Review status for RETURNED reservations
                const review = reviewState[r.reservation_id]
                const hasMine = !!review?.mine
                const hasTheirs = !!review?.theirs
                const otherFirstName = isOwner ? r.borrower_first_name : r.owner_first_name
 
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
 
                                {/* Direction label — Incoming (on my tools) vs Outgoing (my requests) */}
                                <span className={`text-[0.6rem] font-semibold px-1.5 py-0.5 rounded mr-1 ml-1 ${directionClass}`}>
                                    {directionLabel}
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
 
                            {/* Reviews — owner or borrower, RETURNED ("done") only.
                                The label and pills reflect whether the user has already
                                reviewed and whether they've received a review back. */}
                            {(isOwner || isBorrower) && r.reservation_status === 'RETURNED' && (
                                <>
                                    <button
                                        onClick={() => navigate(`/reservations/${r.reservation_id}/review`)}
                                        className={
                                            hasMine
                                                // Your part is done, neutral "view" style
                                                ? 'px-3 py-1.5 bg-white/5 border border-white/15 text-gray-200 text-xs font-semibold rounded hover:border-[#e8a838] hover:text-[#e8a838] transition-colors cursor-pointer'
                                                // You still owe a review: gold call-to-action
                                                : 'px-3 py-1.5 bg-[#e8a838]/20 border border-[#e8a838]/40 text-[#e8a838] text-xs font-semibold rounded hover:bg-[#e8a838]/30 transition-colors cursor-pointer'
                                        }
                                    >
                                        {hasMine ? 'View Reviews' : 'Make a Review'}
                                    </button>
 
                                    {/* You have submitted your review */}
                                    {hasMine && (
                                        <span className="text-[0.6rem] font-semibold px-1.5 py-0.5 rounded bg-green-400/15 text-green-300 border border-green-400/25">
                                            Review sent
                                        </span>
                                    )}
 
                                    {/* You submitted but haven't received one yet */}
                                    {hasMine && !hasTheirs && (
                                        <span className="text-[0.6rem] font-semibold px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
                                            Awaiting their review
                                        </span>
                                    )}
 
                                    {/* The other party has reviewed you, show the rating you got */}
                                    {hasTheirs && (
                                        <span
                                            title={review?.theirs?.comment ?? undefined}
                                            className="text-[0.6rem] font-semibold px-1.5 py-0.5 rounded bg-purple-400/20 text-purple-200 border border-purple-400/30"
                                        >
                                            ★ {review?.theirs?.rating}/5 from {otherFirstName}
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )
            })}
 
            {/* Pagination — Previous and Next buttons
                Shows 10 reservations at a time using API limit/offset params */}
            {!loading && (offset > 0 || hasMore) && (
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