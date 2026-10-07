import { ApiRequestError, isRecord, postJson } from './api'
import type { AdminSession, LoginRequest } from '../types/auth'

const AUTH_SESSION_KEY = 'erags.admin.session'
/** Access Token 만료 이 시간 전에 미리 재발급한다. 요청 도중 만료되는 것을 막는다. */
export const TOKEN_REFRESH_MARGIN_MS = 60_000

export function clearAdminSession(): void {
  sessionStorage.removeItem(AUTH_SESSION_KEY)
}

// 저장된 관리자 세션. Access Token 만료 여부와 관계없이 형식만 확인한다(만료돼도 Refresh Token으로 재발급할 수 있다).
function readAdminSession(): AdminSession | null {
  try {
    const storedSession = sessionStorage.getItem(AUTH_SESSION_KEY)
    if (!storedSession) return null
    const session: unknown = JSON.parse(storedSession)
    if (
      !isRecord(session) || !isRecord(session.user) || session.user.role !== 'admin' ||
      typeof session.access_token !== 'string' || !session.access_token.trim() ||
      typeof session.refresh_token !== 'string' || !session.refresh_token.trim() ||
      typeof session.expires_at !== 'number' || !Number.isFinite(session.expires_at)
    ) return null
    return session as unknown as AdminSession
  } catch {
    return null
  }
}

export function hasStoredAdminSession(): boolean {
  return readAdminSession() !== null
}

export function getAdminAccessToken(): string | null {
  return getAdminSessionExpiresAt() === null ? null : readAdminSession()?.access_token ?? null
}

export function getAdminSessionExpiresAt(): number | null {
  const session = readAdminSession()
  return session && session.expires_at > Date.now() ? session.expires_at : null
}

function parseTokenSet(data: unknown) {
  if (
    !isRecord(data) ||
    typeof data.access_token !== 'string' || !data.access_token.trim() ||
    typeof data.refresh_token !== 'string' || !data.refresh_token.trim() ||
    typeof data.expires_in !== 'number' || !Number.isFinite(data.expires_in) || data.expires_in <= 0
  ) return null
  return { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in }
}

let refreshRequest: Promise<string> | null = null

/**
 * Refresh Token으로 Access Token을 재발급하고 세션을 갱신한다. 동시에 여러 요청이 401을 받아도 재발급은 한 번만 한다.
 * 서버가 재발급을 거절하면(400/401/403) 다시 로그인해야 하므로 세션을 지운다.
 */
export function refreshAdminSession(): Promise<string> {
  refreshRequest ??= (async () => {
    const session = readAdminSession()
    if (!session) throw new ApiRequestError(401, '로그인이 필요합니다.', 'AUTH_REQUIRED')
    let payload: unknown
    try {
      payload = await postJson('/api/auth/refresh', { refresh_token: session.refresh_token })
    } catch (error) {
      if (error instanceof ApiRequestError && [400, 401, 403].includes(error.status)) clearAdminSession()
      throw error
    }
    const tokens = isRecord(payload) && payload.success === true ? parseTokenSet(payload.data) : null
    if (!tokens) {
      clearAdminSession()
      throw new ApiRequestError(200, '토큰 재발급 응답 형식이 올바르지 않습니다.', 'INVALID_RESPONSE')
    }
    // 재발급을 기다리는 동안 로그아웃했다면 세션을 되살리지 않는다.
    if (readAdminSession()?.refresh_token !== session.refresh_token) {
      throw new ApiRequestError(401, '로그인이 필요합니다.', 'AUTH_REQUIRED')
    }
    const next: AdminSession = { ...session, ...tokens, expires_at: Date.now() + tokens.expires_in * 1000 }
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(next))
    console.info('[auth] Access Token을 재발급했습니다.')
    return next.access_token
  })().finally(() => {
    refreshRequest = null
  })
  return refreshRequest
}

/**
 * 만료가 가까우면(또는 이미 만료됐으면) 재발급하고 새 만료 시각을 돌려준다. 재발급이 거절돼 다시 로그인해야 하면 null.
 * 네트워크 오류처럼 다시 시도하면 될 수 있는 실패는 reject한다.
 */
export async function ensureFreshAdminSession(): Promise<number | null> {
  const session = readAdminSession()
  if (!session) return null
  if (session.expires_at - Date.now() > TOKEN_REFRESH_MARGIN_MS) return session.expires_at
  try {
    await refreshAdminSession()
  } catch (error) {
    if (!hasStoredAdminSession()) return null
    throw error
  }
  return getAdminSessionExpiresAt()
}

/**
 * 유효한 Access Token으로 요청한다. 만료가 가까우면 먼저 재발급하고,
 * 서버가 401을 주면(서버 쪽에서 먼저 만료·폐기된 경우) 한 번만 재발급해서 다시 요청한다.
 */
export async function withAdminToken<T>(request: (accessToken: string) => Promise<T>): Promise<T> {
  const session = readAdminSession()
  if (!session) throw new ApiRequestError(401, '로그인이 필요합니다.', 'AUTH_REQUIRED')
  const accessToken = session.expires_at - Date.now() > TOKEN_REFRESH_MARGIN_MS ? session.access_token : await refreshAdminSession()
  try {
    return await request(accessToken)
  } catch (error) {
    if (!(error instanceof ApiRequestError && error.status === 401)) throw error
    // 그사이 다른 요청이 이미 재발급했다면 새 토큰으로 다시 요청만 한다.
    const current = readAdminSession()
    const retryToken = current && current.access_token !== accessToken ? current.access_token : await refreshAdminSession()
    return request(retryToken)
  }
}

/**
 * 브라우저 세션을 먼저 지우고 서버에 Refresh Token 폐기를 요청한다.
 * 로그아웃 직후 페이지를 이동해도 요청이 끝까지 가도록 keepalive를 쓰고, 폐기에 실패해도 로그아웃은 그대로 진행한다.
 */
export async function logoutAdmin(): Promise<void> {
  const session = readAdminSession()
  clearAdminSession()
  if (!session) return
  try {
    await postJson('/api/auth/logout', { refresh_token: session.refresh_token }, { keepalive: true })
  } catch (error) {
    console.warn('[auth] 서버 Refresh Token 폐기에 실패했습니다. 브라우저 세션은 삭제했습니다.', error)
  }
}

export async function loginAdmin(credentials: LoginRequest): Promise<void> {
  sessionStorage.removeItem(AUTH_SESSION_KEY)
  const payload = await postJson('/api/auth/login', credentials)
  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
    throw new ApiRequestError(200, '로그인 응답 형식이 올바르지 않습니다.', 'INVALID_RESPONSE')
  }

  const { data } = payload
  if (!isRecord(data.user) || data.user.role !== 'admin') {
    throw new ApiRequestError(403, '관리자 계정만 로그인할 수 있습니다.', 'ADMIN_ONLY')
  }
  const { user } = data
  const tokens = parseTokenSet(data)
  if (
    !tokens ||
    typeof user.id !== 'number' || !Number.isFinite(user.id) ||
    typeof user.email !== 'string' || !user.email.trim()
  ) {
    throw new ApiRequestError(200, '로그인 응답 형식이 올바르지 않습니다.', 'INVALID_RESPONSE')
  }

  const session: AdminSession = {
    ...tokens,
    expires_at: Date.now() + tokens.expires_in * 1000,
    user: {
      id: user.id,
      email: user.email,
      role: 'admin',
      ...(typeof user.name === 'string' ? { name: user.name } : {}),
      ...(typeof user.guardian_phone === 'string' ? { guardian_phone: user.guardian_phone } : {}),
    },
  }
  sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
}
