// src/pages/Calendar/CalendarPage.tsx
// Reservation Calendar — shows all user reservations on a monthly calendar view
//
// User Stories covered:
//   US 26 Scenario 3: Dashboard displays a reminder for upcoming reservations
//                     — this page shows upcoming reservations with a reminder banner
//
// Features:
//   - Monthly calendar grid with colored dots per reservation status
//   - Navigate between months with prev/next arrows
//   - Click a date to see reservations for that day in a detail panel
//   - Today's date highlighted in orange
//   - US 26 Scenario 3: reminder banner for APPROVED reservations starting within 3 days
//   - Clicking a tool name navigates to its detail page
//   - Follows team code style: Tailwind CSS, heroicons, async/await API calls

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import { fetchReservations, type ReservationDetails } from '../../api/reservations'

// ---------------------------------------------------------------------------
// Status color maps — match Transactions.tsx for visual consistency
// ---------------------------------------------------------------------------

// Badge colors used in the detail panel
const statusColors: Record<string, string> = {
    REQUESTED: 'bg-blue-400/80 text-white',
    APPROVED:  'bg-green-400/80 text-white',
    PICKED_UP: 'bg-yellow-400/80 text-black',
    RETURNED:  'bg-purple-400/80 text-white',
    DENIED:    'bg-red-400/80 text-white',
    CANCELED:  'bg-gray-400/80 text-white',
}

// Dot colors used on calendar day cells
const statusDotColors: Record<string, string> = {
    REQUESTED: 'bg-blue-400',
    APPROVED:  'bg-green-400',
    PICKED_UP: 'bg-yellow-400',
    RETURNED:  'bg-purple-400',
    DENIED:    'bg-red-400',
    CANCELED:  'bg-gray-400',
}

// Day and month name arrays for the calendar header
const DAY_NAMES   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Returns true if the reservation's date range overlaps a given calendar date
function reservationOverlapsDate(reservation: ReservationDetails, date: Date): boolean {
    const start = new Date(reservation.reservation_start_date)
    const end   = new Date(reservation.reservation_end_date)
    const check = new Date(date)

    // Normalize to midnight so we compare dates only, not times
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    check.setHours(12, 0, 0, 0)

    return check >= start && check <= end
}

// Returns true if the given date is today
function isToday(date: Date): boolean {
    const today = new Date()
    return (
        date.getDate()     === today.getDate()     &&
        date.getMonth()    === today.getMonth()    &&
        date.getFullYear() === today.getFullYear()
    )
}

// US 26 Scenario 3: returns true if an APPROVED reservation starts within 3 days
function isUpcomingSoon(reservation: ReservationDetails): boolean {
    const start          = new Date(reservation.reservation_start_date)
    const now            = new Date()
    const threeDaysLater = new Date()
    threeDaysLater.setDate(now.getDate() + 3)

    return (
        reservation.reservation_status === 'APPROVED' &&
        start >= now &&
        start <= threeDaysLater
    )
}

// Format an ISO date string to "Jul 20, 2026"
function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
    })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CalendarPage() {
    const navigate = useNavigate()

    // Month currently shown on the calendar
    const today = new Date()
    const [displayYear,  setDisplayYear]  = useState(today.getFullYear())
    const [displayMonth, setDisplayMonth] = useState(today.getMonth())

    // The date the user clicked — drives the detail panel on the right
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)

    // Reservation data
    const [reservations, setReservations] = useState<ReservationDetails[]>([])
    const [loading,      setLoading]      = useState(true)
    const [error,        setError]        = useState('')

    // Load all reservations once on mount
    useEffect(() => {
        const load = async () => {
            try {
                // GET /api/reservations — returns all reservations for the current user
                // (both as borrower and as tool owner)
                const data = await fetchReservations()
                setReservations(data)
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Failed to load reservations.')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    // ---------------------------------------------------------------------------
    // Calendar grid — build an array of date cells for the displayed month
    // ---------------------------------------------------------------------------

    // How many days in the displayed month
    const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate()

    // Which day of the week the 1st falls on (0=Sun … 6=Sat)
    const startDayOfWeek = new Date(displayYear, displayMonth, 1).getDay()

    // Full array of cells: null = empty padding before the 1st
    const calendarDays: (Date | null)[] = [
        ...Array(startDayOfWeek).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) =>
            new Date(displayYear, displayMonth, i + 1)
        ),
    ]

    // Pad to fill the last row
    while (calendarDays.length % 7 !== 0) calendarDays.push(null)

    // ---------------------------------------------------------------------------
    // Month navigation
    // ---------------------------------------------------------------------------
    const goToPrevMonth = () => {
        setSelectedDate(null)
        if (displayMonth === 0) { setDisplayMonth(11); setDisplayYear(y => y - 1) }
        else                    { setDisplayMonth(m => m - 1) }
    }

    const goToNextMonth = () => {
        setSelectedDate(null)
        if (displayMonth === 11) { setDisplayMonth(0); setDisplayYear(y => y + 1) }
        else                     { setDisplayMonth(m => m + 1) }
    }

    // Reservations that overlap a given day
    const reservationsForDate = (date: Date) =>
        reservations.filter(r => reservationOverlapsDate(r, date))

    // Reservations shown in the detail panel (driven by selectedDate)
    const selectedReservations = selectedDate
        ? reservationsForDate(selectedDate)
        : []

    // US 26 Scenario 3: APPROVED reservations starting within 3 days
    const upcomingReminders = reservations.filter(isUpcomingSoon)

    return (
        <div className="min-h-screen text-white bg-[#1a1f26]">
            <Navbar />

            <main className="max-w-4xl mx-auto p-6">

                {/* Page header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold mb-1">Reservation Calendar</h1>
                    <p className="text-xs text-gray-400">
                        Your reservations as borrower and tool owner, shown on a monthly view.
                    </p>
                </div>

                {/* US 26 Scenario 3: Reminder banner for upcoming pickups within 3 days */}
                {upcomingReminders.length > 0 && (
                    <div
                        role="alert"
                        aria-live="polite"
                        className="mb-6 p-4 bg-yellow-400/10 border border-yellow-400/30 rounded-lg"
                    >
                        <p className="text-xs font-bold text-yellow-300 mb-2">
                            Upcoming Pickup Reminders
                        </p>
                        {upcomingReminders.map(r => (
                            <p key={r.reservation_id} className="text-xs text-yellow-200">
                                • {r.tool_title} — pickup starts {formatDate(r.reservation_start_date)}
                            </p>
                        ))}
                    </div>
                )}

                {/* Loading state */}
                {loading && (
                    <p className="text-center text-gray-400 py-10">Loading calendar...</p>
                )}

                {/* Error state */}
                {error && (
                    <p role="alert" className="text-center text-red-400 py-10">{error}</p>
                )}

                {!loading && !error && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* -------------------------------------------------------
                            Left/main panel: calendar grid (2 columns on large screens)
                            ------------------------------------------------------- */}
                        <div className="lg:col-span-2 bg-black/20 border border-white/10 rounded-lg p-4">

                            {/* Month navigation header */}
                            <div className="flex items-center justify-between mb-4">
                                <button
                                    type="button"
                                    onClick={goToPrevMonth}
                                    aria-label="Previous month"
                                    className="p-2 rounded hover:bg-white/10 transition-colors cursor-pointer text-gray-300 hover:text-white"
                                >
                                    ←
                                </button>
                                <h2 className="text-base font-bold">
                                    {MONTH_NAMES[displayMonth]} {displayYear}
                                </h2>
                                <button
                                    type="button"
                                    onClick={goToNextMonth}
                                    aria-label="Next month"
                                    className="p-2 rounded hover:bg-white/10 transition-colors cursor-pointer text-gray-300 hover:text-white"
                                >
                                    →
                                </button>
                            </div>

                            {/* Day-of-week column headers */}
                            <div className="grid grid-cols-7 mb-2">
                                {DAY_NAMES.map(day => (
                                    <div
                                        key={day}
                                        className="text-center text-[0.65rem] font-semibold text-gray-500 uppercase tracking-wider py-1"
                                    >
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar day cells */}
                            <div className="grid grid-cols-7 gap-1">
                                {calendarDays.map((date, idx) => {
                                    // Empty cell — padding before the 1st of the month
                                    if (!date) {
                                        return <div key={`empty-${idx}`} className="h-14" />
                                    }

                                    const dayReservations = reservationsForDate(date)
                                    const isSelected      = selectedDate?.toDateString() === date.toDateString()
                                    const isTodayDate     = isToday(date)

                                    return (
                                        <button
                                            key={date.toISOString()}
                                            type="button"
                                            onClick={() => setSelectedDate(date)}
                                            aria-label={`${date.getDate()} ${MONTH_NAMES[date.getMonth()]}, ${dayReservations.length} reservation${dayReservations.length !== 1 ? 's' : ''}`}
                                            aria-pressed={isSelected}
                                            className={`
                                                h-14 rounded-lg p-1 flex flex-col items-center cursor-pointer transition-colors
                                                ${isSelected
                                                    ? 'bg-[#e8a838]/20 border border-[#e8a838]'
                                                    : 'hover:bg-white/5 border border-transparent'}
                                            `}
                                        >
                                            {/* Date number — orange circle on today */}
                                            <span className={`
                                                text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1
                                                ${isTodayDate ? 'bg-[#e8a838] text-black' : 'text-gray-300'}
                                            `}>
                                                {date.getDate()}
                                            </span>

                                            {/* Status dots — one dot per reservation (max 3 shown) */}
                                            <div className="flex gap-0.5 flex-wrap justify-center">
                                                {dayReservations.slice(0, 3).map(r => (
                                                    <span
                                                        key={r.reservation_id}
                                                        className={`w-1.5 h-1.5 rounded-full ${statusDotColors[r.reservation_status] ?? 'bg-gray-400'}`}
                                                        aria-hidden="true"
                                                    />
                                                ))}
                                                {/* Show overflow count if more than 3 */}
                                                {dayReservations.length > 3 && (
                                                    <span className="text-[0.5rem] text-gray-400">
                                                        +{dayReservations.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Status color legend */}
                            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-white/10">
                                {Object.entries(statusDotColors).map(([status, color]) => (
                                    <div key={status} className="flex items-center gap-1">
                                        <span className={`w-2 h-2 rounded-full ${color}`} aria-hidden="true" />
                                        <span className="text-[0.6rem] text-gray-400 capitalize">
                                            {status.replace('_', ' ').toLowerCase()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* -------------------------------------------------------
                            Right panel: detail view for the selected date
                            ------------------------------------------------------- */}
                        <div className="bg-black/20 border border-white/10 rounded-lg p-4">
                            {selectedDate ? (
                                <>
                                    {/* Selected date heading */}
                                    <h3 className="text-sm font-bold mb-1">
                                        {selectedDate.toLocaleDateString('en-US', {
                                            weekday: 'long', month: 'long', day: 'numeric'
                                        })}
                                    </h3>
                                    <p className="text-xs text-gray-400 mb-4">
                                        {selectedReservations.length} reservation{selectedReservations.length !== 1 ? 's' : ''}
                                    </p>

                                    {/* No reservations on this day */}
                                    {selectedReservations.length === 0 ? (
                                        <p className="text-xs text-gray-500">
                                            No reservations on this day.
                                        </p>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            {selectedReservations.map(r => (
                                                <div
                                                    key={r.reservation_id}
                                                    className="p-3 bg-black/20 border border-white/10 rounded-lg"
                                                >
                                                    {/* Tool name — navigates to tool detail page */}
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/tools/${r.tool_id}`)}
                                                        className="text-xs font-bold text-white hover:text-[#e8a838] transition-colors cursor-pointer text-left w-full mb-1"
                                                    >
                                                        {r.tool_title}
                                                    </button>

                                                    {/* Status badge */}
                                                    <span className={`text-[0.6rem] font-bold px-2 py-0.5 rounded uppercase ${statusColors[r.reservation_status] ?? 'bg-gray-400/80 text-white'}`}>
                                                        {r.reservation_status}
                                                    </span>

                                                    {/* Date range */}
                                                    <p className="text-[0.65rem] text-gray-400 mt-2">
                                                        {formatDate(r.reservation_start_date)} → {formatDate(r.reservation_end_date)}
                                                    </p>

                                                    {/* Owner → Borrower */}
                                                    <p className="text-[0.65rem] text-gray-500 mt-1">
                                                        {r.owner_first_name} {r.owner_last_name} → {r.borrower_first_name} {r.borrower_last_name}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                /* Prompt shown when no date is selected yet */
                                <div className="text-center py-8">
                                    <span className="block text-3xl mb-3" aria-hidden="true">📅</span>
                                    <p className="text-xs text-gray-400">
                                        Click any date to see reservations for that day.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
