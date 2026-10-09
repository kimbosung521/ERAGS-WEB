import type { EmergencyIncidentDetail, MonitoringSupply } from '../../../../types/emergency'
import { codeLabel, progressStatusLabels } from '../../emergency.constants'

export function formatKst(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}

export function formatSupply(supply: MonitoringSupply) {
  const name = supply.itemName ?? (supply.itemId !== null ? `물품 #${supply.itemId}` : '물품 미확인')
  return `${name} ${supply.quantity === null ? '(수량 미확인)' : `${supply.quantity}개`}`
}

/** 좌표는 소수 5자리(약 1m)로, 오차는 미터 단위 정수로 줄여 읽기 쉽게 한다. */
export function formatCoordinates(latitude: number, longitude: number, accuracy: number | null) {
  const coordinates = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
  return accuracy === null ? coordinates : `${coordinates} (오차 약 ${Math.round(accuracy)}m)`
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
