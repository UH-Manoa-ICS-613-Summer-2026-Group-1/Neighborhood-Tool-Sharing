// src/api/reservations.ts
// API service for all reservation endpoints
// Follows the same pattern as tools.ts and users.ts — authHeaders, extractDetail, async fetch

// ---------------------------------------------------------------------------
// Types — match the backend ReservationDetailsResponse schema
// ---------------------------------------------------------------------------

// Full reservation object returned by GET /api/reservations and GET /api/reservations/{id}
export interface ReservationDetails {
    reservation_id: string
    reservation_status: string           // REQUESTED | APPROVED | PICKED_UP | RETURNED | DENIED | CANCELED
    reservation_start_date: string       // ISO datetime with timezone
    reservation_end_date: string         // ISO datetime with timezone
    reservation_loan_duration_limit: number
    reservation_pickup_notes: string | null
    reservation_return_notes: string | null
    reservation_created_at: string
    tool_id: string
    tool_title: string
    tool_description: string
    tool_condition: string
    tool_type_id: number
    tool_type_code: string
    tool_type_name: string
    borrower_id: string
    borrower_first_name: string
    borrower_last_name: string
    borrower_middle_name: string | null
    owner_id: string
    owner_first_name: string
    owner_last_name: string
    owner_middle_name: string | null
    tool_photos: { id: string; url: string }[]
}

// Request body for POST /api/reservations — matches backend ReservationRequest schema
export interface CreateReservationPayload {
    tool_id: string       // UUID of the tool to borrow
    start_date: string    // ISO datetime with timezone e.g. "2026-07-20T10:00:00.000Z"
    end_date: string      // ISO datetime with timezone e.g. "2026-07-21T09:59:59.000Z"
}

// ---------------------------------------------------------------------------
// Helpers — shared by all service functions below
// ---------------------------------------------------------------------------

// Attaches the stored JWT token to every API request
const authHeaders = (): HeadersInit => {
    const token = localStorage.getItem('access_token')
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    }
}

// Extracts a readable error message from backend responses
// Handles both plain string detail (400/401) and Pydantic array detail (422)
const extractDetail = (data: { detail?: unknown }, fallback: string): string => {
    if (Array.isArray(data.detail)) {
        const first = data.detail[0] as { msg?: string } | undefined
        return first?.msg || fallback
    }
    return typeof data.detail === 'string' ? data.detail : fallback
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

// POST /api/reservations
// Borrower submits a new reservation request for a tool (US 2)
export const createReservation = async (
    payload: CreateReservationPayload
): Promise<ReservationDetails> => {
    const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to create reservation.'))
    return data
}

// GET /api/reservations
// Returns all reservations where the current user is either the borrower or the tool owner
export const fetchReservations = async (): Promise<ReservationDetails[]> => {
    const response = await fetch('/api/reservations', { headers: authHeaders() })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to load reservations.'))
    return data
}

// GET /api/reservations/{id}
// Returns a single reservation by its ID
export const fetchReservationById = async (
    reservationId: string
): Promise<ReservationDetails> => {
    const response = await fetch(`/api/reservations/${reservationId}`, {
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Reservation not found.'))
    return data
}

// POST /api/reservations/{id}/approve
// Tool owner approves a REQUESTED reservation (US 4 Scenario 1)
export const approveReservation = async (reservationId: string): Promise<ReservationDetails> => {
    const response = await fetch(`/api/reservations/${reservationId}/approve`, {
        method: 'POST',
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to approve reservation.'))
    return data
}

// POST /api/reservations/{id}/deny
// Tool owner denies a REQUESTED reservation (US 4 Scenario 2)
export const denyReservation = async (reservationId: string): Promise<ReservationDetails> => {
    const response = await fetch(`/api/reservations/${reservationId}/deny`, {
        method: 'POST',
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to deny reservation.'))
    return data
}

// POST /api/reservations/{id}/cancel
// Borrower or owner cancels a REQUESTED or APPROVED reservation (US 3)
export const cancelReservation = async (reservationId: string): Promise<ReservationDetails> => {
    const response = await fetch(`/api/reservations/${reservationId}/cancel`, {
        method: 'POST',
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to cancel reservation.'))
    return data
}

// POST /api/reservations/{id}/pickup
// Borrower confirms they have picked up the tool (US 7)
export const pickupReservation = async (reservationId: string): Promise<ReservationDetails> => {
    const response = await fetch(`/api/reservations/${reservationId}/pickup`, {
        method: 'POST',
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to confirm pickup.'))
    return data
}

// POST /api/reservations/{id}/return
// Tool owner confirms the tool has been returned (US 5)
export const returnReservation = async (reservationId: string): Promise<ReservationDetails> => {
    const response = await fetch(`/api/reservations/${reservationId}/return`, {
        method: 'POST',
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to confirm return.'))
    return data
}
