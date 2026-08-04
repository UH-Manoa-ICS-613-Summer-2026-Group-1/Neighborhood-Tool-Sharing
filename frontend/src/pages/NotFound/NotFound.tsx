import { useNavigate } from 'react-router'
import Navbar from '../../components/Navbar'

export default function NotFound() {

  const navigate = useNavigate()

  return (
    <div className="min-h-screen text-white bg-[#1a1f26]">
      <Navbar />

      <main className="max-w-md mx-auto p-6 text-center mt-20">
        <h1 className="text-6xl font-bold text-[#e8a838] mb-2">404</h1>
        <h2 className="text-xl font-semibold mb-3">Page Not Found</h2>
        <p className="text-xs text-gray-400 mb-6">
          The page or resource you are looking for does not exist or may have been removed.
        </p>

        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="px-5 py-2.5 bg-[#e8a838] hover:bg-[#d6962f] text-white rounded font-bold text-xs transition-colors cursor-pointer"
        >
          Return to Dashboard
        </button>
      </main>
    </div>
  )
}