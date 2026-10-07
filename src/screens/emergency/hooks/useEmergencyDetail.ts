import { useEffect, useState } from 'react'
import { ApiRequestError } from '../../../services/api'
import { getMonitoringIncident } from '../../../services/monitoring'
import type { EmergencyIncidentDetail } from '../../../types/emergency'

// API 문서 권장 주기. 처치 진행·사용량·위치·관제 상태 변경은 SSE로 오지 않아 주기 조회로만 반영된다.
const POLLING_INTERVAL_MS = 5_000

// 잘못된 요청·인증·권한·없는 사건은 다시 요청해도 바뀌지 않으므로 자동 갱신을 멈춘다.
function shouldStopPolling(reason: unknown) {
  return reason instanceof ApiRequestError && [400, 401, 403, 404].includes(reason.status)
}

export function useEmergencyDetail(incidentId: string | null) {
  // 선택이 바뀐 직후 이전 사건의 상세가 보이지 않도록 결과마다 어느 사건의 것인지 함께 저장한다.
  const [result, setResult] = useState<{ id: string; data: EmergencyIncidentDetail | null; error: Error | null } | null>(null)
  const current = result && result.id === incidentId ? result : null

  useEffect(() => {
    if (!incidentId) return
    const controller = new AbortController()
    let timeoutId: number | undefined

    function load(id: string) {
      getMonitoringIncident(id, controller.signal).then((data) => {
        if (controller.signal.aborted) return
        setResult({ id, data, error: null })
        timeoutId = window.setTimeout(() => load(id), POLLING_INTERVAL_MS)
      }).catch((reason: unknown) => {
        if (controller.signal.aborted) return
        console.error('[monitoring] 사건 상세 조회 실패', reason instanceof ApiRequestError
          ? { status: reason.status, errorCode: reason.errorCode, message: reason.message, incidentId: id }
          : reason)
        const error = reason instanceof Error ? reason : new Error('사건 상세를 불러오지 못했습니다.')
        // 일시적인 실패에서는 마지막으로 받은 상세를 계속 보여준다.
        setResult((previous) => ({ id, data: previous?.id === id ? previous.data : null, error }))
        if (!shouldStopPolling(reason)) timeoutId = window.setTimeout(() => load(id), POLLING_INTERVAL_MS)
      })
    }

    load(incidentId)
    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [incidentId])

  return {
    detail: current?.data ?? null,
    error: current?.error ?? null,
    isLoading: incidentId !== null && current === null,
  }
}
