// tests/testApi/tools.test.ts
// Unit tests for src/api/tools.ts — fetchToolTypes, fetchToolConditions,
// createTool, fetchTools (query-string building), fetchToolById.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    fetchToolTypes,
    fetchToolConditions,
    createTool,
    fetchTools,
    fetchToolById,
    hideTool,
    unhideTool,
    deleteTool,
    type ToolDetails,
    type ToolResponse,
    type CreateToolPayload,
} from '../../src/api/tools'
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

const toolTypes = [
    { id: 1, code: 'POWER_TOOLS', display_name: 'Power Tools', description: null },
    { id: 2, code: 'GARDEN', display_name: 'Garden', description: null },
]

const toolDetails: ToolDetails = {
    tool_id: 'tool-1',
    owner_id: 'owner-1',
    owner_first_name: 'Jane',
    owner_last_name: 'Doe',
    owner_middle_name: null,
    tool_type_id: 1,
    tool_type_code: 'POWER_TOOLS',
    tool_type_name: 'Power Tools',
    tool_title: 'DeWalt 20V Cordless Drill',
    tool_description: 'Great drill.',
    tool_condition: 'GOOD',
    tool_pickup_notes: null,
    tool_return_notes: null,
    tool_loan_duration_limit: 7,
    tool_status: 'AVAILABLE',
    tool_created_at: '2026-01-01T00:00:00Z',
    tool_photos: [],
}

const createPayload: CreateToolPayload = {
    tool_type_code: 'POWER_TOOLS',
    title: 'DeWalt 20V Cordless Drill',
    description: 'Great drill, barely used.',
    condition: 'GOOD',
    photo_urls: ['http://minio.local/photos/drill.jpg'],
    loan_duration_limit: 7,
}

const createdTool: ToolResponse = {
    id: 'tool-1',
    tool_type_id: 1,
    title: 'DeWalt 20V Cordless Drill',
    description: 'Great drill, barely used.',
    condition: 'GOOD',
    photos: [{ id: 'photo-1', url: 'http://minio.local/photos/drill.jpg' }],
    pickup_notes: null,
    return_notes: null,
    loan_duration_limit: 7,
    status: 'AVAILABLE',
    created_at: '2026-01-01T00:00:00Z',
}

// Parses the query string of the nth fetch call into a URLSearchParams.
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

describe('fetchToolTypes', () => {
    it('GETs the tool types with the stored bearer token', async () => {
        localStorage.setItem('access_token', 'stored-token')
        fetchMock.mockResolvedValue(jsonOk(toolTypes))

        const result = await fetchToolTypes()

        expect(result).toEqual(toolTypes)
        expect(callUrl(fetchMock)).toBe('/api/tools/types')
        expect(callHeaders(fetchMock)).toEqual({
            'Content-Type': 'application/json',
            Authorization: 'Bearer stored-token',
        })
    })

    it('throws the backend detail message on failure', async () => {
        fetchMock.mockResolvedValue(jsonError({ detail: 'Not authorized.' }, 401))

        await expect(fetchToolTypes()).rejects.toThrow('Not authorized.')
    })

    it('falls back to a generic message when detail is missing', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))

        await expect(fetchToolTypes()).rejects.toThrow(
            'Failed to load tool categories.',
        )
    })
})

describe('fetchToolConditions', () => {
    it('GETs the allowed condition values', async () => {
        fetchMock.mockResolvedValue(jsonOk(['NEW', 'GOOD', 'FAIR', 'POOR']))

        const result = await fetchToolConditions()

        expect(result).toEqual(['NEW', 'GOOD', 'FAIR', 'POOR'])
        expect(callUrl(fetchMock)).toBe('/api/tools/conditions')
    })

    it('falls back to a generic message when detail is missing', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))

        await expect(fetchToolConditions()).rejects.toThrow(
            'Failed to load tool conditions.',
        )
    })
})

describe('createTool', () => {
    it('POSTs the payload and returns the created tool', async () => {
        fetchMock.mockResolvedValue(jsonOk(createdTool, 201))

        const result = await createTool(createPayload)

        expect(result).toEqual(createdTool)
        expect(callUrl(fetchMock)).toBe('/api/tools')
        expect(callInit(fetchMock).method).toBe('POST')
        expect(callBody(fetchMock)).toEqual(createPayload)
    })

    it('throws the backend detail message on validation failure', async () => {
        fetchMock.mockResolvedValue(
            jsonError({ detail: 'Title must be under 100 characters.' }, 422),
        )

        await expect(createTool(createPayload)).rejects.toThrow(
            'Title must be under 100 characters.',
        )
    })

    it('falls back to a generic message when detail is missing', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))

        await expect(createTool(createPayload)).rejects.toThrow(
            'Failed to create tool listing.',
        )
    })
})

describe('fetchTools', () => {
    it('applies the default query params when called with no arguments', async () => {
        fetchMock.mockResolvedValue(jsonOk([toolDetails]))

        const result = await fetchTools()

        expect(result).toEqual([toolDetails])

        const query = queryOf()
        expect(query.get('is_mine')).toBe('true')
        expect(query.get('limit')).toBe('10')
        expect(query.get('offset')).toBe('0')
        // Optional filters are omitted entirely when not supplied.
        expect(query.has('tool_type')).toBe(false)
        expect(query.has('tool_condition')).toBe(false)
        expect(query.has('search')).toBe(false)
    })

    it('serializes every supplied filter', async () => {
        fetchMock.mockResolvedValue(jsonOk([]))

        await fetchTools({
            isMine: false,
            limit: 25,
            offset: 50,
            toolType: 'POWER_TOOLS',
            toolCondition: 'GOOD',
            search: 'drill',
        })

        const query = queryOf()
        expect(query.get('is_mine')).toBe('false')
        expect(query.get('limit')).toBe('25')
        expect(query.get('offset')).toBe('50')
        expect(query.get('tool_type')).toBe('POWER_TOOLS')
        expect(query.get('tool_condition')).toBe('GOOD')
        expect(query.get('search')).toBe('drill')
    })

    it('URL-encodes a multi-word search term', async () => {
        fetchMock.mockResolvedValue(jsonOk([]))

        await fetchTools({ search: 'cordless drill & bits' })

        expect(callUrl(fetchMock)).toContain(
            'search=cordless+drill+%26+bits',
        )
        expect(queryOf().get('search')).toBe('cordless drill & bits')
    })

    it('drops empty-string filters rather than sending them', async () => {
        fetchMock.mockResolvedValue(jsonOk([]))

        await fetchTools({ toolType: '', toolCondition: '', search: '' })

        const query = queryOf()
        expect(query.has('tool_type')).toBe(false)
        expect(query.has('tool_condition')).toBe(false)
        expect(query.has('search')).toBe(false)
    })

    it('falls back to a generic message when detail is missing', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 500))

        await expect(fetchTools()).rejects.toThrow('Failed to load tools.')
    })

    it('throws the backend detail message on failure', async () => {
        fetchMock.mockResolvedValue(jsonError({ detail: 'Invalid offset.' }, 400))

        await expect(fetchTools({ offset: -1 })).rejects.toThrow('Invalid offset.')
    })
})

describe('fetchToolById', () => {
    it('GETs the tool by id and returns its details', async () => {
        fetchMock.mockResolvedValue(jsonOk(toolDetails))

        const result = await fetchToolById('tool-1')

        expect(result).toEqual(toolDetails)
        expect(callUrl(fetchMock)).toBe('/api/tools/tool-1')
    })

    it('throws the backend detail message on failure', async () => {
        fetchMock.mockResolvedValue(
            jsonError({ detail: 'This tool has been removed.' }, 404),
        )

        await expect(fetchToolById('gone')).rejects.toThrow(
            'This tool has been removed.',
        )
    })

    it('falls back to "Tool not found." when detail is missing', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 404))

        await expect(fetchToolById('missing')).rejects.toThrow('Tool not found.')
    })
})

describe('hideTool', () => {
    it('POSTs to /api/tools/:id/hide and returns updated tool', async () => {
        const hiddenTool = { ...createdTool, status: 'HIDDEN' }
        fetchMock.mockResolvedValue(jsonOk(hiddenTool))

        const result = await hideTool('tool-1')

        expect(result).toEqual(hiddenTool)
        expect(callUrl(fetchMock)).toBe('/api/tools/tool-1/hide')
        expect(callInit(fetchMock).method).toBe('POST')
    })

    it('throws error detail on failure', async () => {
        fetchMock.mockResolvedValue(
            jsonError({ detail: 'Tool is currently loaned.' }, 400),
        )

        await expect(hideTool('tool-1')).rejects.toThrow('Tool is currently loaned.')
    })

    it('falls back to generic message when detail is missing', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 404))

        await expect(hideTool('missing')).rejects.toThrow('Tool not found.')
    })
})

describe('unhideTool', () => {
    it('POSTs to /api/tools/:id/unhide and returns updated tool', async () => {
        const unhiddenTool = { ...createdTool, status: 'AVAILABLE' }
        fetchMock.mockResolvedValue(jsonOk(unhiddenTool))

        const result = await unhideTool('tool-1')

        expect(result).toEqual(unhiddenTool)
        expect(callUrl(fetchMock)).toBe('/api/tools/tool-1/unhide')
        expect(callInit(fetchMock).method).toBe('POST')
    })

    it('throws error detail on failure', async () => {
        fetchMock.mockResolvedValue(
            jsonError({ detail: 'Cannot unhide tool.' }, 400),
        )

        await expect(unhideTool('tool-1')).rejects.toThrow('Cannot unhide tool.')
    })

    it('falls back to generic message when detail is missing', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 404))

        await expect(unhideTool('missing')).rejects.toThrow('Tool not found.')
    })
})

describe('deleteTool', () => {
    it('DELETEs the specified tool', async () => {
        fetchMock.mockResolvedValue(jsonOk({ message: 'Tool deleted successfully' }))

        const result = await deleteTool('tool-1')

        expect(result).toEqual({ message: 'Tool deleted successfully' })
        expect(callUrl(fetchMock)).toBe('/api/tools/tool-1')
        expect(callInit(fetchMock).method).toBe('DELETE')
    })

    it('throws error detail on failure', async () => {
        fetchMock.mockResolvedValue(
            jsonError({ detail: 'Cannot delete tool with active reservation.' }, 400),
        )

        await expect(deleteTool('tool-1')).rejects.toThrow(
            'Cannot delete tool with active reservation.',
        )
    })

    it('falls back to generic message when detail is missing', async () => {
        fetchMock.mockResolvedValue(jsonError({}, 404))

        await expect(deleteTool('missing')).rejects.toThrow('Tool not found.')
    })
})