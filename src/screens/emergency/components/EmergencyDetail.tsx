import type { Emergency, EmergencyIncidentDetail, MonitoringSupply } from '../../../types/emergency'
import {
  ageGroupLabels, codeLabel, dispositionLabels, emergencyStatusLabels, generationStatusLabels, guideKindLabels,
  locationStatusLabels, progressStatusLabels,
} from '../emergency.constants'

interface Props {
  emergency: Emergency | null
  detail: EmergencyIncidentDetail | null
  isLoading: boolean
  error: Error | null
}

function formatKst(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}

function formatSupply(supply: MonitoringSupply) {
  const name = supply.itemName ?? (supply.itemId !== null ? `물품 #${supply.itemId}` : '물품 미확인')
  return `${name} ${supply.quantity === null ? '(수량 미확인)' : `${supply.quantity}개`}`
}

function DetailSections({ detail }: { detail: EmergencyIncidentDetail }) {
  const { guide, location, progress, history } = detail
  const completed = new Set(progress.completedStepIds)
  // 진행 기록이 없으면(source=UNKNOWN) 실행 여부를 추정하지 않는다.
  const hasProgress = progress.source !== 'UNKNOWN'

  return (
    <>
      <dl className="emergency-fields">
        <div><dt>손상 구분</dt><dd>{codeLabel(guideKindLabels, guide.kind)} · {codeLabel(ageGroupLabels, guide.ageGroup)}</dd></div>
        <div><dt>발생 위치</dt><dd>
          {location ? (
            <>
              {location.latitude !== null && location.longitude !== null
                ? `${location.latitude}, ${location.longitude}${location.accuracy !== null ? ` (오차 ${location.accuracy}m)` : ''}`
                : codeLabel(locationStatusLabels, location.status)}
              <span className="emergency-muted"> · 수집 <time dateTime={location.observedAt}>{formatKst(location.observedAt)}</time></span>
            </>
          ) : '위치 보고 전'}
        </dd></div>
        <div><dt>접수 일시</dt><dd><time dateTime={guide.createdAt}>{formatKst(guide.createdAt)}</time></dd></div>
        <div><dt>가이드</dt><dd>
          {codeLabel(generationStatusLabels, guide.generationStatus)}
          <span className="emergency-muted"> · 저장 <time dateTime={guide.generatedAt}>{formatKst(guide.generatedAt)}</time></span>
        </dd></div>
        {guide.redFlags.length > 0 && <div><dt>위험 신호</dt><dd>{guide.redFlags.join(', ')}</dd></div>}
        {guide.blockedReasons.length > 0 && <div><dt>차단 사유</dt><dd>{guide.blockedReasons.join(', ')}</dd></div>}
      </dl>

      <section className="emergency-detail-section" aria-labelledby="emergency-injuries-heading">
        <h3 id="emergency-injuries-heading">손상 ({guide.injuries.length})</h3>
        {guide.injuries.length > 0 ? (
          <ul className="emergency-detail-list">
            {guide.injuries.map((injury) => (
              <li key={injury.injuryId}>
                <strong>{injury.category}</strong>
                <span className="emergency-muted"> · {[injury.subtypeCode, injury.severityCode, codeLabel(dispositionLabels, injury.disposition)].filter(Boolean).join(' · ')}</span>
                {injury.summary && <p>{injury.summary}</p>}
              </li>
            ))}
          </ul>
        ) : <p className="emergency-muted">손상 정보 없음</p>}
      </section>

      <section className="emergency-detail-section" aria-labelledby="emergency-steps-heading">
        <h3 id="emergency-steps-heading">
          처치 단계
          <small className="emergency-muted">
            {!hasProgress ? '진행 기록 미확인' : progress.status ? codeLabel(progressStatusLabels, progress.status) : '진행 기록 있음'}
          </small>
        </h3>
        {progress.blockedReason && <p className="emergency-notice warning">막힌 사유: {progress.blockedReason}</p>}
        {guide.execution.length > 0 ? (
          <ol className="emergency-detail-list">
            {guide.execution.map((step) => {
              const state = !hasProgress ? null
                : completed.has(step.executionStepId) ? 'done'
                : progress.currentStepId === step.executionStepId ? 'current' : null
              return (
                <li key={step.executionStepId} className={state ? `step-${state}` : undefined}>
                  {state && <span className="emergency-step-badge">{state === 'done' ? '완료' : '진행 중'}</span>}
                  <p>{step.instruction}</p>
                  {step.supplies.length > 0 && <p className="emergency-muted">가이드 필요 물품: {step.supplies.map(formatSupply).join(', ')}</p>}
                </li>
              )
            })}
          </ol>
        ) : <p className="emergency-muted">저장된 처치 단계 없음</p>}
      </section>

      <section className="emergency-detail-section" aria-labelledby="emergency-supplies-heading">
        <h3 id="emergency-supplies-heading">실제 사용 물품</h3>
        {progress.usedSupplies === null ? <p className="emergency-muted">사용 기록 미확인</p>
          : progress.usedSupplies.length > 0 ? (
            <ul className="emergency-detail-list">
              {progress.usedSupplies.map((supply, index) => <li key={`${supply.itemId}-${index}`}>{formatSupply(supply)}</li>)}
            </ul>
          ) : <p className="emergency-muted">사용한 물품 없음</p>}
      </section>

      <section className="emergency-detail-section" aria-labelledby="emergency-history-heading">
        <h3 id="emergency-history-heading">관제 처리 이력</h3>
        {history.length > 0 ? (
          <ol className="emergency-detail-list">
            {history.map((entry, index) => (
              <li key={`${entry.at}-${index}`}>
                <span className={`emergency-status ${entry.status}`}>{emergencyStatusLabels[entry.status]}</span>
                <span className="emergency-muted"> <time dateTime={entry.at}>{formatKst(entry.at)}</time> · 담당자 {entry.actorId}</span>
                {entry.reason && <p>{entry.reason}</p>}
              </li>
            ))}
          </ol>
        ) : <p className="emergency-muted">처리 이력 없음</p>}
      </section>
    </>
  )
}

export default function EmergencyDetail({ emergency, detail, isLoading, error }: Props) {
  // 상세가 목록보다 최신일 수 있으므로 관제 상태는 상세 값을 우선한다.
  const status = detail?.status ?? emergency?.status
  return (
    <section className="emergency-panel" aria-labelledby="emergency-detail-heading">
      <h2 id="emergency-detail-heading">상황 상세</h2>
      {emergency ? (
        <>
          <div className="emergency-detail-summary">
            {status && <span className={`emergency-status ${status}`}>{emergencyStatusLabels[status]}</span>}
            <h3>{emergency.category}</h3>
            <p className="emergency-muted">{emergency.id}</p>
          </div>
          <div className="emergency-notices">
            {isLoading && <p className="emergency-notice" role="status">상세 정보를 불러오는 중입니다.</p>}
            {error && <p className="emergency-notice danger" role="alert">
              {detail ? `상세 갱신 실패: ${error.message} (마지막으로 받은 정보를 표시합니다)` : error.message}
            </p>}
          </div>
          {detail && <DetailSections detail={detail} />}
          <p className="emergency-muted emergency-detail-note">이름·연락처는 관제 API에서 제공되지 않습니다. 시각은 한국 시간입니다.</p>
        </>
      ) : <p className="emergency-muted">목록 또는 지도에서 상황을 선택하세요.</p>}
    </section>
  )
}
