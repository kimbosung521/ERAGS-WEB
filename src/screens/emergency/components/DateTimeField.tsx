import { useEffect, useId, useRef, useState } from 'react'
import {
  formatDateTime, joinDateTime, monthCells, toDateString, todayKstDate, weekdayLabels,
} from '../emergency.datetime'

interface Props {
  label: string
  /** 한국 시간 'YYYY-MM-DDTHH:mm', 비어 있으면 '' */
  value: string
  onChange: (value: string) => void
  /** 처음 열 때 쓰는 시각. 종료 시각은 하루의 끝(23:59)이 자연스럽다. */
  defaultTime: { hour: number; minute: number }
  min?: string
  max?: string
  /** 값 옆에 붙는 상태 표시(예: 현재 시각을 따라가는 중) */
  badge?: string
  /** 있으면 팝오버에 '현재 시각' 버튼을 보여준다. */
  onNow?: () => void
}

const hours = Array.from({ length: 24 }, (_, index) => index)
const minutes = Array.from({ length: 60 }, (_, index) => index)

export default function DateTimeField({ label, value, onChange, defaultTime, min, max, badge, onNow }: Props) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [date, setDate] = useState('')
  const [hour, setHour] = useState(defaultTime.hour)
  const [minute, setMinute] = useState(defaultTime.minute)
  const [view, setView] = useState({ year: 0, month: 0 })
  const today = todayKstDate()
  const minDate = min?.slice(0, 10)
  const maxDate = max?.slice(0, 10)

  useEffect(() => {
    if (!isOpen) return
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setIsOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  function handleOpen() {
    if (isOpen) {
      setIsOpen(false)
      return
    }
    const initialDate = value.slice(0, 10) || today
    setDate(value.slice(0, 10))
    setHour(value ? Number(value.slice(11, 13)) : defaultTime.hour)
    setMinute(value ? Number(value.slice(14, 16)) : defaultTime.minute)
    setView({ year: Number(initialDate.slice(0, 4)), month: Number(initialDate.slice(5, 7)) - 1 })
    setIsOpen(true)
  }

  function handleMonthMove(step: number) {
    const next = new Date(Date.UTC(view.year, view.month + step, 1))
    setView({ year: next.getUTCFullYear(), month: next.getUTCMonth() })
  }

  function handleApply() {
    if (!date) return
    onChange(joinDateTime(date, hour, minute))
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  function handleNow() {
    onNow?.()
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  function handleClear() {
    onChange('')
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div className="emergency-filter-field emergency-datetime" ref={rootRef}>
      <span id={`${id}-label`}>{label} <small>한국 시간</small></span>
      <button
        ref={triggerRef}
        id={`${id}-trigger`}
        type="button"
        className={`emergency-datetime-trigger${value ? '' : ' empty'}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-labelledby={`${id}-label ${id}-trigger`}
        onClick={handleOpen}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="1.75" y="2.75" width="12.5" height="11.5" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M1.75 6.25h12.5M5 1.25v3M11 1.25v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span>{value ? formatDateTime(value) : '전체 기간'}</span>
        {badge && <em className="emergency-datetime-badge">{badge}</em>}
      </button>

      {isOpen && (
        <div className="emergency-datetime-popover" role="dialog" aria-label={`${label} 선택`}>
          <div className="emergency-calendar-head">
            <button type="button" aria-label="이전 달" onClick={() => handleMonthMove(-1)}>‹</button>
            <strong aria-live="polite">{view.year}년 {view.month + 1}월</strong>
            <button type="button" aria-label="다음 달" onClick={() => handleMonthMove(1)}>›</button>
          </div>
          <div className="emergency-calendar-grid">
            {weekdayLabels.map((weekday) => <span key={weekday} className="emergency-calendar-weekday" aria-hidden="true">{weekday}</span>)}
            {monthCells(view.year, view.month).map((day, index) => {
              if (day === null) return <span key={`blank-${index}`} />
              const cellDate = toDateString(view.year, view.month, day)
              const isDisabled = (minDate !== undefined && cellDate < minDate) || (maxDate !== undefined && cellDate > maxDate)
              return (
                <button
                  key={cellDate}
                  type="button"
                  className={`emergency-calendar-day${cellDate === today ? ' today' : ''}`}
                  aria-pressed={cellDate === date}
                  aria-label={`${view.year}년 ${view.month + 1}월 ${day}일${cellDate === today ? ' (오늘)' : ''}`}
                  disabled={isDisabled}
                  onClick={() => setDate(cellDate)}
                >
                  {day}
                </button>
              )
            })}
          </div>
          <div className="emergency-time">
            <span>시간</span>
            <select aria-label="시" value={hour} onChange={(event) => setHour(Number(event.target.value))}>
              {hours.map((item) => <option key={item} value={item}>{String(item).padStart(2, '0')}시</option>)}
            </select>
            <select aria-label="분" value={minute} onChange={(event) => setMinute(Number(event.target.value))}>
              {minutes.map((item) => <option key={item} value={item}>{String(item).padStart(2, '0')}분</option>)}
            </select>
          </div>
          <div className="emergency-datetime-actions">
            {onNow && <button className="emergency-button now" type="button" onClick={handleNow}>현재 시각</button>}
            <button className="emergency-button" type="button" onClick={handleClear}>지우기</button>
            <button className="emergency-button primary" type="button" disabled={!date} onClick={handleApply}>적용</button>
          </div>
        </div>
      )}
    </div>
  )
}
