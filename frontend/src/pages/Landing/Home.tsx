import { useNavigate } from 'react-router-dom'

const Home = () => {
    const navigate = useNavigate()

    return (
        <main className="flex flex-col items-center justify-center min-h-screen gap-6 md:gap-8 px-4 py-6 text-center text-white box-border">
            <div className="w-full max-w-[700px]">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-wide leading-tight">
                    Neighborhood Tool Sharing
                </h1>
            </div>

            <div className="flex flex-wrap justify-center gap-3 md:gap-5 w-full max-w-[800px]">
                {[
                    { icon: '🔧', title: 'List Your Tools', desc: 'Share your tools with photos, condition notes, and lending rules.' },
                    { icon: '📅', title: 'Reserve with Ease', desc: 'Browse available tools and request a reservation for your time window.' },
                    { icon: '🏘️', title: 'Invite Only', desc: 'A trusted, private community. Join only with a valid invite from a neighbor.' },
                ].map(({ icon, title, desc }) => (
                    <div key={title} className="flex-[1_1_200px] max-w-[240px] sm:max-w-full bg-black/20 border border-white/10 rounded p-4 md:p-6">
                        <span className="block text-2xl md:text-3xl mb-3">{icon}</span>
                        <h3 className="text-xs sm:text-sm font-semibold text-[#e8a838] mb-2">{title}</h3>
                        <p className="text-[0.65rem] sm:text-xs text-white/65 leading-relaxed">{desc}</p>
                    </div>
                ))}
            </div>

            <div className="flex justify-center w-full">
                <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="px-10 py-3 bg-[#e8a838] hover:bg-[#c98a20] text-white font-bold text-xs sm:text-sm tracking-widest rounded cursor-pointer transition-colors duration-200 [text-shadow:0_1px_0_rgba(0,0,0,0.2)] w-full max-w-[320px] sm:w-auto"
                >
                    Sign In
                </button>
            </div>
        </main>
    )
}

export default Home