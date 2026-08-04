// src/pages/Admin/AdminDashboard.tsx
// Specialized dashboard shown only to users whose role_code === 'ADMIN'.
//
// Three tabs
//   reports (default) → basic platform metrics   → <ReportsTab />
//   users             → suspend / activate users → <SuspendUsersTab />
//   tools             → suspend / activate tools → <SuspendToolsTab />

import { useOutletContext, useNavigate, useSearchParams } from 'react-router'
import { logoutUser } from '../../api/auth'
import type { UserProfile } from '../../api/users'
import ReportsTab from './ReportsTab'
import SuspendUsersTab from './SuspendUsersTab'
import SuspendToolsTab from './SuspendToolsTab'

type Tab = 'reports' | 'users' | 'tools'

const TABS: { key: Tab; label: string }[] = [
    { key: 'reports', label: 'Reports' },
    { key: 'users', label: 'Suspend Users' },
    { key: 'tools', label: 'Suspend Tools' },
]

export default function AdminDashboard() {
    const navigate = useNavigate()
    // Provided by <AdminRoute /> via <Outlet context={user} />
    const admin = useOutletContext<UserProfile>()

    // Active tab lives in the URL so it survives refresh and can be deep-linked.
    const [searchParams, setSearchParams] = useSearchParams()
    const tabParam = searchParams.get('tab')
    const activeTab: Tab = tabParam === 'users' || tabParam === 'tools' ? tabParam : 'reports'

    const switchTab = (tab: Tab) => {
        if (tab === 'reports') setSearchParams({})
        else setSearchParams({ tab })
    }

    const handleSignOut = async () => {
        try {
            await logoutUser()
        } catch (err) {
            console.error(err instanceof Error ? err.message : 'Logout failed.')
        } finally {
            localStorage.removeItem('access_token')
            navigate('/')
        }
    }

    const tabButtonClass = (tab: Tab) =>
        `px-4 py-2 text-xs sm:text-sm font-semibold rounded-t transition-colors duration-150 cursor-pointer ${
            activeTab === tab
                ? 'bg-black/25 text-[#e8a838] border-b-2 border-[#e8a838]'
                : 'text-gray-400 hover:text-white'
        }`


    const initials = ((admin.user_first_name?.[0] ?? '') + (admin.user_last_name?.[0] ?? '')).toUpperCase()
    const avatar = admin.user_photo_url ? (
        <img
            src={admin.user_photo_url}
            alt=""
            className="size-9 rounded-full object-cover outline -outline-offset-1 outline-white/10"
        />
    ) : (
        <span className="flex size-9 items-center justify-center rounded-full bg-[#e8a838] text-sm font-bold text-[#1a1f26]">
            {initials || 'A'}
        </span>
    )

    return (
        <div className="min-h-screen text-white bg-[#1a1f26]">
            {/* Admin header */}
            <header className="sticky top-0 z-10 bg-gray-800/95 backdrop-blur border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    {/* Brand */}
                    <div className="flex items-center gap-3">
                        <div className="leading-tight">
                            <p className="text-base font-bold text-white">Admin</p>
                        </div>
                    </div>

                    {/* User cluster */}
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:block text-right leading-tight">
                            <p className="text-sm font-medium text-white">
                                {admin.user_first_name} {admin.user_last_name}
                            </p>
                            <p className="text-xs text-gray-400">{admin.user_email}</p>
                        </div>
                        {avatar}
                        <button
                            onClick={handleSignOut}
                            className="ml-1 px-3 py-1.5 text-sm font-semibold rounded-md border border-white/15 text-gray-200 hover:border-[#e8a838] hover:text-[#e8a838] transition-colors cursor-pointer"
                        >
                            Sign out
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6">
                <div className="mt-2 mb-6">
                    <h1 className="text-2xl font-bold mb-1">Administration</h1>
                    <p className="text-sm text-gray-400">
                        Signed in as <span className="text-[#e8a838]">{admin.user_email}</span>
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b border-white/10 mb-6">
                    {TABS.map(t => (
                        <button key={t.key} className={tabButtonClass(t.key)} onClick={() => switchTab(t.key)}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Active tab */}
                {activeTab === 'reports' && <ReportsTab />}
                {activeTab === 'users' && <SuspendUsersTab currentUserId={admin.user_id} />}
                {activeTab === 'tools' && <SuspendToolsTab />}
            </main>
        </div>
    )
}