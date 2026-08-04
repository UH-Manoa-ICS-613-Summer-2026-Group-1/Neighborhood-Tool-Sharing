// src/pages/Dashboard/Dashboard.tsx
// Main dashboard page for logged-in users
// Covers US 9 (owner views lending reservations) and US 10 (borrower views their requests)
// via the Transactions tab which now uses the Transactions component

import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import Navbar from '../../components/Navbar'
import ToolCard from '../../components/ToolCard'
import { fetchCurrentUser, type UserProfile } from '../../api/users'
import {
    fetchTools,
    fetchToolTypes,
    fetchToolConditions,
    type ToolDetails,
    type ToolType,
} from '../../api/tools'

// ADDED BY MARITZA — 07/19/2026
// Transactions component covers US 3, 4, 5, 7, 9, 10
import Transactions from '../Reservations/Transactions'

type Tab = 'my-tools' | 'neighborhood' | 'transactions'

const PAGE_SIZE = 12

export default function Dashboard() {
    const navigate = useNavigate()
    const location = useLocation()

    // User profile
    const [user, setUser] = useState<UserProfile | null>(null)
    const [profileLoading, setProfileLoading] = useState(true)
    const [profileError, setProfileError] = useState('')

    // Tabs
    // The active tab lives in the URL (?tab=...) so the Navbar's Search and
    // Calendar links can deep-link to a tab and highlight correctly. It also
    // means the tab survives refresh and back/forward navigation.
    const [searchParams, setSearchParams] = useSearchParams()
    const tabParam = searchParams.get('tab')
    const activeTab: Tab =
        tabParam === 'neighborhood' || tabParam === 'transactions' ? tabParam : 'my-tools'

    // Tool list state
    const [tools, setTools] = useState<ToolDetails[]>([])
    const [toolsError, setToolsError] = useState('')
    const [offset, setOffset] = useState(0)
    // If the API returns a full page, there may be more results
    const [hasMore, setHasMore] = useState(false)

    // Filters
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [conditionFilter, setConditionFilter] = useState('')
    const [toolTypes, setToolTypes] = useState<ToolType[]>([])
    const [conditions, setConditions] = useState<string[]>([])

    // Success banner after publishing a new tool (passed via navigate state)
    // UPDATED BY MARITZA — also handles reservationCreated state from RequestReservation page
    const locationState = location.state as { toolCreated?: string; reservationCreated?: string } | null
    const [successBanner, setSuccessBanner] = useState(
        locationState?.toolCreated
            ? `"${locationState.toolCreated}" was published to your Tool Shed.`
            : locationState?.reservationCreated
            // US 2 Scenario 1: show success message after reservation is created
            ? `Reservation request for "${locationState.reservationCreated}" was submitted successfully!`
            : ''
    )

    // Reset paging whenever the tab changes, including when Navbar links
    // update the URL directly. Adjusting state during render (instead of in
    // an effect) avoids the extra cascading re-render the lint rule flags.
    const [prevTab, setPrevTab] = useState(activeTab)
    if (prevTab !== activeTab) {
        setPrevTab(activeTab)
        setOffset(0)
    }

    // Everything that identifies the current tool query. While the last
    // finished query differs from this one, we're loading — so the loading
    // flag is derived and never needs to be set synchronously in an effect.
    const queryKey = [activeTab, offset, search, typeFilter, conditionFilter].join('|')
    const [loadedQueryKey, setLoadedQueryKey] = useState<string | null>(null)
    const toolsLoading = activeTab !== 'transactions' && loadedQueryKey !== queryKey

    // Load the user profile once
    useEffect(() => {
        const token = localStorage.getItem('access_token')
        if (!token) {
            navigate('/login')
            return
        }

        const loadUserProfile = async () => {
            try {
                const data = await fetchCurrentUser()
                setUser(data)
            } catch (err: unknown) {
                setProfileError(err instanceof Error ? err.message : 'Failed to load dashboard data.')
                localStorage.removeItem('access_token')
            } finally {
                setProfileLoading(false)
            }
        }
        loadUserProfile()
    }, [navigate])

    // Load filter dropdown options once
    useEffect(() => {
        const loadLookups = async () => {
            try {
                const [types, conds] = await Promise.all([fetchToolTypes(), fetchToolConditions()])
                setToolTypes(types)
                setConditions(conds)
            } catch {
                // Filters are non-critical; the lists still load without them.
            }
        }
        loadLookups()
    }, [])

    // Load tools whenever the tab, filters, or page change.
    // The cancelled flag ignores responses from stale requests so a slow
    // response for an old tab/filter can't overwrite newer results.
    useEffect(() => {
        if (activeTab === 'transactions') return

        let cancelled = false
        const loadTools = async () => {
            try {
                const results = await fetchTools({
                    isMine: activeTab === 'my-tools',
                    limit: PAGE_SIZE,
                    offset,
                    search: search || undefined,
                    toolType: typeFilter || undefined,
                    toolCondition: conditionFilter || undefined,
                })
                if (cancelled) return
                setTools(results)
                setHasMore(results.length === PAGE_SIZE)
                setToolsError('')
            } catch (err) {
                if (cancelled) return
                setToolsError(err instanceof Error ? err.message : 'Failed to load tools.')
            } finally {
                // Mark this query as finished — this is what turns off the
                // derived toolsLoading flag.
                if (!cancelled) setLoadedQueryKey(queryKey)
            }
        }
        loadTools()

        return () => {
            cancelled = true
        }
    }, [activeTab, offset, search, typeFilter, conditionFilter, queryKey])

    // Switch tab via the tab buttons (Navbar links update the URL directly;
    // the render-time adjustment above resets paging for both paths).
    const switchTab = (tab: Tab) => {
        if (tab === 'my-tools') {
            setSearchParams({}) // default tab needs no query param
        } else {
            setSearchParams({ tab })
        }
    }

    const applySearch = (e: React.FormEvent) => {
        e.preventDefault()
        setOffset(0)
        setSearch(searchInput.trim())
    }

    const tabButtonClass = (tab: Tab) =>
        `px-4 py-2 text-xs sm:text-sm font-semibold rounded-t transition-colors duration-150 cursor-pointer ${
            activeTab === tab
                ? 'bg-black/25 text-[#e8a838] border-b-2 border-[#e8a838]'
                : 'text-gray-400 hover:text-white'
        }`

    return (
        <div className="min-h-screen text-white bg-[#1a1f26]">
            {/* Pass the profile down so Navbar doesn't re-fetch /api/users/me */}
            <Navbar user={user} />

            <main className="max-w-7xl mx-auto p-6">
                {profileLoading && (
                    <p className="text-center text-gray-400 mt-10">Loading your space...</p>
                )}

                {profileError && (
                    <div className="text-center mt-10">
                        <p className="text-red-400 mb-4">{profileError}</p>
                        <button
                            onClick={() => navigate('/login')}
                            className="px-4 py-2 bg-[#e8a838] text-white rounded font-semibold text-sm"
                        >
                            Go to Login
                        </button>
                    </div>
                )}

                {!profileLoading && !profileError && user && (
                    <div className="mt-4">
                        {/* Header */}
                        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                            <div>
                                <h1 className="text-2xl font-bold mb-1">
                                    Welcome back, {user.user_first_name}!
                                </h1>
                                <p className="text-sm text-gray-400">
                                    Logged in as <span className="text-[#e8a838]">{user.user_email}</span>
                                </p>
                            </div>
                        </div>

                        {/* Success banner — shown after publishing a tool OR after creating a reservation */}
                        {successBanner && (
                            <div
                                role="alert"
                                aria-live="polite"
                                className="flex items-center justify-between mb-6 px-4 py-3 bg-green-400/10 border border-green-400/30 rounded text-green-400 text-sm"
                            >
                                <span>✓ {successBanner}</span>
                                <button
                                    onClick={() => setSuccessBanner('')}
                                    className="text-green-400/70 hover:text-green-400 ml-4 cursor-pointer"
                                    aria-label="Dismiss"
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        {/* Tabs */}
                        <div className="flex gap-1 border-b border-white/10 mb-6">
                            <button className={tabButtonClass('my-tools')} onClick={() => switchTab('my-tools')}>
                                Your Tool Shed
                            </button>
                            <button className={tabButtonClass('neighborhood')} onClick={() => switchTab('neighborhood')}>
                                Browse Neighborhood
                            </button>
                            <button className={tabButtonClass('transactions')} onClick={() => switchTab('transactions')}>
                                Transactions
                            </button>
                        </div>

                        {/* UPDATED BY MARITZA — 07/19/2026
                            Transactions tab now uses the real Transactions component
                            covering US 3, 4, 5, 7, 9, 10 instead of the placeholder */}
                        {activeTab === 'transactions' && <Transactions />}

                        {/* Tool lists — My Tool Shed and Browse Neighborhood tabs */}
                        {activeTab !== 'transactions' && (
                            <>
                                {/* Filter bar */}
                                <form onSubmit={applySearch} className="flex flex-wrap gap-3 mb-6">
                                    <input
                                        className="flex-1 min-w-48 px-3 py-2 bg-black/25 border border-white/10 rounded text-sm placeholder-[#8f8f8f] focus:outline-none focus:ring-2 focus:ring-[#e8a838]"
                                        placeholder="Search title or description..."
                                        value={searchInput}
                                        onChange={e => setSearchInput(e.target.value)}
                                    />
                                    <select
                                        className="px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e8a838]"
                                        value={typeFilter}
                                        onChange={e => { setTypeFilter(e.target.value); setOffset(0) }}
                                    >
                                        <option value="">All categories</option>
                                        {toolTypes.map(t => (
                                            <option key={t.id} value={t.code}>{t.display_name}</option>
                                        ))}
                                    </select>
                                    <select
                                        className="px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e8a838]"
                                        value={conditionFilter}
                                        onChange={e => { setConditionFilter(e.target.value); setOffset(0) }}
                                    >
                                        <option value="">Any condition</option>
                                        {conditions.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-black/25 border border-[#e8a838] text-[#e8a838] rounded text-sm font-semibold hover:bg-[#e8a838] hover:text-white transition-colors cursor-pointer"
                                    >
                                        Search
                                    </button>
                                </form>

                                {toolsLoading && (
                                    <p className="text-center text-gray-400 py-10">Loading tools...</p>
                                )}

                                {!toolsLoading && toolsError && (
                                    <p role="alert" className="text-center text-red-400 py-10">{toolsError}</p>
                                )}

                                {/* Empty states */}
                                {!toolsLoading && !toolsError && tools.length === 0 && (
                                    <div className="p-10 bg-black/15 border border-white/5 rounded-lg text-center">
                                        {activeTab === 'my-tools' ? (
                                            <>
                                                <span className="block text-3xl mb-3">🔧</span>
                                                <h2 className="text-lg font-semibold text-[#e8a838] mb-2">Your Tool Shed is empty</h2>
                                                <p className="text-xs text-gray-400 mb-4">
                                                    {search || typeFilter || conditionFilter
                                                        ? 'No tools match your filters.'
                                                        : "You haven't listed any tools yet. Share your first tool with the neighborhood!"}
                                                </p>
                                                {!search && !typeFilter && !conditionFilter && (
                                                    <button
                                                        onClick={() => navigate('/tools/new')}
                                                        className="px-6 py-2 bg-[#e8a838] hover:bg-[#d6962f] text-white rounded font-bold text-sm transition-colors cursor-pointer"
                                                    >
                                                        + Add Your First Tool
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <span className="block text-3xl mb-3">🏘️</span>
                                                <h2 className="text-lg font-semibold text-[#e8a838] mb-2">No tools found</h2>
                                                <p className="text-xs text-gray-400">
                                                    {search || typeFilter || conditionFilter
                                                        ? 'No neighborhood tools match your filters.'
                                                        : 'No neighbors have shared tools yet. Be the first — or invite more neighbors!'}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Tool grid */}
                                {!toolsLoading && !toolsError && tools.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {tools.map(tool => (
                                            <ToolCard
                                                key={tool.tool_id}
                                                tool={tool}
                                                showOwner={activeTab === 'neighborhood'}
                                                showStatus={activeTab === 'my-tools'}
                                                // Pass user data to ToolDetail page
                                                onClick={id => navigate(`/tools/${id}`, { state: { user } })}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Pagination */}
                                {!toolsLoading && !toolsError && (offset > 0 || hasMore) && (
                                    <div className="flex justify-center items-center gap-4 mt-8">
                                        <button
                                            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                                            disabled={offset === 0}
                                            className="px-4 py-2 text-xs font-semibold border border-white/10 rounded text-gray-300 hover:border-[#e8a838] hover:text-[#e8a838] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                            ← Previous
                                        </button>
                                        <span className="text-xs text-gray-500">
                                            Page {Math.floor(offset / PAGE_SIZE) + 1}
                                        </span>
                                        <button
                                            onClick={() => setOffset(offset + PAGE_SIZE)}
                                            disabled={!hasMore}
                                            className="px-4 py-2 text-xs font-semibold border border-white/10 rounded text-gray-300 hover:border-[#e8a838] hover:text-[#e8a838] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                            Next →
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </main>
        </div>
    )
}
