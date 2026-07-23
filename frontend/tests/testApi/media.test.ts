// tests/testApi/media.test.ts
// Unit tests for src/api/media.ts: fetchUploadTicket, uploadFileToStorage, uploadPhoto.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    fetchUploadTicket,
    uploadFileToStorage,
    uploadPhoto,
    type MediaUploadTicket,
} from '../../src/api/media'
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

const ticket: MediaUploadTicket = {
    upload_target: 'http://minio.local/tool-photos',
    upload_fields: {
        key: 'photos/drill.jpg',
        policy: 'base64-policy',
        'x-amz-signature': 'sig',
    },
    url: 'http://minio.local/tool-photos/photos/drill.jpg',
}

const makeFile = () =>
    new File(['fake-bytes'], 'drill.jpg', { type: 'image/jpeg' })

beforeEach(() => {
    fetchMock = installFetchMock()
    localStorage.clear()
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('fetchUploadTicket', () => {
    it('POSTs the filename with the stored bearer token and returns the ticket', async () => {
        localStorage.setItem('access_token', 'stored-token')
        fetchMock.mockResolvedValue(jsonOk(ticket))

        const result = await fetchUploadTicket('drill.jpg')

        expect(result).toEqual(ticket)
        expect(callUrl(fetchMock)).toBe('/api/media/upload')
        expect(callInit(fetchMock).method).toBe('POST')
        expect(callHeaders(fetchMock)).toEqual({
            'Content-Type': 'application/json',
            Authorization: 'Bearer stored-token',
        })
        expect(callBody(fetchMock)).toEqual({ filename: 'drill.jpg' })
    })

    it('throws with the backend detail message on failure', async () => {
        fetchMock.mockResolvedValue(
            jsonError({ detail: 'Unsupported file type.' }, 415),
        )

        await expect(fetchUploadTicket('notes.exe')).rejects.toThrow(
            'Unsupported file type.',
        )
    })

    it('falls back to a generic message when the body has no detail', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))

        await expect(fetchUploadTicket('drill.jpg')).rejects.toThrow(
            'Failed to fetch media upload ticket.',
        )
    })
})

describe('uploadFileToStorage', () => {
    it('POSTs to the signed target with the file appended last', async () => {
        fetchMock.mockResolvedValue(jsonOk({}))
        const file = makeFile()

        await uploadFileToStorage(file, ticket)

        expect(callUrl(fetchMock)).toBe(ticket.upload_target)
        expect(callInit(fetchMock).method).toBe('POST')

        const body = callInit(fetchMock).body as unknown as FormData
        const entries = Array.from(body.entries())

        // S3/MinIO requires every policy field first and 'file' last.
        expect(entries.map(([key]) => key)).toEqual([
            'key',
            'policy',
            'x-amz-signature',
            'file',
        ])
        expect(entries[entries.length - 1][1]).toBe(file)
    })

    it('does not send the Authorization header to the storage host', async () => {
        localStorage.setItem('access_token', 'stored-token')
        fetchMock.mockResolvedValue(jsonOk({}))

        await uploadFileToStorage(makeFile(), ticket)

        expect(callInit(fetchMock).headers).toBeUndefined()
    })

    it('handles a ticket with no policy fields', async () => {
        fetchMock.mockResolvedValue(jsonOk({}))

        await uploadFileToStorage(makeFile(), { ...ticket, upload_fields: {} })

        const body = callInit(fetchMock).body as unknown as FormData
        expect(Array.from(body.keys())).toEqual(['file'])
    })

    it('throws with the response statusText when the upload is rejected', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 403, 'Forbidden'))

        await expect(uploadFileToStorage(makeFile(), ticket)).rejects.toThrow(
            'Storage upload failed: Forbidden',
        )
    })
})

describe('uploadPhoto', () => {
    it('requests a ticket, uploads the file, and returns the permanent URL', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonOk(ticket)) // ticket request
            .mockResolvedValueOnce(jsonOk({})) // storage upload

        const url = await uploadPhoto(makeFile())

        expect(url).toBe(ticket.url)
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(callUrl(fetchMock, 0)).toBe('/api/media/upload')
        expect(callBody(fetchMock, 0)).toEqual({ filename: 'drill.jpg' })
        expect(callUrl(fetchMock, 1)).toBe(ticket.upload_target)
    })

    it('propagates a ticket failure without attempting the upload', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonError({ detail: 'Quota exceeded.' }, 429),
        )

        await expect(uploadPhoto(makeFile())).rejects.toThrow('Quota exceeded.')
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('propagates a storage failure', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonOk(ticket))
            .mockResolvedValueOnce(jsonError({}, 500, 'Internal Server Error'))

        await expect(uploadPhoto(makeFile())).rejects.toThrow(
            'Storage upload failed: Internal Server Error',
        )
    })
})