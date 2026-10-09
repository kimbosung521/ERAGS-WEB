import type { EmergencyIncidentDetail } from '../../../../types/emergency'
import { codeLabel, locationStatusLabels } from '../../emergency.constants'
import { useLocationAddress } from '../../hooks/useLocationAddress'
import { formatCoordinates } from './format'

const addressNotes = { loading: '주소 확인 중', failed: '주소 확인 불가', ready: '해당 주소 없음' } as const

// 주소를 앞에 두고 좌표·오차는 보조 정보로 보여준다. 주소를 못 구하면 좌표만 보여준다.
export default function LocationText({ location }: { location: EmergencyIncidentDetail['location'] }) {
  const { status, address } = useLocationAddress(location?.latitude ?? null, location?.longitude ?? null)
  if (!location) return '위치 보고 전'
  if (location.latitude === null || location.longitude === null) return codeLabel(locationStatusLabels, location.status)
  const coordinates = formatCoordinates(location.latitude, location.longitude, location.accuracy)
  return address
    ? <>{address}<span className="emergency-muted"> · {coordinates}</span></>
    : <>{coordinates}<span className="emergency-muted"> · {addressNotes[status]}</span></>
}
