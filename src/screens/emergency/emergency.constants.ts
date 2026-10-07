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
