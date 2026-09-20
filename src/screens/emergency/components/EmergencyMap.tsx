import type { Emergency } from '../../../types/emergency'
import { useEmergencyMap } from '../hooks/useEmergencyMap'

interface Props {
  emergencies: readonly Emergency[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function EmergencyMap({ emergencies, selectedId, onSelect }: Props) {
  const { containerRef, isReady, error } = useEmergencyMap(emergencies, selectedId, onSelect)
  return (
    <section className="emergency-panel emergency-map-panel" aria-labelledby="emergency-map-heading">
      <h2 id="emergency-map-heading">상황 지도</h2>
      <div className="emergency-map" ref={containerRef} aria-label="위급상황 위치 지도" />
      {error ? <p role="alert">{error}</p> : !isReady && <p role="status">지도를 불러오는 중입니다.</p>}
      <p className="emergency-muted">카카오맵 · 표시된 위치는 가상 사건의 예시 좌표입니다.</p>
    </section>
  )
}
