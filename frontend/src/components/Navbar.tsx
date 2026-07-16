import { useEffect, useState } from 'react'
import { Disclosure, DisclosureButton, DisclosurePanel, Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { Bars3Icon, XMarkIcon, HomeIcon, PlusCircleIcon, CalendarIcon } from '@heroicons/react/24/outline'
import { useLocation, useNavigate } from 'react-router-dom'
import { logoutUser } from '../api/auth'
import { fetchCurrentUser, type UserProfile } from '../api/users'


const navigation =  [
  { name: 'Home', href: '/dashboard', pathname: '/dashboard', tab: 'my-tools', icon: HomeIcon },
  { name: 'Add Tool', href: '/tools/new', pathname: '/tools/new', tab: null, icon: PlusCircleIcon },
  { name: 'Calendar', href: '/dashboard?tab=transactions', pathname: '/dashboard', tab: 'transactions', icon: CalendarIcon },
]

type NavItem = (typeof navigation)[number]

function classNames(...classes: (string | undefined | null | boolean)[]) {
  return classes.filter(Boolean).join(' ')
}

function getInitials(user: UserProfile | null): string {
  if (!user) return '?'
  const first = user.user_first_name?.[0] ?? ''
  const last = user.user_last_name?.[0] ?? ''
  return (first + last).toUpperCase() || '?'
}
 
interface NavbarProps {
  // Optional: pass the already-fetched profile to skip the extra API call
  user?: UserProfile | null
}

// Top navigation bar for logged-in users.
export default function Navbar({ user: userProp }: NavbarProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const [fetchedUser, setFetchedUser] = useState<UserProfile | null>(null)

  const user = userProp !== undefined ? userProp : fetchedUser
 
  useEffect(() => {
    // Parent owns the profile fetch
    if (userProp !== undefined) return
  
    const loadUser = async () => {
      try {
        const data = await fetchCurrentUser()
        setFetchedUser(data)
      } catch {
        // Not fatal, the navbar just renders without user details
        // (initials fall back to "?" and the menu header is hidden).
      }
    }
    loadUser()
  }, [userProp])

  // Logs the user out via the API, clears the local token, and
  // returns them to the public landing page.
  const handleSignOut = async () => {
    try {
      await logoutUser()
    } catch (err) {
      // Even if the API call fails, still clear local state and leave.
      console.error(err instanceof Error ? err.message : 'Logout failed.')
    } finally {
      localStorage.removeItem('access_token')
      navigate('/')
    }
  }

 const isCurrent = (item: NavItem) => {
    if (location.pathname !== item.pathname) return false
    if (item.tab === null) return true // non-dashboard route: pathname match is enough
    const activeTab = new URLSearchParams(location.search).get('tab') ?? 'my-tools'
    return activeTab === item.tab
  }

  const avatar = user?.user_photo_url ? (
    <img
      alt={`${user.user_first_name} ${user.user_last_name}`}
      src={user.user_photo_url}
      className="size-8 rounded-full bg-gray-800 object-cover outline -outline-offset-1 outline-white/10"
    />
  ) : (
    <span className="flex size-8 items-center justify-center rounded-full bg-[#e8a838] text-xs font-bold text-white outline -outline-offset-1 outline-white/10">
      {getInitials(user)}
    </span>
  )

  return (
    <Disclosure as="nav" className="relative bg-gray-800">
      <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
        <div className="relative flex h-16 items-center justify-between">
          <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
            {/* Mobile menu button*/}
            <DisclosureButton className="group relative inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-white/5 hover:text-white focus:outline-2 focus:-outline-offset-1 focus:outline-indigo-500">
              <span className="absolute -inset-0.5" />
              <span className="sr-only">Open main menu</span>
              <Bars3Icon aria-hidden="true" className="block size-6 group-data-open:hidden" />
              <XMarkIcon aria-hidden="true" className="hidden size-6 group-data-open:block" />
            </DisclosureButton>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="hidden sm:flex space-x-4">
                {navigation.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => navigate(item.href)}
                    aria-current={isCurrent(item) ? 'page' : undefined}
                    className={classNames(
                      isCurrent(item) ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white',
                      'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium cursor-pointer',
                    )}
                  >
                    <item.icon className="size-5" aria-hidden="true" />
                    {item.name}
                  </button>
                ))}
            </div>
          </div>
          {/* Profile dropdown menu (avatar, profile link, invite, sign out) */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
            <Menu as="div" className="relative ml-3">
              <MenuButton className="relative flex rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
                <span className="absolute -inset-1.5" />
                <span className="sr-only">Open user menu</span>
                {avatar}
              </MenuButton>

              <MenuItems
                transition
                className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg outline outline-black/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
              >
                {/* Signed-in user header */}
                {user && (
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {user.user_first_name} {user.user_last_name}
                    </p>
                    <p className="truncate text-xs text-gray-500">{user.user_email}</p>
                  </div>
                )}
 
                <MenuItem>
                  <button
                    onClick={() => navigate('/profile')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:outline-hidden"
                  >
                    Your profile
                  </button>
                </MenuItem>
                <MenuItem>
                  <button
                    onClick={() => navigate('/invite')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:outline-hidden"
                  >
                    Send Invite
                  </button>
                </MenuItem>
                <MenuItem>
                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:outline-hidden"
                  >
                    Sign out
                  </button>
                </MenuItem>
              </MenuItems>
            </Menu>
          </div>
        </div>
      </div>

      <DisclosurePanel className="sm:hidden">
        <div className="space-y-1 px-2 pt-2 pb-3">
          {navigation.map((item) => (
            <DisclosureButton
              key={item.name}
              as="button"
              onClick={() => navigate(item.href)}
              aria-current={isCurrent(item) ? 'page' : undefined}
              className={classNames(
                isCurrent(item) ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white',
                'block w-full text-left rounded-md px-3 py-2 text-base font-medium',
              )}
            >
              {item.name}
            </DisclosureButton>
          ))}
        </div>
      </DisclosurePanel>
    </Disclosure>
  )
}
