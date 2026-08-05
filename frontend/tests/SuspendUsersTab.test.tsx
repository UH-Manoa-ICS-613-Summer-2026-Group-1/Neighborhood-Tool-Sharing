// tests/SuspendUsersTab.test.tsx
// Verifies the user moderation tab: row rendering, the self/admin action guards,
// confirm-gated suspend, activate, the status filter refetch, and the error banner.

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import SuspendUsersTab from '../src/pages/Admin/SuspendUsersTab'
import * as adminApi from '../src/api/admin'
import type { UserProfile } from '../src/api/admin'

const CURRENT_ADMIN_ID = 'admin-1'

const make = (overrides: Partial<UserProfile>): UserProfile => ({
    user_id: 'user-2',
    user_first_name: 'Bob',
    user_last_name: 'Borrower',
    user_middle_name: null,
    user_email: 'bob@example.com',
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
    ...overrides,
})

const activeUser = make({})
const suspendedUser = make({ user_id: 'user-3', user_first_name: 'Sue', user_last_name: 'Suspended', status_code: 'SUSPENDED' })
const selfUser = make({ user_id: CURRENT_ADMIN_ID, user_first_name: 'Ada', user_last_name: 'Admin', role_code: 'ADMIN' })
const otherAdmin = make({ user_id: 'admin-2', user_first_name: 'Otto', user_last_name: 'Other', role_code: 'ADMIN', role_name: 'Administrator' })

function renderTab() {
    return render(<SuspendUsersTab currentUserId={CURRENT_ADMIN_ID} />)
}

describe('SuspendUsersTab', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        vi.spyOn(adminApi, 'fetchAdminUsers').mockResolvedValue([activeUser])
        vi.spyOn(adminApi, 'suspendUser').mockResolvedValue({ message: 'User account suspended.' })
        vi.spyOn(adminApi, 'activateUser').mockResolvedValue({ message: 'User account activated.' })
    })

    it('renders a user row with name and email', async () => {
        renderTab()

        expect(await screen.findByText('Bob Borrower')).toBeInTheDocument()
        expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    })

    it('suspends an active user after confirmation and reloads the list', async () => {
        const user = userEvent.setup()
        renderTab()

        await user.click(await screen.findByRole('button', { name: /suspend/i }))

        expect(window.confirm).toHaveBeenCalled()
        await waitFor(() => expect(adminApi.suspendUser).toHaveBeenCalledWith('user-2'))
        expect(await screen.findByText(/user account suspended/i)).toBeInTheDocument()
        // Once on mount, once after the action
        await waitFor(() => expect(adminApi.fetchAdminUsers).toHaveBeenCalledTimes(2))
    })

    it('does not suspend when the confirmation is dismissed', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(false)
        const user = userEvent.setup()
        renderTab()

        await user.click(await screen.findByRole('button', { name: /suspend/i }))

        expect(adminApi.suspendUser).not.toHaveBeenCalled()
    })

    it('activates a suspended user', async () => {
        vi.spyOn(adminApi, 'fetchAdminUsers').mockResolvedValue([suspendedUser])
        const user = userEvent.setup()
        renderTab()

        await user.click(await screen.findByRole('button', { name: /activate/i }))

        await waitFor(() => expect(adminApi.activateUser).toHaveBeenCalledWith('user-3'))
    })

    it('shows "You" and no action button on the admin\'s own row', async () => {
        vi.spyOn(adminApi, 'fetchAdminUsers').mockResolvedValue([selfUser])
        renderTab()

        expect(await screen.findByText('You')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /suspend|activate/i })).not.toBeInTheDocument()
    })

    it('offers no suspend/activate action for another active administrator', async () => {
        vi.spyOn(adminApi, 'fetchAdminUsers').mockResolvedValue([otherAdmin])
        renderTab()

        // The row renders, but no moderation action is offered for a fellow admin.
        expect(await screen.findByText('Otto Other')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /suspend|activate/i })).not.toBeInTheDocument()
    })

    it('refetches with the status filter when it changes', async () => {
        const user = userEvent.setup()
        renderTab()
        await screen.findByText('Bob Borrower')

        await user.selectOptions(screen.getByRole('combobox'), 'SUSPENDED')

        await waitFor(() =>
            expect(adminApi.fetchAdminUsers).toHaveBeenLastCalledWith(
                expect.objectContaining({ status: 'SUSPENDED' }),
            ),
        )
    })

    it('shows an error banner when the suspend call fails', async () => {
        vi.spyOn(adminApi, 'suspendUser').mockRejectedValue(new Error('Failed to suspend user.'))
        const user = userEvent.setup()
        renderTab()

        await user.click(await screen.findByRole('button', { name: /suspend/i }))

        expect(await screen.findByRole('alert')).toHaveTextContent(/failed to suspend user/i)
    })
})