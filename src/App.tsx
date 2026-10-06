import { useEffect, useState } from 'react'
import EmergencyScreen from './screens/emergency/EmergencyScreen'
import LoginScreen from './screens/login/LoginScreen'
import { clearAdminSession, getAdminSessionExpiresAt } from './services/auth'

export default function App() {
  const [expiresAt, setExpiresAt] = useState(getAdminSessionExpiresAt)

  function handleLogout() {
    clearAdminSession()
    setExpiresAt(null)
    window.location.replace('/login')
  }

  useEffect(() => {
    function handleSessionCheck() {
      setExpiresAt(getAdminSessionExpiresAt())
    }
    const timeoutId = expiresAt === null ? undefined : window.setTimeout(
      () => setExpiresAt(null),
      Math.min(Math.max(expiresAt - Date.now(), 0), 2_147_483_647),
    )
    window.addEventListener('focus', handleSessionCheck)
    window.addEventListener('storage', handleSessionCheck)
    document.addEventListener('visibilitychange', handleSessionCheck)
    return () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener('focus', handleSessionCheck)
      window.removeEventListener('storage', handleSessionCheck)
      document.removeEventListener('visibilitychange', handleSessionCheck)
    }
  }, [expiresAt])

  const hasAdminSession = expiresAt !== null
  return !hasAdminSession || window.location.pathname.replace(/\/$/, '') === '/login'
    ? <LoginScreen />
    : <EmergencyScreen onLogout={handleLogout} />
}
