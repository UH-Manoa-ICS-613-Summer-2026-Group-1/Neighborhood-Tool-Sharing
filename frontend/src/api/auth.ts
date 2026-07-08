// Shape of the response returned by the login endpoint.
export interface LoginResponse {
    access_token: string
    token_type: string
}

// Shape of the response returned by the register endpoint.
export interface RegisterResponse {
    message?: string
}

interface RegisterPayload {
    email: string
    password: string
    inviteToken: string
}

// service
// Sends email/password to the backend and returns the access token on success.
// Throws an Error with the backend's message (or a fallback) on failure.
export const loginUser = async (email: string, password: string): Promise<LoginResponse> => {
    const response = await fetch(`/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.detail || 'Login failed.')
    return data
}

// Logs the current user out on the backend using the stored bearer token.
export const logoutUser = async (): Promise<void> => {
    const token = localStorage.getItem('access_token')
    const response = await fetch(`/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.detail || 'Logout failed.')
}

// Creates an account using an invite token. Throws an Error with the
// backend's message (or a fallback) on failure.
export const registerUser = async ({ email, password, inviteToken }: RegisterPayload): Promise<RegisterResponse> => {
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
    if (!response.ok) throw new Error(data.detail || 'Registration failed. Please try again.')
    return data
}