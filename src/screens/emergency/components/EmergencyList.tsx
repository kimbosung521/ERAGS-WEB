import type { Emergency } from '../../../types/emergency'
import { emergencyStatusLabels } from '../emergency.constants'

interface Props {
  emergencies: readonly Emergency[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function EmergencyList({ emergencies, selectedId, onSelect }: Props) {
  return (
    <section className="emergency-panel" aria-labelledby="emergency-list-heading">
      <h2 id="emergency-list-heading">위급상황 목록 <small>{emergencies.length}건</small></h2>
      {emergencies.length === 0 && <p>접수된 위급상황이 없습니다.</p>}
      <ul className="emergency-list">
        {emergencies.map((emergency) => (
          <li key={emergency.id}>
            <button
              className="emergency-item"
              aria-pressed={selectedId === emergency.id}
              onClick={() => onSelect(emergency.id)}
            >
              <span className={`emergency-status ${emergency.status}`}>
                {emergencyStatusLabels[emergency.status]}
              </span>
              <strong>{emergency.category}</strong>
              <span>{emergency.person.name} · {emergency.person.age}세</span>
              <span className="emergency-muted">{emergency.address}</span>
              <time dateTime={emergency.occurredAt}>{emergency.occurredAt.slice(11, 19)} 접수</time>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
