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

export async function postJson(path: string, body: unknown): Promise<unknown> {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ApiRequestError(response.status, '서버 응답 형식이 올바르지 않습니다. API 주소를 확인해 주세요.', 'INVALID_RESPONSE')
  }

  if (!response.ok || (isRecord(payload) && payload.success === false)) {
    throw new ApiRequestError(
      response.status,
      isRecord(payload) && typeof payload.message === 'string'
        ? payload.message
        : `요청에 실패했습니다. (${response.status})`,
      isRecord(payload) && typeof payload.errorCode === 'string' ? payload.errorCode : undefined,
    )
  }
  return payload
}
