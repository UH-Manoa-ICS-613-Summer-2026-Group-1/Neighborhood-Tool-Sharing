// Shared helpers for testing the src/api service layer.
//
// The services all call the global `fetch` directly, so every test installs a
// vi.fn() in its place and hands back canned Response-shaped objects.
// Only the properties the services actually touch are implemented
// (ok, status, statusText, json), which keeps fixtures small and readable.

import { vi, type Mock } from 'vitest'

// Installs a mocked global fetch and returns it so tests can assert on calls.
// Pair with vi.unstubAllGlobals() in afterEach.
export function installFetchMock(): Mock {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

// A successful response whose json() resolves to `body`.
export function jsonOk<T>(body: T, status = 200): Response {
    return {
        ok: true,
        status,
        statusText: 'OK',
        json: async () => body,
    } as unknown as Response
}

// A failed response whose json() resolves to `body` (usually { detail: ... }).
export function jsonError(
    body: unknown,
    status = 400,
    statusText = 'Bad Request',
): Response {
    return {
        ok: false,
        status,
        statusText,
        json: async () => body,
    } as unknown as Response
}

// The URL passed to the nth fetch call.
export function callUrl(fetchMock: Mock, index = 0): string {
    return fetchMock.mock.calls[index][0] as string
}

// The RequestInit passed to the nth fetch call ({} when omitted).
export function callInit(fetchMock: Mock, index = 0): RequestInit {
    return (fetchMock.mock.calls[index][1] ?? {}) as RequestInit
}

// The headers of the nth fetch call, as a plain object.
export function callHeaders(fetchMock: Mock, index = 0): Record<string, string> {
    return (callInit(fetchMock, index).headers ?? {}) as Record<string, string>
}

// The JSON-parsed body of the nth fetch call.
export function callBody<T = Record<string, unknown>>(
    fetchMock: Mock,
    index = 0,
): T {
    return JSON.parse(callInit(fetchMock, index).body as string) as T
}