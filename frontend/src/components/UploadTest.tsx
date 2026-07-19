import { useState, useRef, useEffect } from 'react'
import { fetchUploadTicket, uploadFileToStorage } from '../api/mediaTest'

type LocalPhoto = {
  file: File
  previewUrl: string
}
// Component for creating a new tool
export default function CreateToolForm() {
  const [photos, setPhotos] = useState<LocalPhoto[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  
  // State to hold the final permanent URLs to display at the bottom
  const [finalUrls, setFinalUrls] = useState<string[]>([])
  // Ref for the file input
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Function to handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return

    const selectedFiles = Array.from(e.target.files)
    
    if (photos.length + selectedFiles.length > 5) {
      setError('You can only select a maximum of 5 photos.')
      return
    }

    setError('')
    
    const newLocalPhotos = selectedFiles.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file)
    }))

    setPhotos(prev => [...prev, ...newLocalPhotos])
    
    if (fileInputRef.current) fileInputRef.current.value = ''
  }
  // Function to handle photo deletion
  const handleDeletePhoto = (indexToRemove: number) => {
    setPhotos(prev => {
      const photoToRemove = prev[indexToRemove]
      URL.revokeObjectURL(photoToRemove.previewUrl) 
      return prev.filter((_, index) => index !== indexToRemove)
    })
  }
  // Function to handle photo movement
  const handleMovePhoto = (index: number, direction: 'left' | 'right') => {
    setPhotos(prev => {
      const newPhotos = [...prev]
      if (direction === 'left' && index > 0) {
        [newPhotos[index - 1], newPhotos[index]] = [newPhotos[index], newPhotos[index - 1]]
      } else if (direction === 'right' && index < newPhotos.length - 1) {
        [newPhotos[index + 1], newPhotos[index]] = [newPhotos[index], newPhotos[index + 1]]
      }
      return newPhotos
    })
  }
  // Function to handle form submission. 
  const handleSubmitTool = async (e: React.FormEvent) => {
    e.preventDefault()
    if (photos.length < 1) {
      setError('You must include at least one photo.')
      return
    }
    
    setIsSubmitting(true)
    setError('')
    setStatus('Uploading photos to storage...')
    setFinalUrls([]) // Clear previous URLs if they resubmit

    try {
      const uploadedUrls: string[] = await Promise.all(
        photos.map(async (photo) => {
          const ticket = await fetchUploadTicket(photo.file.name)
          await uploadFileToStorage(photo.file, ticket)
          return ticket.url
        })
      )

      // setStatus('Saving tool to database...')

      // const newToolPayload = {
      //   title: "DeWalt Drill", 
      //   tool_type: "POWER_TOOLS",
      //   description: "Great drill, barely used.",
      //   condition: "GOOD",
      //   photo_urls: uploadedUrls, 
      // }

      // // await createTool(newToolPayload)
      
      // console.log('Successfully submitted tool:', newToolPayload)
      // setStatus('Success! Tool published.')
      
      // Save the generated URLs to state so they render at the bottom
      setFinalUrls(uploadedUrls)
      
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed')
      setStatus('')
    } finally {
      setIsSubmitting(false)
    }
  }
 
  useEffect(() => {
    return () => {
      photos.forEach(photo => URL.revokeObjectURL(photo.previewUrl))
    }
  }, [photos])

  return (
    <div className="max-w-xl mx-auto py-8">
      <form onSubmit={handleSubmitTool} className="p-6 text-white">
        <h2 className="text-xl font-bold mb-4">List a New Tool</h2>

        <div className="mb-6 p-4 border border-dashed border-gray-600 rounded">
          <h3 className="mb-4 font-semibold text-[#e8a838]">
            Photos ({photos.length}/5)
            <span className="text-xs text-gray-400 font-normal ml-2">
              (The first photo will be the cover image)
            </span>
          </h3>
          
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-4 mb-6">
              {photos.map((photo, idx) => (
                <div key={photo.previewUrl} className="relative group flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(idx)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-700 z-10 shadow-lg"
                  >
                    ✕
                  </button>

                  <img src={photo.previewUrl} alt={`Preview ${idx}`} className="w-24 h-24 object-cover rounded border border-gray-600" />
                  
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => handleMovePhoto(idx, 'left')}
                      disabled={idx === 0 || isSubmitting}
                      className="p-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMovePhoto(idx, 'right')}
                      disabled={idx === photos.length - 1 || isSubmitting}
                      className="p-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30"
                    >
                      →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {photos.length < 5 && (
            <input 
              type="file" 
              accept="image/jpeg, image/png, image/webp"
              multiple 
              ref={fileInputRef}
              onChange={handleFileSelect}
              disabled={isSubmitting}
              className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-gray-700 file:text-white file:cursor-pointer hover:file:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          )}
        </div>

        {status && <p className="text-blue-400 mb-4 text-sm font-medium">{status}</p>}
        {error && <p className="text-red-400 mb-4 text-sm">{error}</p>}

        <button 
          type="submit" 
          disabled={photos.length === 0 || isSubmitting}
          className="w-full py-3 bg-[#e8a838] hover:bg-[#d6962f] text-white rounded font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Processing...' : 'Publish the tool'}
        </button>
      </form>

      {/* --- RENDER THE GENERATED URLs --- */}
      {finalUrls.length > 0 && (
        <div className="mt-8 p-6 bg-black/20 border border-green-500/30 rounded-lg mx-6 text-white">
          <h3 className="text-green-400 font-bold mb-3 text-lg">✓ Upload Successful!</h3>
          <p className="text-sm text-gray-400 mb-4">Here are the permanent MinIO links generated for the tool:</p>
          <ul className="list-disc list-inside space-y-2 text-sm break-all">
            {finalUrls.map((url, index) => (
              <li key={index}>
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-blue-400 hover:text-blue-300 underline transition-colors"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}