import { ApiRequestError, authenticatedFetch, isRecord } from './api'
import { getAdminAccessToken } from './auth'
import type { Emergency, EmergencyListResult, EmergencyStatus } from '../types/emergency'

const statuses: Record<string, EmergencyStatus> = {
  NEW: 'unconfirmed', ACKNOWLEDGED: 'acknowledged', RESPONDING: 'responding', CLOSED: 'closed',
}

function invalidResponse(): never {
  throw new ApiRequestError(200, '사건 목록 응답 형식이 올바르지 않습니다.', 'INVALID_RESPONSE')
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function parseIncident(value: unknown): Emergency {
  if (
    !isRecord(value) || typeof value.incidentId !== 'string' || !value.incidentId.trim() ||
    typeof value.status !== 'string' || !Object.hasOwn(statuses, value.status) ||
    !isRecord(value.guide) || typeof value.guide.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.guide.createdAt)) || !Array.isArray(value.guide.injuries)
  ) return invalidResponse()

  const categories = value.guide.injuries.map((injury: unknown) => {
    if (!isRecord(injury) || typeof injury.categoryCode !== 'string') return invalidResponse()
    return injury.categoryCode
  })
  let location: Emergency['location'] = null
  if (value.location !== null) {
    if (!isRecord(value.location)) return invalidResponse()
    const { latitude, longitude } = value.location
    if (latitude !== null || longitude !== null) {
      if (
        typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
        typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180
      ) return invalidResponse()
      location = { latitude, longitude }
    }
  }
  // 관제 DTO가 제공하지 않는 개인정보와 주소는 가상 데이터로 보충하지 않는다.
  return {
    id: value.incidentId, status: statuses[value.status],
    category: categories.join(' · ') || '손상 정보 없음', occurredAt: value.guide.createdAt,
    person: null, guardian: null, location,
    address: location ? `${location.latitude}, ${location.longitude}` : '위치 미확인',
  }
}

export async function getMonitoringIncidents(offset = 0, signal?: AbortSignal): Promise<EmergencyListResult> {
  const accessToken = getAdminAccessToken()
  if (!accessToken) throw new ApiRequestError(401, '로그인이 필요합니다.', 'AUTH_REQUIRED')
  const query = new URLSearchParams({ status: 'ACTIVE', limit: '50', offset: String(offset) })
  const payload = await authenticatedFetch(`/api/v1/monitoring/incidents?${query}`, accessToken, signal)
  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) return invalidResponse()
  const { data } = payload
  if (
    !Array.isArray(data.items) || !isNonNegativeInteger(data.total) ||
    !(data.nextOffset === null || (isNonNegativeInteger(data.nextOffset) && data.nextOffset > offset)) ||
    typeof data.fetchedAt !== 'string' || !Number.isFinite(Date.parse(data.fetchedAt)) ||
    !isNonNegativeInteger(data.eventCursor)
  ) return invalidResponse()
  return {
    items: data.items.map(parseIncident), total: data.total, nextOffset: data.nextOffset,
    fetchedAt: data.fetchedAt, eventCursor: data.eventCursor,
  }
}
