// tests/AdminRoute.test.tsx
// Verifies the admin route guard: unauthenticated → /login, non-admin → /dashboard,
// admin → renders the page (and receives the profile via Outlet context),
// and a failed profile fetch clears the token and bounces to /login.

import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MemoryRouter, Routes, Route, useOutletContext } from 'react-router'
import AdminRoute from '../src/components/AdminRoute'
import * as usersApi from '../src/api/users'
import type { UserProfile } from '../src/api/users'

const baseProfile: UserProfile = {
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

const adminProfile: UserProfile = { ...baseProfile, role_code: 'ADMIN' }
const memberProfile: UserProfile = { ...baseProfile, role_code: 'USER', user_email: 'member@example.com' }

// Child page that proves the guard forwarded the profile via context.
function AdminChild() {
    const u = useOutletContext<UserProfile>()
    return <p>Admin area for {u.user_email}</p>
}

function renderAt(path = '/admin') {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/login" element={<p>Login Page</p>} />
                <Route path="/dashboard" element={<p>Dashboard Page</p>} />
                <Route element={<AdminRoute />}>
                    <Route path="/admin" element={<AdminChild />} />
                </Route>
            </Routes>
        </MemoryRouter>,
    )
}

describe('AdminRoute', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('redirects to /login when no token is stored (without checking the role)', () => {
        const spy = vi.spyOn(usersApi, 'fetchCurrentUser')

        renderAt('/admin')

        expect(screen.getByText('Login Page')).toBeInTheDocument()
        expect(spy).not.toHaveBeenCalled()
    })

    it('shows a verifying placeholder while the role check is in flight', () => {
        localStorage.setItem('access_token', 'token')
        // Never resolves — keeps the guard in its checking state.
        vi.spyOn(usersApi, 'fetchCurrentUser').mockReturnValue(new Promise<UserProfile>(() => {}))

        renderAt('/admin')

        expect(screen.getByText(/verifying admin access/i)).toBeInTheDocument()
    })

    it('renders the admin page and passes the profile via context for an admin', async () => {
        localStorage.setItem('access_token', 'token')
        vi.spyOn(usersApi, 'fetchCurrentUser').mockResolvedValue(adminProfile)

        renderAt('/admin')

        expect(await screen.findByText(/admin area for admin@example.com/i)).toBeInTheDocument()
    })

    it('redirects a logged-in non-admin to /dashboard', async () => {
        localStorage.setItem('access_token', 'token')
        vi.spyOn(usersApi, 'fetchCurrentUser').mockResolvedValue(memberProfile)

        renderAt('/admin')

        expect(await screen.findByText('Dashboard Page')).toBeInTheDocument()
        expect(screen.queryByText(/admin area/i)).not.toBeInTheDocument()
    })

    it('clears the token and redirects to /login when the profile fetch fails', async () => {
        localStorage.setItem('access_token', 'bad-token')
        vi.spyOn(usersApi, 'fetchCurrentUser').mockRejectedValue(new Error('Invalid token'))

        renderAt('/admin')

        expect(await screen.findByText('Login Page')).toBeInTheDocument()
        expect(localStorage.getItem('access_token')).toBeNull()
    })
})