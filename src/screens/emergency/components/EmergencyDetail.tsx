import type { Emergency } from '../../../types/emergency'
import { emergencyStatusLabels } from '../emergency.constants'

interface Props {
  emergency: Emergency | null
}

export default function EmergencyDetail({ emergency }: Props) {
  return (
    <section className="emergency-panel" aria-labelledby="emergency-detail-heading">
      <h2 id="emergency-detail-heading">상황 상세</h2>
      {emergency ? (
        <>
          <div className="emergency-detail-summary">
            <span className={`emergency-status ${emergency.status}`}>
              {emergencyStatusLabels[emergency.status]}
            </span>
            <h3>{emergency.category}</h3>
            <p className="emergency-muted">{emergency.id}</p>
          </div>
          <dl className="emergency-fields">
            <div><dt>대상자</dt><dd>{emergency.person.name} · {emergency.person.age}세</dd></div>
            <div><dt>발생 위치</dt><dd>{emergency.address}</dd></div>
            <div><dt>접수 일시</dt><dd><time dateTime={emergency.occurredAt}>
              {emergency.occurredAt.slice(0, 10)} {emergency.occurredAt.slice(11, 19)} (한국 시간)
            </time></dd></div>
            <div><dt>보호자</dt><dd>{emergency.guardian.name}</dd></div>
            <div><dt>연락처</dt><dd>{emergency.guardian.phone}</dd></div>
          </dl>
        </>
      ) : <p className="emergency-muted">목록 또는 지도에서 상황을 선택하세요.</p>}
    </section>
  )
}
