import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router'
import Navbar from '../../components/Navbar'
import { uploadPhoto } from '../../api/media'
import { createTool, fetchToolTypes, fetchToolConditions, type ToolType } from '../../api/tools'
 
type LocalPhoto = {
    file: File
    previewUrl: string
}
 
const MAX_PHOTOS = 5
 
export default function AddTool() {
    const navigate = useNavigate()
 
    // Lookup data loaded from the backend
    const [toolTypes, setToolTypes] = useState<ToolType[]>([])
    const [conditions, setConditions] = useState<string[]>([])
    const [lookupsLoading, setLookupsLoading] = useState(true)
 
    // Form state
    const [title, setTitle] = useState('')
    const [toolTypeCode, setToolTypeCode] = useState('')
    const [condition, setCondition] = useState('')
    const [description, setDescription] = useState('')
    const [pickupNotes, setPickupNotes] = useState('')
    const [returnNotes, setReturnNotes] = useState('')
    const [loanDurationLimit, setLoanDurationLimit] = useState(7)
 
    // Photo state
    const [photos, setPhotos] = useState<LocalPhoto[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)
 
    // Submission state
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [status, setStatus] = useState('')
    const [error, setError] = useState('')
 
    // Load tool types and conditions for the dropdowns
    useEffect(() => {
        const loadLookups = async () => {
            try {
                const [types, conds] = await Promise.all([
                    fetchToolTypes(),
                    fetchToolConditions(),
                ])
                setToolTypes(types)
                setConditions(conds)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load form options.')
            } finally {
                setLookupsLoading(false)
            }
        }
        loadLookups()
    }, [])
 
    // Photo handlers
 
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return
 
        const selectedFiles = Array.from(e.target.files)
 
        if (photos.length + selectedFiles.length > MAX_PHOTOS) {
            setError(`You can only select a maximum of ${MAX_PHOTOS} photos.`)
            return
        }
 
        setError('')
        const newLocalPhotos = selectedFiles.map(file => ({
            file,
            previewUrl: URL.createObjectURL(file),
        }))
        setPhotos(prev => [...prev, ...newLocalPhotos])
 
        if (fileInputRef.current) fileInputRef.current.value = ''
    }
 
    const handleDeletePhoto = (indexToRemove: number) => {
        setPhotos(prev => {
            URL.revokeObjectURL(prev[indexToRemove].previewUrl)
            return prev.filter((_, index) => index !== indexToRemove)
        })
    }
 
    const handleMovePhoto = (index: number, direction: 'left' | 'right') => {
        setPhotos(prev => {
            const newPhotos = [...prev]
            if (direction === 'left' && index > 0) {
                [newPhotos[index - 1], newPhotos[index]] = [newPhotos[index], newPhotos[index - 1]]
            } else if (direction === 'right' && index < newPhotos.length - 1) {
                [newPhotos[index + 1], newPhotos[index]] = [newPhotos[index], newPhotos[index + 1]]
            }
            return newPhotos
        })
    }
 
    // Clean up object URLs on unmount
    useEffect(() => {
        return () => {
            photos.forEach(photo => URL.revokeObjectURL(photo.previewUrl))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
 
    // Submit
 
    const handleSubmit = async (e: React.SyntheticEvent) => {
        e.preventDefault()
        setError('')
 
        if (!toolTypeCode) {
            setError('Please choose a tool category.')
            return
        }
        if (title.trim().length < 3 || title.trim().length > 255) {
            setError('Title must be between 3 and 255 characters.')
            return
        }
        if (description.trim().length < 5 || description.trim().length > 2000) {
            setError('Description must be between 5 and 2000 characters.')
            return
        }
        if (!condition) {
            setError('Please choose a condition.')
            return
        }
        if (photos.length < 1) {
            setError('You must include at least one photo.')
            return
        }
        if (loanDurationLimit < 1 || loanDurationLimit > 365) {
            setError('Loan limit must be between 1 and 365 days.')
            return
        }
 
        setIsSubmitting(true)
        setStatus('Uploading photos...')
 
        try {
            // 1. Upload every photo to MinIO, keeping the display order
            const photoUrls: string[] = await Promise.all(
                photos.map(photo => uploadPhoto(photo.file))
            )
 
            // 2. Save the tool itself
            setStatus('Saving tool listing...')
            await createTool({
                tool_type_code: toolTypeCode,
                title: title.trim(),
                description: description.trim(),
                condition,
                photo_urls: photoUrls,
                pickup_notes: pickupNotes.trim() || undefined,
                return_notes: returnNotes.trim() || undefined,
                loan_duration_limit: loanDurationLimit,
            })
 
            // 3. Back to the dashboard, where the new tool will show up
            navigate('/dashboard', { state: { toolCreated: title.trim() } })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to publish the tool.')
            setStatus('')
            setIsSubmitting(false)
        }
    }
 
    return (
        <div className="min-h-screen text-white bg-[#1a1f26]">
            <Navbar />
 
            <main className="max-w-2xl mx-auto p-6">
                <button
                    className="text-[#e8a838] text-xs font-semibold mb-4 cursor-pointer hover:underline"
                    onClick={() => navigate('/dashboard')}
                    type="button"
                >
                    ← Back to dashboard
                </button>
 
                <div className="p-6 bg-black/15 border border-white/5 rounded-lg">
                    <h1 className="text-xl font-bold mb-1">List a New Tool</h1>
                    <p className="text-xs text-gray-400 mb-6">
                        Share a tool with your neighbors. Add photos, describe its condition, and set your lending rules.
                    </p>
 
                    {error && (
                        <p role="alert" className="text-red-400 text-xs mb-4 border border-red-500/30 bg-red-500/10 rounded px-3 py-2">
                            {error}
                        </p>
                    )}
 
                    {lookupsLoading ? (
                        <p className="text-[#8f8f8f] text-sm">Loading form options...</p>
                    ) : (
                        <form onSubmit={handleSubmit} noValidate>
                            {/* Title */}
                            <div className="mb-4">
                                <label className="block text-xs font-semibold text-[#e8a838] mb-1" htmlFor="tool-title">Title</label>
                                <input
                                    id="tool-title"
                                    className="w-full px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-white placeholder-[#8f8f8f] focus:outline-none focus:ring-2 focus:ring-[#e8a838] focus:border-transparent transition-colors duration-150"
                                    placeholder="e.g. DeWalt 20V Cordless Drill"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    maxLength={255}
                                    required
                                />
                            </div>
 
                            {/* Category + condition side by side */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-semibold text-[#e8a838] mb-1" htmlFor="tool-type">Category</label>
                                    <select
                                        id="tool-type"
                                        className="w-full px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-white placeholder-[#8f8f8f] focus:outline-none focus:ring-2 focus:ring-[#e8a838] focus:border-transparent transition-colors duration-150"
                                        value={toolTypeCode}
                                        onChange={e => setToolTypeCode(e.target.value)}
                                        required
                                    >
                                        <option value="" disabled>Choose a category</option>
                                        {toolTypes.map(type => (
                                            <option key={type.id} value={type.code}>
                                                {type.display_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
 
                                <div>
                                    <label className="block text-xs font-semibold text-[#e8a838] mb-1" htmlFor="tool-condition">Condition</label>
                                    <select
                                        id="tool-condition"
                                        className="w-full px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-white placeholder-[#8f8f8f] focus:outline-none focus:ring-2 focus:ring-[#e8a838] focus:border-transparent transition-colors duration-150"
                                        value={condition}
                                        onChange={e => setCondition(e.target.value)}
                                        required
                                    >
                                        <option value="" disabled>Choose a condition</option>
                                        {conditions.map(cond => (
                                            <option key={cond} value={cond}>{cond}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
 
                            {/* Description */}
                            <div className="mb-4">
                                <label className="block text-xs font-semibold text-[#e8a838] mb-1" htmlFor="tool-description">Description</label>
                                <textarea
                                    id="tool-description"
                                    className="w-full px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-white placeholder-[#8f8f8f] focus:outline-none focus:ring-2 focus:ring-[#e8a838] focus:border-transparent transition-colors duration-150 min-h-24 resize-y"
                                    placeholder="Describe the tool, what it's good for, and anything a borrower should know."
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    maxLength={2000}
                                    required
                                />
                                <p className="text-[0.6rem] text-gray-500 mt-1 text-right">{description.length}/2000</p>
                            </div>
 
                            {/* Photos */}
                            <div className="mb-4 p-4 border border-dashed border-gray-600 rounded">
                                <h3 className="mb-3 text-xs font-semibold text-[#e8a838]">
                                    Photos ({photos.length}/{MAX_PHOTOS})
                                    <span className="text-[0.65rem] text-gray-400 font-normal ml-2">
                                        (The first photo will be the cover image)
                                    </span>
                                </h3>
 
                                {photos.length > 0 && (
                                    <div className="flex flex-wrap gap-4 mb-4">
                                        {photos.map((photo, idx) => (
                                            <div key={photo.previewUrl} className="relative flex flex-col items-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeletePhoto(idx)}
                                                    disabled={isSubmitting}
                                                    aria-label={`Remove photo ${idx + 1}`}
                                                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-700 z-10 shadow-lg disabled:opacity-50"
                                                >
                                                    ✕
                                                </button>
 
                                                <img
                                                    src={photo.previewUrl}
                                                    alt={`Preview ${idx + 1}`}
                                                    className="w-24 h-24 object-cover rounded border border-gray-600"
                                                />
 
                                                <div className="flex gap-2 mt-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMovePhoto(idx, 'left')}
                                                        disabled={idx === 0 || isSubmitting}
                                                        aria-label={`Move photo ${idx + 1} left`}
                                                        className="p-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30"
                                                    >
                                                        ←
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMovePhoto(idx, 'right')}
                                                        disabled={idx === photos.length - 1 || isSubmitting}
                                                        aria-label={`Move photo ${idx + 1} right`}
                                                        className="p-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30"
                                                    >
                                                        →
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
 
                                {photos.length < MAX_PHOTOS && (
                                    <input
                                        type="file"
                                        accept="image/jpeg, image/png, image/webp"
                                        multiple
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        disabled={isSubmitting}
                                        className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-gray-700 file:text-white file:cursor-pointer hover:file:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                )}
                            </div>
 
                            {/* Lending rules */}
                            <div className="mb-4">
                                <label className="block text-xs font-semibold text-[#e8a838] mb-1" htmlFor="loan-limit">
                                    Maximum loan duration (days)
                                </label>
                                <input
                                    id="loan-limit"
                                    className="w-full px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-white placeholder-[#8f8f8f] focus:outline-none focus:ring-2 focus:ring-[#e8a838] focus:border-transparent transition-colors duration-150"
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={loanDurationLimit}
                                    onChange={e => setLoanDurationLimit(Number(e.target.value))}
                                    required
                                />
                            </div>
 
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label className="block text-xs font-semibold text-[#e8a838] mb-1" htmlFor="pickup-notes">
                                        Pickup notes <span className="text-gray-500 font-normal">(optional)</span>
                                    </label>
                                    <textarea
                                        id="pickup-notes"
                                        className="w-full px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-white placeholder-[#8f8f8f] focus:outline-none focus:ring-2 focus:ring-[#e8a838] focus:border-transparent transition-colors duration-150 min-h-16 resize-y"
                                        placeholder="e.g. Porch pickup after 5pm"
                                        value={pickupNotes}
                                        onChange={e => setPickupNotes(e.target.value)}
                                        maxLength={2000}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#e8a838] mb-1" htmlFor="return-notes">
                                        Return notes <span className="text-gray-500 font-normal">(optional)</span>
                                    </label>
                                    <textarea
                                        id="return-notes"
                                        className="w-full px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-white placeholder-[#8f8f8f] focus:outline-none focus:ring-2 focus:ring-[#e8a838] focus:border-transparent transition-colors duration-150 min-h-16 resize-y"
                                        placeholder="e.g. Please return with a full charge"
                                        value={returnNotes}
                                        onChange={e => setReturnNotes(e.target.value)}
                                        maxLength={2000}
                                    />
                                </div>
                            </div>
 
                            {status && <p className="text-blue-400 mb-4 text-sm font-medium">{status}</p>}
 
                            <button
                                type="submit"
                                disabled={isSubmitting || photos.length === 0}
                                className="w-full py-3 bg-[#e8a838] hover:bg-[#d6962f] text-white rounded font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed [text-shadow:0_1px_0_rgba(0,0,0,0.2)]"
                            >
                                {isSubmitting ? 'Publishing...' : 'Publish Tool'}
                            </button>
                        </form>
                    )}
                </div>
            </main>
        </div>
    )
}