// src/pages/Tools/ToolDetail.tsx
// Shows full details for a single tool — photos, description, pickup/return notes
// Includes the Request Reservation button (US 2) which navigates to /tools/:toolId/reserve

import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router'
import Navbar from '../../components/Navbar'
import { hideTool, unhideTool, deleteTool, fetchToolById, type ToolDetails } from '../../api/tools'
import { fetchCurrentUser, type UserProfile } from '../../api/users'

const STORAGE_BASE_URL = import.meta.env.VITE_STORAGE_EXTERNAL_ENDPOINT || "http://localhost:9000";
const STORAGE_BUCKET_NAME = import.meta.env.VITE_STORAGE_BUCKET_NAME || "community-tool-share-media";
const PLACEHOLDER_IMAGE = `${STORAGE_BASE_URL}/${STORAGE_BUCKET_NAME}/placeholders/default-placeholder-image.png`;

export default function ToolDetail() {
    const navigate = useNavigate()
    const { toolId } = useParams<{ toolId: string }>()
    const location = useLocation()

    // Extract user from router state if available
    const initialUser = (location.state as { user?: UserProfile } | null)?.user ?? null

    const [isHiding, setIsHiding] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [user, setUser] = useState<UserProfile | null>(initialUser)
    const [tool, setTool] = useState<ToolDetails | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Which photo is currently shown large in the gallery
    const [activePhoto, setActivePhoto] = useState(0)

    // Load the tool details when the page mounts
    useEffect(() => {
        if (!toolId) return
        const loadTool = async () => {
            try {
                const data = await fetchToolById(toolId)
                setTool(data)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load tool details.')
            } finally {
                setLoading(false)
            }
        }
        loadTool()
    }, [toolId])

    // Fetch user profile if it wasn't passed via router state (if refresh page or direct url)
    useEffect(() => {
        if (user) return

        const loadUser = async () => {
            try {
                const userData = await fetchCurrentUser()
                setUser(userData)
            } catch (err){
                setError(err instanceof Error ? err.message : 'Failed to load profile data.')
                localStorage.removeItem('access_token')
            }
        }
        loadUser()
    }, [user])

    const handleToggleHide = async () => {
        if (!tool) return
        setIsHiding(true)
        try {
            const updatedTool = tool.tool_status === 'HIDDEN' 
            ? await unhideTool(tool.tool_id)
            : await hideTool(tool.tool_id) 
            setTool({ ...tool, tool_status: updatedTool.status })
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to update tool status.')
        } finally {
            setIsHiding(false)
        }
    }

    const handleDelete = async () => {
        if (!toolId) return
        if (!confirm('Are you sure you want to delete this tool? This action cannot be undone.')) return
        setIsDeleting(true)
        try {
            await deleteTool(toolId)
            // If the tool was successfully deleted, navigate to the dashboard
            navigate('/dashboard')
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete tool.')
            setIsDeleting(false)
        }
    }

    const photos = tool?.tool_photos ?? []

    // Check if the tool is owned by the current user
    const isOwner = tool?.owner_id === user?.user_id


    return (
        <div className="min-h-screen text-white bg-[#1a1f26]">
            {/* Pass user data to the navbar */}
            <Navbar user={user}/>

            <main className="max-w-4xl mx-auto p-6">
                <button
                    className="text-[#e8a838] text-xs font-semibold mb-4 cursor-pointer hover:underline"
                    onClick={() => navigate('/dashboard')}
                    type="button"
                >
                    ← Back to dashboard
                </button>

                {/* Loading state */}
                {loading && <p className="text-center text-gray-400 mt-10">Loading tool...</p>}

                {/* Error state */}
                {error && (
                    <p role="alert" className="text-center text-red-400 mt-10">{error}</p>
                )}

                {/* Main content */}
                {!loading && !error && tool && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Photo gallery */}
                        <div>
                            {/* Main large photo */}
                            <div className="h-72 bg-black/30 rounded-lg overflow-hidden flex items-center justify-center mb-3 border border-white/10">
                                {photos[activePhoto] ? (
                                    <img
                                        src={photos[activePhoto].url}
                                        alt={`${tool.tool_title} — photo ${activePhoto + 1}`}
                                        className="h-full w-full object-cover"
                                        onError={(e) => { 
                                            e.currentTarget.onerror = null;
                                            e.currentTarget.src = PLACEHOLDER_IMAGE;
                                        }}
                                    />
                                ) : (
                                    <span className="text-4xl">🔧</span>
                                )}
                            </div>

                            {/* Thumbnail strip — only shown when there are multiple photos */}
                            {photos.length > 1 && (
                                <div className="flex gap-2 flex-wrap">
                                    {photos.map((photo, idx) => (
                                        <button
                                            key={photo.id}
                                            type="button"
                                            onClick={() => setActivePhoto(idx)}
                                            aria-label={`Show photo ${idx + 1}`}
                                            className={`w-16 h-16 rounded overflow-hidden border-2 cursor-pointer ${
                                                idx === activePhoto ? 'border-[#e8a838]' : 'border-transparent opacity-70 hover:opacity-100'
                                            }`}
                                        >
                                            <img src={photo.url} 
                                                alt="" 
                                                className="h-full w-full object-cover" 
                                                onError={(e) => { 
                                                    e.currentTarget.onerror = null;
                                                    e.currentTarget.src = PLACEHOLDER_IMAGE; 
                                                }}/>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Tool details */}
                        <div>
                            {/* Category */}
                            <p className="text-[0.6rem] uppercase tracking-widest text-[#e8a838] mb-1">
                                {tool.tool_type_name}
                            </p>

                            {/* Title and owner */}
                            <h1 className="text-2xl font-bold mb-2">{tool.tool_title}</h1>
                            <p className="text-xs text-gray-400 mb-4">
                                Shared by {tool.owner_first_name} {tool.owner_last_name}
                            </p>

                            {/* Status,Condition and loan duration badges */}
                            <div className="flex gap-2 mb-4">
                                <span className="text-[0.65rem] px-2 py-1 rounded border border-white/20 text-gray-300">
                                    Condition: {tool.tool_condition}
                                </span>
                                <span className="text-[0.65rem] px-2 py-1 rounded border border-white/20 text-gray-300">
                                    Loan up to {tool.tool_loan_duration_limit} day{tool.tool_loan_duration_limit === 1 ? '' : 's'}
                                </span>
                                <span className="text-[0.65rem] px-2 py-1 rounded border border-white/20 text-gray-300">
                                    Status: {tool.tool_status}
                                </span>
                            </div>

                            {/* Description */}
                            <p className="text-sm text-gray-300 whitespace-pre-wrap mb-6">
                                {tool.tool_description}
                            </p>

                            {/* Pickup notes — only shown if the owner provided them */}
                            {tool.tool_pickup_notes && (
                                <div className="mb-4">
                                    <h3 className="text-xs font-semibold text-[#e8a838] mb-1">Pickup notes</h3>
                                    <p className="text-xs text-gray-400 whitespace-pre-wrap">{tool.tool_pickup_notes}</p>
                                </div>
                            )}

                            {/* Return notes — only shown if the owner provided them */}
                            {tool.tool_return_notes && (
                                <div className="mb-4">
                                    <h3 className="text-xs font-semibold text-[#e8a838] mb-1">Return notes</h3>
                                    <p className="text-xs text-gray-400 whitespace-pre-wrap">{tool.tool_return_notes}</p>
                                </div>
                            )}

                            {/* UPDATED BY MARITZA — 07/19/2026
                                US 2: Request Reservation button now navigates to the reservation form
                                Previously this button was disabled with a "not available yet" comment
                                Now it routes to /tools/:toolId/reserve (added to App.tsx) */}

                            {/* If the user is the owner of the tool, disable the button */}
                            {isOwner ? (
                                <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={handleToggleHide}
                                            disabled={isHiding || isDeleting}
                                            className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            {isHiding 
                                                ? 'Updating...' 
                                                : tool.tool_status === 'HIDDEN' 
                                                    ? 'Unhide Listing' 
                                                    : 'Hide Listing'}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleDelete}
                                            disabled={isHiding || isDeleting}
                                            className="py-2.5 px-4 bg-red-900/40 hover:bg-red-800/60 text-red-300 border border-red-500/30 rounded font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            {isDeleting ? 'Deleting...' : 'Delete'}
                                        </button>
                                    </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => navigate(`/tools/${toolId}/reserve`)}
                                    className="w-full py-3 mt-2 bg-[#e8a838] hover:bg-[#d6962f] text-white rounded font-bold text-sm transition-colors cursor-pointer"
                                >
                                    Request Reservation
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
