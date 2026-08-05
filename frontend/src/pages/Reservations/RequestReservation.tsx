// src/pages/Reservations/RequestReservation.tsx
// US 2: As a borrower, I want to request a reservation to borrow a tool
//       during a specific date range so that I can borrow the tool when I need it.
//
// Scenarios handled in this file:
//   Scenario 2: Invalid date range — end date before start date → validation error
//   Scenario 3: Incomplete request — missing start or end date → validation error
//   Scenario 6: Past dates — start or end date is in the past → validation error
//
// Scenarios handled by the backend (API returns error message):
//   Scenario 1: Valid request — creates reservation with REQUESTED status
//   Scenario 4: Overlaps APPROVED reservation → conflict error from API
//   Scenario 5: Overlaps PICKED_UP reservation → conflict error from API
//
// Flow:
//   Tool Detail page → click "Request Reservation"
//   → /tools/:toolId/reserve
//   → fill in start and end dates
//   → POST /api/reservations
//   → on success: redirect to /dashboard?tab=transactions

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import Navbar from '../../components/Navbar'
import { fetchToolById, fetchToolAvailability, type ToolDetails } from '../../api/tools'
import { createReservation } from '../../api/reservations'

export default function RequestReservation() {
    const navigate = useNavigate()

    // toolId comes from the URL: /tools/:toolId/reserve
    const { toolId } = useParams<{ toolId: string }>()

    // Tool details — loaded on mount so we can show the tool name and enforce loan limit
    const [tool, setTool] = useState<ToolDetails | null>(null)
    const [toolLoading, setToolLoading] = useState(true)
    const [toolError, setToolError] = useState('')

    // Tool not available dates
    const [blockedDates, setBlockedDates] = useState<string[]>([])

    // Form state
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [formError, setFormError] = useState('')

    // Load the tool details when the page mounts
    useEffect(() => {
        if (!toolId) return

        const loadTool = async () => {
            try {
                const data = await fetchToolById(toolId)
                setTool(data)
            } catch (err: unknown) {
                setToolError(err instanceof Error ? err.message : 'Failed to load tool details.')
            } finally {
                setToolLoading(false)
            }
        }
        loadTool()
    }, [toolId])

    // Fetch tool availability
    useEffect(() => {
        if (!toolId) return

        const loadAvailability = async () => {
            try {
                const availabilityData = await fetchToolAvailability(toolId)
                setBlockedDates(availabilityData)
            } catch {
                // Non-fatal, give the user request a tool anyway
            }
        }
        loadAvailability()
    }, [toolId])

    // Conver YYYY-MM-DD to MM/DD/YYYY US format
    const formatToUSDate = (dateStr: string): string => {
        if (!dateStr) return ''
        const [year, month, day] = dateStr.split('-')
        return `${month}/${day}/${year}`
    }

    // Today's date in YYYY-MM-DD format
    // Used as the minimum value on date inputs to prevent past date selection (Scenario 6)
    const today = new Date().toLocaleDateString('en-CA');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setFormError('')

        // US 2 Scenario 3: both dates are required — reject if either is missing
        if (!startDate || !endDate) {
            setFormError('Please select both a start and end date.')
            return
        }

        // US 2 Scenario 2: end date must be after start date
        if (new Date(endDate) < new Date(startDate)) {
            setFormError('End date must be on or after start date.')
            return
        }

        // Enforce the tool owner's loan duration limit
        if (tool?.tool_loan_duration_limit) {
            const days = Math.ceil(
                (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
            )
            if (days > tool.tool_loan_duration_limit) {
                setFormError(
                    `This tool can only be loaned for up to ${tool.tool_loan_duration_limit} day${tool.tool_loan_duration_limit === 1 ? '' : 's'}.`
                )
                return
            }
        }

        try {
            setSubmitting(true)

            // Convert local date strings to ISO datetime strings with timezone
            // Start at 10:00 AM, end at 9:59 AM the following day (matching seed data pattern)
            const startISO = new Date(`${startDate}T00:00:00`).toISOString()
            const endISO = new Date(`${endDate}T23:59:59`).toISOString()

            // POST /api/reservations
            // US 2 Scenario 1: creates reservation with REQUESTED status
            // US 2 Scenarios 4 & 5: backend rejects if dates overlap APPROVED or PICKED_UP reservation
            await createReservation({
                tool_id: toolId!,
                start_date: startISO,
                end_date: endISO,
            })

            // US 2 Scenario 1: on success redirect to Transactions tab
            // Pass the tool title so Dashboard can show a success banner
            navigate('/dashboard?tab=transactions', {
                state: { reservationCreated: tool?.tool_title || 'Tool' },
            })
        } catch (err: unknown) {
            // Shows API error messages for Scenarios 4 & 5 (overlap conflicts)
            setFormError(err instanceof Error ? err.message : 'Failed to submit reservation request.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen text-white bg-[#1a1f26]">
            <Navbar />

            <main className="max-w-xl mx-auto p-6">

                {/* Back link to tool detail page */}
                <button
                    className="text-[#e8a838] text-xs font-semibold mb-4 cursor-pointer hover:underline"
                    onClick={() => navigate(`/tools/${toolId}`)}
                    type="button"
                >
                    &larr; Back to tool
                </button>

                {/* Loading state */}
                {toolLoading && (
                    <p className="text-center text-gray-400 mt-10">Loading tool details...</p>
                )}

                {/* Error state — shown if tool fetch fails */}
                {toolError && (
                    <p role="alert" className="text-center text-red-400 mt-10">{toolError}</p>
                )}

                {/* Main content — only shown when tool is loaded successfully */}
                {!toolLoading && !toolError && tool && (
                    <>
                        {/* Tool summary card — reminds the borrower which tool they are requesting */}
                        <div className="mb-6 p-4 bg-black/20 border border-white/10 rounded-lg">
                            <p className="text-[0.6rem] uppercase tracking-widest text-[#e8a838] mb-1">
                                {tool.tool_type_name}
                            </p>
                            <h1 className="text-xl font-bold mb-1">{tool.tool_title}</h1>
                            <p className="text-xs text-gray-400">
                                Shared by {tool.owner_first_name} {tool.owner_last_name}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                Loan duration: up to {tool.tool_loan_duration_limit} day{tool.tool_loan_duration_limit === 1 ? '' : 's'}
                            </p>
                        </div>

                        {/* Reservation date form */}
                        <div className="p-6 bg-black/20 border border-white/10 rounded-lg">
                            <h2 className="text-lg font-bold mb-1">Request Reservation</h2>
                            <p className="text-xs text-gray-400 mb-6">
                                Select your preferred dates. The owner will approve or deny your request.
                            </p>

                            {/* Blocked dates display section */}
                            <p className="block text-xs font-semibold text-gray-300 mb-1">
                                Reserved Dates (mm/dd/yyyy)
                            </p>
                            <div className="mb-6 p-3 bg-black/30 border border-white/10 rounded-lg">
                                {blockedDates.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {blockedDates.map(date => (
                                            <span
                                                key={date}
                                                className="px-2.5 py-1 bg-[#e8a838]/10 text-[#e8a838] border border-[#e8a838]/30 text-xs rounded font-medium"
                                            >
                                                {formatToUSDate(date)}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-emerald-400 mt-1">
                                        All upcoming dates are currently open
                                    </p>
                                )}
                            </div>

                            {/* Form-level error message — covers Scenarios 2, 3, 4, 5, 6 */}
                            {formError && (
                                <p
                                    role="alert"
                                    aria-live="assertive"
                                    className="mb-4 px-3 py-2 bg-red-400/10 border border-red-400/30 rounded text-red-400 text-xs"
                                >
                                    {formError}
                                </p>
                            )}

                            <form onSubmit={handleSubmit} noValidate>

                                {/* Start date picker */}
                                {/* min={today} prevents past date selection (Scenario 6) */}
                                <div className="mb-4">
                                    <label
                                        htmlFor="start-date"
                                        className="block text-xs font-semibold text-gray-300 mb-1"
                                    >
                                        Start Date
                                    </label>
                                    <input
                                        id="start-date"
                                        type="date"
                                        min={today}
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                        required
                                        aria-required="true"
                                        className="w-full px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#e8a838]"
                                    />
                                </div>

                                {/* End date picker */}
                                {/* min={startDate} prevents end before start (Scenario 2) */}
                                <div className="mb-6">
                                    <label
                                        htmlFor="end-date"
                                        className="block text-xs font-semibold text-gray-300 mb-1"
                                    >
                                        End Date
                                    </label>
                                    <input
                                        id="end-date"
                                        type="date"
                                        min={startDate || today}
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                        required
                                        aria-required="true"
                                        className="w-full px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#e8a838]"
                                    />
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-3">
                                    {/* Cancel — returns to tool detail without submitting */}
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/tools/${toolId}`)}
                                        className="flex-1 py-2 border border-white/20 text-gray-400 text-sm font-semibold rounded hover:border-white/40 hover:text-white transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>

                                    {/* Submit — disabled while API request is in flight */}
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex-1 py-2 bg-[#e8a838] hover:bg-[#d6962f] text-white text-sm font-bold rounded transition-colors disabled:opacity-50 cursor-pointer"
                                    >
                                        {submitting ? 'Submitting...' : 'Submit Request'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </>
                )}
            </main>
        </div>
    )
}
