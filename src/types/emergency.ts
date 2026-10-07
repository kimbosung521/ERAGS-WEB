export type EmergencyStatus = 'unconfirmed' | 'acknowledged' | 'responding' | 'closed'

export interface Emergency {
  id: string
  category: string
  status: EmergencyStatus
  occurredAt: string
  person: { name: string; age: number } | null
  address: string
  guardian: { name: string; phone: string } | null
  location: { latitude: number; longitude: number } | null
}

export interface EmergencyListResult {
  items: Emergency[]
  /** 형식 오류로 items에서 제외된 사건 수 */
  invalidCount: number
  total: number
  nextOffset: number | null
  fetchedAt: string
  eventCursor: number
}

export type MonitoringStatusFilter = 'ACTIVE' | 'ALL' | 'NEW' | 'ACKNOWLEDGED' | 'RESPONDING' | 'CLOSED'

export interface MonitoringIncidentFilter {
  status: MonitoringStatusFilter
  /** 시차를 포함한 ISO 8601 시각. 세션 생성 시각 기준이며 양끝을 포함한다. */
  from: string | null
  to: string | null
}

/** 화면의 조회 조건. toFollowsNow이면 to를 무시하고 요청할 때마다 현재 시각을 종료 시각으로 쓴다. */
export interface EmergencyFilterState extends MonitoringIncidentFilter {
  toFollowsNow: boolean
}
