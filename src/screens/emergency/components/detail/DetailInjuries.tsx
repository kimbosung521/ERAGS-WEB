import type { EmergencyIncidentDetail } from '../../../../types/emergency'
import { codeLabel, dispositionLabels } from '../../emergency.constants'

export default function DetailInjuries({ detail }: { detail: EmergencyIncidentDetail }) {
  const { injuries } = detail.guide
  return injuries.length > 0 ? (
    <ul className="emergency-detail-list">
      {injuries.map((injury) => (
        <li key={injury.injuryId}>
          <strong>{injury.category}</strong>
          <span className="emergency-muted"> · {[injury.subtypeCode, injury.severityCode, codeLabel(dispositionLabels, injury.disposition)].filter(Boolean).join(' · ')}</span>
          {injury.summary && <p>{injury.summary}</p>}
        </li>
      ))}
    </ul>
  ) : <p className="emergency-muted">손상 정보 없음</p>
}
