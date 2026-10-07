import { useEffect, useState } from 'react'
import EmergencyScreen from './screens/emergency/EmergencyScreen'
import LoginScreen from './screens/login/LoginScreen'
import {
  TOKEN_REFRESH_MARGIN_MS, ensureFreshAdminSession, getAdminSessionExpiresAt, hasStoredAdminSession, logoutAdmin,
} from './services/auth'

// 재발급이 네트워크 오류 등으로 실패하면 이 간격으로 다시 시도한다.
const REFRESH_RETRY_MS = 10_000
const MAX_TIMEOUT_MS = 2_147_483_647

export default function App() {
  const [expiresAt, setExpiresAt] = useState(getAdminSessionExpiresAt)
  // Access Token은 만료됐지만 Refresh Token이 남아 있으면(예: PC 절전 후) 재발급을 시도하는 동안 로그인 화면을 띄우지 않는다.
  const [isRestoring, setIsRestoring] = useState(() => getAdminSessionExpiresAt() === null && hasStoredAdminSession())

  function handleLogout() {
    void logoutAdmin()
    setExpiresAt(null)
    window.location.replace('/login')
  }

  // 만료 직전에 Access Token을 재발급해 세션을 이어 간다. 재발급이 거절됐을 때만 로그인 화면으로 보낸다.
  useEffect(() => {
    let timeoutId: number | undefined
    let isCancelled = false

    function schedule(delay: number) {
      window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(check, Math.min(Math.max(delay, 0), MAX_TIMEOUT_MS))
    }

    function check() {
      ensureFreshAdminSession().then((next) => {
        if (isCancelled) return
        setExpiresAt(next)
        setIsRestoring(false)
        if (next !== null) schedule(next - TOKEN_REFRESH_MARGIN_MS - Date.now())
      }).catch((reason: unknown) => {
        if (isCancelled) return
        console.error('[auth] 토큰 재발급 실패. 잠시 후 다시 시도합니다.', reason)
        setExpiresAt(getAdminSessionExpiresAt())
        setIsRestoring(false)
        schedule(REFRESH_RETRY_MS)
      })
    }

    check()
    // 절전·탭 숨김 중에는 타이머가 늦게 실행될 수 있으므로 화면으로 돌아올 때도 확인한다.
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      isCancelled = true
      window.clearTimeout(timeoutId)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  if (isRestoring) return null
  const hasAdminSession = expiresAt !== null
  return !hasAdminSession || window.location.pathname.replace(/\/$/, '') === '/login'
    ? <LoginScreen />
    : <EmergencyScreen onLogout={handleLogout} />
}
