// src/api/admin.ts
// API service for all admin-only endpoints 
//
// Endpoints covered (backend already implemented, see app/routers/admin.py):
//   GET  /api/admin/users                  → list all user profiles
//   POST /api/admin/users/{id}/suspend     → suspend a user account
//   POST /api/admin/users/{id}/activate    → re-activate a suspended user
//   GET  /api/admin/tools                  → list all tools
//   POST /api/admin/tools/{id}/suspend     → suspend a tool listing
//   POST /api/admin/tools/{id}/activate    → activate (→ HIDDEN) a suspended tool
//   GET  /api/admin/statistics/overview    → basic report metrics
//   GET  /api/admin/reports                → list user-submitted reports
//   POST /api/admin/reports/{id}/resolve   → mark a report RESOLVED
//   POST /api/admin/reports/{id}/activate  → re-open a resolved report

import type { UserProfile } from './users'
import type { ToolDetails } from './tools'

// Re-export so tab components can import the shared shapes from one place.
export type { UserProfile } from './users'
export type { ToolDetails } from './tools'

// ---------------------------------------------------------------------------
// Types — match the backend response schemas
// ---------------------------------------------------------------------------

// Matches MessageResponse (used by the suspend/activate endpoints)
export interface MessageResponse {
    message: string
}

// Matches AdminOverviewStatisticsResponse (app/schemas/admin_statistics.py)
export interface AdminOverviewStatistics {
    total_users: number
    active_users: number
    suspended_users: number
    new_users_this_month: number

    total_tools: number
    available_tools: number
    hidden_tools: number
    suspended_tools: number
    deleted_tools: number
    new_tools_this_month: number

    total_reservations: number
    requested_reservations: number
    approved_reservations: number
    picked_up_reservations: number
    completed_reservations: number
    denied_reservations: number
    cancelled_reservations: number
    new_reservations_this_month: number
}

// Matches ReportResponse (app/schemas/report.py)
export interface AdminReport {
    id: string
    reporter_id: string
    target_id: string
    target_type: string // RESERVATION | TOOL | USER
    category: string
    description: string
    status: string // ACTIVE | RESOLVED
    created_at: string
}

// Query params for the paginated list endpoints
export interface ListUsersParams {
    status?: string // ACTIVE | SUSPENDED
    limit?: number
    offset?: number
}

export interface ListToolsParams {
    status?: string // AVAILABLE | SUSPENDED | HIDDEN
    search?: string
    limit?: number
    offset?: number
}

export interface ListReportsParams {
    status?: string // ACTIVE | RESOLVED
    limit?: number
    offset?: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Attaches the stored JWT token to every request
const authHeaders = (): HeadersInit => {
    const token = localStorage.getItem('access_token')
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    }
}

// Extracts a readable message from either a plain-string detail (400/401/403)
// or a Pydantic validation array (422).
const extractDetail = (data: { detail?: unknown }, fallback: string): string => {
    if (Array.isArray(data.detail)) {
        const first = data.detail[0] as { msg?: string } | undefined
        return first?.msg || fallback
    }
    return typeof data.detail === 'string' ? data.detail : fallback
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

// GET /api/admin/users — all user profiles (optionally filtered by status)
export const fetchAdminUsers = async (params: ListUsersParams = {}): Promise<UserProfile[]> => {
    const query = new URLSearchParams()
    query.set('limit', String(params.limit ?? 20))
    query.set('offset', String(params.offset ?? 0))
    if (params.status) query.set('status', params.status)

    const response = await fetch(`/api/admin/users?${query.toString()}`, {
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to load users.'))
    return data
}

// POST /api/admin/users/{id}/suspend
export const suspendUser = async (userId: string): Promise<MessageResponse> => {
    const response = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: 'POST',
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to suspend user.'))
    return data
}

// POST /api/admin/users/{id}/activate
export const activateUser = async (userId: string): Promise<MessageResponse> => {
    const response = await fetch(`/api/admin/users/${userId}/activate`, {
        method: 'POST',
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to activate user.'))
    return data
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

// GET /api/admin/tools — all tools (optionally filtered by status / keyword)
export const fetchAdminTools = async (params: ListToolsParams = {}): Promise<ToolDetails[]> => {
    const query = new URLSearchParams()
    query.set('limit', String(params.limit ?? 20))
    query.set('offset', String(params.offset ?? 0))
    if (params.status) query.set('status', params.status)
    if (params.search) query.set('search', params.search)

    const response = await fetch(`/api/admin/tools?${query.toString()}`, {
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to load tools.'))
    return data
}

// POST /api/admin/tools/{id}/suspend
export const suspendTool = async (toolId: string): Promise<MessageResponse> => {
    const response = await fetch(`/api/admin/tools/${toolId}/suspend`, {
        method: 'POST',
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to suspend tool.'))
    return data
}

// POST /api/admin/tools/{id}/activate — reinstates a suspended tool as HIDDEN
export const activateTool = async (toolId: string): Promise<MessageResponse> => {
    const response = await fetch(`/api/admin/tools/${toolId}/activate`, {
        method: 'POST',
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to activate tool.'))
    return data
}

// ---------------------------------------------------------------------------
// Reports / statistics
// ---------------------------------------------------------------------------

// GET /api/admin/statistics/overview — basic report metrics for the Reports tab
export const fetchAdminOverview = async (): Promise<AdminOverviewStatistics> => {
    const response = await fetch('/api/admin/statistics/overview', {
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to load statistics.'))
    return data
}

// GET /api/admin/reports — user-submitted reports (optional status filter)
export const fetchAdminReports = async (params: ListReportsParams = {}): Promise<AdminReport[]> => {
    const query = new URLSearchParams()
    query.set('limit', String(params.limit ?? 10))
    query.set('offset', String(params.offset ?? 0))
    if (params.status) query.set('status', params.status)

    const response = await fetch(`/api/admin/reports?${query.toString()}`, {
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to load reports.'))
    return data
}

// POST /api/admin/reports/{id}/resolve
export const resolveReport = async (reportId: string): Promise<AdminReport> => {
    const response = await fetch(`/api/admin/reports/${reportId}/resolve`, {
        method: 'POST',
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to resolve report.'))
    return data
}

// POST /api/admin/reports/{id}/activate
export const reopenReport = async (reportId: string): Promise<AdminReport> => {
    const response = await fetch(`/api/admin/reports/${reportId}/activate`, {
        method: 'POST',
        headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to re-open report.'))
    return data
}