import { ApiRequestError, isRecord, postJson } from './api'
import type { AdminSession, LoginRequest } from '../types/auth'

const AUTH_SESSION_KEY = 'erags.admin.session'

export function clearAdminSession(): void {
  sessionStorage.removeItem(AUTH_SESSION_KEY)
}

export function getAdminSessionExpiresAt(): number | null {
  try {
    const storedSession = sessionStorage.getItem(AUTH_SESSION_KEY)
    if (!storedSession) return null
    const session: unknown = JSON.parse(storedSession)
    if (
      !isRecord(session) || !isRecord(session.user) || session.user.role !== 'admin' ||
      typeof session.access_token !== 'string' || !session.access_token.trim() ||
      typeof session.expires_at !== 'number' || !Number.isFinite(session.expires_at) ||
      session.expires_at <= Date.now()
    ) return null
    return session.expires_at
  } catch {
    return null
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
  if (
    typeof data.access_token !== 'string' || !data.access_token.trim() ||
    typeof data.refresh_token !== 'string' || !data.refresh_token.trim() ||
    typeof data.expires_in !== 'number' || !Number.isFinite(data.expires_in) || data.expires_in <= 0 ||
    typeof user.id !== 'number' || !Number.isFinite(user.id) ||
    typeof user.email !== 'string' || !user.email.trim()
  ) {
    throw new ApiRequestError(200, '로그인 응답 형식이 올바르지 않습니다.', 'INVALID_RESPONSE')
  }

  const session: AdminSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    expires_at: Date.now() + data.expires_in * 1000,
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
