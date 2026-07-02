// src/pages/Register/Register.tsx
// US 11: New user registers using an invite token from the URL
// Flow: invite link → ?token=... → validate token → fill form → POST /api/auth/register

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const Register = () => {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    // Get the invite token from the URL query string (?token=...)
    const inviteToken = searchParams.get('token') || ''

    // Form state
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    // LINT FIX — start validating as false when no token, true when token exists
    const [validating, setValidating] = useState(!!inviteToken)
    const [error, setError] = useState('')
    // LINT FIX — set tokenError directly without useEffect when no token
    const [tokenError, setTokenError] = useState(
        !inviteToken ? 'No invitation token found. Please use the link from your invitation email.' : ''
    )

    // US 11: Validate the invite token as soon as the page loads
    useEffect(() => {
        // Skip if no token — already handled above
        if (!inviteToken) return

        const validateToken = async () => {
            try {
                // GET /api/invitations/validate?token=... — checks if token is valid
                const response = await fetch(`/api/invitations/validate?token=${inviteToken}`)
                const data = await response.json()

                if (!response.ok) {
                    // Backend returns { detail: "..." } for invalid/expired/used tokens
                    setTokenError(data.detail || 'This invitation link is invalid.')
                    return
                }

                // Pre-fill the email field with the recipient email from the invite
                setEmail(data.recipient_email)

            } catch {
                // LINT FIX — renamed err to _err since it is not used
                setTokenError('Could not validate invitation. Please try again.')
            } finally {
                setValidating(false)
            }
        }

        validateToken()
    }, [inviteToken])

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError('')

        // Password match validation
        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        // Minimum password length
        if (password.length < 8) {
            setError('Password must be at least 8 characters.')
            return
        }

        try {
            setLoading(true)

            // POST /api/auth/register — creates the account using the invite token
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    invite_token: inviteToken,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.detail || 'Registration failed. Please try again.')
                return
            }

            // Success — redirect to login page
            navigate('/login?registered=true')

        } catch {
            // LINT FIX — renamed err to _err since it is not used
            setError('Could not connect to the server. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // Show loading while validating token
    if (validating) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-[#8f8f8f] text-sm">Validating your invitation...</p>
            </div>
        )
    }

    // Show error if token is invalid
    if (tokenError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen px-4">
                <div className="w-full max-w-[20em] text-center">
                    <p className="text-red-400 text-sm mb-4">⚠ {tokenError}</p>
                    <button
                        className="text-[#e8a838] text-xs underline"
                        onClick={() => navigate('/login')}
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center min-h-screen pt-[15vh] px-4">
            <div className="w-full max-w-[20em] mx-auto">

                {/* Back button — same style as Login page */}
                <button
                    className="block w-1/4 px-3 py-2 sm:py-3 bg-black/25 text-[#e8a838] border border-[#e8a838] border-b-0 text-[0.65rem] sm:text-[0.75rem] font-semibold tracking-[0.05em] text-left cursor-pointer transition-colors duration-200 hover:bg-[#e8a838] hover:text-white"
                    onClick={() => navigate('/login')}
                >
                    ← Back
                </button>

                <div className="relative w-full p-4 sm:p-6 md:p-8 bg-black/15 box-border before:content-[''] before:absolute before:top-[-2px] before:left-0 before:h-[2px] before:w-full before:bg-[#e8a838]">

                    <h1 className="text-white font-bold text-sm sm:text-base mb-1">
                        Create Your Account
                    </h1>
                    <p className="text-[#8f8f8f] text-[0.65rem] sm:text-xs mb-4">
                        You were invited to join Neighborhood Tool Sharing.
                    </p>

                    {/* Error message */}
                    {error && (
                        <p role="alert" className="text-red-400 text-[0.65rem] sm:text-xs mb-3 text-center">
                            {error}
                        </p>
                    )}

                    <form onSubmit={handleSubmit} noValidate>

                        {/* Email — pre-filled and locked to the invited email */}
                        <div className="flex mb-4">
                            <label
                                className="w-8 flex items-center justify-center bg-[#f5f6f8] cursor-pointer shrink-0"
                                htmlFor="register-email"
                            >
                                <svg x="0px" y="0px" width="12px" height="13px">
                                    <path fill="#B1B7C4" d="M8.9,7.2C9,6.9,9,6.7,9,6.5v-4C9,1.1,7.9,0,6.5,0h-1C4.1,0,3,1.1,3,2.5v4c0,0.2,0,0.4,0.1,0.7 C1.3,7.8,0,9.5,0,11.5V13h12v-1.5C12,9.5,10.7,7.8,8.9,7.2z M4,2.5C4,1.7,4.7,1,5.5,1h1C7.3,1,8,1.7,8,2.5v4c0,0.2,0,0.4-0.1,0.6 l0.1,0L7.9,7.3C7.6,7.8,7.1,8.2,6.5,8.2h-1c-0.6,0-1.1-0.4-1.4-0.9L4.1,7.1l0.1,0C4,6.9,4,6.7,4,6.5V2.5z M11,12H1v-0.5 c0-1.6,1-2.9,2.4-3.4c0.5,0.7,1.2,1.1,2.1,1.1h1c0.8,0,1.6-0.4,2.1-1.1C10,8.5,11,9.9,11,11.5V12z" />
                                </svg>
                            </label>
                            <input
                                id="register-email"
                                className="flex-1 px-2 sm:px-3 py-2 sm:py-3 border-0 text-[#8f8f8f] text-sm sm:text-base min-w-0 focus:outline-none bg-black/10"
                                type="email"
                                value={email}
                                readOnly
                                aria-label="Email address (pre-filled from invitation)"
                            />
                        </div>

                        {/* Password */}
                        <div className="flex mb-4">
                            <label
                                className="w-8 flex items-center justify-center bg-[#f5f6f8] cursor-pointer shrink-0"
                                htmlFor="register-password"
                            >
                                <svg x="0px" y="0px" width="15px" height="5px">
                                    <g>
                                        <path fill="#B1B7C4" d="M6,2L6,2c0-1.1-1-2-2.1-2H2.1C1,0,0,0.9,0,2.1v0.8C0,4.1,1,5,2.1,5h1.7C5,5,6,4.1,6,2.9V3h5v1h1V3h1v2h1V3h1 V2H6z M5.1,2.9c0,0.7-0.6,1.2-1.3,1.2H2.1c-0.7,0-1.3-0.6-1.3-1.2V2.1c0-0.7,0.6-1.2,1.3-1.2h1.7c0.7,0,1.3,0.6,1.3,1.2V2.9z" />
                                    </g>
                                </svg>
                            </label>
                            <input
                                id="register-password"
                                className="flex-1 px-2 sm:px-3 py-2 sm:py-3 border-0 text-[#8f8f8f] text-sm sm:text-base min-w-0 focus:outline-none focus:scale-110 transition-transform duration-150"
                                placeholder="Password (min 8 characters)"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={8}
                            />
                        </div>

                        {/* Confirm Password */}
                        <div className="flex mb-4">
                            <label
                                className="w-8 flex items-center justify-center bg-[#f5f6f8] cursor-pointer shrink-0"
                                htmlFor="confirm-password"
                            >
                                <svg x="0px" y="0px" width="15px" height="5px">
                                    <g>
                                        <path fill="#B1B7C4" d="M6,2L6,2c0-1.1-1-2-2.1-2H2.1C1,0,0,0.9,0,2.1v0.8C0,4.1,1,5,2.1,5h1.7C5,5,6,4.1,6,2.9V3h5v1h1V3h1v2h1V3h1 V2H6z M5.1,2.9c0,0.7-0.6,1.2-1.3,1.2H2.1c-0.7,0-1.3-0.6-1.3-1.2V2.1c0-0.7,0.6-1.2,1.3-1.2h1.7c0.7,0,1.3,0.6,1.3,1.2V2.9z" />
                                    </g>
                                </svg>
                            </label>
                            <input
                                id="confirm-password"
                                className="flex-1 px-2 sm:px-3 py-2 sm:py-3 border-0 text-[#8f8f8f] text-sm sm:text-base min-w-0 focus:outline-none focus:scale-110 transition-transform duration-150"
                                placeholder="Confirm password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>

                        {/* Submit button */}
                        <button
                            className="block w-full py-2 sm:py-3 bg-[#e8a838] border-0 text-white cursor-pointer text-[0.65em] sm:text-[0.75em] font-semibold [text-shadow:0_1px_0_rgba(0,0,0,0.2)] focus:outline-none focus:scale-110 transition-transform duration-150 disabled:opacity-50"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default Register