// tests/testApi/reservations.test.ts
// Unit tests for src/api/reservations.ts.
//
// Covers createReservation, fetchReservations (pagination + filters),
// fetchReservationById, and the five status-transition endpoints
// (approve, deny, cancel, pickup, return).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    createReservation,
    fetchReservations,
    fetchReservationById,
    approveReservation,
    denyReservation,
    cancelReservation,
    pickupReservation,
    returnReservation,
    type ReservationDetails,
    type CreateReservationPayload,
} from '../../src/api/reservations'
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

const reservation: ReservationDetails = {
    reservation_id: 'res-1',
    reservation_status: 'REQUESTED',
    reservation_start_date: '2026-07-22T00:00:00Z',
    reservation_end_date: '2026-07-23T23:59:59Z',
    reservation_loan_duration_limit: 7,
    reservation_pickup_notes: null,
    reservation_return_notes: null,
    reservation_created_at: '2026-07-21T00:00:00Z',
    tool_id: 'tool-1',
    tool_title: 'DeWalt 20V Cordless Drill',
    tool_description: 'Great drill.',
    tool_condition: 'GOOD',
    tool_type_id: 1,
    tool_type_code: 'POWER_TOOLS',
    tool_type_name: 'Power Tools',
    borrower_id: 'borrower-1',
    borrower_first_name: 'John',
    borrower_last_name: 'Smith',
    borrower_middle_name: null,
    owner_id: 'owner-1',
    owner_first_name: 'Jane',
    owner_last_name: 'Doe',
    owner_middle_name: null,
    tool_photos: [],
}

const payload: CreateReservationPayload = {
    tool_id: 'tool-1',
    start_date: '2026-07-22T10:00:00.000Z',
    end_date: '2026-07-23T09:59:59.000Z',
}

const queryOf = (index = 0) =>
    new URLSearchParams(callUrl(fetchMock, index).split('?')[1] ?? '')

beforeEach(() => {
    fetchMock = installFetchMock()
    localStorage.clear()
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('createReservation', () => {
    it('POSTs the payload with the stored bearer token', async () => {
        localStorage.setItem('access_token', 'stored-token')
        fetchMock.mockResolvedValue(jsonOk(reservation, 201))

        const result = await createReservation(payload)

        expect(result).toEqual(reservation)
        expect(callUrl(fetchMock)).toBe('/api/reservations')
        expect(callInit(fetchMock).method).toBe('POST')
        expect(callHeaders(fetchMock)).toEqual({
            'Content-Type': 'application/json',
            Authorization: 'Bearer stored-token',
        })
        expect(callBody(fetchMock)).toEqual(payload)
    })

    it('throws the conflict message when the dates overlap an approved booking', async () => {
        fetchMock.mockResolvedValue(
            jsonError(
                { detail: 'This tool is already reserved for those dates.' },
                409,
            ),
        )

        await expect(createReservation(payload)).rejects.toThrow(
            'This tool is already reserved for those dates.',
        )
    })

    it('throws the first message from a 422 validation array', async () => {
        fetchMock.mockResolvedValue(
            jsonError(
                {
                    detail: [
                        { loc: ['body', 'end_date'], msg: 'end_date must be after start_date' },
                        { loc: ['body', 'tool_id'], msg: 'field required' },
                    ],
                },
                422,
            ),
        )

        await expect(createReservation(payload)).rejects.toThrow(
            'end_date must be after start_date',
        )
    })

    it('falls back when the 422 array entry has no msg', async () => {
        fetchMock.mockResolvedValue(jsonError({ detail: [{ loc: ['body'] }] }, 422))

        await expect(createReservation(payload)).rejects.toThrow(
            'Failed to create reservation.',
        )
    })

    it('falls back when detail is missing entirely', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))

        await expect(createReservation(payload)).rejects.toThrow(
            'Failed to create reservation.',
        )
    })
})

describe('fetchReservations', () => {
    it('sends an empty query string when called with no params', async () => {
        fetchMock.mockResolvedValue(jsonOk([reservation]))

        const result = await fetchReservations()

        expect(result).toEqual([reservation])
        expect(callUrl(fetchMock)).toBe('/api/reservations?')
        expect(Array.from(queryOf().keys())).toEqual([])
    })

    it('serializes role, status, limit, and offset', async () => {
        fetchMock.mockResolvedValue(jsonOk([]))

        await fetchReservations({
            role: 'owner',
            status: 'REQUESTED',
            limit: 10,
            offset: 20,
        })

        const query = queryOf()
        expect(query.get('role')).toBe('owner')
        expect(query.get('status')).toBe('REQUESTED')
        expect(query.get('limit')).toBe('10')
        expect(query.get('offset')).toBe('20')
    })

    it('includes limit and offset when they are zero', async () => {
        fetchMock.mockResolvedValue(jsonOk([]))

        await fetchReservations({ limit: 0, offset: 0 })

        const query = queryOf()
        expect(query.get('limit')).toBe('0')
        expect(query.get('offset')).toBe('0')
    })

    it('omits role and status when they are empty strings', async () => {
        fetchMock.mockResolvedValue(jsonOk([]))

        await fetchReservations({ status: '' })

        expect(queryOf().has('status')).toBe(false)
    })

    it('supports the borrower role filter', async () => {
        fetchMock.mockResolvedValue(jsonOk([]))

        await fetchReservations({ role: 'borrower' })

        expect(queryOf().get('role')).toBe('borrower')
    })

    it('returns an empty array when the user has no reservations', async () => {
        fetchMock.mockResolvedValue(jsonOk([]))

        await expect(fetchReservations()).resolves.toEqual([])
    })

    it('throws the backend detail message on failure', async () => {
        fetchMock.mockResolvedValue(jsonError({ detail: 'Token has expired.' }, 401))

        await expect(fetchReservations()).rejects.toThrow('Token has expired.')
    })

    it('falls back to a generic message when detail is missing', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))

        await expect(fetchReservations()).rejects.toThrow(
            'Failed to load reservations.',
        )
    })
})

describe('fetchReservationById', () => {
    it('GETs the reservation by id', async () => {
        fetchMock.mockResolvedValue(jsonOk(reservation))

        const result = await fetchReservationById('res-1')

        expect(result).toEqual(reservation)
        expect(callUrl(fetchMock)).toBe('/api/reservations/res-1')
        expect(callHeaders(fetchMock).Authorization).toBe('Bearer null')
    })

    it('throws the backend detail message on failure', async () => {
        fetchMock.mockResolvedValue(
            jsonError({ detail: 'You do not have access to this reservation.' }, 403),
        )

        await expect(fetchReservationById('res-9')).rejects.toThrow(
            'You do not have access to this reservation.',
        )
    })

    it('falls back to "Reservation not found." when detail is missing', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 404))

        await expect(fetchReservationById('missing')).rejects.toThrow(
            'Reservation not found.',
        )
    })
})

// The five status-transition endpoints share an identical shape, so they are
// exercised in a table to keep every path covered without repetition.
const statusActions = [
    {
        name: 'approveReservation',
        fn: approveReservation,
        path: 'approve',
        status: 'APPROVED',
        fallback: 'Failed to approve reservation.',
        backendError: 'Only the tool owner can approve this reservation.',
    },
    {
        name: 'denyReservation',
        fn: denyReservation,
        path: 'deny',
        status: 'DENIED',
        fallback: 'Failed to deny reservation.',
        backendError: 'Only REQUESTED reservations can be denied.',
    },
    {
        name: 'cancelReservation',
        fn: cancelReservation,
        path: 'cancel',
        status: 'CANCELED',
        fallback: 'Failed to cancel reservation.',
        backendError: 'A picked-up reservation cannot be canceled.',
    },
    {
        name: 'pickupReservation',
        fn: pickupReservation,
        path: 'pickup',
        status: 'PICKED_UP',
        fallback: 'Failed to confirm pickup.',
        backendError: 'The reservation must be approved before pickup.',
    },
    {
        name: 'returnReservation',
        fn: returnReservation,
        path: 'return',
        status: 'RETURNED',
        fallback: 'Failed to confirm return.',
        backendError: 'The tool has not been picked up yet.',
    },
] as const

describe.each(statusActions)(
    '$name',
    ({ fn, path, status, fallback, backendError }) => {
        it(`POSTs to /api/reservations/{id}/${path} with the bearer token`, async () => {
            localStorage.setItem('access_token', 'stored-token')
            fetchMock.mockResolvedValue(
                jsonOk({ ...reservation, reservation_status: status }),
            )

            const result = await fn('res-1')

            expect(result.reservation_status).toBe(status)
            expect(callUrl(fetchMock)).toBe(`/api/reservations/res-1/${path}`)
            expect(callInit(fetchMock).method).toBe('POST')
            expect(callHeaders(fetchMock)).toEqual({
                'Content-Type': 'application/json',
                Authorization: 'Bearer stored-token',
            })
            // These endpoints carry no request body.
            expect(callInit(fetchMock).body).toBeUndefined()
        })

        it('throws the backend detail message on an invalid transition', async () => {
            fetchMock.mockResolvedValue(jsonError({ detail: backendError }, 400))

            await expect(fn('res-1')).rejects.toThrow(backendError)
        })

        it('throws the first message from a 422 validation array', async () => {
            fetchMock.mockResolvedValue(
                jsonError({ detail: [{ msg: 'reservation_id must be a valid UUID' }] }, 422),
            )

            await expect(fn('not-a-uuid')).rejects.toThrow(
                'reservation_id must be a valid UUID',
            )
        })

        it(`falls back to "${fallback}" when detail is missing`, async () => {
            fetchMock.mockResolvedValue(jsonError({}, 500))

            await expect(fn('res-1')).rejects.toThrow(fallback)
        })
    },
)