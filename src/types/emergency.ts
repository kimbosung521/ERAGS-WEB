export type EmergencyStatus = 'unconfirmed' | 'acknowledged' | 'responding' | 'closed'

export interface Emergency {
  id: string
  category: string
  status: EmergencyStatus
  occurredAt: string
  address: string
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

export type MonitoringSupply = { itemId: number | null; itemName: string | null; quantity: number | null }

/** 상세 API(GET /api/v1/monitoring/incidents/{incidentId}) 중 화면에 쓰는 필드. 코드 값은 서버 값을 그대로 둔다. */
export interface EmergencyIncidentDetail {
  id: string
  status: EmergencyStatus
  /** 관제 상태 변경용 revision. progress.revision과 다르다. */
  revision: number
  updatedAt: string
  guide: {
    kind: string
    createdAt: string
    generatedAt: string
    generationStatus: string
    ageGroup: string
    redFlags: string[]
    blockedReasons: string[]
    injuries: {
      injuryId: string
      category: string
      subtypeCode: string | null
      severityCode: string
      summary: string | null
      disposition: string
    }[]
    execution: { executionStepId: string; instruction: string; supplies: MonitoringSupply[] }[]
  }
  location: {
    status: string
    latitude: number | null
    longitude: number | null
    accuracy: number | null
    observedAt: string
    receivedAt: string
  } | null
  progress: {
    source: string
    status: string | null
    currentStepId: string | null
    blockedReason: string | null
    completedStepIds: string[]
    /** null은 사용 기록 미확인이다. */
    usedSupplies: MonitoringSupply[] | null
  }
  history: { status: EmergencyStatus; at: string; actorId: string; reason: string | null }[]
}
