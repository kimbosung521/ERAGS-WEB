interface LatLng {
  getLat(): number
  getLng(): number
}
export interface KakaoMap {
  relayout(): void
  setCenter(position: LatLng): void
  getCenter(): LatLng
}
export interface MapShape {
  setMap(map: KakaoMap | null): void
}
interface Overlay extends MapShape {
  setZIndex(index: number): void
}
interface GeocoderResult {
  address: { address_name: string } | null
  road_address: { address_name: string; building_name: string } | null
}
interface Geocoder {
  coord2Address(longitude: number, latitude: number, callback: (result: GeocoderResult[], status: string) => void): void
}
interface KakaoMaps {
  load(callback: () => void): void
  services?: {
    Status: { OK: string; ZERO_RESULT: string; ERROR: string }
    Geocoder: new () => Geocoder
  }
  LatLng: new (latitude: number, longitude: number) => LatLng
  Map: new (container: HTMLElement, options: { center: LatLng; level: number }) => KakaoMap
  CustomOverlay: new (options: {
    map: KakaoMap; position: LatLng; content: HTMLElement; yAnchor: number; zIndex?: number
  }) => Overlay
  Circle: new (options: {
    map: KakaoMap; center: LatLng; radius: number
    strokeWeight?: number; strokeColor?: string; strokeOpacity?: number; fillColor?: string; fillOpacity?: number
  }) => MapShape
}
declare global {
  interface Window {
    kakao?: { maps: KakaoMaps }
  }
}
let sdkPromise: Promise<KakaoMaps> | undefined

export function loadKakaoMaps(): Promise<KakaoMaps> {
  if (sdkPromise) return sdkPromise
  const appKey = import.meta.env.VITE_KAKAO_MAP_APP_KEY?.trim()
  if (!appKey) return Promise.reject(new Error('카카오 지도 키가 설정되지 않았습니다.'))
  // StrictMode와 여러 지도에서 SDK를 중복 삽입하지 않도록 로딩을 공유한다.
  sdkPromise = new Promise<KakaoMaps>((resolve, reject) => {
    const script = document.createElement('script')
    const timeout = window.setTimeout(() => handleError(), 15000)
    function handleError() {
      window.clearTimeout(timeout)
      script.remove()
      reject(new Error('카카오 지도를 불러오지 못했습니다. 네트워크 또는 지도 사용 설정을 확인하세요.'))
    }
    script.async = true
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=services`
    script.onerror = handleError
    script.onload = () => {
      const maps = window.kakao?.maps
      if (!maps) { handleError(); return }
      maps.load(() => { window.clearTimeout(timeout); resolve(maps) })
    }
    document.head.appendChild(script)
  }).catch((error: unknown) => { sdkPromise = undefined; throw error })
  return sdkPromise
}

// 상세는 5초마다 다시 조회되고 요약·정보 탭이 같은 좌표를 보여주므로, 좌표마다 한 번만 주소를 조회한다.
const addressCache = new Map<string, Promise<string | null>>()

/** 건물명이 있으면 "동양미래대학교 (서울특별시 구로구 경인로 445-3)"처럼 장소를 먼저 보여준다. */
function describePlace(result: GeocoderResult | undefined): string | null {
  const road = result?.road_address
  const address = road?.address_name ?? result?.address?.address_name ?? null
  const building = road?.building_name.trim()
  return address && building ? `${building} (${address})` : address
}

/** 좌표를 장소·도로명 주소(없으면 지번 주소)로 바꾼다. 결과가 없으면 null. */
export function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  const key = `${latitude},${longitude}`
  const cached = addressCache.get(key)
  if (cached) return cached
  const promise = loadKakaoMaps().then((maps) => new Promise<string | null>((resolve, reject) => {
    // 주소 라이브러리 없이 로드된 SDK가 남아 있으면(페이지를 새로 고치지 않은 경우) 원인을 알 수 있게 한다.
    const { services } = maps
    if (!services) { reject(new Error('카카오 주소 라이브러리가 로드되지 않았습니다. 페이지를 새로 고쳐 주세요.')); return }
    new services.Geocoder().coord2Address(longitude, latitude, (result, status) => {
      if (status === services.Status.OK) {
        resolve(describePlace(result[0]))
      } else if (status === services.Status.ZERO_RESULT) {
        resolve(null)
      } else {
        reject(new Error('주소를 조회하지 못했습니다.'))
      }
    })
  })).catch((error: unknown) => { addressCache.delete(key); throw error })
  addressCache.set(key, promise)
  return promise
}
