// tests/SuspendToolsTab.test.tsx
// Verifies the tool moderation tab: row rendering, confirm-gated suspend,
// activate for suspended tools, search + status refetch, and the error banner.

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import SuspendToolsTab from '../src/pages/Admin/SuspendToolsTab'
import * as adminApi from '../src/api/admin'
import type { ToolDetails } from '../src/api/admin'

const make = (overrides: Partial<ToolDetails>): ToolDetails => ({
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
    ...overrides,
})

const availableTool = make({})
const suspendedTool = make({ tool_id: 'tool-2', tool_title: 'Old Mower', tool_status: 'SUSPENDED' })

describe('SuspendToolsTab', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        vi.spyOn(adminApi, 'fetchAdminTools').mockResolvedValue([availableTool])
        vi.spyOn(adminApi, 'suspendTool').mockResolvedValue({ message: 'Tool suspended.' })
        vi.spyOn(adminApi, 'activateTool').mockResolvedValue({ message: 'Tool activated.' })
    })

    it('renders a tool row with title and owner', async () => {
        render(<SuspendToolsTab />)

        expect(await screen.findByText('Cordless Drill')).toBeInTheDocument()
        expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    })

    it('suspends a tool after confirmation and shows the result banner', async () => {
        const user = userEvent.setup()
        render(<SuspendToolsTab />)

        await user.click(await screen.findByRole('button', { name: /suspend/i }))

        expect(window.confirm).toHaveBeenCalled()
        await waitFor(() => expect(adminApi.suspendTool).toHaveBeenCalledWith('tool-1'))
        expect(await screen.findByText(/tool suspended/i)).toBeInTheDocument()
    })

    it('does not suspend when the confirmation is dismissed', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(false)
        const user = userEvent.setup()
        render(<SuspendToolsTab />)

        await user.click(await screen.findByRole('button', { name: /suspend/i }))

        expect(adminApi.suspendTool).not.toHaveBeenCalled()
    })

    it('activates a suspended tool', async () => {
        vi.spyOn(adminApi, 'fetchAdminTools').mockResolvedValue([suspendedTool])
        const user = userEvent.setup()
        render(<SuspendToolsTab />)

        await user.click(await screen.findByRole('button', { name: /activate/i }))

        await waitFor(() => expect(adminApi.activateTool).toHaveBeenCalledWith('tool-2'))
    })

    it('refetches with the search term when the search form is submitted', async () => {
        const user = userEvent.setup()
        render(<SuspendToolsTab />)
        await screen.findByText('Cordless Drill')

        await user.type(screen.getByPlaceholderText(/search title or description/i), 'drill')
        await user.click(screen.getByRole('button', { name: /^search$/i }))

        await waitFor(() =>
            expect(adminApi.fetchAdminTools).toHaveBeenLastCalledWith(
                expect.objectContaining({ search: 'drill' }),
            ),
        )
    })

    it('refetches with the status filter when it changes', async () => {
        const user = userEvent.setup()
        render(<SuspendToolsTab />)
        await screen.findByText('Cordless Drill')

        await user.selectOptions(screen.getByRole('combobox'), 'SUSPENDED')

        await waitFor(() =>
            expect(adminApi.fetchAdminTools).toHaveBeenLastCalledWith(
                expect.objectContaining({ status: 'SUSPENDED' }),
            ),
        )
    })

    it('shows an error banner when the suspend call fails', async () => {
        vi.spyOn(adminApi, 'suspendTool').mockRejectedValue(new Error('Failed to suspend tool.'))
        const user = userEvent.setup()
        render(<SuspendToolsTab />)

        await user.click(await screen.findByRole('button', { name: /suspend/i }))

        expect(await screen.findByRole('alert')).toHaveTextContent(/failed to suspend tool/i)
    })
})