// tests/testApi/notifications.test.ts
// Unit tests for src/api/notifications.ts — fetchNotifications,
// fetchUnreadCount, markNotificationRead, markAllNotificationsRead.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    fetchNotifications,
    fetchUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    type NotificationItem,
} from '../../src/api/notifications'
import {
    installFetchMock,
    jsonOk,
    jsonError,
    callUrl,
    callInit,
    callHeaders,
} from './apimocks'

let fetchMock: ReturnType<typeof installFetchMock>

const notification: NotificationItem = {
    id: 'n-1',
    recipient_id: 'user-1',
    category: 'RESERVATION',
    title: 'Reservation approved',
    content: 'Your request for the Drill was approved.',
    target_id: 'res-1',
    target_type: 'RESERVATION',
    is_read: false,
    created_at: '2026-07-22T10:00:00Z',
}

// A failed response whose json() rejects — models a non-JSON / empty error body.
// apimocks only builds responses that resolve, so this covers the
// `response.json().catch(() => ({}))` fallback in the mutating calls.
const jsonUnparseable = (status = 500): Response =>
    ({
        ok: false,
        status,
        statusText: 'Error',
        json: async () => {
            throw new Error('Unexpected end of JSON input')
        },
    }) as unknown as Response

beforeEach(() => {
    fetchMock = installFetchMock()
    localStorage.clear()
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('fetchNotifications', () => {
    it('GETs the notifications with the default limit and stored bearer token', async () => {
        localStorage.setItem('access_token', 'stored-token')
        fetchMock.mockResolvedValue(jsonOk([notification]))

        const result = await fetchNotifications()

        expect(result).toEqual([notification])
        expect(callUrl(fetchMock)).toBe('/api/notifications?limit=15')
        expect(callHeaders(fetchMock)).toEqual({
            'Content-Type': 'application/json',
            Authorization: 'Bearer stored-token',
        })
    })

    it('honors a custom limit', async () => {
        fetchMock.mockResolvedValue(jsonOk([]))

        await fetchNotifications(5)

        expect(callUrl(fetchMock)).toBe('/api/notifications?limit=5')
    })

    it('sends "Bearer null" when no token is stored', async () => {
        fetchMock.mockResolvedValue(jsonOk([]))

        await fetchNotifications()

        expect(callHeaders(fetchMock).Authorization).toBe('Bearer null')
    })

    it('throws the backend detail message on failure', async () => {
        fetchMock.mockResolvedValue(jsonError({ detail: 'Not authorized.' }, 401))

        await expect(fetchNotifications()).rejects.toThrow('Not authorized.')
    })

    it('falls back to a generic message when detail is missing', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))

        await expect(fetchNotifications()).rejects.toThrow(
            'Failed to load notifications.',
        )
    })
})

// The extractDetail helper is shared; its Pydantic-array branch is exercised
// here through fetchNotifications (mirrors users/reservations suites).
describe('extractDetail array branch (via fetchNotifications)', () => {
    it('throws the first message from a 422 validation array', async () => {
        fetchMock.mockResolvedValue(
            jsonError(
                {
                    detail: [
                        { loc: ['query', 'limit'], msg: 'limit must be positive' },
                        { loc: ['query', 'offset'], msg: 'field required' },
                    ],
                },
                422,
            ),
        )

        await expect(fetchNotifications()).rejects.toThrow(
            'limit must be positive',
        )
    })

    it('falls back when the first array entry has no msg', async () => {
        fetchMock.mockResolvedValue(
            jsonError({ detail: [{ loc: ['query'] }] }, 422),
        )

        await expect(fetchNotifications()).rejects.toThrow(
            'Failed to load notifications.',
        )
    })

    it('falls back when the detail array is empty', async () => {
        fetchMock.mockResolvedValue(jsonError({ detail: [] }, 422))

        await expect(fetchNotifications()).rejects.toThrow(
            'Failed to load notifications.',
        )
    })
})

describe('fetchUnreadCount', () => {
    it('reads the unread_count field from the response', async () => {
        fetchMock.mockResolvedValue(jsonOk({ unread_count: 4 }))

        await expect(fetchUnreadCount()).resolves.toBe(4)
        expect(callUrl(fetchMock)).toBe('/api/notifications/unread-count')
    })

    it('accepts a bare numeric response', async () => {
        fetchMock.mockResolvedValue(jsonOk(7))

        await expect(fetchUnreadCount()).resolves.toBe(7)
    })

    it('defaults to 0 when the field is absent', async () => {
        fetchMock.mockResolvedValue(jsonOk({}))

        await expect(fetchUnreadCount()).resolves.toBe(0)
    })

    it('throws the backend detail message on failure', async () => {
        fetchMock.mockResolvedValue(jsonError({ detail: 'Boom.' }, 500))

        await expect(fetchUnreadCount()).rejects.toThrow('Boom.')
    })
})

describe('markNotificationRead', () => {
    it('PATCHes the notification-specific url with the bearer token', async () => {
        localStorage.setItem('access_token', 'stored-token')
        fetchMock.mockResolvedValue(jsonOk({ ...notification, is_read: true }))

        await markNotificationRead('n-1')

        expect(callUrl(fetchMock)).toBe('/api/notifications/n-1/read')
        expect(callInit(fetchMock).method).toBe('PATCH')
        expect(callHeaders(fetchMock)).toEqual({
            'Content-Type': 'application/json',
            Authorization: 'Bearer stored-token',
        })
        // This endpoint carries no request body.
        expect(callInit(fetchMock).body).toBeUndefined()
    })

    it('throws the backend detail message on failure', async () => {
        fetchMock.mockResolvedValue(jsonError({ detail: 'Not found.' }, 404))

        await expect(markNotificationRead('n-1')).rejects.toThrow('Not found.')
    })

    it('falls back to a generic message when detail is missing', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))

        await expect(markNotificationRead('n-1')).rejects.toThrow(
            'Failed to update notification.',
        )
    })

    it('falls back when the error body is not valid json', async () => {
        fetchMock.mockResolvedValue(jsonUnparseable())

        await expect(markNotificationRead('n-1')).rejects.toThrow(
            'Failed to update notification.',
        )
    })
})

describe('markAllNotificationsRead', () => {
    it('POSTs to the read-all url with the bearer token', async () => {
        localStorage.setItem('access_token', 'stored-token')
        fetchMock.mockResolvedValue(jsonOk({ message: 'Notifications marked as read.' }))

        await markAllNotificationsRead()

        expect(callUrl(fetchMock)).toBe('/api/notifications/read-all')
        expect(callInit(fetchMock).method).toBe('POST')
        expect(callHeaders(fetchMock)).toEqual({
            'Content-Type': 'application/json',
            Authorization: 'Bearer stored-token',
        })
    })

    it('throws the backend detail message on failure', async () => {
        fetchMock.mockResolvedValue(jsonError({ detail: 'Server error.' }, 500))

        await expect(markAllNotificationsRead()).rejects.toThrow('Server error.')
    })

    it('falls back to a generic message when detail is missing', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))

        await expect(markAllNotificationsRead()).rejects.toThrow(
            'Failed to update notifications.',
        )
    })

    it('falls back when the error body is not valid json', async () => {
        fetchMock.mockResolvedValue(jsonUnparseable())

        await expect(markAllNotificationsRead()).rejects.toThrow(
            'Failed to update notifications.',
        )
    })
})