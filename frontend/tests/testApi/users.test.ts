// tests/testApi/users.test.ts
// Unit tests for src/api/users.ts: fetchCurrentUser, updateUserProfile, changePassword.
// Also covers every branch of the shared extractDetail helper (string detail,
// Pydantic 422 array detail, malformed detail).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    fetchCurrentUser,
    updateUserProfile,
    changePassword,
    type UserProfile,
} from '../../src/api/users'
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

const profile: UserProfile = {
    user_id: 'user-1',
    user_first_name: 'Jane',
    user_last_name: 'Doe',
    user_middle_name: null,
    user_email: 'jane@example.com',
    user_bio: 'I like fixing things.',
    user_location: 'Maple Street',
    user_created_at: '2026-01-01T00:00:00Z',
    user_photo_url: null,
    role_code: 'MEMBER',
    role_name: 'Member',
    role_description: null,
    status_code: 'ACTIVE',
    status_name: 'Active',
    status_description: null,
}

beforeEach(() => {
    fetchMock = installFetchMock()
    localStorage.clear()
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('fetchCurrentUser', () => {
    it('GETs /api/users/me with the stored bearer token', async () => {
        localStorage.setItem('access_token', 'stored-token')
        fetchMock.mockResolvedValue(jsonOk(profile))

        const result = await fetchCurrentUser()

        expect(result).toEqual(profile)
        expect(callUrl(fetchMock)).toBe('/api/users/me')
        expect(callInit(fetchMock).method).toBe('GET')
        expect(callHeaders(fetchMock)).toEqual({
            'Content-Type': 'application/json',
            Authorization: 'Bearer stored-token',
        })
    })

    it('sends "Bearer null" when no token is stored', async () => {
        fetchMock.mockResolvedValue(jsonOk(profile))

        await fetchCurrentUser()

        expect(callHeaders(fetchMock).Authorization).toBe('Bearer null')
    })

    it('throws the string detail from a 401', async () => {
        fetchMock.mockResolvedValue(
            jsonError({ detail: 'Token has expired.' }, 401),
        )

        await expect(fetchCurrentUser()).rejects.toThrow('Token has expired.')
    })

    it('falls back to the default message when detail is missing', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))

        await expect(fetchCurrentUser()).rejects.toThrow(
            'Session expired or invalid token',
        )
    })

    it('falls back to the default message when detail is not a string', async () => {
        // Some proxies return an object body — extractDetail must not leak "[object Object]".
        fetchMock.mockResolvedValue(jsonError({ detail: { code: 500 } }, 500))

        await expect(fetchCurrentUser()).rejects.toThrow(
            'Session expired or invalid token',
        )
    })
})

describe('extractDetail branches (via fetchCurrentUser)', () => {
    it('uses the first msg of a Pydantic 422 detail array', async () => {
        fetchMock.mockResolvedValue(
            jsonError(
                {
                    detail: [
                        { loc: ['body', 'email'], msg: 'value is not a valid email address' },
                        { loc: ['body', 'password'], msg: 'field required' },
                    ],
                },
                422,
            ),
        )

        await expect(fetchCurrentUser()).rejects.toThrow(
            'value is not a valid email address',
        )
    })

    it('falls back when the detail array is empty', async () => {
        fetchMock.mockResolvedValue(jsonError({ detail: [] }, 422))

        await expect(fetchCurrentUser()).rejects.toThrow(
            'Session expired or invalid token',
        )
    })

    it('falls back when the first detail entry has no msg', async () => {
        fetchMock.mockResolvedValue(
            jsonError({ detail: [{ loc: ['body'] }] }, 422),
        )

        await expect(fetchCurrentUser()).rejects.toThrow(
            'Session expired or invalid token',
        )
    })
})

describe('updateUserProfile', () => {
    it('PATCHes the payload and returns the updated profile', async () => {
        const updated = { ...profile, user_first_name: 'Janet' }
        fetchMock.mockResolvedValue(jsonOk(updated))

        const result = await updateUserProfile({
            first_name: 'Janet',
            last_name: 'Doe',
            bio: 'I like fixing things.',
            location: 'Maple Street',
        })

        expect(result).toEqual(updated)
        expect(callUrl(fetchMock)).toBe('/api/users/me')
        expect(callInit(fetchMock).method).toBe('PATCH')
        expect(callBody(fetchMock)).toEqual({
            first_name: 'Janet',
            last_name: 'Doe',
            bio: 'I like fixing things.',
            location: 'Maple Street',
        })
    })

    it('sends an empty object when given no fields', async () => {
        fetchMock.mockResolvedValue(jsonOk(profile))

        await updateUserProfile({})

        expect(callBody(fetchMock)).toEqual({})
    })

    it('preserves explicit nulls so fields can be cleared', async () => {
        fetchMock.mockResolvedValue(jsonOk(profile))

        await updateUserProfile({ bio: null, photo_url: null })

        expect(callBody(fetchMock)).toEqual({ bio: null, photo_url: null })
    })

    it('throws the 422 validation message', async () => {
        fetchMock.mockResolvedValue(
            jsonError(
                { detail: [{ msg: 'first_name must not be empty' }] },
                422,
            ),
        )

        await expect(
            updateUserProfile({ first_name: '' }),
        ).rejects.toThrow('first_name must not be empty')
    })

    it('falls back to a generic message when detail is missing', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))

        await expect(updateUserProfile({ first_name: 'Janet' })).rejects.toThrow(
            'Failed to update profile.',
        )
    })
})

describe('changePassword', () => {
    it('PATCHes the snake_case password payload', async () => {
        fetchMock.mockResolvedValue(jsonOk({ message: 'Password updated.' }))

        const result = await changePassword('OldPass1!', 'NewPass1!')

        expect(result).toEqual({ message: 'Password updated.' })
        expect(callUrl(fetchMock)).toBe('/api/users/me/change-password')
        expect(callInit(fetchMock).method).toBe('PATCH')
        expect(callBody(fetchMock)).toEqual({
            current_password: 'OldPass1!',
            new_password: 'NewPass1!',
        })
    })

    it('throws the backend message when the current password is wrong', async () => {
        fetchMock.mockResolvedValue(
            jsonError({ detail: 'Current password is incorrect.' }, 400),
        )

        await expect(changePassword('wrong', 'NewPass1!')).rejects.toThrow(
            'Current password is incorrect.',
        )
    })

    it('falls back to a generic message when detail is missing', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))

        await expect(changePassword('OldPass1!', 'NewPass1!')).rejects.toThrow(
            'Failed to change password.',
        )
    })
})