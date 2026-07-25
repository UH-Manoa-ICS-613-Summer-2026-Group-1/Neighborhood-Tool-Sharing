
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import Navbar from '../../components/Navbar'
import { uploadPhoto } from '../../api/media'
import {changePassword, fetchCurrentUser, updateUserProfile, type UserProfile } from '../../api/users'
 
// Mirrors the backend ChangePasswordRequest validator
const validateNewPassword = (password: string): string => {
    if (password.length < 8) return 'New password must be at least 8 characters.'
    if (password.length > 64) return 'New password must be at most 64 characters.'
    if (!/[A-Z]/.test(password)) return 'New password must contain at least one uppercase letter.'
    if (!/[a-z]/.test(password)) return 'New password must contain at least one lowercase letter.'
    if (!/[0-9]/.test(password)) return 'New password must contain at least one number.'
    if (!/[!@#$%^&*(),.?":{}|<>_+=-]/.test(password)) return 'New password must contain at least one special character.'
    return ''
}
 
export default function Profile() {
    const navigate = useNavigate()
 
    // Loaded profile
    const [user, setUser] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
 
    // Profile info form
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [middleName, setMiddleName] = useState('')
    const [bio, setBio] = useState('')
    const [locationField, setLocationField] = useState('')
 
    // Photo state:
    //   newPhotoFile: user picked a replacement (upload on save)
    //   removePhoto: user clicked "Remove photo" (send photo_url: null)
    const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null)
    const [newPhotoPreview, setNewPhotoPreview] = useState('')
    const [removePhoto, setRemovePhoto] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
 
    const [savingProfile, setSavingProfile] = useState(false)
    const [profileError, setProfileError] = useState('')
    const [profileSuccess, setProfileSuccess] = useState('')
 
    // Change password form
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmNewPassword, setConfirmNewPassword] = useState('')
    const [savingPassword, setSavingPassword] = useState(false)
    const [passwordError, setPasswordError] = useState('')
    const [passwordSuccess, setPasswordSuccess] = useState('')
 
    // Load the profile and seed the form
    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchCurrentUser()
                setUser(data)
                setFirstName(data.user_first_name)
                setLastName(data.user_last_name)
                setMiddleName(data.user_middle_name ?? '')
                setBio(data.user_bio ?? '')
                setLocationField(data.user_location ?? '')
            } catch (err) {
                setLoadError(err instanceof Error ? err.message : 'Failed to load your profile.')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])
 
    // Clean up the local preview object URL
    useEffect(() => {
        return () => {
            if (newPhotoPreview) URL.revokeObjectURL(newPhotoPreview)
        }
    }, [newPhotoPreview])
 
    // Photo handlers
 
    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
 
        if (newPhotoPreview) URL.revokeObjectURL(newPhotoPreview)
        setNewPhotoFile(file)
        setNewPhotoPreview(URL.createObjectURL(file))
        setRemovePhoto(false)
 
        if (fileInputRef.current) fileInputRef.current.value = ''
    }
 
    const handleRemovePhoto = () => {
        if (newPhotoPreview) URL.revokeObjectURL(newPhotoPreview)
        setNewPhotoFile(null)
        setNewPhotoPreview('')
        setRemovePhoto(true)
    }
 
    // Avatar preview
    const displayedPhoto = removePhoto
        ? ''
        : newPhotoPreview || user?.user_photo_url || ''
 
    const initials = user
        ? `${user.user_first_name?.[0] ?? ''}${user.user_last_name?.[0] ?? ''}`.toUpperCase() || '?'
        : '?'
 
    // Save profile info 
 
    const handleSaveProfile = async (e: React.SyntheticEvent) => {
        e.preventDefault()
        setProfileError('')
        setProfileSuccess('')
 
        if (!firstName.trim()) {
            setProfileError('First name is required.')
            return
        }
        if (!lastName.trim()) {
            setProfileError('Last name is required.')
            return
        }
 
        setSavingProfile(true)
        try {
            // If a new photo was picked, upload it first to get its permanent URL
            let photoUrl: string | null | undefined = undefined 
            if (newPhotoFile) {
                photoUrl = await uploadPhoto(newPhotoFile)
            } else if (removePhoto) {
                photoUrl = null 
            }
 
            // PATCH the profile
            const updated = await updateUserProfile({
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                middle_name: middleName.trim(),
                bio: bio.trim(),
                location: locationField.trim(),
                ...(photoUrl !== undefined ? { photo_url: photoUrl } : {}),
            })
 
            // Refresh local state with the authoritative response
            setUser(updated)
            setNewPhotoFile(null)
            if (newPhotoPreview) URL.revokeObjectURL(newPhotoPreview)
            setNewPhotoPreview('')
            setRemovePhoto(false)
            setProfileSuccess('Profile updated successfully.')
        } catch (err) {
            setProfileError(err instanceof Error ? err.message : 'Failed to update profile.')
        } finally {
            setSavingProfile(false)
        }
    }
 
    // Change password
 
    const handleChangePassword = async (e: React.SyntheticEvent) => {
        e.preventDefault()
        setPasswordError('')
        setPasswordSuccess('')
 
        if (!currentPassword) {
            setPasswordError('Please enter your current password.')
            return
        }
        if (newPassword !== confirmNewPassword) {
            setPasswordError('New passwords do not match.')
            return
        }
        const strengthError = validateNewPassword(newPassword)
        if (strengthError) {
            setPasswordError(strengthError)
            return
        }
        if (newPassword === currentPassword) {
            setPasswordError('New password cannot be identical to your current password.')
            return
        }
 
        setSavingPassword(true)
        try {
            const data = await changePassword(currentPassword, newPassword)
            setPasswordSuccess(data.message || 'Password updated successfully.')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmNewPassword('')
        } catch (err) {
            setPasswordError(err instanceof Error ? err.message : 'Failed to change password.')
        } finally {
            setSavingPassword(false)
        }
    }
 
    return (
        <div className="min-h-screen text-white bg-[#1a1f26]">
            <Navbar user={user} />
 
            <main className="max-w-2xl mx-auto p-6">
                <button
                    className="text-[#e8a838] text-xs font-semibold mb-4 cursor-pointer hover:underline"
                    onClick={() => navigate('/dashboard')}
                    type="button"
                >
                    ← Back to dashboard
                </button>
 
                {loading && <p className="text-center text-gray-400 mt-10">Loading your profile...</p>}
 
                {loadError && (
                    <p role="alert" className="text-center text-red-400 mt-10">{loadError}</p>
                )}
 
                {!loading && !loadError && user && (
                    <>
                        {/* Profile info */}
                        <section className="p-6 bg-black/15 border border-white/5 rounded-lg mb-6">
                            <h1 className="text-xl font-bold mb-1">Your Profile</h1>
                            <p className="text-xs text-gray-400 mb-6">
                                Signed in as <span className="text-[#e8a838]">{user.user_email}</span> ·{' '}
                                member since {new Date(user.user_created_at).toLocaleDateString()}
                            </p>
 
                            {profileError && (
                                <p role="alert" className="text-red-400 text-xs mb-4 border border-red-500/30 bg-red-500/10 rounded px-3 py-2">
                                    {profileError}
                                </p>
                            )}
                            {profileSuccess && (
                                <p role="alert" className="text-green-400 text-xs mb-4 border border-green-400/30 bg-green-400/10 rounded px-3 py-2">
                                    {profileSuccess}
                                </p>
                            )}
 
                            <form onSubmit={handleSaveProfile} noValidate>
                                {/* Profile photo */}
                                <div className="flex items-center gap-4 mb-6">
                                    {displayedPhoto ? (
                                        <img
                                            src={displayedPhoto}
                                            alt="Profile"
                                            className="size-20 rounded-full object-cover border border-white/10"
                                        />
                                    ) : (
                                        <span className="flex size-20 items-center justify-center rounded-full bg-[#e8a838] text-xl font-bold text-white border border-white/10">
                                            {initials}
                                        </span>
                                    )}
 
                                    <div className="flex flex-col gap-2">
                                        <input
                                            type="file"
                                            accept="image/jpeg, image/png, image/webp"
                                            ref={fileInputRef}
                                            onChange={handlePhotoSelect}
                                            disabled={savingProfile}
                                            className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-gray-700 file:text-white file:cursor-pointer hover:file:bg-gray-600 disabled:opacity-50"
                                        />
                                        {(displayedPhoto || user.user_photo_url) && !removePhoto && (
                                            <button
                                                type="button"
                                                onClick={handleRemovePhoto}
                                                disabled={savingProfile}
                                                className="text-left text-xs text-red-400 hover:text-red-300 cursor-pointer disabled:opacity-50"
                                            >
                                                Remove photo
                                            </button>
                                        )}
                                        {removePhoto && (
                                            <p className="text-xs text-gray-500">
                                                Photo will be removed when you save.
                                            </p>
                                        )}
                                    </div>
                                </div>
 
                                {/* Names */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-[#e8a838] mb-1" htmlFor="first-name">First name</label>
                                        <input
                                            id="first-name"
                                            className="w-full px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-white placeholder-[#8f8f8f] focus:outline-none focus:ring-2 focus:ring-[#e8a838] focus:border-transparent transition-colors duration-150"
                                            value={firstName}
                                            onChange={e => setFirstName(e.target.value)}
                                            maxLength={255}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-[#e8a838] mb-1" htmlFor="last-name">Last name</label>
                                        <input
                                            id="last-name"
                                            className="w-full px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-white placeholder-[#8f8f8f] focus:outline-none focus:ring-2 focus:ring-[#e8a838] focus:border-transparent transition-colors duration-150"
                                            value={lastName}
                                            onChange={e => setLastName(e.target.value)}
                                            maxLength={255}
                                            required
                                        />
                                    </div>
                                </div>
 
                                <div className="mb-4">
                                    <label className="block text-xs font-semibold text-[#e8a838] mb-1" htmlFor="middle-name">
                                        Middle name <span className="text-gray-500 font-normal">(optional)</span>
                                    </label>
                                    <input
                                        id="middle-name"
                                        className="w-full px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-white placeholder-[#8f8f8f] focus:outline-none focus:ring-2 focus:ring-[#e8a838] focus:border-transparent transition-colors duration-150"
                                        value={middleName}
                                        onChange={e => setMiddleName(e.target.value)}
                                        maxLength={255}
                                    />
                                </div>
 
                                {/* Location */}
                                <div className="mb-4">
                                    <label className="block text-xs font-semibold text-[#e8a838] mb-1" htmlFor="location">
                                        Location <span className="text-gray-500 font-normal">(optional)</span>
                                    </label>
                                    <input
                                        id="location"
                                        className="w-full px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-white placeholder-[#8f8f8f] focus:outline-none focus:ring-2 focus:ring-[#e8a838] focus:border-transparent transition-colors duration-150"
                                        placeholder="e.g. Maple Street, ABC Town"
                                        value={locationField}
                                        onChange={e => setLocationField(e.target.value)}
                                        maxLength={255}
                                    />
                                </div>
 
                                {/* Bio */}
                                <div className="mb-6">
                                    <label className="block text-xs font-semibold text-[#e8a838] mb-1" htmlFor="bio">
                                        Bio <span className="text-gray-500 font-normal">(optional)</span>
                                    </label>
                                    <textarea
                                        id="bio"
                                        className="w-full px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-white placeholder-[#8f8f8f] focus:outline-none focus:ring-2 focus:ring-[#e8a838] focus:border-transparent transition-colors duration-150 min-h-24 resize-y"
                                        placeholder="Tell your neighbors a little about yourself."
                                        value={bio}
                                        onChange={e => setBio(e.target.value)}
                                        maxLength={2000}
                                    />
                                    <p className="text-[0.6rem] text-gray-500 mt-1 text-right">{bio.length}/2000</p>
                                </div>
 
                                <button
                                    type="submit"
                                    disabled={savingProfile}
                                    className="w-full py-3 bg-[#e8a838] hover:bg-[#d6962f] text-white rounded font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer [text-shadow:0_1px_0_rgba(0,0,0,0.2)]"
                                >
                                    {savingProfile ? 'Saving...' : 'Save Profile'}
                                </button>
                            </form>
                        </section>
 
                        {/* Change password */}
                        <section className="p-6 bg-black/15 border border-white/5 rounded-lg mb-6">
                            <h2 className="text-lg font-bold mb-1">Change Password</h2>
                            <p className="text-xs text-gray-400 mb-6">
                                Must be 8–64 characters with an uppercase letter, lowercase letter, number, and special character.
                            </p>
 
                            {passwordError && (
                                <p role="alert" className="text-red-400 text-xs mb-4 border border-red-500/30 bg-red-500/10 rounded px-3 py-2">
                                    {passwordError}
                                </p>
                            )}
                            {passwordSuccess && (
                                <p role="alert" className="text-green-400 text-xs mb-4 border border-green-400/30 bg-green-400/10 rounded px-3 py-2">
                                    {passwordSuccess}
                                </p>
                            )}
 
                            <form onSubmit={handleChangePassword} noValidate>
                                <div className="mb-4">
                                    <label className="block text-xs font-semibold text-[#e8a838] mb-1" htmlFor="current-password">Current password</label>
                                    <input
                                        id="current-password"
                                        className="w-full px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-white placeholder-[#8f8f8f] focus:outline-none focus:ring-2 focus:ring-[#e8a838] focus:border-transparent transition-colors duration-150"
                                        type="password"
                                        autoComplete="current-password"
                                        value={currentPassword}
                                        onChange={e => setCurrentPassword(e.target.value)}
                                        required
                                    />
                                </div>
 
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <label className="block text-xs font-semibold text-[#e8a838] mb-1" htmlFor="new-password">New password</label>
                                        <input
                                            id="new-password"
                                            className="w-full px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-white placeholder-[#8f8f8f] focus:outline-none focus:ring-2 focus:ring-[#e8a838] focus:border-transparent transition-colors duration-150"
                                            type="password"
                                            autoComplete="new-password"
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            minLength={8}
                                            maxLength={64}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-[#e8a838] mb-1" htmlFor="confirm-new-password">Confirm new password</label>
                                        <input
                                            id="confirm-new-password"
                                            className="w-full px-3 py-2 bg-black/25 border border-white/10 rounded text-sm text-white placeholder-[#8f8f8f] focus:outline-none focus:ring-2 focus:ring-[#e8a838] focus:border-transparent transition-colors duration-150"
                                            type="password"
                                            autoComplete="new-password"
                                            value={confirmNewPassword}
                                            onChange={e => setConfirmNewPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
 
                                <button
                                    type="submit"
                                    disabled={savingPassword}
                                    className="w-full py-3 bg-black/25 border border-[#e8a838] text-[#e8a838] rounded font-bold text-sm hover:bg-[#e8a838] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    {savingPassword ? 'Updating...' : 'Update Password'}
                                </button>
                            </form>
                        </section>
                    </>
                )}
            </main>
        </div>
    )
}