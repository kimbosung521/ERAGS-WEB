import type { EmergencyIncidentDetail, MonitoringSupply } from '../../../../types/emergency'
import { codeLabel, locationStatusLabels, progressStatusLabels } from '../../emergency.constants'

export function formatKst(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}

export function formatSupply(supply: MonitoringSupply) {
  const name = supply.itemName ?? (supply.itemId !== null ? `물품 #${supply.itemId}` : '물품 미확인')
  return `${name} ${supply.quantity === null ? '(수량 미확인)' : `${supply.quantity}개`}`
}

export function formatLocation(location: EmergencyIncidentDetail['location']) {
  if (!location) return '위치 보고 전'
  if (location.latitude === null || location.longitude === null) return codeLabel(locationStatusLabels, location.status)
  return `${location.latitude}, ${location.longitude}${location.accuracy !== null ? ` (오차 ${location.accuracy}m)` : ''}`
}

// 진행 기록이 없으면(source=UNKNOWN) 실행 여부를 추정하지 않는다.
export function hasProgressRecord(detail: EmergencyIncidentDetail) {
  return detail.progress.source !== 'UNKNOWN'
}

export function formatProgress(detail: EmergencyIncidentDetail) {
  if (!hasProgressRecord(detail)) return '진행 기록 미확인'
  const { execution } = detail.guide
  const completed = new Set(detail.progress.completedStepIds)
  const done = execution.filter((step) => completed.has(step.executionStepId)).length
  const status = detail.progress.status ? codeLabel(progressStatusLabels, detail.progress.status) : '진행 기록 있음'
  return execution.length > 0 ? `${status} · ${done}/${execution.length} 완료` : status
}
