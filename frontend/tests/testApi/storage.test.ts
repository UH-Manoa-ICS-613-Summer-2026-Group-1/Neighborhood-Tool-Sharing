// tests/testApi/storage.test.ts
// Unit tests for src/api/storage.ts — wakeUpStorageService.
//
// The function only pings a health endpoint and logs the outcome; it never
// returns a value or throws. So the assertions target the request it makes,
// console output, and the fact that it always resolves.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { wakeUpStorageService } from '../../src/utils/storage'
import { installFetchMock, jsonOk, jsonError, callUrl, callInit } from './apimocks'

let fetchMock: ReturnType<typeof installFetchMock>
let logSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
    fetchMock = installFetchMock()
    // Silence and capture the informational logging.
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.resetModules()
    vi.restoreAllMocks()
})

describe('wakeUpStorageService', () => {
    it('GETs the storage health endpoint', async () => {
        fetchMock.mockResolvedValue(jsonOk({}))

        await wakeUpStorageService()

        expect(callUrl(fetchMock)).toMatch(/\/minio\/health\/live$/)
        expect(callInit(fetchMock).method).toBe('GET')
    })

    it('logs a healthy message when the response is ok', async () => {
        fetchMock.mockResolvedValue(jsonOk({}))

        await wakeUpStorageService()

        expect(logSpy).toHaveBeenCalledWith('Storage is awake and healthy!')
    })

    it('logs the status when the response is not ok', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 503, 'Service Unavailable'))

        await wakeUpStorageService()

        expect(logSpy).toHaveBeenCalledWith('Storage response status: 503')
    })

    it('resolves without throwing on a non-ok response', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))

        await expect(wakeUpStorageService()).resolves.toBeUndefined()
    })

    it('fails silently and logs the cold-start message when fetch throws', async () => {
        const error = new Error('ECONNREFUSED')
        fetchMock.mockRejectedValue(error)

        await expect(wakeUpStorageService()).resolves.toBeUndefined()

        expect(logSpy).toHaveBeenCalledWith(
            'Storage is spinning up from cold start...',
            error,
        )
    })
})

// The health URL is built at module load from import.meta.env, so these tests
// stub the env and re-import a fresh copy of the module to exercise the builder.
describe('storage health URL', () => {
    it('uses the configured endpoint and strips a trailing slash', async () => {
        vi.stubEnv('VITE_STORAGE_EXTERNAL_ENDPOINT', 'https://storage.example.com/')
        vi.resetModules()
        fetchMock.mockResolvedValue(jsonOk({}))

        const { wakeUpStorageService: freshWake } = await import(
            '../../src/utils/storage'
        )
        await freshWake()

        expect(callUrl(fetchMock)).toBe(
            'https://storage.example.com/minio/health/live',
        )
    })

    it('falls back to localhost:9000 when the env var is unset', async () => {
        vi.stubEnv('VITE_STORAGE_EXTERNAL_ENDPOINT', '')
        vi.resetModules()
        fetchMock.mockResolvedValue(jsonOk({}))

        const { wakeUpStorageService: freshWake } = await import(
            '../../src/utils/storage'
        )
        await freshWake()

        expect(callUrl(fetchMock)).toBe('http://localhost:9000/minio/health/live')
    })
})