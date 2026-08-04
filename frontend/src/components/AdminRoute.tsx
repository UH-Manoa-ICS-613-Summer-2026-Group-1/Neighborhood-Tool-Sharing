// src/components/AdminRoute.tsx
// Route guard for admin-only pages.
//
// It layers on top of the normal auth check:
//   1. No token           → redirect to /login (remembering where they were headed)
//   2. Token but NOT admin → redirect to /dashboard (regular user space)
//   3. Token AND admin     → render the admin page, passing the profile down
//                            via Outlet context so the page doesn't refetch it.
//
// role_code === 'ADMIN' is the source of truth (from GET /api/users/me).

import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { fetchCurrentUser, type UserProfile } from '../api/users'

const AdminRoute = () => {
    const location = useLocation()
    const token = localStorage.getItem('access_token')

    const [user, setUser] = useState<UserProfile | null>(null)
    const [checking, setChecking] = useState(true)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        if (!token) {
            setChecking(false)
            return
        }

        let cancelled = false
        const verify = async () => {
            try {
                const data = await fetchCurrentUser()
                if (!cancelled) setUser(data)
            } catch {
                // Bad/expired token — drop it and fall back to the login redirect.
                if (!cancelled) {
                    localStorage.removeItem('access_token')
                    setFailed(true)
                }
            } finally {
                if (!cancelled) setChecking(false)
            }
        }
        verify()

        return () => {
            cancelled = true
        }
    }, [token])

    // Not logged in (or token just failed) → login
    if (!token || failed) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    // Verifying the role — brief placeholder to avoid a flash of the wrong UI
    if (checking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#1a1f26] text-gray-400">
                Verifying admin access...
            </div>
        )
    }

    // Logged in but a regular member → send them to their normal dashboard
    if (user?.role_code !== 'ADMIN') {
        return <Navigate to="/dashboard" replace />
    }

    // Admin confirmed — hand the profile to the page via context
    return <Outlet context={user} />
}

export default AdminRoute