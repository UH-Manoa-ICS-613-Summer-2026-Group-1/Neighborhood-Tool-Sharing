// src/components/NotificationBell.tsx
// Bell icon for the navbar with an unread-count badge and a dropdown panel
// of recent notifications.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { BellIcon } from '@heroicons/react/24/outline'
import {
    fetchNotifications,
    fetchUnreadCount,
    markAllNotificationsRead,
    type NotificationItem,
} from '../api/notifications'

// How often to re-check the unread count while the app is open (ms).
const POLL_INTERVAL = 30_000

// Relative "time ago" label, e.g. "3m", "2h", "5d".
function timeAgo(iso: string): string {
    const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
}

export default function NotificationBell() {
    const [items, setItems] = useState<NotificationItem[]>([])
    const [unread, setUnread] = useState(0)
    const [loading, setLoading] = useState(false)

    // Keep a ref so the interval callback always reads the latest value.
    const loadCount = useCallback(async () => {
        try {
            setUnread(await fetchUnreadCount())
        } catch {
            // Non-fatal, leave the badge as-is.
        }
    }, [])

    // Poll the unread count on mount and on an interval.
    useEffect(() => {
        const id = window.setInterval(loadCount, POLL_INTERVAL)
        const first = window.setTimeout(loadCount, 0)   // initial load, off the effect body
        return () => {
            window.clearInterval(id)
            window.clearTimeout(first)
        }
    }, [loadCount])

    // Load the list of recent notifications when the panel opens.
    const loadList = useCallback(async () => {
        setLoading(true)
        try {
            setItems(await fetchNotifications(15))
        } catch {
            setItems([])
        } finally {
            setLoading(false)
        }
    }, [])

    const handleMarkAll = async () => {
        setItems(prev => prev.map(i => ({ ...i, is_read: true })))
        setUnread(0)
        try {
            await markAllNotificationsRead()
        } catch {
            // If it fails, refresh the true count.
            loadCount()
        }
    }

    const badge = unread > 9 ? '9+' : String(unread)

    return (
        <Popover className="relative">
            {({ open }) => {
                // Load the list the first time the panel opens.
                return (
                    <BellPopoverInner
                        open={open}
                        onOpen={loadList}
                        badge={badge}
                        unread={unread}
                        items={items}
                        loading={loading}
                        timeAgo={timeAgo}
                        onMarkAll={handleMarkAll}
                    />
                )
            }}
        </Popover>
    )
}

// Split out so we can trigger loadList exactly when `open` flips to true.
interface InnerProps {
    open: boolean
    onOpen: () => void
    badge: string
    unread: number
    items: NotificationItem[]
    loading: boolean
    timeAgo: (iso: string) => string
    onMarkAll: () => void
}

function BellPopoverInner({
    open, onOpen, badge, unread, items, loading, timeAgo, onMarkAll,
}: InnerProps) {
    const wasOpen = useRef(false)
    useEffect(() => {
        if (open && !wasOpen.current) onOpen()
        wasOpen.current = open
    }, [open, onOpen])

    return (
        <>
            <PopoverButton className="relative flex items-center justify-center rounded-full p-1 text-gray-300 hover:text-white hover:bg-white/5 focus:outline-2 focus:-outline-offset-1 focus:outline-indigo-500 cursor-pointer">
                <span className="sr-only">View notifications</span>
                <BellIcon className="size-6" aria-hidden="true" />
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex min-w-4 h-4 items-center justify-center rounded-full bg-[#e8a838] px-1 text-[0.6rem] font-bold text-white">
                        {badge}
                    </span>
                )}
            </PopoverButton>

            <PopoverPanel
                transition
                className="absolute right-0 z-20 mt-2 w-80 origin-top-right rounded-md bg-white shadow-lg outline outline-black/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
            >
                {() => (
                    <div className="max-h-96 flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                            <p className="text-sm font-semibold text-gray-900">Notifications</p>
                            {unread > 0 && (
                                <button
                                    onClick={onMarkAll}
                                    className="text-xs font-semibold text-[#e8a838] hover:underline cursor-pointer"
                                >
                                    Mark all read
                                </button>
                            )}
                        </div>

                        {/* List */}
                        <div className="overflow-y-auto">
                            {loading && (
                                <p className="px-4 py-6 text-center text-xs text-gray-400">Loading…</p>
                            )}

                            {!loading && items.length === 0 && (
                                <p className="px-4 py-8 text-center text-xs text-gray-400">
                                    You&apos;re all caught up.
                                </p>
                            )}

                            {!loading && items.map(n => (
                                <div
                                    key={n.id}
                                    className={[
                                        'block w-full px-4 py-3 border-b border-gray-50',
                                        n.is_read ? 'bg-white' : 'bg-[#e8a838]/5',
                                    ].join(' ')}
                                >
                                    <div className="flex items-start gap-2">
                                        {!n.is_read && (
                                            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#e8a838]" />
                                        )}
                                        <div className={n.is_read ? 'pl-4' : ''}>
                                            <p className="text-xs font-semibold text-gray-900">{n.title}</p>
                                            <p className="text-xs text-gray-500 line-clamp-2">{n.content}</p>
                                            <p className="mt-0.5 text-[0.65rem] text-gray-400">{timeAgo(n.created_at)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </PopoverPanel>
        </>
    )
}