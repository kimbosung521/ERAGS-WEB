import type { EmergencyStatus } from '../../types/emergency'

export const emergencyStatusLabels: Record<EmergencyStatus, string> = {
  unconfirmed: '미확인',
  acknowledged: '확인됨',
  responding: '대응 중',
  closed: '종료',
}
