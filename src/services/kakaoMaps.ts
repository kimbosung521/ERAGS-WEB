interface LatLng {
  getLat(): number
  getLng(): number
}
export interface KakaoMap {
  relayout(): void
  setCenter(position: LatLng): void
  getCenter(): LatLng
}
interface Overlay {
  setMap(map: KakaoMap | null): void
  setZIndex(index: number): void
}
interface KakaoMaps {
  load(callback: () => void): void
  LatLng: new (latitude: number, longitude: number) => LatLng
  Map: new (container: HTMLElement, options: { center: LatLng; level: number }) => KakaoMap
  CustomOverlay: new (options: {
    map: KakaoMap; position: LatLng; content: HTMLElement; yAnchor: number
  }) => Overlay
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
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`
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
