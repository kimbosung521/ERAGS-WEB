import { useRef, useState } from 'react'
import EmergencyDetail from './components/EmergencyDetail'
import EmergencyList from './components/EmergencyList'
import EmergencyMap from './components/EmergencyMap'
import { mockEmergencies } from './emergency.mock'
import './EmergencyScreen.css'

export default function EmergencyScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(mockEmergencies[0]?.id ?? null)
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list')
  const detailRef = useRef<HTMLDivElement>(null)
  const selectedEmergency = mockEmergencies.find((emergency) => emergency.id === selectedId) ?? null

  function handleSelect(id: string) {
    setSelectedId(id)
  }

  function handleShowDetail() {
    detailRef.current?.focus()
  }

  return (
    <div className="emergency-screen">
      <header className="emergency-header">
        <strong>ERAGS</strong><span>위급상황 관제</span><small>데모 데이터</small>
      </header>
      <main className="emergency-content">
        <div className="emergency-intro">
          <h1>위급상황 모니터링</h1>
          <p className="emergency-muted">목록 또는 지도에서 상황을 선택해 상세 정보를 확인하세요.</p>
        </div>
        <div className="emergency-mobile-controls" role="group" aria-label="보기 선택">
          <button aria-pressed={activeTab === 'list'} onClick={() => setActiveTab('list')}>목록</button>
          <button aria-pressed={activeTab === 'map'} onClick={() => setActiveTab('map')}>지도</button>
        </div>
        <div className="emergency-layout" data-active-tab={activeTab}>
          <div className="emergency-list-slot">
            <EmergencyList emergencies={mockEmergencies} selectedId={selectedId} onSelect={handleSelect} />
          </div>
          <div className="emergency-map-slot">
            <EmergencyMap emergencies={mockEmergencies} selectedId={selectedId} onSelect={handleSelect} />
          </div>
          <button className="emergency-mobile-detail-link" onClick={handleShowDetail} disabled={!selectedEmergency}>
            {selectedEmergency ? `${selectedEmergency.person.name} 상세 정보 보기 ↓` : '선택된 상황 없음'}
          </button>
          <div className="emergency-detail-slot" ref={detailRef} tabIndex={-1}>
            <EmergencyDetail emergency={selectedEmergency} />
          </div>
        </div>
        <p className="emergency-disclaimer">모든 인물·주소·연락처는 가상 데이터입니다. 서버에 연결되지 않은 기본 화면입니다.</p>
      </main>
    </div>
  )
}
