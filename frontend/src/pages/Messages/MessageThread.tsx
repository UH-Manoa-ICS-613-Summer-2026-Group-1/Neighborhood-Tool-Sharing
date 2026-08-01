// src/pages/Messages/MessageThread.tsx
// Private message thread for a single reservation.


import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import Navbar from '../../components/Navbar'
import { fetchCurrentUser } from '../../api/users'
import { fetchReservationById, type ReservationDetails } from '../../api/reservations'
import { fetchMessages, sendMessage, type ChatMessage } from '../../api/messages'

// Poll for new messages while the thread is open (ms).
const POLL_INTERVAL = 10_000
const MAX_LEN = 2000

export default function MessageThread() {
    const { reservationId } = useParams<{ reservationId: string }>()
    const navigate = useNavigate()

    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [reservation, setReservation] = useState<ReservationDetails | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [draft, setDraft] = useState('')

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [sending, setSending] = useState(false)
    const [sendError, setSendError] = useState('')

    const bottomRef = useRef<HTMLDivElement | null>(null)

    // Initial load: current user, reservation, and messages together.
    useEffect(() => {
        if (!reservationId) return
        let cancelled = false

        const load = async () => {
            setLoading(true)
            setError('')
            try {
                const [user, res, msgs] = await Promise.all([
                    fetchCurrentUser(),
                    fetchReservationById(reservationId),
                    fetchMessages(reservationId),
                ])
                if (cancelled) return
                setCurrentUserId(user.user_id)
                setReservation(res)
                setMessages(msgs)
            } catch (err: unknown) {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load conversation.')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [reservationId])

    // Poll for new messages.
    useEffect(() => {
        if (!reservationId || error) return
        const id = window.setInterval(async () => {
            try {
                const msgs = await fetchMessages(reservationId)
                setMessages(msgs)
            } catch {
                // Ignore transient polling errors.
            }
        }, POLL_INTERVAL)
        return () => window.clearInterval(id)
    }, [reservationId, error])

    // Auto-scroll to the newest message.
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Name of the other participant, for the header.
    const otherName = (() => {
        if (!reservation || !currentUserId) return ''
        const isOwner = reservation.owner_id === currentUserId
        return isOwner
            ? `${reservation.borrower_first_name} ${reservation.borrower_last_name}`
            : `${reservation.owner_first_name} ${reservation.owner_last_name}`
    })()

    const handleSend = async () => {
        const content = draft.trim()
        if (!content || !reservationId) return
        setSending(true)
        setSendError('')
        try {
            const sent = await sendMessage(reservationId, { content })
            setMessages(prev => [...prev, sent])
            setDraft('')
        } catch (err: unknown) {
            setSendError(err instanceof Error ? err.message : 'Failed to send message.')
        } finally {
            setSending(false)
        }
    }

    // Enter sends, Shift+Enter makes a newline.
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const formatTime = (iso: string) =>
        new Date(iso).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        })

    return (
        <>
            <Navbar />
            <div className="mx-auto max-w-2xl px-4 py-6">

                {/* Back link */}
                <button
                    onClick={() => navigate('/dashboard?tab=transactions')}
                    className="mb-4 text-xs font-semibold text-gray-400 hover:text-[#e8a838] transition-colors cursor-pointer"
                >
                    ← Back to transactions
                </button>

                {/* Header */}
                <div className="mb-4 rounded-lg border border-white/10 bg-black/20 p-4">
                    {reservation ? (
                        <>
                            <h1 className="text-sm font-bold text-white">{reservation.tool_title}</h1>
                            <p className="mt-0.5 text-xs text-gray-400">
                                Conversation with {otherName || '…'}
                            </p>
                        </>
                    ) : (
                        <h1 className="text-sm font-bold text-white">Conversation</h1>
                    )}
                </div>

                {error && (
                    <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                        {error}
                    </p>
                )}

                {!error && (
                    <>
                        {/* History */}
                        <div className="mb-4 flex h-[60vh] flex-col gap-3 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-4">
                            {loading && (
                                <p className="py-10 text-center text-xs text-gray-400">Loading conversation…</p>
                            )}

                            {!loading && messages.length === 0 && (
                                <p className="py-10 text-center text-xs text-gray-400">
                                    No messages yet. Say hello to coordinate pickup or return.
                                </p>
                            )}

                            {!loading && messages.map(m => {
                                const mine = m.sender_id === currentUserId
                                return (
                                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                                        <div
                                            className={[
                                                'max-w-[75%] rounded-lg px-3 py-2',
                                                mine
                                                    ? 'bg-[#e8a838]/20 border border-[#e8a838]/30 text-gray-100'
                                                    : 'bg-white/5 border border-white/10 text-gray-200',
                                            ].join(' ')}
                                        >
                                            <p className="whitespace-pre-wrap break-words text-sm">{m.content}</p>
                                            <p className="mt-1 text-[0.6rem] text-gray-400">{formatTime(m.created_at)}</p>
                                        </div>
                                    </div>
                                )
                            })}
                            <div ref={bottomRef} />
                        </div>

                        {/* Composer */}
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                            {sendError && (
                                <p role="alert" className="mb-2 text-xs text-red-400">{sendError}</p>
                            )}
                            <div className="flex items-end gap-2">
                                <textarea
                                    value={draft}
                                    onChange={e => setDraft(e.target.value.slice(0, MAX_LEN))}
                                    onKeyDown={handleKeyDown}
                                    rows={2}
                                    placeholder="Type a message…"
                                    disabled={loading}
                                    className="flex-1 resize-none rounded border border-white/10 bg-black/25 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#e8a838] disabled:opacity-50"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={sending || loading || draft.trim().length === 0}
                                    className="shrink-0 rounded bg-[#e8a838] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#d6962f] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    {sending ? '…' : 'Send'}
                                </button>
                            </div>
                            <p className="mt-1 text-right text-[0.6rem] text-gray-500">{draft.length}/{MAX_LEN}</p>
                        </div>
                    </>
                )}
            </div>
        </>
    )
}