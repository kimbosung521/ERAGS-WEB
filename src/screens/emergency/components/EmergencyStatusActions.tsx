import { useState, type FormEvent } from 'react'
import type { EmergencyStatus } from '../../../types/emergency'

interface Props {
  status: EmergencyStatus
  isPending: boolean
  error: Error | null
  onChange: (status: EmergencyStatus, reason?: string) => void
}

// 서버가 허용하는 순서(NEW → ACKNOWLEDGED → RESPONDING → CLOSED)대로 다음 단계만 보여준다.
const nextActions: Partial<Record<EmergencyStatus, { status: EmergencyStatus; label: string }>> = {
  unconfirmed: { status: 'acknowledged', label: '확인' },
  acknowledged: { status: 'responding', label: '대응 시작' },
  responding: { status: 'closed', label: '종료' },
}

const REASON_MAX_LENGTH = 500

export default function EmergencyStatusActions({ status, isPending, error, onChange }: Props) {
  const [reason, setReason] = useState('')
  const next = nextActions[status]

  // 종료된 사건은 사유를 적어야 다시 확인 단계로 열 수 있다.
  function handleReopen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reason.trim()) return
    onChange('acknowledged', reason)
    setReason('')
  }

  return (
    // 다음 단계 버튼만 있을 때는 요약 오른쪽에 붙이고, 재개 입력칸이나 오류가 있으면 요약 아래 전체 폭을 쓴다.
    <div className={`emergency-status-actions${!next || error ? ' wide' : ''}`}>
      {next ? (
        <button
          className="emergency-button primary" type="button" disabled={isPending} onClick={() => onChange(next.status)}
          title="관제 처리 상태만 바뀌며 실제 처치 완료·물품 차감은 발생하지 않습니다."
        >
          {isPending ? '변경 중…' : next.label}
        </button>
      ) : (
        <form className="emergency-reopen" onSubmit={handleReopen}>
          <label htmlFor="emergency-reopen-reason">재개 사유</label>
          <textarea
            id="emergency-reopen-reason" value={reason} maxLength={REASON_MAX_LENGTH} rows={2}
            placeholder="다시 확인이 필요한 이유를 입력하세요." onChange={(event) => setReason(event.target.value)}
          />
          <button className="emergency-button" type="submit" disabled={isPending || !reason.trim()}>
            {isPending ? '변경 중…' : '다시 열기'}
          </button>
        </form>
      )}
      {error && <p className="emergency-notice danger" role="alert">{error.message}</p>}
    </div>
  )
}
