import { useRef, useState } from 'react'
import EmergencyDetail from './components/EmergencyDetail'
import EmergencyList from './components/EmergencyList'
import EmergencyMap from './components/EmergencyMap'
import { useEmergencyList } from './hooks/useEmergencyList'
import type { Emergency } from '../../types/emergency'
import './EmergencyScreen.css'

interface Props {
  onLogout: () => void
}

const emptyEmergencies: readonly Emergency[] = []

export default function EmergencyScreen({ onLogout }: Props) {
  const { data, isLoading, error, offset, handleLoad } = useEmergencyList()
  const emergencies = data?.items ?? emptyEmergencies
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list')
  const detailRef = useRef<HTMLDivElement>(null)
  const selectedEmergency = emergencies.find((emergency) => emergency.id === selectedId) ?? emergencies[0] ?? null
  const activeId = selectedEmergency?.id ?? null

  function handleSelect(id: string) {
    setSelectedId(id)
  }

  function handleShowDetail() {
    detailRef.current?.focus()
  }

  return (
    <div className="emergency-screen">
      <header className="emergency-header">
        <strong>ERAGS</strong><span>위급상황 관제</span><small>서버 사건 목록</small>
        <button className="emergency-logout" type="button" onClick={onLogout}>로그아웃</button>
      </header>
      <main className="emergency-content">
        <div className="emergency-intro">
          <h1>위급상황 모니터링</h1>
          <p className="emergency-muted">목록 또는 지도에서 상황을 선택해 상세 정보를 확인하세요.</p>
          <button type="button" onClick={() => handleLoad()} disabled={isLoading}>목록 새로고침</button>
          {isLoading && <p role="status">사건 목록을 불러오는 중입니다.</p>}
          {error && <p role="alert">{error.message}</p>}
          {data && <p className="emergency-muted">활성 사건 총 {data.total}건 · 조회 시각 {new Date(data.fetchedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (한국 시간)</p>}
        </div>
        <div className="emergency-mobile-controls" role="group" aria-label="보기 선택">
          <button aria-pressed={activeTab === 'list'} onClick={() => setActiveTab('list')}>목록</button>
          <button aria-pressed={activeTab === 'map'} onClick={() => setActiveTab('map')}>지도</button>
        </div>
        <div className="emergency-layout" data-active-tab={activeTab}>
          <div className="emergency-list-slot">
            <EmergencyList emergencies={emergencies} selectedId={activeId} onSelect={handleSelect} hasLoaded={data !== null} />
            <div role="group" aria-label="목록 페이지 이동">
              <button type="button" disabled={isLoading || offset === 0} onClick={() => handleLoad(Math.max(0, offset - 50))}>이전</button>
              <button type="button" disabled={isLoading || data?.nextOffset == null} onClick={() => {
                if (data?.nextOffset != null) handleLoad(data.nextOffset)
              }}>다음</button>
            </div>
          </div>
          <div className="emergency-map-slot">
            <EmergencyMap emergencies={emergencies} selectedId={activeId} onSelect={handleSelect} />
          </div>
          <button className="emergency-mobile-detail-link" onClick={handleShowDetail} disabled={!selectedEmergency}>
            {selectedEmergency ? `${selectedEmergency.person?.name ?? selectedEmergency.id} 상세 정보 보기 ↓` : '선택된 상황 없음'}
          </button>
          <div className="emergency-detail-slot" ref={detailRef} tabIndex={-1}>
            <EmergencyDetail emergency={selectedEmergency} />
          </div>
        </div>
        <p className="emergency-disclaimer">목록 응답 기준 정보입니다. 이름·연락처는 관제 API에서 제공되지 않습니다. 상세 API와 실시간 갱신은 아직 연결되지 않았습니다.</p>
      </main>
    </div>
  )
}
