import type { Emergency, EmergencyIncidentDetail, EmergencyStatus } from '../../../types/emergency'
import { emergencyStatusLabels } from '../emergency.constants'
import DetailTabs from './detail/DetailTabs'
import { formatLocation, formatProgress } from './detail/format'
import EmergencyStatusActions from './EmergencyStatusActions'

interface Props {
  emergency: Emergency | null
  detail: EmergencyIncidentDetail | null
  isLoading: boolean
  error: Error | null
  isStatusChanging: boolean
  statusChangeError: Error | null
  onStatusChange: (status: EmergencyStatus, reason?: string) => void
}

// 관제 상태·상태 변경·핵심 정보는 위에 고정하고, 나머지는 탭으로 나눠 패널이 길어지지 않게 한다.
export default function EmergencyDetail({
  emergency, detail, isLoading, error, isStatusChanging, statusChangeError, onStatusChange,
}: Props) {
  // 상세가 목록보다 최신일 수 있으므로 관제 상태는 상세 값을 우선한다.
  const status = detail?.status ?? emergency?.status
  return (
    <section className="emergency-panel" aria-labelledby="emergency-detail-heading">
      <h2 id="emergency-detail-heading">상황 상세</h2>
      {emergency ? (
        <>
          {/* 요약과 상태 변경 버튼을 한 줄에 두어 탭이 화면 위쪽에서 시작하게 한다. */}
          <div className="emergency-detail-summary">
            <div className="emergency-detail-title">
              <p>
                {status && <span className={`emergency-status ${status}`}>{emergencyStatusLabels[status]}</span>}
                <span className="emergency-muted">{emergency.id}</span>
              </p>
              <h3>{emergency.category}</h3>
            </div>
            {/* 상태 변경에는 상세의 revision이 필요하므로 상세를 받은 뒤에만 보여준다. 사건이 바뀌면 입력 중인 사유를 비운다. */}
            {detail && (
              <EmergencyStatusActions
                key={detail.id} status={detail.status} isPending={isStatusChanging} error={statusChangeError} onChange={onStatusChange}
              />
            )}
          </div>
          <div className="emergency-notices">
            {isLoading && <p className="emergency-notice" role="status">상세 정보를 불러오는 중입니다.</p>}
            {error && <p className="emergency-notice danger" role="alert">
              {detail ? `상세 갱신 실패: ${error.message} (마지막으로 받은 정보를 표시합니다)` : error.message}
            </p>}
          </div>
          {detail && (
            <>
              <dl className="emergency-fields compact">
                <div><dt>위치</dt><dd>{formatLocation(detail.location)}</dd></div>
                <div><dt>처치</dt><dd>{formatProgress(detail)}</dd></div>
                {detail.guide.redFlags.length > 0 && <div><dt>위험 신호</dt><dd className="emergency-danger-text">{detail.guide.redFlags.join(', ')}</dd></div>}
              </dl>
              <DetailTabs detail={detail} />
            </>
          )}
        </>
      ) : <p className="emergency-muted">목록 또는 지도에서 상황을 선택하세요.</p>}
    </section>
  )
}
