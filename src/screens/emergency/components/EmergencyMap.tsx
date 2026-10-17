import { useState } from 'react'
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

function MapPlaceholder({ title, description, onRetry }: { title: string; description: string; onRetry?: () => void }) {
  return (
    <div className="emergency-map-placeholder" role={onRetry ? 'alert' : 'status'}>
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" />
        <path d="m9.5 7.5 5 5m0-5-5 5" />
      </svg>
      <strong>{title}</strong>
      <p>{description}</p>
      {onRetry && <button className="emergency-button" type="button" onClick={onRetry}>지도 다시 불러오기</button>}
    </div>
  )
}

function EmergencyMapContent({ emergencies, selectedId, onSelect, detailLocation, onRetry }: Props & { onRetry: () => void }) {
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
    <>
      <div className="emergency-map" ref={containerRef} aria-label="위급상황 위치 지도" hidden={error !== null} />
      {error ? (
        <MapPlaceholder title="지도를 불러오지 못했습니다" description="네트워크 연결을 확인한 뒤 다시 시도해 주세요. 상황 상세 정보는 계속 확인할 수 있습니다." onRetry={onRetry} />
      ) : (
        <>
          {!isReady && <p role="status">지도를 불러오는 중입니다.</p>}
          <p className="emergency-muted">카카오맵 · 위치 좌표가 있는 사건만 표시합니다. 선택한 사건은 상세의 최신 위치와 오차 범위를 함께 표시합니다.</p>
        </>
      )}
    </>
  )
}

export default function EmergencyMap(props: Props) {
  const [mapAttempt, setMapAttempt] = useState(0)
  const selectedEmergency = props.emergencies.find((emergency) => emergency.id === props.selectedId)
  const location = props.detailLocation ?? selectedEmergency?.location
  const hasLocation = location?.latitude != null && location.longitude != null

  function handleRetry() {
    setMapAttempt((current) => current + 1)
  }

  return (
    <section className="emergency-panel emergency-map-panel" aria-labelledby="emergency-map-heading">
      <h2 id="emergency-map-heading">상황 지도</h2>
      {/* 선택한 사건의 좌표가 없으면 다른 사건이나 기본 지역이 해당 사건의 위치처럼 보이지 않도록 지도를 생성하지 않는다. */}
      {hasLocation ? (
        <EmergencyMapContent key={mapAttempt} {...props} onRetry={handleRetry} />
      ) : (
        <MapPlaceholder
          title={selectedEmergency ? '위치 정보를 확인할 수 없습니다' : '표시할 위치 정보가 없습니다'}
          description={selectedEmergency
            ? '선택한 상황의 위치 정보가 아직 수신되지 않았습니다. 위치가 확인되면 자동으로 지도가 표시됩니다.'
            : '목록에서 위치 정보가 있는 상황을 선택하면 지도가 표시됩니다.'}
        />
      )}
    </section>
  )
}
