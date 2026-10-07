import type { EmergencyIncidentDetail } from '../../../../types/emergency'
import { emergencyStatusLabels } from '../../emergency.constants'
import { formatKst } from './format'

export default function DetailHistory({ detail }: { detail: EmergencyIncidentDetail }) {
  const { history } = detail
  return history.length > 0 ? (
    <ol className="emergency-detail-list">
      {history.map((entry, index) => (
        <li key={`${entry.at}-${index}`}>
          <span className={`emergency-status ${entry.status}`}>{emergencyStatusLabels[entry.status]}</span>
          <span className="emergency-muted"> <time dateTime={entry.at}>{formatKst(entry.at)}</time> · 담당자 {entry.actorId}</span>
          {entry.reason && <p>{entry.reason}</p>}
        </li>
      ))}
    </ol>
  ) : <p className="emergency-muted">처리 이력 없음</p>
}
