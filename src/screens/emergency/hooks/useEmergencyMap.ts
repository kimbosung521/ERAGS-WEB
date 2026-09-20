import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { loadKakaoMaps, type KakaoMap } from '../../../services/kakaoMaps'
import type { Emergency } from '../../../types/emergency'
import { emergencyStatusLabels } from '../emergency.constants'

export function useEmergencyMap(
  emergencies: readonly Emergency[], selectedId: string | null, onSelect: (id: string) => void,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<KakaoMap | null>(null)
  const markersRef = useRef<{ id: string; button: HTMLButtonElement; setZIndex: (index: number) => void }[]>([])
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const handleSelect = useEffectEvent((id: string) => onSelect(id))

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let isCancelled = false
    let cleanup = () => {}
    loadKakaoMaps().then((maps) => {
      if (isCancelled) return
      const initial = emergencies[0]?.location ?? { latitude: 37.5563, longitude: 126.9236 }
      const map = new maps.Map(container, {
        center: new maps.LatLng(initial.latitude, initial.longitude), level: 5,
      })
      mapRef.current = map
      const overlays = emergencies.map((emergency, index) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = `emergency-pin ${emergency.status}`
        button.textContent = String(index + 1)
        button.setAttribute('aria-label', `${emergency.person.name}, ${emergency.category}, ${emergencyStatusLabels[emergency.status]}`)
        button.onclick = () => handleSelect(emergency.id)
        const overlay = new maps.CustomOverlay({
          map, content: button, yAnchor: 0.5,
          position: new maps.LatLng(emergency.location.latitude, emergency.location.longitude),
        })
        return { id: emergency.id, button, overlay }
      })
      markersRef.current = overlays.map(({ id, button, overlay }) => ({
        id, button, setZIndex: (index: number) => overlay.setZIndex(index),
      }))
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
        overlays.forEach(({ button, overlay }) => { button.onclick = null; overlay.setMap(null) })
        markersRef.current = []
        mapRef.current = null
        container.replaceChildren()
      }
      setIsReady(true)
    }).catch((reason: unknown) => {
      if (!isCancelled) setError(reason instanceof Error ? reason.message : '지도를 표시하지 못했습니다.')
    })
    return () => { isCancelled = true; cleanup() }
  }, [emergencies])

  useEffect(() => {
    const map = mapRef.current
    const maps = window.kakao?.maps
    if (!isReady || !map || !maps) return
    markersRef.current.forEach((marker) => {
      const isSelected = marker.id === selectedId
      marker.button.setAttribute('aria-pressed', String(isSelected))
      marker.setZIndex(isSelected ? 1 : 0)
    })
    const selected = emergencies.find((emergency) => emergency.id === selectedId)
    if (selected) map.setCenter(new maps.LatLng(selected.location.latitude, selected.location.longitude))
  }, [emergencies, selectedId, isReady])
  return { containerRef, isReady, error }
}
