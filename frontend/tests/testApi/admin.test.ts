// tests/testApi/admin.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    fetchAdminUsers,
    suspendUser,
    activateUser,
    fetchAdminTools,
    suspendTool,
    activateTool,
    fetchAdminOverview,
    fetchAdminReports,
    resolveReport,
    reopenReport,
    type UserProfile,
    type ToolDetails,
    type AdminOverviewStatistics,
    type AdminReport,
} from '../../src/api/admin'
import {
    installFetchMock,
    jsonOk,
    jsonError,
    callUrl,
    callInit,
    callHeaders,
} from '../testApi/apimocks'

let fetchMock: ReturnType<typeof installFetchMock>

// Parses the query string of the nth fetch call into a URLSearchParams.
const queryOf = (index = 0) =>
    new URLSearchParams(callUrl(fetchMock, index).split('?')[1] ?? '')

const userProfile: UserProfile = {
    user_id: 'user-1',
    user_first_name: 'Jane',
    user_last_name: 'Doe',
    user_middle_name: null,
    user_email: 'jane@example.com',
    user_bio: null,
    user_location: null,
    user_created_at: '2026-01-01T00:00:00Z',
    user_photo_url: null,
    role_code: 'USER',
    role_name: 'Member',
    role_description: null,
    status_code: 'ACTIVE',
    status_name: 'Active',
    status_description: null,
}

const toolDetails: ToolDetails = {
    tool_id: 'tool-1',
    owner_id: 'owner-1',
    owner_first_name: 'Jane',
    owner_last_name: 'Doe',
    owner_middle_name: null,
    tool_type_id: 1,
    tool_type_code: 'POWER_TOOLS',
    tool_type_name: 'Power Tools',
    tool_title: 'Cordless Drill',
    tool_description: 'A useful tool.',
    tool_condition: 'GOOD',
    tool_pickup_notes: null,
    tool_return_notes: null,
    tool_loan_duration_limit: 7,
    tool_status: 'AVAILABLE',
    tool_created_at: '2026-01-01T00:00:00Z',
    tool_photos: [],
}

const overview: AdminOverviewStatistics = {
    total_users: 100,
    active_users: 90,
    suspended_users: 10,
    new_users_this_month: 7,
    total_tools: 55,
    available_tools: 40,
    hidden_tools: 8,
    suspended_tools: 5,
    deleted_tools: 2,
    new_tools_this_month: 3,
    total_reservations: 200,
    requested_reservations: 20,
    approved_reservations: 30,
    picked_up_reservations: 15,
    completed_reservations: 120,
    denied_reservations: 9,
    cancelled_reservations: 6,
    new_reservations_this_month: 11,
}

const report: AdminReport = {
    id: 'report-1',
    reporter_id: 'user-9',
    target_id: 'tool-1',
    target_type: 'TOOL',
    category: 'TOOL_DAMAGED',
    description: 'Blade was chipped on return.',
    status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
    fetchMock = installFetchMock()
    localStorage.clear()
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('fetchAdminUsers', () => {
    it('applies the default query params and sends the bearer token', async () => {
        localStorage.setItem('access_token', 'stored-token')
        fetchMock.mockResolvedValue(jsonOk([userProfile]))

        const result = await fetchAdminUsers()

        expect(result).toEqual([userProfile])
        expect(callUrl(fetchMock)).toContain('/api/admin/users?')
        const query = queryOf()
        expect(query.get('limit')).toBe('20')
        expect(query.get('offset')).toBe('0')
        expect(query.has('status')).toBe(false)
        expect(callHeaders(fetchMock)).toEqual({
            'Content-Type': 'application/json',
            Authorization: 'Bearer stored-token',
        })
    })

    it('serializes the status filter and pagination when supplied', async () => {
        fetchMock.mockResolvedValue(jsonOk([]))

        await fetchAdminUsers({ status: 'SUSPENDED', limit: 5, offset: 10 })

        const query = queryOf()
        expect(query.get('status')).toBe('SUSPENDED')
        expect(query.get('limit')).toBe('5')
        expect(query.get('offset')).toBe('10')
    })

    it('throws the backend detail on failure and falls back otherwise', async () => {
        fetchMock.mockResolvedValueOnce(jsonError({ detail: 'Admin privileges required.' }, 403))
        await expect(fetchAdminUsers()).rejects.toThrow('Admin privileges required.')

        fetchMock.mockResolvedValueOnce(jsonError({}, 500))
        await expect(fetchAdminUsers()).rejects.toThrow('Failed to load users.')
    })
})

describe('suspendUser / activateUser', () => {
    it('POSTs to the suspend endpoint and returns the message', async () => {
        fetchMock.mockResolvedValue(jsonOk({ message: 'User account suspended.' }))

        const result = await suspendUser('user-2')

        expect(result).toEqual({ message: 'User account suspended.' })
        expect(callUrl(fetchMock)).toBe('/api/admin/users/user-2/suspend')
        expect(callInit(fetchMock).method).toBe('POST')
    })

    it('POSTs to the activate endpoint', async () => {
        fetchMock.mockResolvedValue(jsonOk({ message: 'User account activated.' }))

        await activateUser('user-3')

        expect(callUrl(fetchMock)).toBe('/api/admin/users/user-3/activate')
        expect(callInit(fetchMock).method).toBe('POST')
    })

    it('falls back to generic messages when detail is missing', async () => {
        fetchMock.mockResolvedValueOnce(jsonError({}, 500))
        await expect(suspendUser('x')).rejects.toThrow('Failed to suspend user.')

        fetchMock.mockResolvedValueOnce(jsonError({}, 500))
        await expect(activateUser('x')).rejects.toThrow('Failed to activate user.')
    })
})

describe('fetchAdminTools', () => {
    it('applies default params and omits optional filters', async () => {
        fetchMock.mockResolvedValue(jsonOk([toolDetails]))

        const result = await fetchAdminTools()

        expect(result).toEqual([toolDetails])
        const query = queryOf()
        expect(query.get('limit')).toBe('20')
        expect(query.get('offset')).toBe('0')
        expect(query.has('status')).toBe(false)
        expect(query.has('search')).toBe(false)
    })

    it('serializes status and search filters', async () => {
        fetchMock.mockResolvedValue(jsonOk([]))

        await fetchAdminTools({ status: 'SUSPENDED', search: 'drill' })

        const query = queryOf()
        expect(query.get('status')).toBe('SUSPENDED')
        expect(query.get('search')).toBe('drill')
    })

    it('falls back to a generic message when detail is missing', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))
        await expect(fetchAdminTools()).rejects.toThrow('Failed to load tools.')
    })
})

describe('suspendTool / activateTool', () => {
    it('POSTs to the suspend endpoint', async () => {
        fetchMock.mockResolvedValue(jsonOk({ message: 'Tool suspended.' }))

        await suspendTool('tool-1')

        expect(callUrl(fetchMock)).toBe('/api/admin/tools/tool-1/suspend')
        expect(callInit(fetchMock).method).toBe('POST')
    })

    it('POSTs to the activate endpoint', async () => {
        fetchMock.mockResolvedValue(jsonOk({ message: 'Tool activated.' }))

        await activateTool('tool-2')

        expect(callUrl(fetchMock)).toBe('/api/admin/tools/tool-2/activate')
        expect(callInit(fetchMock).method).toBe('POST')
    })

    it('falls back to generic messages when detail is missing', async () => {
        fetchMock.mockResolvedValueOnce(jsonError({}, 500))
        await expect(suspendTool('x')).rejects.toThrow('Failed to suspend tool.')

        fetchMock.mockResolvedValueOnce(jsonError({}, 500))
        await expect(activateTool('x')).rejects.toThrow('Failed to activate tool.')
    })
})

describe('fetchAdminOverview', () => {
    it('GETs the overview statistics', async () => {
        fetchMock.mockResolvedValue(jsonOk(overview))

        const result = await fetchAdminOverview()

        expect(result).toEqual(overview)
        expect(callUrl(fetchMock)).toBe('/api/admin/statistics/overview')
    })

    it('falls back to a generic message when detail is missing', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))
        await expect(fetchAdminOverview()).rejects.toThrow('Failed to load statistics.')
    })
})

describe('reports', () => {
    it('GETs reports with default pagination', async () => {
        fetchMock.mockResolvedValue(jsonOk([report]))

        const result = await fetchAdminReports()

        expect(result).toEqual([report])
        const query = queryOf()
        expect(query.get('limit')).toBe('10')
        expect(query.get('offset')).toBe('0')
        expect(query.has('status')).toBe(false)
    })

    it('serializes the status filter', async () => {
        fetchMock.mockResolvedValue(jsonOk([]))

        await fetchAdminReports({ status: 'RESOLVED' })

        expect(queryOf().get('status')).toBe('RESOLVED')
    })

    it('POSTs resolve and re-open endpoints', async () => {
        fetchMock.mockResolvedValueOnce(jsonOk({ ...report, status: 'RESOLVED' }))
        await resolveReport('report-1')
        expect(callUrl(fetchMock)).toBe('/api/admin/reports/report-1/resolve')
        expect(callInit(fetchMock).method).toBe('POST')

        fetchMock.mockResolvedValueOnce(jsonOk({ ...report, status: 'ACTIVE' }))
        await reopenReport('report-1')
        expect(callUrl(fetchMock, 1)).toBe('/api/admin/reports/report-1/activate')
    })

    it('falls back to generic messages when detail is missing', async () => {
        fetchMock.mockResolvedValueOnce(jsonError({}, 500))
        await expect(fetchAdminReports()).rejects.toThrow('Failed to load reports.')

        fetchMock.mockResolvedValueOnce(jsonError({}, 500))
        await expect(resolveReport('x')).rejects.toThrow('Failed to resolve report.')

        fetchMock.mockResolvedValueOnce(jsonError({}, 500))
        await expect(reopenReport('x')).rejects.toThrow('Failed to re-open report.')
    })
})