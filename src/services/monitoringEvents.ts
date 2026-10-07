import { ApiRequestError, authenticatedStream, isRecord } from './api'
import { getAdminAccessToken } from './auth'

export interface MonitoringGuideEvent {
  eventId: number
  /** guide.sessionId. 사건 ID(incidentId)와 같다. */
  sessionId: string
}

interface SseMessage {
  event: string
  data: string
  id: string | null
}

// text/event-stream 본문을 메시지 단위로 나눈다. 청크가 줄 중간에서 끊겨도 다음 청크와 이어 붙인다.
// heartbeat(콜론으로 시작하는 주석)와 retry 같은 다른 필드는 무시한다.
export function createSseParser(onMessage: (message: SseMessage) => void) {
  let buffer = ''
  let event = ''
  let data: string[] = []
  let id: string | null = null

  function dispatch() {
    if (data.length > 0) onMessage({ event: event || 'message', data: data.join('\n'), id })
    event = ''
    data = []
    id = null
  }

  function processLine(line: string) {
    if (line === '') return dispatch()
    if (line.startsWith(':')) return
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
    else if (field === 'id') id = value
  }

  return {
    push(chunk: string) {
      buffer += chunk
      // \r\n이 청크 경계에서 나뉘면 빈 줄로 잘못 읽으므로 끝의 \r은 다음 청크까지 기다린다.
      const pendingCr = buffer.endsWith('\r')
      const lines = (pendingCr ? buffer.slice(0, -1) : buffer).split(/\r\n|\r|\n/)
      // 마지막 조각은 아직 줄바꿈이 오지 않은 미완성 줄이다.
      buffer = (lines.pop() ?? '') + (pendingCr ? '\r' : '')
      for (const line of lines) processLine(line)
    },
  }
}

function parseGuideEvent(data: string): MonitoringGuideEvent | null {
  let payload: unknown
  try {
    payload = JSON.parse(data)
  } catch {
    return null
  }
  if (
    !isRecord(payload) || typeof payload.eventId !== 'number' || !Number.isSafeInteger(payload.eventId) || payload.eventId < 1 ||
    !isRecord(payload.guide) || typeof payload.guide.sessionId !== 'string' || !payload.guide.sessionId.trim()
  ) return null
  return { eventId: payload.eventId, sessionId: payload.guide.sessionId }
}

/**
 * 관제 SSE에 연결해 guide.created 이벤트를 전달한다. 서버가 연결을 닫으면 정상 종료(resolve)하고,
 * 연결 실패는 ApiRequestError로 reject한다. 재연결은 호출하는 쪽에서 한다.
 */
export async function streamMonitoringEvents({ lastEventId, signal, onOpen, onEvent }: {
  lastEventId: number
  signal: AbortSignal
  onOpen?: () => void
  onEvent: (event: MonitoringGuideEvent) => void
}): Promise<void> {
  const accessToken = getAdminAccessToken()
  if (!accessToken) throw new ApiRequestError(401, '로그인이 필요합니다.', 'AUTH_REQUIRED')
  console.info(`[monitoring] 실시간 이벤트 연결 요청\n  Last-Event-ID=${lastEventId}\n  GET /api/v1/monitoring/events`)
  const body = await authenticatedStream('/api/v1/monitoring/events', accessToken, { 'Last-Event-ID': String(lastEventId) }, signal)
  onOpen?.()

  const parser = createSseParser((message) => {
    if (message.event !== 'guide.created') return
    const event = parseGuideEvent(message.data)
    if (event) onEvent(event)
    else console.warn('[monitoring] 형식이 올바르지 않은 실시간 이벤트를 무시했습니다.', message)
  })
  const reader = body.getReader()
  // stream 옵션으로 청크 경계에서 잘린 한글(멀티바이트 문자)을 다음 청크와 이어 디코딩한다.
  const decoder = new TextDecoder()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return
      parser.push(decoder.decode(value, { stream: true }))
    }
  } finally {
    reader.releaseLock()
  }
}
