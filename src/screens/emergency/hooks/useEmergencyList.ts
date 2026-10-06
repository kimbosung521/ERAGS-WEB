import { useEffect, useState } from 'react'
import { getMonitoringIncidents } from '../../../services/monitoring'
import type { EmergencyListResult } from '../../../types/emergency'

export function useEmergencyList() {
  const [request, setRequest] = useState({ offset: 0, revision: 0 })
  const [data, setData] = useState<EmergencyListResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getMonitoringIncidents(request.offset, controller.signal).then((result) => {
      if (!controller.signal.aborted) setData(result)
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason : new Error('사건 목록을 불러오지 못했습니다.'))
      }
    }).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false)
    })
    return () => controller.abort()
  }, [request])

  function handleLoad(offset = request.offset) {
    setIsLoading(true)
    setError(null)
    if (offset !== request.offset) setData(null)
    setRequest({ offset, revision: request.revision + 1 })
  }

  return { data, isLoading, error, offset: request.offset, handleLoad }
}
