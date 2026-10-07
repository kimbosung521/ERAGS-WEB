import type { EmergencyIncidentDetail } from '../../../../types/emergency'
import { ageGroupLabels, codeLabel, generationStatusLabels, guideKindLabels } from '../../emergency.constants'
import { formatKst, formatLocation } from './format'

export default function DetailInfo({ detail }: { detail: EmergencyIncidentDetail }) {
  const { guide, location } = detail
  return (
    <dl className="emergency-fields">
      <div><dt>손상 구분</dt><dd>{codeLabel(guideKindLabels, guide.kind)} · {codeLabel(ageGroupLabels, guide.ageGroup)}</dd></div>
      <div><dt>접수 일시</dt><dd><time dateTime={guide.createdAt}>{formatKst(guide.createdAt)}</time></dd></div>
      <div><dt>가이드</dt><dd>
        {codeLabel(generationStatusLabels, guide.generationStatus)}
        <span className="emergency-muted"> · 저장 <time dateTime={guide.generatedAt}>{formatKst(guide.generatedAt)}</time></span>
      </dd></div>
      <div><dt>발생 위치</dt><dd>
        {formatLocation(location)}
        {location && <span className="emergency-muted"> · 수집 <time dateTime={location.observedAt}>{formatKst(location.observedAt)}</time></span>}
      </dd></div>
      {guide.blockedReasons.length > 0 && <div><dt>차단 사유</dt><dd>{guide.blockedReasons.join(', ')}</dd></div>}
      <div><dt>안내</dt><dd className="emergency-muted">
        관제 상태 변경은 처리 상태만 바꾸며 실제 처치 완료·물품 차감은 발생하지 않습니다.
        이름·연락처는 관제 API에서 제공되지 않습니다. 시각은 한국 시간입니다.
      </dd></div>
    </dl>
  )
}
