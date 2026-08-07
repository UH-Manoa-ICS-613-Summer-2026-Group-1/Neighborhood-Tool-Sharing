// Matches PhotoSchema
export interface ToolPhoto {
    id: string
    url: string
}
 
// Matches ToolTypeResponse
export interface ToolType {
    id: number
    code: string
    display_name: string
    description: string | null
}
 
// Matches ToolResponse
export interface ToolResponse {
    id: string
    tool_type_id: number
    title: string
    description: string
    condition: string
    photos: ToolPhoto[]
    pickup_notes: string | null
    return_notes: string | null
    loan_duration_limit: number
    status: string
    created_at: string
}
 
// Matches ToolDetailsResponse
export interface ToolDetails {
    tool_id: string
    owner_id: string
    owner_first_name: string
    owner_last_name: string
    owner_middle_name: string | null
    tool_type_id: number
    tool_type_code: string
    tool_type_name: string
    tool_title: string
    tool_description: string
    tool_condition: string
    tool_pickup_notes: string | null
    tool_return_notes: string | null
    tool_loan_duration_limit: number
    tool_status: string
    tool_created_at: string
    tool_photos: ToolPhoto[]
}
 
// Matches ToolRequest
export interface CreateToolPayload {
    tool_type_code: string
    title: string
    description: string
    condition: string
    photo_urls: string[]
    pickup_notes?: string
    return_notes?: string
    loan_duration_limit?: number
}
 
// Query params for GET /api/tools
export interface ListToolsParams {
    isMine?: boolean
    limit?: number
    offset?: number
    toolType?: string
    toolCondition?: string
    search?: string
}
 
// Helpers
const authHeaders = (): HeadersInit => {
    const token = localStorage.getItem('access_token')
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    }
}
 
// Services
 
// list of tool categories for the "Add Tool" dropdown
export const fetchToolTypes = async (): Promise<ToolType[]> => {
    const response = await fetch('/api/tools/types', { headers: authHeaders() })
    const data = await response.json()
    if (!response.ok) throw new Error(data.detail || 'Failed to load tool categories.')
    return data
}
 
// list of allowed condition values
export const fetchToolConditions = async (): Promise<string[]> => {
    const response = await fetch('/api/tools/conditions', { headers: authHeaders() })
    const data = await response.json()
    if (!response.ok) throw new Error(data.detail || 'Failed to load tool conditions.')
    return data
}
 
// Create a new tool listing
export const createTool = async (payload: CreateToolPayload): Promise<ToolResponse> => {
    const response = await fetch('/api/tools', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.detail || 'Failed to create tool listing.')
    return data
}
 
// Filtered list
export const fetchTools = async (params: ListToolsParams = {}): Promise<ToolDetails[]> => {
    const query = new URLSearchParams()
    query.set('is_mine', String(params.isMine ?? true))
    query.set('limit', String(params.limit ?? 10))
    query.set('offset', String(params.offset ?? 0))
    if (params.toolType) query.set('tool_type', params.toolType)
    if (params.toolCondition) query.set('tool_condition', params.toolCondition)
    if (params.search) query.set('search', params.search)
 
    const response = await fetch(`/api/tools?${query.toString()}`, { headers: authHeaders() })
    const data = await response.json()
    if (!response.ok) throw new Error(data.detail || 'Failed to load tools.')
    return data
}
 
// Full details for one tool.
export const fetchToolById = async (toolId: string): Promise<ToolDetails> => {
    const response = await fetch(`/api/tools/${toolId}`, { headers: authHeaders() })
    const data = await response.json()
    if (!response.ok) throw new Error(data.detail || 'Tool not found.')
    return data
}
 

// Hide the tool listing
export const hideTool = async (toolId: string): Promise<ToolResponse> => {
    const response = await fetch(`/api/tools/${toolId}/hide`, {
        method: 'POST',
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.detail || 'Tool not found.')
    return data
}

export const unhideTool = async (toolId: string): Promise<ToolResponse> => {
    const response = await fetch(`/api/tools/${toolId}/unhide`, {
        method: 'POST',
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.detail || 'Tool not found.')
    return data
}

export const deleteTool = async (toolId: string): Promise<{ message: string }> => {
    const response = await fetch(`/api/tools/${toolId}`, {
        method: 'DELETE',
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.detail || 'Tool not found.')
    return data
}

// Fetch list of unavailable/blocked dates ('YYYY-MM-DD' format) for a tool
export const fetchToolAvailability = async (toolId: string): Promise<string[]> => {
    const response = await fetch(`/api/tools/${toolId}/availability`, { headers: authHeaders() })
    const data = await response.json()
    if (!response.ok) throw new Error(data.detail || 'Failed to load tool availability.')
    return data
}