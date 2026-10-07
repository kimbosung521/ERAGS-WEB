import { ApiRequestError, authenticatedFetch, getJson, isRecord } from './api'
import { getAdminAccessToken } from './auth'
import type { Emergency, EmergencyListResult, EmergencyStatus, MonitoringIncidentFilter } from '../types/emergency'

const statuses: Record<string, EmergencyStatus> = {
  NEW: 'unconfirmed', ACKNOWLEDGED: 'acknowledged', RESPONDING: 'responding', CLOSED: 'closed',
}

export const MONITORING_PAGE_SIZE = 50
export const DEFAULT_MONITORING_FILTER: MonitoringIncidentFilter = { status: 'ACTIVE', from: null, to: null }
const CATEGORY_LABELS_TIMEOUT_MS = 2_000

let categoryLabelsRequest: Promise<Record<string, string>> | null = null
// 백엔드 확인용 요청 로그. 5초 자동 갱신마다 찍히지 않도록 조회 조건이 바뀔 때만 남긴다.
let lastLoggedQuery: string | null = null

// 라벨은 표시용이므로 조회에 실패해도 목록은 코드로 보여주고, 다음 조회 때 다시 시도한다.
function loadCategoryLabels(): Promise<Record<string, string>> {
  categoryLabelsRequest ??= getJson('/api/v2/first-aid/categories').then((payload) => {
    if (!isRecord(payload) || !Array.isArray(payload.data)) throw new Error('INVALID_RESPONSE')
    const labels: Record<string, string> = {}
    for (const category of payload.data) {
      if (isRecord(category) && typeof category.category_code === 'string' && typeof category.category_name === 'string') {
        labels[category.category_code] = category.category_name
      }
    }
    return labels
  }).catch(() => {
    categoryLabelsRequest = null
    return {}
  })
  return categoryLabelsRequest
}

function loadCategoryLabelsWithin(timeoutMs: number): Promise<Record<string, string>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<Record<string, string>>((resolve) => {
    timeoutId = setTimeout(() => resolve({}), timeoutMs)
  })
  return Promise.race([loadCategoryLabels(), timeout]).finally(() => clearTimeout(timeoutId))
}

function invalidResponse(): never {
  throw new ApiRequestError(200, '사건 목록 응답 형식이 올바르지 않습니다.', 'INVALID_RESPONSE')
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function parseLocation(value: unknown): Emergency['location'] | undefined {
  if (value === null) return null
  if (!isRecord(value)) return undefined
  const { latitude, longitude } = value
  if (latitude === null && longitude === null) return null
  if (
    typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
    typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180
  ) return undefined
  return { latitude, longitude }
}

// 사건 하나의 형식 오류가 나머지 위급상황까지 가리지 않도록 실패한 항목만 null로 돌려준다.
function parseIncident(value: unknown, categoryLabels: Record<string, string>): Emergency | null {
  if (
    !isRecord(value) || typeof value.incidentId !== 'string' || !value.incidentId.trim() ||
    typeof value.status !== 'string' || !Object.hasOwn(statuses, value.status) ||
    !isRecord(value.guide) || typeof value.guide.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.guide.createdAt)) || !Array.isArray(value.guide.injuries)
  ) return null

  const categories: string[] = []
  for (const injury of value.guide.injuries) {
    if (!isRecord(injury) || typeof injury.categoryCode !== 'string') return null
    categories.push(Object.hasOwn(categoryLabels, injury.categoryCode) ? categoryLabels[injury.categoryCode] : injury.categoryCode)
  }
  const location = parseLocation(value.location)
  if (location === undefined) return null
  // 관제 DTO가 제공하지 않는 개인정보와 주소는 가상 데이터로 보충하지 않는다.
  return {
    id: value.incidentId, status: statuses[value.status],
    category: categories.join(' · ') || '손상 정보 없음', occurredAt: value.guide.createdAt,
    person: null, guardian: null, location,
    address: location ? `${location.latitude}, ${location.longitude}` : '위치 미확인',
  }
}

export async function getMonitoringIncidents(
  filter: MonitoringIncidentFilter = DEFAULT_MONITORING_FILTER, offset = 0, signal?: AbortSignal,
): Promise<EmergencyListResult> {
  const accessToken = getAdminAccessToken()
  if (!accessToken) throw new ApiRequestError(401, '로그인이 필요합니다.', 'AUTH_REQUIRED')
  const query = new URLSearchParams({ status: filter.status, limit: String(MONITORING_PAGE_SIZE), offset: String(offset) })
  if (filter.from) query.set('from', filter.from)
  if (filter.to) query.set('to', filter.to)
  if (String(query) !== lastLoggedQuery) {
    lastLoggedQuery = String(query)
    console.info(
      `[monitoring] 사건 목록 조회 요청
` +
      `  status=${filter.status} limit=${MONITORING_PAGE_SIZE} offset=${offset}
` +
      `  from=${filter.from ?? '(보내지 않음)'}
` +
      `  to=${filter.to ?? '(보내지 않음)'}
` +
      `  GET /api/v1/monitoring/incidents?${query}`,
    )
  }
  const [payload, categoryLabels] = await Promise.all([
    authenticatedFetch(`/api/v1/monitoring/incidents?${query}`, accessToken, signal),
    loadCategoryLabelsWithin(CATEGORY_LABELS_TIMEOUT_MS),
  ])
  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) return invalidResponse()
  const { data } = payload
  if (
    !Array.isArray(data.items) || !isNonNegativeInteger(data.total) ||
    !(data.nextOffset === null || (isNonNegativeInteger(data.nextOffset) && data.nextOffset > offset)) ||
    typeof data.fetchedAt !== 'string' || !Number.isFinite(Date.parse(data.fetchedAt)) ||
    !isNonNegativeInteger(data.eventCursor)
  ) return invalidResponse()
  const items: Emergency[] = []
  let invalidCount = 0
  for (const item of data.items) {
    const incident = parseIncident(item, categoryLabels)
    if (incident) items.push(incident)
    else invalidCount += 1
  }
  if (invalidCount > 0) console.warn(`사건 목록 응답 중 형식이 올바르지 않은 ${invalidCount}건을 제외했습니다.`)
  return {
    items, invalidCount, total: data.total, nextOffset: data.nextOffset,
    fetchedAt: data.fetchedAt, eventCursor: data.eventCursor,
  }
}
