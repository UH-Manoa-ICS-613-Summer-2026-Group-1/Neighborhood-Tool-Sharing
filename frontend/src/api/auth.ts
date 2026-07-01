//types
export interface LoginResponse {
    access_token: string
    token_type: string
}

// service
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


export const logoutUser = async (): Promise<void> => {
    const token = localStorage.getItem('access_token')
    const response = await fetch(`/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.detail || 'Logout failed.')
}