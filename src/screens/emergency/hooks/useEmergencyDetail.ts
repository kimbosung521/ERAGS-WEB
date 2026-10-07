import { useEffect, useState } from 'react'
import { ApiRequestError } from '../../../services/api'
import { getMonitoringIncident, updateMonitoringIncidentStatus } from '../../../services/monitoring'
import type { EmergencyIncidentDetail, EmergencyStatus } from '../../../types/emergency'

// API 문서 권장 주기. 처치 진행·사용량·위치·관제 상태 변경은 SSE로 오지 않아 주기 조회로만 반영된다.
const POLLING_INTERVAL_MS = 5_000

// 잘못된 요청·인증·권한·없는 사건은 다시 요청해도 바뀌지 않으므로 자동 갱신을 멈춘다.
function shouldStopPolling(reason: unknown) {
  return reason instanceof ApiRequestError && [400, 401, 403, 404].includes(reason.status)
}

type DetailResult = { id: string; data: EmergencyIncidentDetail | null; error: Error | null }

// 상태 변경 직후 그 전에 보낸 주기 조회 응답이 늦게 도착하면 이전 상태로 되돌아가 보이므로, 관제 revision이 더 낮은 응답은 버린다.
function mergeDetail(previous: DetailResult | null, id: string, data: EmergencyIncidentDetail): DetailResult {
  const current = previous?.id === id ? previous.data : null
  return { id, data: current && current.revision > data.revision ? current : data, error: null }
}

export function useEmergencyDetail(incidentId: string | null, onStatusChanged?: () => void) {
  // 선택이 바뀐 직후 이전 사건의 상세가 보이지 않도록 결과마다 어느 사건의 것인지 함께 저장한다.
  const [result, setResult] = useState<DetailResult | null>(null)
  // 상태 변경이 충돌하면 기다리지 않고 바로 다시 조회하도록 주기 조회를 새로 시작한다.
  const [reloadKey, setReloadKey] = useState(0)
  const [statusChange, setStatusChange] = useState<{ id: string; isPending: boolean; error: Error | null } | null>(null)
  const current = result && result.id === incidentId ? result : null
  const currentStatusChange = statusChange && statusChange.id === incidentId ? statusChange : null

  useEffect(() => {
    if (!incidentId) return
    const controller = new AbortController()
    let timeoutId: number | undefined

    function load(id: string) {
      getMonitoringIncident(id, controller.signal).then((data) => {
        if (controller.signal.aborted) return
        setResult((previous) => mergeDetail(previous, id, data))
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
  }, [incidentId, reloadKey])

  async function changeStatus(status: EmergencyStatus, reason?: string) {
    const detail = current?.data
    if (!detail || currentStatusChange?.isPending) return
    const id = detail.id
    setStatusChange({ id, isPending: true, error: null })
    try {
      const updated = await updateMonitoringIncidentStatus(id, { status, expectedRevision: detail.revision, reason })
      setResult((previous) => mergeDetail(previous, id, updated))
      setStatusChange({ id, isPending: false, error: null })
      onStatusChanged?.()
    } catch (reason: unknown) {
      console.error('[monitoring] 관제 상태 변경 실패', reason instanceof ApiRequestError
        ? { status: reason.status, errorCode: reason.errorCode, message: reason.message, incidentId: id }
        : reason)
      setStatusChange({ id, isPending: false, error: reason instanceof Error ? reason : new Error('상태를 변경하지 못했습니다.') })
      // 다른 담당자가 먼저 바꾼 경우(409) 최신 상태를 바로 보여준다.
      if (reason instanceof ApiRequestError && reason.status === 409) setReloadKey((key) => key + 1)
    }
  }

  return {
    detail: current?.data ?? null,
    error: current?.error ?? null,
    isLoading: incidentId !== null && current === null,
    changeStatus,
    isStatusChanging: currentStatusChange?.isPending ?? false,
    statusChangeError: currentStatusChange?.error ?? null,
  }
}
