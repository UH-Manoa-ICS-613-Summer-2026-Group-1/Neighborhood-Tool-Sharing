// Shape of the payload expected by api/media/upload
export interface MediaUploadRequest {
    filename: string
}

// Shape of the response returned by api/media/upload
export interface MediaResponse {
    upload_target: string
    upload_fields: Record<string, string>
    // The permanent URL that will be send to the backend when tool is created or updated; also when user uploads a new profile picture
    url: string 
}

// Fetches the upload ticket using
export const fetchUploadTicket = async (
    filename: string
): Promise<MediaResponse> => {
    const token = localStorage.getItem('access_token')

    const response = await fetch('/api/media/upload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ filename }),
    })

    const data = await response.json()
    
    if (!response.ok) {
        throw new Error(data.detail || 'Failed to fetch media upload ticket')
    }
    
    return data
}



 // Takes the file and the backend ticket, and uploads to MinIO.
 // Note: S3/MinIO requires the 'file' to be the very last field appended.
export const uploadFileToStorage = async (
    file: File,
    ticket: MediaResponse
): Promise<void> => {
    const formData = new FormData()

    // Append all the security and policy fields from the backend first
    Object.entries(ticket.upload_fields).forEach(([key, value]) => {
        formData.append(key, value)
    })

    // Append the actual file last
    formData.append('file', file)

    // POST to MinIO
    const response = await fetch(ticket.upload_target, {
        method: 'POST',
        body: formData,
    })

    if (!response.ok) {
        throw new Error(`Storage upload failed: ${response.statusText}`)
    }
}