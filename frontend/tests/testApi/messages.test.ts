// tests/testApi/messages.test.ts
// Unit tests for src/api/messages.ts — fetchMessages, sendMessage.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    fetchMessages,
    sendMessage,
    type ChatMessage,
} from '../../src/api/messages'
import {
    installFetchMock,
    jsonOk,
    jsonError,
    callUrl,
    callInit,
    callBody,
    callHeaders,
} from './apimocks'

let fetchMock: ReturnType<typeof installFetchMock>

const message: ChatMessage = {
    id: 'm-1',
    reservation_id: 'res-1',
    sender_id: 'user-2',
    content: 'Ready for pickup!',
    is_read: false,
    created_at: '2026-07-22T10:00:00Z',
}

beforeEach(() => {
    fetchMock = installFetchMock()
    localStorage.clear()
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('fetchMessages', () => {
    it('GETs the reservation thread with the stored bearer token', async () => {
        localStorage.setItem('access_token', 'stored-token')
        fetchMock.mockResolvedValue(jsonOk([message]))

        const result = await fetchMessages('res-1')

        expect(result).toEqual([message])
        expect(callUrl(fetchMock)).toBe('/api/reservations/res-1/messages')
        expect(callHeaders(fetchMock)).toEqual({
            'Content-Type': 'application/json',
            Authorization: 'Bearer stored-token',
        })
    })

    it('sends "Bearer null" when no token is stored', async () => {
        fetchMock.mockResolvedValue(jsonOk([]))

        await fetchMessages('res-1')

        expect(callHeaders(fetchMock).Authorization).toBe('Bearer null')
    })

    it('throws the backend detail message on failure', async () => {
        fetchMock.mockResolvedValue(
            jsonError({ detail: 'You are not authorized to view messages.' }, 403),
        )

        await expect(fetchMessages('res-1')).rejects.toThrow(
            'You are not authorized to view messages.',
        )
    })

    it('falls back to a generic message when detail is missing', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))

        await expect(fetchMessages('res-1')).rejects.toThrow(
            'Failed to load messages.',
        )
    })
})

describe('sendMessage', () => {
    it('POSTs the content as JSON with the stored bearer token', async () => {
        localStorage.setItem('access_token', 'stored-token')
        fetchMock.mockResolvedValue(jsonOk(message, 201))

        const result = await sendMessage('res-1', { content: 'hello' })

        expect(result).toEqual(message)
        expect(callUrl(fetchMock)).toBe('/api/reservations/res-1/messages')
        expect(callInit(fetchMock).method).toBe('POST')
        expect(callHeaders(fetchMock)).toEqual({
            'Content-Type': 'application/json',
            Authorization: 'Bearer stored-token',
        })
        expect(callBody(fetchMock)).toEqual({ content: 'hello' })
    })

    it('throws the first message from a 422 validation array', async () => {
        fetchMock.mockResolvedValue(
            jsonError(
                {
                    detail: [
                        { msg: 'Message content must be between 1 and 2000 characters long.' },
                    ],
                },
                422,
            ),
        )

        await expect(sendMessage('res-1', { content: '' })).rejects.toThrow(
            'Message content must be between 1 and 2000 characters long.',
        )
    })

    it('throws the backend detail message when messaging is closed', async () => {
        fetchMock.mockResolvedValue(
            jsonError(
                { detail: 'You cannot send messages for finished reservations.' },
                400,
            ),
        )

        await expect(sendMessage('res-1', { content: 'late' })).rejects.toThrow(
            'You cannot send messages for finished reservations.',
        )
    })

    it('falls back to a generic message when detail is missing', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))

        await expect(sendMessage('res-1', { content: 'x' })).rejects.toThrow(
            'Failed to send message.',
        )
    })
})