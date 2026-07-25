// src/api/reviews.ts
// API service for reservation reviews.

// Matches the backend ReviewDetailsResponse schema (review.py)
export interface ReviewDetails {
    review_id: string
    reservation_id: string

    reviewee_id: string
    reviewee_first_name: string
    reviewee_last_name: string
    reviewee_middle_name: string | null
    reviewee_photo_url: string | null

    reviewer_id: string
    reviewer_first_name: string
    reviewer_last_name: string
    reviewer_middle_name: string | null
    reviewer_photo_url: string | null

    rating: number          // 1..5
    comment: string | null
    created_at: string      // ISO datetime
}

// Request body for POST, matches the backend ReviewRequest schema
export interface CreateReviewPayload {
    rating: number          
    comment?: string | null
}

// ---------------------------------------------------------------------------
// Helpers — identical pattern to the other api/*.ts files
// ---------------------------------------------------------------------------
const authHeaders = (): HeadersInit => {
    const token = localStorage.getItem('access_token')
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    }
}

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

// GET /api/reservations/{id}/reviews
// Returns every review left on a reservation (up to one per party).
export const fetchReservationReviews = async (
    reservationId: string
): Promise<ReviewDetails[]> => {
    const response = await fetch(`/api/reservations/${reservationId}/reviews`, {
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to load reviews.'))
    return data
}

// POST /api/reservations/{id}/reviews
// Current user leaves a review for the other party on a RETURNED reservation.
export const createReview = async (
    reservationId: string,
    payload: CreateReviewPayload
): Promise<ReviewDetails> => {
    const response = await fetch(`/api/reservations/${reservationId}/reviews`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to submit review.'))
    return data
}