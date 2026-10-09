import type { Emergency, EmergencyIncidentDetail } from '../../../types/emergency'
import { useEmergencyMap, type SelectedLocation } from '../hooks/useEmergencyMap'
import { useLocationAddress } from '../hooks/useLocationAddress'
import { formatCoordinates } from './detail/format'

interface Props {
  emergencies: readonly Emergency[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** 선택한 사건의 상세 위치. 상세를 아직 못 받았으면 null. */
  detailLocation: EmergencyIncidentDetail['location']
}

export default function EmergencyMap({ emergencies, selectedId, onSelect, detailLocation }: Props) {
  const latitude = detailLocation?.latitude ?? null
  const longitude = detailLocation?.longitude ?? null
  const { address } = useLocationAddress(latitude, longitude)
  const selectedLocation: SelectedLocation | null = detailLocation && latitude !== null && longitude !== null
    ? {
      latitude, longitude, accuracy: detailLocation.accuracy,
      label: address ?? formatCoordinates(latitude, longitude, detailLocation.accuracy),
    }
    : null
  const { containerRef, isReady, error } = useEmergencyMap(emergencies, selectedId, onSelect, selectedLocation)
  return (
    <section className="emergency-panel emergency-map-panel" aria-labelledby="emergency-map-heading">
      <h2 id="emergency-map-heading">상황 지도</h2>
      <div className="emergency-map" ref={containerRef} aria-label="위급상황 위치 지도" />
      {error ? <p role="alert">{error}</p> : !isReady && <p role="status">지도를 불러오는 중입니다.</p>}
      <p className="emergency-muted">카카오맵 · 위치 좌표가 있는 사건만 표시합니다. 선택한 사건은 상세의 최신 위치와 오차 범위를 함께 표시합니다.</p>
    </section>
  )
}
