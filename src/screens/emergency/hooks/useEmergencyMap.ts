import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { loadKakaoMaps, type KakaoMap } from '../../../services/kakaoMaps'
import type { Emergency } from '../../../types/emergency'
import { emergencyStatusLabels } from '../emergency.constants'

function markerLabel(emergency: Emergency) {
  return `${emergency.id}, ${emergency.category}, ${emergencyStatusLabels[emergency.status]}`
}

export function useEmergencyMap(
  emergencies: readonly Emergency[], selectedId: string | null, onSelect: (id: string) => void,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<KakaoMap | null>(null)
  const markersRef = useRef<{ id: string; button: HTMLButtonElement; setZIndex: (index: number) => void }[]>([])
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const handleSelect = useEffectEvent((id: string) => onSelect(id))
  const getEmergencies = useEffectEvent(() => emergencies)
  const getSelectedId = useEffectEvent(() => selectedId)
  // 5초 자동 갱신마다 목록 배열은 새로 만들어지므로, 마커에 보이는 값이 바뀔 때만 마커를 다시 그린다.
  const markerKey = emergencies.map((emergency, index) => emergency.location
    ? [emergency.id, index, emergency.status, markerLabel(emergency), emergency.location.latitude, emergency.location.longitude].join('|')
    : '').join('\n')

  // 지도는 한 번만 만든다. 다시 만들면 사용자가 옮기거나 확대한 화면이 초기화된다.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let isCancelled = false
    let cleanup = () => {}
    loadKakaoMaps().then((maps) => {
      if (isCancelled) return
      const initial = getEmergencies().find((emergency) => emergency.location)?.location ?? { latitude: 37.5563, longitude: 126.9236 }
      const map = new maps.Map(container, {
        center: new maps.LatLng(initial.latitude, initial.longitude), level: 5,
      })
      mapRef.current = map
      // 모바일 탭에서 숨겨졌다 다시 나타나는 경우에도 타일 크기를 다시 계산한다.
      const observer = new ResizeObserver(() => {
        if (!container.clientWidth || !container.clientHeight) return
        const center = map.getCenter()
        map.relayout()
        map.setCenter(center)
      })
      observer.observe(container)
      cleanup = () => {
        observer.disconnect()
        mapRef.current = null
        container.replaceChildren()
      }
      setIsReady(true)
    }).catch((reason: unknown) => {
      if (!isCancelled) setError(reason instanceof Error ? reason.message : '지도를 표시하지 못했습니다.')
    })
    return () => { isCancelled = true; cleanup() }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const maps = window.kakao?.maps
    if (!isReady || !map || !maps) return
    const currentSelectedId = getSelectedId()
    const overlays = getEmergencies().flatMap((emergency, index) => {
      if (!emergency.location) return []
      const isSelected = emergency.id === currentSelectedId
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `emergency-pin ${emergency.status}`
      button.textContent = String(index + 1)
      button.setAttribute('aria-label', markerLabel(emergency))
      button.setAttribute('aria-pressed', String(isSelected))
      button.onclick = () => handleSelect(emergency.id)
      const overlay = new maps.CustomOverlay({
        map, content: button, yAnchor: 0.5,
        position: new maps.LatLng(emergency.location.latitude, emergency.location.longitude),
      })
      overlay.setZIndex(isSelected ? 1 : 0)
      return [{ id: emergency.id, button, overlay }]
    })
    markersRef.current = overlays.map(({ id, button, overlay }) => ({
      id, button, setZIndex: (index: number) => overlay.setZIndex(index),
    }))
    return () => {
      overlays.forEach(({ button, overlay }) => { button.onclick = null; overlay.setMap(null) })
      markersRef.current = []
    }
  }, [isReady, markerKey])

  // 선택이 바뀔 때만 지도를 옮긴다. 자동 갱신 때마다 옮기면 사용자가 둘러보던 위치에서 튕겨 나간다.
  useEffect(() => {
    const map = mapRef.current
    const maps = window.kakao?.maps
    if (!isReady || !map || !maps) return
    markersRef.current.forEach((marker) => {
      const isSelected = marker.id === selectedId
      marker.button.setAttribute('aria-pressed', String(isSelected))
      marker.setZIndex(isSelected ? 1 : 0)
    })
    const selected = getEmergencies().find((emergency) => emergency.id === selectedId)
    if (selected?.location) map.setCenter(new maps.LatLng(selected.location.latitude, selected.location.longitude))
  }, [selectedId, isReady])
  return { containerRef, isReady, error }
}
