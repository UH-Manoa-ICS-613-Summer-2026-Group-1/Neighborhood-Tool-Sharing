// src/pages/Admin/ReportsTab.tsx
// "Basic reports" tab for the admin console.
// Pulls the platform-wide metrics from GET /api/admin/statistics/overview
// and renders them as grouped stat cards (Users, Tools, Reservations).

import { useEffect, useState } from 'react'
import { fetchAdminOverview, type AdminOverviewStatistics } from '../../api/admin'

// A single metric tile
function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
    return (
        <div className="p-4 bg-black/25 border border-white/10 rounded-lg">
            <p className={`text-2xl font-bold ${accent ? 'text-[#e8a838]' : 'text-white'}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-1">{label}</p>
        </div>
    )
}

// A labelled group of metric tiles
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="mb-8">
            <h2 className="text-sm font-semibold text-[#e8a838] uppercase tracking-wide mb-3">{title}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{children}</div>
        </div>
    )
}

export default function ReportsTab() {
    const [stats, setStats] = useState<AdminOverviewStatistics | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            setLoading(true)
            try {
                const data = await fetchAdminOverview()
                if (!cancelled) {
                    setStats(data)
                    setError('')
                }
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load statistics.')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [])

    if (loading) {
        return <p className="text-center text-gray-400 py-10">Loading reports...</p>
    }

    if (error) {
        return (
            <p role="alert" className="text-center text-red-400 py-10">
                {error}
            </p>
        )
    }

    if (!stats) {
        return <p className="text-center text-gray-400 py-10">No statistics available.</p>
    }

    return (
        <div>
            <Section title="Users">
                <Stat label="Total users" value={stats.total_users} accent />
                <Stat label="Active" value={stats.active_users} />
                <Stat label="Suspended" value={stats.suspended_users} />
                <Stat label="New this month" value={stats.new_users_this_month} />
            </Section>

            <Section title="Tools">
                <Stat label="Total tools" value={stats.total_tools} accent />
                <Stat label="Available" value={stats.available_tools} />
                <Stat label="Hidden" value={stats.hidden_tools} />
                <Stat label="Suspended" value={stats.suspended_tools} />
                <Stat label="Deleted" value={stats.deleted_tools} />
                <Stat label="New this month" value={stats.new_tools_this_month} />
            </Section>

            <Section title="Reservations">
                <Stat label="Total reservations" value={stats.total_reservations} accent />
                <Stat label="Requested" value={stats.requested_reservations} />
                <Stat label="Approved" value={stats.approved_reservations} />
                <Stat label="Picked up" value={stats.picked_up_reservations} />
                <Stat label="Completed" value={stats.completed_reservations} />
                <Stat label="Denied" value={stats.denied_reservations} />
                <Stat label="Cancelled" value={stats.cancelled_reservations} />
                <Stat label="New this month" value={stats.new_reservations_this_month} />
            </Section>
        </div>
    )
}