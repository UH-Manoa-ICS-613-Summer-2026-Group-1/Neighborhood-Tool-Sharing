// tests/invitations.test.ts
// Unit tests for src/api/invitations.ts — sendInvite, validateInviteToken.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { sendInvite, validateInviteToken } from '../../src/api/invitations'
import {
    installFetchMock,
    jsonOk,
    jsonError,
    callUrl,
    callInit,
    callBody,
    callHeaders,
} from '../testApi/apimocks'

let fetchMock: ReturnType<typeof installFetchMock>

beforeEach(() => {
    fetchMock = installFetchMock()
    localStorage.clear()
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('sendInvite', () => {
    it('POSTs the recipient email with the stored bearer token', async () => {
        localStorage.setItem('access_token', 'stored-token')
        fetchMock.mockResolvedValue(jsonOk({ message: 'Invitation sent.' }))

        const result = await sendInvite('neighbor@example.com')

        expect(result).toEqual({ message: 'Invitation sent.' })
        expect(callUrl(fetchMock)).toBe('/api/invitations')
        expect(callInit(fetchMock).method).toBe('POST')
        expect(callHeaders(fetchMock)).toEqual({
            'Content-Type': 'application/json',
            Authorization: 'Bearer stored-token',
        })
        expect(callBody(fetchMock)).toEqual({
            recipient_email: 'neighbor@example.com',
        })
    })

    it('throws with the backend detail message on failure', async () => {
        fetchMock.mockResolvedValue(
            jsonError({ detail: 'That email already has an account.' }, 409),
        )

        await expect(sendInvite('taken@example.com')).rejects.toThrow(
            'That email already has an account.',
        )
    })

    it('falls back to a generic message when the body has no detail', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))

        await expect(sendInvite('neighbor@example.com')).rejects.toThrow(
            'Failed to send invitation.',
        )
    })
})

describe('validateInviteToken', () => {
    it('GETs the validation endpoint with the token in the query string', async () => {
        fetchMock.mockResolvedValue(
            jsonOk({ recipient_email: 'neighbor@example.com' }),
        )

        const result = await validateInviteToken('invite-123')

        expect(result).toEqual({ recipient_email: 'neighbor@example.com' })
        expect(callUrl(fetchMock)).toBe(
            '/api/invitations/validate?token=invite-123',
        )
        // No init argument is passed — this is an unauthenticated GET.
        expect(fetchMock.mock.calls[0][1]).toBeUndefined()
    })

    it('throws with the backend detail message for an expired token', async () => {
        fetchMock.mockResolvedValue(
            jsonError({ detail: 'This invitation has expired.' }, 400),
        )

        await expect(validateInviteToken('expired')).rejects.toThrow(
            'This invitation has expired.',
        )
    })

    it('falls back to a generic message when the body has no detail', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 404))

        await expect(validateInviteToken('bogus')).rejects.toThrow(
            'This invitation link is invalid.',
        )
    })
})