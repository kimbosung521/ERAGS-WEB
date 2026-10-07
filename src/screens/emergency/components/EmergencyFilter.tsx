import { useState, type FormEvent } from 'react'
import type { EmergencyFilterState, MonitoringStatusFilter } from '../../../types/emergency'
import { statusFilterOptions } from '../emergency.constants'
import { kstValueFromNow, todayIncidentFilter, todayKstDate, toKstIso } from '../emergency.datetime'
import DateTimeField from './DateTimeField'

interface Props {
  filter: EmergencyFilterState
  disabled?: boolean
  onApply: (filter: EmergencyFilterState) => void
}

const HOUR_MS = 60 * 60 * 1000

// 빠른 기간은 시작 시각을 정하고 종료 시각은 현재 시각을 따라가게 한다. '전체 기간'은 둘 다 비운다.
const rangePresets: readonly { key: string; label: string; from: () => string }[] = [
  { key: 'all', label: '전체 기간', from: () => '' },
  { key: '1h', label: '최근 1시간', from: () => kstValueFromNow(-HOUR_MS) },
  { key: 'today', label: '오늘', from: () => `${todayKstDate()}T00:00` },
  { key: '24h', label: '최근 24시간', from: () => kstValueFromNow(-24 * HOUR_MS) },
  { key: '7d', label: '최근 7일', from: () => kstValueFromNow(-7 * 24 * HOUR_MS) },
]

function toInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 16) : ''
}

function matchPreset(filter: EmergencyFilterState): string | null {
  if (!filter.from && !filter.to && !filter.toFollowsNow) return 'all'
  return filter.from === todayIncidentFilter().from ? 'today' : null
}

export default function EmergencyFilter({ filter, disabled = false, onApply }: Props) {
  const [status, setStatus] = useState<MonitoringStatusFilter>(filter.status)
  const [from, setFrom] = useState(toInputValue(filter.from))
  const [to, setTo] = useState(toInputValue(filter.to))
  const [toFollowsNow, setToFollowsNow] = useState(filter.toFollowsNow)
  const [presetKey, setPresetKey] = useState<string | null>(() => matchPreset(filter))
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const end = toFollowsNow ? kstValueFromNow() : to
    if (from && end && from > end) {
      setError(toFollowsNow ? '시작 시각이 현재 시각보다 늦습니다.' : '시작 시각이 종료 시각보다 늦습니다.')
      return
    }
    setError(null)
    onApply({ status, from: toKstIso(from, false), to: toFollowsNow ? null : toKstIso(to, true), toFollowsNow })
  }

  function handleReset() {
    const next = todayIncidentFilter()
    setStatus(next.status)
    setFrom(toInputValue(next.from))
    setTo('')
    setToFollowsNow(true)
    setPresetKey('today')
    setError(null)
    onApply(next)
  }

  function handlePreset(preset: (typeof rangePresets)[number]) {
    setFrom(preset.from())
    setTo('')
    setToFollowsNow(preset.key !== 'all')
    setPresetKey(preset.key)
    setError(null)
  }

  function handleFromChange(value: string) {
    setFrom(value)
    setPresetKey(null)
  }

  function handleToChange(value: string) {
    setTo(value)
    setToFollowsNow(false)
    setPresetKey(null)
  }

  function handleToNow() {
    setTo('')
    setToFollowsNow(true)
  }

  return (
    <form className="emergency-filter" aria-label="사건 조회 조건" onSubmit={handleSubmit}>
      <label className="emergency-filter-field">
        <span>처리 상태</span>
        <select value={status} onChange={(event) => setStatus(event.target.value as MonitoringStatusFilter)}>
          {statusFilterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <DateTimeField label="접수 시작" value={from} max={(toFollowsNow ? kstValueFromNow() : to) || undefined} defaultTime={{ hour: 0, minute: 0 }} onChange={handleFromChange} />
      {/* 현재 시각을 따라가는 동안에는 부모가 갱신될 때마다(5초) 표시 시각도 함께 바뀐다. */}
      <DateTimeField
        label="접수 종료"
        value={toFollowsNow ? kstValueFromNow() : to}
        min={from || undefined}
        defaultTime={{ hour: 23, minute: 59 }}
        badge={toFollowsNow ? '현재' : undefined}
        onChange={handleToChange}
        onNow={handleToNow}
      />
      <div className="emergency-filter-actions">
        <button className="emergency-button" type="button" disabled={disabled} onClick={handleReset}>초기화</button>
        <button className="emergency-button primary" type="submit" disabled={disabled}>조회</button>
      </div>
      <div className="emergency-presets" role="group" aria-label="빠른 기간 선택">
        {rangePresets.map((preset) => (
          <button key={preset.key} type="button" className="emergency-chip" aria-pressed={presetKey === preset.key} onClick={() => handlePreset(preset)}>
            {preset.label}
          </button>
        ))}
      </div>
      {error && <p className="emergency-filter-error" role="alert">{error}</p>}
    </form>
  )
}
