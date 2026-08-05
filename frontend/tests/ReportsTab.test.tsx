// tests/ReportsTab.test.tsx
// Verifies the basic-reports tab: loading state, the grouped stat values
// once the overview loads, and the error path.

import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import ReportsTab from '../src/pages/Admin/ReportsTab'
import * as adminApi from '../src/api/admin'
import type { AdminOverviewStatistics } from '../src/api/admin'

const overview: AdminOverviewStatistics = {
    total_users: 100,
    active_users: 90,
    suspended_users: 10,
    new_users_this_month: 7,
    total_tools: 55,
    available_tools: 40,
    hidden_tools: 8,
    suspended_tools: 5,
    deleted_tools: 2,
    new_tools_this_month: 3,
    total_reservations: 200,
    requested_reservations: 20,
    approved_reservations: 30,
    picked_up_reservations: 15,
    completed_reservations: 120,
    denied_reservations: 9,
    cancelled_reservations: 6,
    new_reservations_this_month: 11,
}

describe('ReportsTab', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('shows a loading state before the statistics arrive', () => {
        vi.spyOn(adminApi, 'fetchAdminOverview').mockReturnValue(
            new Promise<AdminOverviewStatistics>(() => {}),
        )

        render(<ReportsTab />)

        expect(screen.getByText(/loading reports/i)).toBeInTheDocument()
    })

    it('renders the grouped stat headline values once loaded', async () => {
        vi.spyOn(adminApi, 'fetchAdminOverview').mockResolvedValue(overview)

        render(<ReportsTab />)

        // Headline totals (unique values, so getByText is unambiguous)
        expect(await screen.findByText('100')).toBeInTheDocument()
        expect(screen.getByText('Total users')).toBeInTheDocument()
        expect(screen.getByText('55')).toBeInTheDocument()
        expect(screen.getByText('Total tools')).toBeInTheDocument()
        expect(screen.getByText('200')).toBeInTheDocument()
        expect(screen.getByText('Total reservations')).toBeInTheDocument()

        // The three section headers are present
        expect(screen.getByText('Users')).toBeInTheDocument()
        expect(screen.getByText('Tools')).toBeInTheDocument()
        expect(screen.getByText('Reservations')).toBeInTheDocument()
    })

    it('shows an error when the statistics fail to load', async () => {
        vi.spyOn(adminApi, 'fetchAdminOverview').mockRejectedValue(
            new Error('Failed to load statistics.'),
        )

        render(<ReportsTab />)

        expect(await screen.findByRole('alert')).toHaveTextContent(/failed to load statistics/i)
    })
})