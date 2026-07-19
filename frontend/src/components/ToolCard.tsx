// Card used in the Dashboard grids
import type { ToolDetails } from '../api/tools'
 
// Small colored badges for tool condition and status
const conditionColors: Record<string, string> = {
    NEW: 'bg-green-500/20 text-green-300 border-green-500/40',
    GOOD: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    FAIR: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    POOR: 'bg-red-500/20 text-red-300 border-red-500/40',
}
 
const statusColors: Record<string, string> = {
    AVAILABLE: 'bg-green-500/20 text-green-300 border-green-500/40',
    HIDDEN: 'bg-gray-500/20 text-gray-300 border-gray-500/40',
    SUSPENDED: 'bg-red-500/20 text-red-300 border-red-500/40',
}
 
interface ToolCardProps {
    tool: ToolDetails
    // Show owner name when browsing other people's tools
    showOwner?: boolean
    // Show status badge on the user's own listings (hidden/suspended matter to the owner)
    showStatus?: boolean
    onClick?: (toolId: string) => void
}
 
export default function ToolCard({ tool, showOwner = false, showStatus = false, onClick }: ToolCardProps) {
    const cover = tool.tool_photos?.[0]?.url
 
    return (
        <button
            type="button"
            onClick={() => onClick?.(tool.tool_id)}
            className="text-left w-full bg-black/20 border border-white/10 rounded-lg overflow-hidden hover:border-[#e8a838]/60 focus:outline-none focus:ring-2 focus:ring-[#e8a838] transition-colors duration-150 cursor-pointer"
        >
            {/* Cover photo */}
            <div className="h-36 w-full bg-black/30 flex items-center justify-center overflow-hidden">
                {cover ? (
                    <img src={cover} alt={tool.tool_title} className="h-full w-full object-cover" />
                ) : (
                    <span className="text-3xl">🔧</span>
                )}
            </div>
 
            <div className="p-4">
                {/* Category eyebrow */}
                <p className="text-[0.6rem] uppercase tracking-widest text-[#e8a838] mb-1">
                    {tool.tool_type_name}
                </p>
 
                <h3 className="text-sm font-semibold text-white mb-1 truncate">
                    {tool.tool_title}
                </h3>
 
                <p className="text-xs text-gray-400 line-clamp-2 mb-3">
                    {tool.tool_description}
                </p>
 
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2">
                    <span
                        className={`text-[0.6rem] px-2 py-0.5 rounded border ${
                            conditionColors[tool.tool_condition] || 'bg-gray-500/20 text-gray-300 border-gray-500/40'
                        }`}
                    >
                        {tool.tool_condition}
                    </span>
 
                    {showStatus && (
                        <span
                            className={`text-[0.6rem] px-2 py-0.5 rounded border ${
                                statusColors[tool.tool_status] || 'bg-gray-500/20 text-gray-300 border-gray-500/40'
                            }`}
                        >
                            {tool.tool_status}
                        </span>
                    )}
 
                    <span className="text-[0.6rem] text-gray-500 ml-auto">
                        up to {tool.tool_loan_duration_limit} day{tool.tool_loan_duration_limit === 1 ? '' : 's'}
                    </span>
                </div>
 
                {showOwner && (
                    <p className="text-[0.65rem] text-gray-500 mt-2">
                        Shared by {tool.owner_first_name} {tool.owner_last_name}
                    </p>
                )}
            </div>
        </button>
    )
}