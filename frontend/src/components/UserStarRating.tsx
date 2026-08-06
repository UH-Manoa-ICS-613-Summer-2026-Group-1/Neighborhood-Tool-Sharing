import { useState, useEffect } from 'react'
import { fetchUserReviews } from '../api/review'

// size refer to font size, small or medium
interface UserStarRatingProps {
    userId: string
    showCount?: boolean
    size?: 'sm' | 'md'
}

export default function UserStarRating({
    userId,
    showCount = true,
    size = 'sm',
}: UserStarRatingProps) {
    const [avgRating, setAvgRating] = useState<number | null>(null)
    const [reviewCount, setReviewCount] = useState<number>(0)
    const [loading, setLoading] = useState<boolean>(true)

    useEffect(() => {
        if (!userId) return

        let cancelled = false

        const loadUserReviews = async () => {
            setLoading(true)
            try {
                const reviews = await fetchUserReviews(userId)
                if (cancelled) return

                if (reviews.length === 0) {
                    setAvgRating(null)
                    setReviewCount(0)
                } else {
                    const total = reviews.reduce((sum, r) => sum + r.rating, 0)
                    setAvgRating(total / reviews.length)
                    setReviewCount(reviews.length)
                }
            } catch {
                // Silently handle
                if (cancelled) return
                setAvgRating(null)
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        loadUserReviews()

        return () => {
            cancelled = true
        }
    }, [userId])

    if (loading) {
        return <span className="text-xs text-gray-500 animate-pulse">Loading rating...</span>
    }

    if (avgRating === null) {
        return <span className="text-xs text-gray-400 font-normal">No reviews yet</span>
    }

    const starSizeClass = size === 'sm' ? 'text-xs' : 'text-base'

    return (
        <div className="inline-flex items-center gap-1">
            {/* Render 5 Stars */}
            <div className={`flex text-[#e8a838] ${starSizeClass}`}>
                {[1, 2, 3, 4, 5].map(star => {
                    const isFilled = star <= Math.round(avgRating)
                    return (
                        <span key={star} aria-hidden="true">
                            {isFilled ? '★' : '☆'}
                        </span>
                    )
                })}
            </div>

            {/* Numerical Score & Count */}
            <span className="text-xs text-gray-300 font-medium ml-0.5">
                {avgRating.toFixed(1)}
            </span>

            {showCount && (
                <span className="text-[10px] text-gray-400">
                    ({reviewCount})
                </span>
            )}
        </div>
    )
}