// Shape of the response returned by the current-user endpoint.
export interface UserProfile {
    user_id: string
    user_first_name: string
    user_last_name: string
    user_middle_name?: string | null
    user_email: string
    user_bio?: string | null
    user_location?: string | null
    user_created_at: string
    user_photo_url?: string | null
    role_code: string
    role_name: string
    role_description?: string | null
    status_code: string
    status_name: string
    status_description?: string | null
}

export interface UpdateProfilePayload {
    first_name?: string
    last_name?: string
    middle_name?: string | null
    bio?: string | null
    location?: string | null
    photo_url?: string | null
}

 
const authHeaders = (): HeadersInit => {
    const token = localStorage.getItem('access_token')
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    }
}
 
// Extracts a readable message from either a plain-string detail (400/401)
// or a Pydantic validation array (422).
const extractDetail = (data: { detail?: unknown }, fallback: string): string => {
    if (Array.isArray(data.detail)) {
        const first = data.detail[0] as { msg?: string } | undefined
        return first?.msg || fallback
    }
    return typeof data.detail === 'string' ? data.detail : fallback
}
 
// service
// Fetches the current user's profile using the stored bearer token.
export const fetchCurrentUser = async (): Promise<UserProfile> => {
    const response = await fetch('/api/users/me', {
        method: 'GET',
        headers: authHeaders(),
    })
 
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Session expired or invalid token'))
    return data
}
 
export const updateUserProfile = async (payload: UpdateProfilePayload): Promise<UserProfile> => {
    const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(payload),
    })
 
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to update profile.'))
    return data
}
 
// PATCH /api/users/me/change-password
export const changePassword = async (
    currentPassword: string,
    newPassword: string
): Promise<{ message: string }> => {
    const response = await fetch('/api/users/me/change-password', {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
        }),
    })
 
    const data = await response.json()
    if (!response.ok) throw new Error(extractDetail(data, 'Failed to change password.'))
    return data
}