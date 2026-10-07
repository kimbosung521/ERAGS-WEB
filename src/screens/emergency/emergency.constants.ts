import type { EmergencyStatus, MonitoringStatusFilter } from '../../types/emergency'

export const emergencyStatusLabels: Record<EmergencyStatus, string> = {
  unconfirmed: '미확인',
  acknowledged: '확인됨',
  responding: '대응 중',
  closed: '종료',
}

export const statusFilterOptions: readonly { value: MonitoringStatusFilter; label: string }[] = [
  { value: 'ACTIVE', label: '진행 중 전체 (종료 제외)' },
  { value: 'NEW', label: emergencyStatusLabels.unconfirmed },
  { value: 'ACKNOWLEDGED', label: emergencyStatusLabels.acknowledged },
  { value: 'RESPONDING', label: emergencyStatusLabels.responding },
  { value: 'CLOSED', label: emergencyStatusLabels.closed },
  { value: 'ALL', label: '전체 (종료 포함)' },
]

// 상세 API의 코드 값 표시 이름. 여기에 없는 새 코드는 코드 그대로 보여준다.
export const guideKindLabels: Record<string, string> = { SINGLE: '단일 손상', COMPOUND: '복합 손상' }

export const generationStatusLabels: Record<string, string> = {
  COMPLETE: '생성 완료', PARTIAL: '일부 생성', ASSESSMENT_ONLY: '평가만 생성', GUIDE_PENDING: '생성 대기',
}

export const ageGroupLabels: Record<string, string> = { CHILD: '소아', ADULT: '성인', ELDERLY: '고령자', UNKNOWN: '연령 미확인' }

export const dispositionLabels: Record<string, string> = { ACTIVE: '처치 대상', DEFERRED: '후순위', HELD: '보류' }

export const progressStatusLabels: Record<string, string> = { IN_PROGRESS: '처치 진행 중', BLOCKED: '처치 막힘', COMPLETED: '처치 완료' }

export const locationStatusLabels: Record<string, string> = {
  AVAILABLE: '수집됨', DENIED: '위치 권한 거부', TIMEOUT: '위치 수집 시간 초과', UNAVAILABLE: '위치 수집 불가',
}

export function codeLabel(labels: Record<string, string>, code: string): string {
  return Object.hasOwn(labels, code) ? labels[code] : code
}
