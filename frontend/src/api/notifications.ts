// src/api/notifications.ts
// API service for notification endpoints.

// Matches the backend NotificationResponse schema
export interface NotificationItem {
    id: string
    recipient_id: string
    category: string            
    title: string
    content: string
    target_id: string | null   
    target_type: string | null 
    is_read: boolean
    created_at: string  
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
// GET /api/notifications: most recent notifications for the current user.
export const fetchNotifications = async (
    limit = 15
): Promise<NotificationItem[]> => {
    const query = new URLSearchParams({ limit: String(limit) })
    const response = await fetch(`/api/notifications?${query.toString()}`, {
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to load notifications.'))
    return data
}

// GET /api/notifications/unread-count: badge number for the bell.
// Backend returns { "unread_count": n }.
export const fetchUnreadCount = async (): Promise<number> => {
    const response = await fetch('/api/notifications/unread-count', {
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to load unread count.'))
    return typeof data === 'number' ? data : (data.unread_count ?? 0)
}

// PATCH /api/notifications/{id}/read: mark one notification read.
export const markNotificationRead = async (notificationId: string): Promise<void> => {
    const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: authHeaders(),
    })
    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(extractDetail(data, 'Failed to update notification.'))
    }
}

// POST /api/notifications/read-all: mark every notification read.
export const markAllNotificationsRead = async (): Promise<void> => {
    const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: authHeaders(),
    })
    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(extractDetail(data, 'Failed to update notifications.'))
    }
}