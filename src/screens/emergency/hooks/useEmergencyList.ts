import { useEffect, useState } from 'react'
import { ApiRequestError } from '../../../services/api'
import { getMonitoringIncidents } from '../../../services/monitoring'
import type { EmergencyFilterState, EmergencyListResult } from '../../../types/emergency'
import { resolveIncidentFilter, todayIncidentFilter } from '../emergency.datetime'

// API 문서 권장 주기. 이전 요청이 끝난 뒤 다음 요청을 예약해 요청이 겹치지 않게 한다.
const POLLING_INTERVAL_MS = 5_000

// 잘못된 조회 조건·인증·권한 오류는 다시 요청해도 바뀌지 않으므로 자동 갱신을 멈춘다.
function shouldStopPolling(reason: unknown) {
  return reason instanceof ApiRequestError && [400, 401, 403].includes(reason.status)
}

export function useEmergencyList() {
  const [request, setRequest] = useState(() => ({ filter: todayIncidentFilter(), offset: 0, revision: 0 }))
  const [data, setData] = useState<EmergencyListResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let timeoutId: number | undefined

    function load() {
      getMonitoringIncidents(resolveIncidentFilter(request.filter), request.offset, controller.signal).then((result) => {
        if (controller.signal.aborted) return
        setData(result)
        setError(null)
        timeoutId = window.setTimeout(load, POLLING_INTERVAL_MS)
      }).catch((reason: unknown) => {
        if (controller.signal.aborted) return
        console.error('[monitoring] 사건 목록 조회 실패', reason instanceof ApiRequestError
          ? { status: reason.status, errorCode: reason.errorCode, message: reason.message, filter: request.filter, offset: request.offset }
          : reason)
        setError(reason instanceof Error ? reason : new Error('사건 목록을 불러오지 못했습니다.'))
        if (!shouldStopPolling(reason)) timeoutId = window.setTimeout(load, POLLING_INTERVAL_MS)
      }).finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    }

    load()
    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [request])

  function handleLoad(offset = request.offset, filter = request.filter) {
    setIsLoading(true)
    setError(null)
    if (offset !== request.offset || filter !== request.filter) setData(null)
    setRequest({ filter, offset, revision: request.revision + 1 })
  }

  // 조건이 바뀌면 이전 조건의 offset은 의미가 없으므로 첫 페이지부터 조회한다.
  function handleFilterChange(filter: EmergencyFilterState) {
    handleLoad(0, filter)
  }

  // 실시간 이벤트를 받았을 때 같은 조건으로 바로 다시 조회한다. 보던 목록은 지우지 않고 로딩 표시도 하지 않는다.
  function refresh() {
    setRequest((current) => ({ ...current, revision: current.revision + 1 }))
  }

  return { data, isLoading, error, offset: request.offset, filter: request.filter, handleLoad, handleFilterChange, refresh }
}
