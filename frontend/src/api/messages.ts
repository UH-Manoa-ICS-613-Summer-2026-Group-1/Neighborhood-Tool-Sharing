// src/api/messages.ts
// API service for the private message thread attached to each reservation.

// Matches the backend ChatMessageResponse schema
export interface ChatMessage {
    id: string
    reservation_id: string
    sender_id: string
    content: string
    is_read: boolean
    created_at: string
}

// Request body for POST
export interface SendMessagePayload {
    content: string
}

// Helpers
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

// Services
// GET /api/reservations/{id}/messages: full thread, oldest first.
// Fetching also marks the other party's messages as read.
export const fetchMessages = async (
    reservationId: string
): Promise<ChatMessage[]> => {
    const response = await fetch(`/api/reservations/${reservationId}/messages`, {
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to load messages.'))
    return data
}

// POST /api/reservations/{id}/messages: send a message to the other party.
export const sendMessage = async (
    reservationId: string,
    payload: SendMessagePayload
): Promise<ChatMessage> => {
    const response = await fetch(`/api/reservations/${reservationId}/messages`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to send message.'))
    return data
}