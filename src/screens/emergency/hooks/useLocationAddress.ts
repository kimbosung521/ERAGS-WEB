import { useEffect, useState } from 'react'
import { reverseGeocode } from '../../../services/kakaoMaps'

type AddressResult =
  | { status: 'loading' | 'failed'; address: null }
  | { status: 'ready'; address: string | null }

// 좌표를 주소로 바꿔 보여준다. 좌표 객체는 주기 조회마다 새로 만들어지므로 값이 바뀔 때만 다시 조회한다.
export function useLocationAddress(latitude: number | null, longitude: number | null): AddressResult {
  const [result, setResult] = useState<{ key: string } & AddressResult | null>(null)
  const key = latitude === null || longitude === null ? null : `${latitude},${longitude}`

  useEffect(() => {
    if (key === null || latitude === null || longitude === null) return
    let isCancelled = false
    reverseGeocode(latitude, longitude).then((address) => {
      if (!isCancelled) setResult({ key, status: 'ready', address })
    }).catch((reason: unknown) => {
      if (isCancelled) return
      console.error('[kakao] 주소 조회 실패', reason)
      setResult({ key, status: 'failed', address: null })
    })
    return () => { isCancelled = true }
  }, [key, latitude, longitude])

  // 좌표가 바뀐 직후 이전 좌표의 주소가 보이지 않도록 결과에 저장된 좌표와 비교한다.
  return result && result.key === key ? result : { status: 'loading', address: null }
}
