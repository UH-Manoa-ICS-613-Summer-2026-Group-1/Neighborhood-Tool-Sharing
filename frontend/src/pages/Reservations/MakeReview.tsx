// src/pages/Reservations/MakeReview.tsx
// Review a completed (RETURNED) reservation.

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import Navbar from '../../components/Navbar'
import { fetchReservationById, type ReservationDetails } from '../../api/reservations'
import { fetchCurrentUser } from '../../api/users'
import {
    fetchReservationReviews,
    createReview,
    type ReviewDetails,
} from '../../api/review'

// ---------------------------------------------------------------------------
// Read-only star row, filled stars up to `value`, hollow stars after.
// ---------------------------------------------------------------------------
function StarDisplay({ value }: { value: number }) {
    return (
        <div className="flex gap-0.5" aria-label={`${value} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map(n => (
                <span
                    key={n}
                    aria-hidden="true"
                    className={`text-lg leading-none ${n <= value ? 'text-[#e8a838]' : 'text-white/20'}`}
                >
                    ★
                </span>
            ))}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Interactive star picker
// ---------------------------------------------------------------------------
function StarPicker({
    value,
    onChange,
}: {
    value: number
    onChange: (v: number) => void
}) {
    const [hover, setHover] = useState(0)
    const shown = hover || value

    return (
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map(n => (
                <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={value === n}
                    aria-label={`${n} star${n === 1 ? '' : 's'}`}
                    onClick={() => onChange(n)}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    className={`text-3xl leading-none transition-colors cursor-pointer ${
                        n <= shown ? 'text-[#e8a838]' : 'text-white/25 hover:text-white/50'
                    }`}
                >
                    ★
                </button>
            ))}
        </div>
    )
}

const fullName = (first: string, middle: string | null, last: string) =>
    [first, middle, last].filter(Boolean).join(' ')

export default function MakeReview() {
    const navigate = useNavigate()
    const { reservationId } = useParams<{ reservationId: string }>()

    const [reservation, setReservation] = useState<ReservationDetails | null>(null)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [reviews, setReviews] = useState<ReviewDetails[]>([])

    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')

    // Form state
    const [rating, setRating] = useState(0)
    const [comment, setComment] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [formError, setFormError] = useState('')
    const [justSubmitted, setJustSubmitted] = useState(false)

    // Load reservation, current user, and any existing reviews.
    useEffect(() => {
        if (!reservationId) return

        const load = async () => {
            setLoading(true)
            try {
                const [reservationData, userData, reviewsData] = await Promise.all([
                    fetchReservationById(reservationId),
                    fetchCurrentUser(),
                    fetchReservationReviews(reservationId),
                ])
                setReservation(reservationData)
                setCurrentUserId(userData.user_id)
                setReviews(reviewsData)
            } catch (err: unknown) {
                setLoadError(err instanceof Error ? err.message : 'Failed to load this reservation.')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [reservationId])

    // Who am I on this reservation, and who am I reviewing?
    const isOwner = !!reservation && reservation.owner_id === currentUserId
    const isBorrower = !!reservation && reservation.borrower_id === currentUserId
    const isParty = isOwner || isBorrower
    const isReturned = reservation?.reservation_status === 'RETURNED'

    // Name of the OTHER party
    const otherPartyName = reservation
        ? isOwner
            ? fullName(reservation.borrower_first_name, reservation.borrower_middle_name, reservation.borrower_last_name)
            : fullName(reservation.owner_first_name, reservation.owner_middle_name, reservation.owner_last_name)
        : ''

    // My review (the one I wrote) and the other party's review (about me).
    const myReview = reviews.find(r => r.reviewer_id === currentUserId) ?? null
    const otherReview = reviews.find(r => r.reviewer_id !== currentUserId) ?? null

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setFormError('')

        if (rating < 1 || rating > 5) {
            setFormError('Please select a star rating from 1 to 5.')
            return
        }

        try {
            setSubmitting(true)
            const created = await createReview(reservationId!, {
                rating,
                comment: comment.trim() || null,
            })
            // Add my new review to the list so the read-only view renders.
            setReviews(prev => [...prev.filter(r => r.reviewer_id !== currentUserId), created])
            setJustSubmitted(true)
        } catch (err: unknown) {
            setFormError(err instanceof Error ? err.message : 'Failed to submit review.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen text-white bg-[#1a1f26]">
            <Navbar />

            <main className="max-w-xl mx-auto p-6">

                {/* Back link to the Transactions tab */}
                <button
                    className="text-[#e8a838] text-xs font-semibold mb-4 cursor-pointer hover:underline"
                    onClick={() => navigate('/dashboard?tab=transactions')}
                    type="button"
                >
                    &larr; Back to transactions
                </button>

                {loading && (
                    <p className="text-center text-gray-400 mt-10">Loading reservation...</p>
                )}

                {!loading && loadError && (
                    <p role="alert" className="text-center text-red-400 mt-10">{loadError}</p>
                )}

                {!loading && !loadError && reservation && (
                    <>
                        {/* Reservation summary */}
                        <div className="mb-6 p-4 bg-black/20 border border-white/10 rounded-lg">
                            <p className="text-[0.6rem] uppercase tracking-widest text-[#e8a838] mb-1">
                                {reservation.tool_type_name}
                            </p>
                            <h1 className="text-xl font-bold mb-1">{reservation.tool_title}</h1>
                            {isParty && (
                                <p className="text-xs text-gray-400">
                                    {isOwner ? 'Borrowed by' : 'Owned by'} {otherPartyName}
                                </p>
                            )}
                        </div>

                        {/* Guard: not a party to this reservation */}
                        {!isParty && (
                            <div className="p-6 bg-black/20 border border-white/10 rounded-lg text-center">
                                <p className="text-sm text-gray-300">
                                    You can only review reservations you took part in.
                                </p>
                            </div>
                        )}

                        {/* Guard: reservation not yet completed */}
                        {isParty && !isReturned && (
                            <div className="p-6 bg-black/20 border border-white/10 rounded-lg text-center">
                                <span className="block text-3xl mb-3">⏳</span>
                                <p className="text-sm text-gray-300 mb-1">This reservation isn&apos;t done yet.</p>
                                <p className="text-xs text-gray-400">
                                    Reviews can be left once the tool has been returned.
                                </p>
                            </div>
                        )}

                        {/* Main review area */}
                        {isParty && isReturned && (
                            <div className="flex flex-col gap-6">

                                {/* YOUR REVIEW */}
                                <div className="p-6 bg-black/20 border border-white/10 rounded-lg">
                                    <h2 className="text-lg font-bold mb-1">
                                        Your review of {otherPartyName}
                                    </h2>

                                    {/* Already reviewed goes to read-only */}
                                    {myReview ? (
                                        <>
                                            {justSubmitted && (
                                                <p
                                                    role="status"
                                                    className="mb-4 px-3 py-2 bg-green-400/10 border border-green-400/30 rounded text-green-300 text-xs"
                                                >
                                                    Thank you. Your review was submitted.
                                                </p>
                                            )}
                                            <div className="mt-2 mb-2">
                                                <StarDisplay value={myReview.rating} />
                                            </div>
                                            {myReview.comment ? (
                                                <p className="text-sm text-gray-200 whitespace-pre-wrap">
                                                    {myReview.comment}
                                                </p>
                                            ) : (
                                                <p className="text-xs text-gray-500 italic">No written comment.</p>
                                            )}
                                            <p className="text-[0.65rem] text-gray-500 mt-3">
                                                A review can only be submitted once.
                                            </p>
                                        </>
                                    ) : (
                                        /* Not reviewed yet goes to the form */
                                        <>
                                            <p className="text-xs text-gray-400 mb-5">
                                                Rate your experience and leave an optional note. This will be
                                                visible to {otherPartyName}.
                                            </p>

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
                                                <div className="mb-5">
                                                    <label className="block text-xs font-semibold text-gray-300 mb-2">
                                                        Rating
                                                    </label>
                                                    <StarPicker value={rating} onChange={setRating} />
                                                </div>

                                                <div className="mb-6">
                                                    <label
                                                        htmlFor="review-comment"
                                                        className="block text-xs font-semibold text-gray-300 mb-1"
                                                    >
                                                        Comment <span className="text-gray-500 font-normal">(optional)</span>
                                                    </label>
                                                    <textarea
                                                        id="review-comment"
                                                        value={comment}
                                                        onChange={e => setComment(e.target.value)}
                                                        rows={4}
                                                        maxLength={1000}
                                                        placeholder="How did it go? Was the tool as described? Was the handoff smooth?"
                                                        className="w-full px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-white placeholder-[#8f8f8f] focus:outline-none focus:ring-2 focus:ring-[#e8a838] resize-y"
                                                    />
                                                    <p className="text-[0.65rem] text-gray-500 mt-1 text-right">
                                                        {comment.length}/1000
                                                    </p>
                                                </div>

                                                <div className="flex gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate('/dashboard?tab=transactions')}
                                                        className="flex-1 py-2 border border-white/20 text-gray-400 text-sm font-semibold rounded hover:border-white/40 hover:text-white transition-colors cursor-pointer"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        disabled={submitting}
                                                        className="flex-1 py-2 bg-[#e8a838] hover:bg-[#d6962f] text-white text-sm font-bold rounded transition-colors disabled:opacity-50 cursor-pointer"
                                                    >
                                                        {submitting ? 'Submitting...' : 'Submit Review'}
                                                    </button>
                                                </div>
                                            </form>
                                        </>
                                    )}
                                </div>

                                {/* THE OTHER PARTY'S REVIEW OF YOU */}
                                <div className="p-6 bg-black/20 border border-white/10 rounded-lg">
                                    <h2 className="text-lg font-bold mb-3">
                                        {otherPartyName}&apos;s review of you
                                    </h2>
                                    {otherReview ? (
                                        <>
                                            <div className="mb-2">
                                                <StarDisplay value={otherReview.rating} />
                                            </div>
                                            {otherReview.comment ? (
                                                <p className="text-sm text-gray-200 whitespace-pre-wrap">
                                                    {otherReview.comment}
                                                </p>
                                            ) : (
                                                <p className="text-xs text-gray-500 italic">No written comment.</p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-xs text-gray-400">
                                            {otherPartyName} hasn&apos;t left a review yet.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    )
}