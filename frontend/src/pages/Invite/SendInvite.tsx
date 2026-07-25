// src/pages/Invite/SendInvite.tsx
// US 12: Logged-in member sends an invitation to a new user

import { useState } from 'react'
import { useNavigate } from 'react-router'
import { sendInvite } from '../../api/invitations'

const SendInvite = () => {
    const navigate = useNavigate()

    // Form state
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.SyntheticEvent) => {
        e.preventDefault()
        setError('')
        setSuccess('')

        // Basic email validation before calling the API
        if (!email || !email.includes('@')) {
            setError('Please enter a valid email address.')
            return
        }

        try {
            setLoading(true)
            const data = await sendInvite(email)

            // Success — show confirmation and clear the form
            setSuccess(data.message)
            setEmail('')

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not connect to the server. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col items-center min-h-screen pt-[15vh] px-4">
            <div className="w-full max-w-[20em] mx-auto">

                {/* Back button — same style as Login page */}
                <button
                    className="block w-1/4 px-3 py-2 sm:py-3 bg-black/25 text-[#e8a838] border border-[#e8a838] border-b-0 text-[0.65rem] sm:text-[0.75rem] font-semibold tracking-[0.05em] text-left cursor-pointer transition-colors duration-200 hover:bg-[#e8a838] hover:text-white"
                    onClick={() => navigate('/dashboard')}
                >
                    ← Back
                </button>

                <div className="relative w-full p-4 sm:p-6 md:p-8 bg-black/15 box-border before:content-[''] before:absolute before:top-[-2px] before:left-0 before:h-[2px] before:w-full before:bg-[#e8a838]">

                    <h1 className="text-white font-bold text-sm sm:text-base mb-1">
                        Invite a Neighbor
                    </h1>
                    <p className="text-[#8f8f8f] text-[0.65rem] sm:text-xs mb-4">
                        Send an invitation link to someone you trust. The link expires in 7 days.
                    </p>

                    {/* Success message */}
                    {success && (
                        <div role="alert" className="text-green-400 text-[0.65rem] sm:text-xs mb-3 text-center border border-green-400/30 bg-green-400/10 rounded px-3 py-2">
                            ✓ {success}
                        </div>
                    )}

                    {/* Error message */}
                    {error && (
                        <p role="alert" className="text-red-400 text-[0.65rem] sm:text-xs mb-3 text-center">
                            {error}
                        </p>
                    )}

                    <form onSubmit={handleSubmit} noValidate>
                        {/* Email input */}
                        <div className="flex mb-4">
                            <label
                                className="w-8 flex items-center justify-center bg-[#f5f6f8] cursor-pointer shrink-0"
                                htmlFor="recipient-email"
                            >
                                <svg x="0px" y="0px" width="12px" height="13px">
                                    <path fill="#B1B7C4" d="M8.9,7.2C9,6.9,9,6.7,9,6.5v-4C9,1.1,7.9,0,6.5,0h-1C4.1,0,3,1.1,3,2.5v4c0,0.2,0,0.4,0.1,0.7 C1.3,7.8,0,9.5,0,11.5V13h12v-1.5C12,9.5,10.7,7.8,8.9,7.2z M4,2.5C4,1.7,4.7,1,5.5,1h1C7.3,1,8,1.7,8,2.5v4c0,0.2,0,0.4-0.1,0.6 l0.1,0L7.9,7.3C7.6,7.8,7.1,8.2,6.5,8.2h-1c-0.6,0-1.1-0.4-1.4-0.9L4.1,7.1l0.1,0C4,6.9,4,6.7,4,6.5V2.5z M11,12H1v-0.5 c0-1.6,1-2.9,2.4-3.4c0.5,0.7,1.2,1.1,2.1,1.1h1c0.8,0,1.6-0.4,2.1-1.1C10,8.5,11,9.9,11,11.5V12z" />
                                </svg>
                            </label>
                            <input
                                id="recipient-email"
                                className="flex-1 px-2 sm:px-3 py-2 sm:py-3 border-0 text-[#8f8f8f] text-sm sm:text-base min-w-0 focus:outline-none focus:ring-2 focus:ring-[#e8a838] transition-colors duration-150"
                                placeholder="neighbor@example.com"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                aria-required="true"
                            />
                        </div>

                        {/* Submit button */}
                        <button
                            className="block w-full py-2 sm:py-3 bg-[#e8a838] border-0 text-white cursor-pointer text-[0.65em] sm:text-[0.75em] font-semibold [text-shadow:0_1px_0_rgba(0,0,0,0.2)] focus:outline-none focus:ring-2 focus:ring-[#e8a838] transition-colors duration-150"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? 'SENDING...' : 'SEND INVITE'}
                        </button>
                    </form>

                    {/* Note about email */}
                    <p className="text-[#8f8f8f] text-[0.55rem] sm:text-[0.65rem] text-center mt-4">
                        The invite link will appear in the server console until email is set up.
                    </p>
                </div>
            </div>
        </div>
    )
}

export default SendInvite