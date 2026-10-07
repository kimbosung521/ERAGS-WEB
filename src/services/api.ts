export class ApiRequestError extends Error {
  readonly status: number
  readonly errorCode: string | undefined

  constructor(status: number, message: string, errorCode?: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.errorCode = errorCode
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// 관제 API는 message에 코드만 담아 보내므로 화면에 보여줄 문구로 바꾼다.
const errorMessages: Record<string, string> = {
  UNAUTHENTICATED: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  FORBIDDEN: '관제 권한이 없는 계정입니다.',
  HTTPS_REQUIRED: '보안 연결(HTTPS)로 접속해야 합니다.',
  INVALID_REQUEST: '요청 값이 올바르지 않습니다.',
  INCIDENT_NOT_FOUND: '해당 사건을 찾을 수 없습니다.',
}

function toRequestError(status: number, payload: unknown): ApiRequestError {
  // 문서의 ApiFailure는 { success: false, error: { code, message, details } }이고, 이전 형식은 최상위 필드를 쓴다.
  const failure = isRecord(payload) && isRecord(payload.error) ? payload.error : payload
  const code = isRecord(failure) && typeof failure.code === 'string' ? failure.code
    : isRecord(payload) && typeof payload.errorCode === 'string' ? payload.errorCode : undefined
  const serverMessage = isRecord(failure) && typeof failure.message === 'string' && failure.message.trim()
    ? failure.message : undefined
  const message = (code && (!serverMessage || serverMessage === code) ? errorMessages[code] : undefined) ??
    serverMessage ?? `요청에 실패했습니다. (${status})`
  return new ApiRequestError(status, message, code)
}

function apiUrl(path: string): string {
  return `${(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')}${path}`
}

async function requestJson(path: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(apiUrl(path), {
    ...init,
  })
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ApiRequestError(response.status, '서버 응답 형식이 올바르지 않습니다. API 주소를 확인해 주세요.', 'INVALID_RESPONSE')
  }

  if (!response.ok || (isRecord(payload) && payload.success === false)) {
    throw toRequestError(response.status, payload)
  }
  return payload
}

export function postJson(path: string, body: unknown): Promise<unknown> {
  return requestJson(path, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function getJson(path: string): Promise<unknown> {
  return requestJson(path, { method: 'GET', headers: { Accept: 'application/json' } })
}

// SSE처럼 응답 본문을 계속 읽어야 하는 요청. 연결 실패는 JSON 오류 응답과 같은 방식으로 ApiRequestError로 바꾼다.
export async function authenticatedStream(
  path: string, accessToken: string, headers: Record<string, string>, signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(apiUrl(path), {
    method: 'GET',
    headers: { Accept: 'text/event-stream', Authorization: `Bearer ${accessToken}`, ...headers },
    cache: 'no-store',
    signal,
  })
  if (!response.ok) {
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      payload = undefined
    }
    throw toRequestError(response.status, payload)
  }
  if (!response.headers.get('Content-Type')?.includes('text/event-stream') || !response.body) {
    throw new ApiRequestError(response.status, '실시간 이벤트 응답 형식이 올바르지 않습니다. API 주소를 확인해 주세요.', 'INVALID_RESPONSE')
  }
  return response.body
}

export function authenticatedFetch(path: string, accessToken: string, signal?: AbortSignal): Promise<unknown> {
  return requestJson(path, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    signal,
  })
}
