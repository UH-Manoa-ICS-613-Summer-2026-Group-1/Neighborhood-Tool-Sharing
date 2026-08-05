// tests/AdminDashboard.test.tsx
// Verifies the admin console shell: header details, URL-driven tab switching,
// the currentUserId handed to the users tab, and sign-out behavior.
// The three tab bodies are stubbed here

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter, Routes, Route, Outlet } from 'react-router'
import AdminDashboard from '../src/pages/Admin/AdminDashboard'
import * as authApi from '../src/api/auth'
import type { UserProfile } from '../src/api/users'

// Mock navigate so we can assert on sign-out without a real router history.
const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))
vi.mock('react-router', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router')>()
    return { ...actual, useNavigate: () => mockNavigate }
})

// Stub the three tab bodies
vi.mock('../src/pages/Admin/ReportsTab', () => ({
    default: () => <div data-testid="reports-tab" />,
}))
vi.mock('../src/pages/Admin/SuspendUsersTab', () => ({
    default: ({ currentUserId }: { currentUserId: string }) => (
        <div data-testid="users-tab">{currentUserId}</div>
    ),
}))
vi.mock('../src/pages/Admin/SuspendToolsTab', () => ({
    default: () => <div data-testid="tools-tab" />,
}))

const admin: UserProfile = {
    user_id: 'admin-1',
    user_first_name: 'Ada',
    user_last_name: 'Admin',
    user_middle_name: null,
    user_email: 'admin@example.com',
    user_bio: null,
    user_location: null,
    user_created_at: '2026-01-01T00:00:00Z',
    user_photo_url: null,
    role_code: 'ADMIN',
    role_name: 'Administrator',
    role_description: null,
    status_code: 'ACTIVE',
    status_name: 'Active',
    status_description: null,
}

// Provides the admin profile through a real Outlet, exactly like AdminRoute does.
function AdminLayout() {
    return <Outlet context={admin} />
}

function renderConsole(url = '/admin') {
    return render(
        <MemoryRouter initialEntries={[url]}>
            <Routes>
                <Route element={<AdminLayout />}>
                    <Route path="/admin" element={<AdminDashboard />} />
                </Route>
            </Routes>
        </MemoryRouter>,
    )
}

describe('AdminDashboard', () => {
    beforeEach(() => {
        mockNavigate.mockClear()
        vi.restoreAllMocks()
        localStorage.setItem('access_token', 'token')
        vi.spyOn(authApi, 'logoutUser').mockResolvedValue(undefined as unknown as void)
    })

    it('renders the header, the admin name and email, and the Reports tab by default', () => {
        renderConsole()

        expect(screen.getByText('Admin')).toBeInTheDocument()
        expect(screen.getByText('Ada Admin')).toBeInTheDocument()
        // The email appears in both the header cluster and the "Signed in as" line.
        expect(screen.getAllByText('admin@example.com').length).toBeGreaterThan(0)
        expect(screen.getByRole('heading', { name: /administration/i })).toBeInTheDocument()
        expect(screen.getByTestId('reports-tab')).toBeInTheDocument()
    })

    it('switches to the Suspend Users tab and passes the admin id down', async () => {
        const user = userEvent.setup()
        renderConsole()

        await user.click(screen.getByRole('button', { name: /suspend users/i }))

        const usersTab = await screen.findByTestId('users-tab')
        expect(usersTab).toHaveTextContent('admin-1')
        expect(screen.queryByTestId('reports-tab')).not.toBeInTheDocument()
    })

    it('switches to the Suspend Tools tab', async () => {
        const user = userEvent.setup()
        renderConsole()

        await user.click(screen.getByRole('button', { name: /suspend tools/i }))

        expect(await screen.findByTestId('tools-tab')).toBeInTheDocument()
    })

    it('honors a ?tab=users deep link on first render', () => {
        renderConsole('/admin?tab=users')

        expect(screen.getByTestId('users-tab')).toBeInTheDocument()
        expect(screen.queryByTestId('reports-tab')).not.toBeInTheDocument()
    })

    it('signs the admin out: calls logout, clears the token, and returns home', async () => {
        const user = userEvent.setup()
        renderConsole()

        await user.click(screen.getByRole('button', { name: /sign out/i }))

        await waitFor(() => expect(authApi.logoutUser).toHaveBeenCalled())
        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
        expect(localStorage.getItem('access_token')).toBeNull()
    })
})