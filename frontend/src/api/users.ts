// Shape of the response returned by the current-user endpoint.
export interface UserProfile {
    user_name: string
    user_email: string
    user_location?: string
    user_bio?: string
}

// service
// Fetches the current user's profile using the stored bearer token.
// Throws an Error with the backend's message (or a fallback) on failure.
export const fetchCurrentUser = async (): Promise<UserProfile> => {
    const token = localStorage.getItem('access_token')

    const response = await fetch('/api/users/me', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.detail || 'Session expired or invalid token')
    return data
}