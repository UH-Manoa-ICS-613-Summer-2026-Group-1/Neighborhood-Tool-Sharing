import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../../components/Navbar'

// UPDATED BY MARITZA — 07/02/2026
// Fixed field names to match actual API response (user_name, user_email instead of name, email)

interface UserProfile {
  user_name: string
  user_email: string
  user_location?: string
  user_bio?: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('access_token')

    if (!token) {
      navigate('/login')
      return
    }

    const fetchUserProfile = async () => {
      try {
        // Calls GET /api/users/me via Vite proxy
        const response = await fetch(`/api/users/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        })

        if (!response.ok) {
          throw new Error('Session expired or invalid token')
        }

        const data = await response.json()
        setUser(data)
      } catch (err: unknown) {
        // LINT FIX — changed err: any to err: unknown
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data.')
        localStorage.removeItem('access_token')
      } finally {
        setLoading(false)
      }
    }

    fetchUserProfile()
  }, [navigate])

  return (
    <div className="min-h-screen text-white bg-[#1a1f26]">
      <Navbar />
      
      <main className="max-w-7xl mx-auto p-6">
        {loading && (
          <p className="text-center text-gray-400 mt-10">Loading your space...</p>
        )}

        {error && (
          <div className="text-center mt-10">
            <p className="text-red-400 mb-4">{error}</p>
            <button 
              onClick={() => navigate('/login')}
              className="px-4 py-2 bg-[#e8a838] text-white rounded font-semibold text-sm"
            >
              Go to Login
            </button>
          </div>
        )}

        {!loading && !error && user && (
          <div className="mt-6">
            {/* FIXED — using user_name and user_email to match API response */}
            <h1 className="text-2xl font-bold mb-2">Welcome back, {user.user_name}!</h1>
            <p className="text-sm text-gray-400">
              Logged in as <span className="text-[#e8a838]">{user.user_email}</span>
            </p>
            
            <div className="mt-8 p-6 bg-black/15 border border-white/5 rounded-lg">
              <h2 className="text-lg font-semibold text-[#e8a838] mb-4">Your Tool Shed</h2>
              <p className="text-xs text-gray-400">You haven't listed any tools yet. Click "Add Tool" above to start sharing!</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}