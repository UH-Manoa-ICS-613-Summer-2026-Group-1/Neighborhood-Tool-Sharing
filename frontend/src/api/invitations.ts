// Shape of the response returned by the invitations endpoint.
export interface SendInviteResponse {
    message: string
}

// Shape of the response returned by the invite validation endpoint.
export interface ValidateInviteResponse {
    recipient_email: string
}

// service
// Sends an invitation to the given email using the stored bearer token.
// Throws an Error with the backend's message (or a fallback) on failure.
export const sendInvite = async (recipientEmail: string): Promise<SendInviteResponse> => {
    const token = localStorage.getItem('access_token')

    const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipient_email: recipientEmail }),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.detail || 'Failed to send invitation.')
    return data
}

// Validates an invite token from a registration link.
// Throws an Error with the backend's message (or a fallback) on failure.
export const validateInviteToken = async (token: string): Promise<ValidateInviteResponse> => {
    const response = await fetch(`/api/invitations/validate?token=${token}`)
    const data = await response.json()
    if (!response.ok) throw new Error(data.detail || 'This invitation link is invalid.')
    return data
}