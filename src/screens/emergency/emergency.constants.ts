import type { EmergencyStatus } from '../../types/emergency'

export const emergencyStatusLabels: Record<EmergencyStatus, string> = {
  unconfirmed: '미확인',
  responding: '대응 중',
}
