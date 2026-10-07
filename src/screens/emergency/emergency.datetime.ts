import type { EmergencyFilterState, MonitoringIncidentFilter } from '../../types/emergency'

// 관제 화면의 날짜·시간 입력값은 한국 시간 기준 'YYYY-MM-DDTHH:mm' 문자열로 다룬다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const weekdays = ['일', '월', '화', '수', '목', '금', '토']

function pad(value: number) {
  return String(value).padStart(2, '0')
}

/** 지금으로부터 offsetMs만큼 이동한 한국 시각을 입력값 형식으로 돌려준다. */
export function kstValueFromNow(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs + KST_OFFSET_MS).toISOString().slice(0, 16)
}

export function todayKstDate(): string {
  return kstValueFromNow().slice(0, 10)
}

// 입력값(YYYY-MM-DDTHH:mm)을 한국 시간으로 해석해 시차를 붙인다.
// 분 단위 입력이라 종료 시각은 해당 분의 끝(59초)까지 포함한다.
export function toKstIso(value: string, isEnd: boolean): string | null {
  if (!value) return null
  return `${value.slice(0, 16)}:${isEnd ? '59' : '00'}+09:00`
}

/** 관제 화면의 기본 조회 조건: 진행 중 사건 중 오늘 0시부터 현재 시각까지(한국 시간) 접수된 것. */
export function todayIncidentFilter(): EmergencyFilterState {
  return { status: 'ACTIVE', from: toKstIso(`${todayKstDate()}T00:00`, false), to: null, toFollowsNow: true }
}

/** 요청 직전에 호출해 '현재 시각까지'를 실제 시각으로 바꾼다. 자동 갱신마다 종료 시각이 함께 밀려 새 사건이 빠지지 않는다. */
export function resolveIncidentFilter({ toFollowsNow, ...filter }: EmergencyFilterState): MonitoringIncidentFilter {
  return toFollowsNow ? { ...filter, to: toKstIso(kstValueFromNow(), true) } : filter
}

export function toDateString(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

export function joinDateTime(date: string, hour: number, minute: number): string {
  return `${date}T${pad(hour)}:${pad(minute)}`
}

/** 달력 한 장(6주)의 날짜. 이전·다음 달 칸은 null이다. */
export function monthCells(year: number, month: number): (number | null)[] {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay()
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1
    return day >= 1 && day <= days ? day : null
  })
}

function weekdayOf(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
}

export const weekdayLabels = weekdays

/** '2026.10.06 (화) 14:30' */
export function formatDateTime(value: string): string {
  const date = value.slice(0, 10)
  return `${date.replaceAll('-', '.')} (${weekdayOf(date)}) ${value.slice(11, 16)}`
}
