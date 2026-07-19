// src/api/media.ts

export interface MediaUploadTicket {
    upload_target: string
    upload_fields: Record<string, string>
    url: string
}

// Requests a signed upload ticket for one file.
export const fetchUploadTicket = async (filename: string): Promise<MediaUploadTicket> => {
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
    if (!response.ok) throw new Error(data.detail || 'Failed to fetch media upload ticket.')
    return data
}

// Uploads the file directly to MinIO using the signed ticket.
// Note: S3/MinIO requires the 'file' field to be the very last field appended.
export const uploadFileToStorage = async (
    file: File,
    ticket: MediaUploadTicket
): Promise<void> => {
    const formData = new FormData()
 
    // Append all the security and policy fields from the backend first
    Object.entries(ticket.upload_fields).forEach(([key, value]) => {
        formData.append(key, value)
    })
 
    // Append the actual file last
    formData.append('file', file)
 
    const response = await fetch(ticket.upload_target, {
        method: 'POST',
        body: formData,
    })
 
    if (!response.ok) {
        throw new Error(`Storage upload failed: ${response.statusText}`)
    }
}
 
// Convenience helper: uploads one file end-to-end and returns its permanent URL.
export const uploadPhoto = async (file: File): Promise<string> => {
    const ticket = await fetchUploadTicket(file.name)
    await uploadFileToStorage(file, ticket)
    return ticket.url
}

