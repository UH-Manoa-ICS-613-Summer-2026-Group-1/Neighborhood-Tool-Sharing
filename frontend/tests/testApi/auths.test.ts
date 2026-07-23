// tests/auth.test.ts
// Unit tests for src/api/auth.ts — loginUser, logoutUser, registerUser.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loginUser, logoutUser, registerUser } from '../../src/api/auth'
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

describe('loginUser', () => {
    it('POSTs credentials to /api/auth/login and returns the token payload', async () => {
        const token = { access_token: 'abc.def.ghi', token_type: 'bearer' }
        fetchMock.mockResolvedValue(jsonOk(token))

        const result = await loginUser('jane@example.com', 'Password1!')

        expect(result).toEqual(token)
        expect(callUrl(fetchMock)).toBe('/api/auth/login')
        expect(callInit(fetchMock).method).toBe('POST')
        expect(callHeaders(fetchMock)).toEqual({
            'Content-Type': 'application/json',
        })
        expect(callBody(fetchMock)).toEqual({
            email: 'jane@example.com',
            password: 'Password1!',
        })
    })

    it('throws with the backend detail message on failure', async () => {
        fetchMock.mockResolvedValue(
            jsonError({ detail: 'Incorrect email or password.' }, 401),
        )

        await expect(loginUser('jane@example.com', 'wrong')).rejects.toThrow(
            'Incorrect email or password.',
        )
    })

    it('falls back to a generic message when the body has no detail', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))

        await expect(loginUser('jane@example.com', 'pw')).rejects.toThrow(
            'Login failed.',
        )
    })
})

describe('logoutUser', () => {
    it('sends the stored bearer token and resolves on success', async () => {
        localStorage.setItem('access_token', 'stored-token')
        fetchMock.mockResolvedValue(jsonOk({ message: 'Logged out.' }))

        await expect(logoutUser()).resolves.toBeUndefined()

        expect(callUrl(fetchMock)).toBe('/api/auth/logout')
        expect(callInit(fetchMock).method).toBe('POST')
        expect(callHeaders(fetchMock)).toEqual({
            Authorization: 'Bearer stored-token',
        })
    })

    it('still sends a header when no token is stored', async () => {
        fetchMock.mockResolvedValue(jsonOk({}))

        await logoutUser()

        // localStorage.getItem returns null, which is interpolated verbatim.
        expect(callHeaders(fetchMock).Authorization).toBe('Bearer null')
    })

    it('throws with the backend detail message on failure', async () => {
        fetchMock.mockResolvedValue(jsonError({ detail: 'Token revoked.' }, 401))

        await expect(logoutUser()).rejects.toThrow('Token revoked.')
    })

    it('falls back to a generic message when the body has no detail', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))

        await expect(logoutUser()).rejects.toThrow('Logout failed.')
    })
})

describe('registerUser', () => {
    const payload = {
        email: 'new@example.com',
        password: 'Password1!',
        inviteToken: 'invite-123',
        firstName: 'Jane',
        lastName: 'Doe',
        middleName: 'Q',
    }

    it('maps the camelCase payload to the snake_case backend schema', async () => {
        fetchMock.mockResolvedValue(jsonOk({ message: 'Account created.' }))

        const result = await registerUser(payload)

        expect(result).toEqual({ message: 'Account created.' })
        expect(callUrl(fetchMock)).toBe('/api/auth/register')
        expect(callInit(fetchMock).method).toBe('POST')
        expect(callBody(fetchMock)).toEqual({
            email: 'new@example.com',
            password: 'Password1!',
            invite_token: 'invite-123',
            first_name: 'Jane',
            last_name: 'Doe',
            middle_name: 'Q',
        })
    })

    it('sends middle_name as null when it is omitted', async () => {
        fetchMock.mockResolvedValue(jsonOk({}))

        await registerUser({ ...payload, middleName: undefined })

        expect(callBody(fetchMock).middle_name).toBeNull()
    })

    it('sends middle_name as null when it is an empty string', async () => {
        fetchMock.mockResolvedValue(jsonOk({}))

        await registerUser({ ...payload, middleName: '' })

        expect(callBody(fetchMock).middle_name).toBeNull()
    })

    it('throws with the backend detail message on failure', async () => {
        fetchMock.mockResolvedValue(
            jsonError({ detail: 'Email already registered.' }, 409),
        )

        await expect(registerUser(payload)).rejects.toThrow(
            'Email already registered.',
        )
    })

    it('falls back to a generic message when the body has no detail', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))

        await expect(registerUser(payload)).rejects.toThrow(
            'Registration failed. Please try again.',
        )
    })
})