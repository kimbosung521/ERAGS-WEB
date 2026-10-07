import { useEffect, useRef, useState } from 'react'
import { ApiRequestError } from '../../../services/api'
import { streamMonitoringEvents, type MonitoringGuideEvent } from '../../../services/monitoringEvents'

export type EventConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'stopped'

const RECONNECT_BASE_MS = 3_000
const RECONNECT_MAX_MS = 30_000

/**
 * 목록을 처음 받은 뒤 관제 SSE에 연결하고, 끊기면 다시 연결한다.
 * 최초 연결은 목록의 eventCursor를, 이후 재연결은 마지막으로 받은 eventId를 Last-Event-ID로 보낸다.
 * 연결이 끊긴 동안의 누락은 5초 목록·상세 조회가 복구하므로 여기서는 따로 메우지 않는다.
 */
export function useMonitoringEvents(listEventCursor: number | null, onGuideCreated: (event: MonitoringGuideEvent) => void) {
  const [status, setStatus] = useState<EventConnectionStatus>('connecting')
  const [error, setError] = useState<Error | null>(null)
  const latestListCursorRef = useRef(listEventCursor)
  const onGuideCreatedRef = useRef(onGuideCreated)
  // 필터·페이지를 바꾸는 동안 목록이 잠시 비어도 연결을 끊지 않도록, 한 번 커서를 받으면 계속 연결 상태를 유지한다.
  const [hasListCursor, setHasListCursor] = useState(false)
  if (!hasListCursor && listEventCursor !== null) setHasListCursor(true)

  useEffect(() => {
    latestListCursorRef.current = listEventCursor
    onGuideCreatedRef.current = onGuideCreated
  })

  useEffect(() => {
    if (!hasListCursor) return
    const controller = new AbortController()
    const seenSessionIds = new Set<string>()
    let cursor = latestListCursorRef.current ?? 0
    let failures = 0
    let timeoutId: number | undefined

    function scheduleReconnect() {
      failures += 1
      setStatus('reconnecting')
      timeoutId = window.setTimeout(connect, Math.min(RECONNECT_BASE_MS * 2 ** (failures - 1), RECONNECT_MAX_MS))
    }

    function handleEvent(event: MonitoringGuideEvent) {
      // 재접속 시 재생되는 이벤트와 같은 사건의 중복 생성 이벤트를 거른다.
      if (event.eventId <= cursor) return
      cursor = event.eventId
      if (seenSessionIds.has(event.sessionId)) return
      seenSessionIds.add(event.sessionId)
      onGuideCreatedRef.current(event)
    }

    function connect() {
      streamMonitoringEvents({
        lastEventId: cursor,
        signal: controller.signal,
        onOpen: () => {
          failures = 0
          setStatus('open')
          setError(null)
        },
        onEvent: handleEvent,
      }).then(() => {
        // 서버가 연결을 정상 종료한 경우(배포·타임아웃 등). 다시 연결한다.
        if (!controller.signal.aborted) scheduleReconnect()
      }).catch((reason: unknown) => {
        if (controller.signal.aborted) return
        console.error('[monitoring] 실시간 이벤트 연결 실패', reason instanceof ApiRequestError
          ? { status: reason.status, errorCode: reason.errorCode, message: reason.message, lastEventId: cursor }
          : reason)
        setError(reason instanceof Error ? reason : new Error('실시간 이벤트 연결에 실패했습니다.'))
        const status = reason instanceof ApiRequestError ? reason.status : null
        // 서버 이벤트 기록이 초기화되면 보관 중인 최대 ID보다 큰 커서는 400이 된다. 최신 목록의 커서로 한 번 낮춰 다시 시도한다.
        const listCursor = latestListCursorRef.current
        if (status === 400 && listCursor !== null && listCursor < cursor) {
          cursor = listCursor
          scheduleReconnect()
        } else if (status === 400 || status === 401 || status === 403) {
          // 다시 연결해도 같은 결과이므로 멈춘다. 401은 화면에서 로그인으로 보낸다.
          setStatus('stopped')
        } else {
          scheduleReconnect()
        }
      })
    }

    connect()
    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [hasListCursor])

  return { status, error }
}
