import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import { fetchToolById, type ToolDetails } from '../../api/tools'
 
export default function ToolDetail() {
    const navigate = useNavigate()
    const { toolId } = useParams<{ toolId: string }>()
 
    const [tool, setTool] = useState<ToolDetails | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    // Which photo is currently shown large
    const [activePhoto, setActivePhoto] = useState(0)
 
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
 
    const photos = tool?.tool_photos ?? []
 
    return (
        <div className="min-h-screen text-white bg-[#1a1f26]">
            <Navbar />
 
            <main className="max-w-4xl mx-auto p-6">
                <button
                    className="text-[#e8a838] text-xs font-semibold mb-4 cursor-pointer hover:underline"
                    onClick={() => navigate('/dashboard')}
                    type="button"
                >
                    ← Back to dashboard
                </button>
 
                {loading && <p className="text-center text-gray-400 mt-10">Loading tool...</p>}
 
                {error && (
                    <p role="alert" className="text-center text-red-400 mt-10">{error}</p>
                )}
 
                {!loading && !error && tool && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Photo gallery */}
                        <div>
                            <div className="h-72 bg-black/30 rounded-lg overflow-hidden flex items-center justify-center mb-3 border border-white/10">
                                {photos[activePhoto] ? (
                                    <img
                                        src={photos[activePhoto].url}
                                        alt={`${tool.tool_title} — photo ${activePhoto + 1}`}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <span className="text-4xl">🔧</span>
                                )}
                            </div>
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
                                            <img src={photo.url} alt="" className="h-full w-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
 
                        {/* Details */}
                        <div>
                            <p className="text-[0.6rem] uppercase tracking-widest text-[#e8a838] mb-1">
                                {tool.tool_type_name}
                            </p>
                            <h1 className="text-2xl font-bold mb-2">{tool.tool_title}</h1>
                            <p className="text-xs text-gray-400 mb-4">
                                Shared by {tool.owner_first_name} {tool.owner_last_name}
                            </p>
 
                            <div className="flex gap-2 mb-4">
                                <span className="text-[0.65rem] px-2 py-1 rounded border border-white/20 text-gray-300">
                                    Condition: {tool.tool_condition}
                                </span>
                                <span className="text-[0.65rem] px-2 py-1 rounded border border-white/20 text-gray-300">
                                    Loan up to {tool.tool_loan_duration_limit} day{tool.tool_loan_duration_limit === 1 ? '' : 's'}
                                </span>
                            </div>
 
                            <p className="text-sm text-gray-300 whitespace-pre-wrap mb-6">
                                {tool.tool_description}
                            </p>
 
                            {tool.tool_pickup_notes && (
                                <div className="mb-4">
                                    <h3 className="text-xs font-semibold text-[#e8a838] mb-1">Pickup notes</h3>
                                    <p className="text-xs text-gray-400 whitespace-pre-wrap">{tool.tool_pickup_notes}</p>
                                </div>
                            )}
 
                            {tool.tool_return_notes && (
                                <div className="mb-4">
                                    <h3 className="text-xs font-semibold text-[#e8a838] mb-1">Return notes</h3>
                                    <p className="text-xs text-gray-400 whitespace-pre-wrap">{tool.tool_return_notes}</p>
                                </div>
                            )}
 
                            {/* Reservation flow doesn't exist in the backend yet */}
                            <button
                                type="button"
                                disabled
                                title="Reservations"
                                className="w-full py-3 mt-2 bg-[#e8a838]/40 text-white/60 rounded font-bold text-sm cursor-not-allowed"
                            >
                                Request Reservation
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}