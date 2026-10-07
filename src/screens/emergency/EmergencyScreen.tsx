import { useEffect, useRef, useState } from 'react'
import EmergencyDetail from './components/EmergencyDetail'
import EmergencyFilter from './components/EmergencyFilter'
import EmergencyList from './components/EmergencyList'
import EmergencyMap from './components/EmergencyMap'
import { useEmergencyDetail } from './hooks/useEmergencyDetail'
import { useEmergencyList } from './hooks/useEmergencyList'
import { ApiRequestError } from '../../services/api'
import { MONITORING_PAGE_SIZE } from '../../services/monitoring'
import type { Emergency } from '../../types/emergency'
import './EmergencyScreen.css'

interface Props {
  onLogout: () => void
}

const emptyEmergencies: readonly Emergency[] = []

export default function EmergencyScreen({ onLogout }: Props) {
  const { data, isLoading, error, offset, filter, handleLoad, handleFilterChange } = useEmergencyList()
  const emergencies = data?.items ?? emptyEmergencies
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list')
  const detailRef = useRef<HTMLDivElement>(null)
  const selectedEmergency = emergencies.find((emergency) => emergency.id === selectedId) ?? emergencies[0] ?? null
  const activeId = selectedEmergency?.id ?? null
  const { detail, isLoading: isDetailLoading, error: detailError } = useEmergencyDetail(activeId)

  // 토큰 누락·만료(401)는 다시 로그인해야 하므로 로그인 화면으로 보낸다.
  useEffect(() => {
    if ([error, detailError].some((reason) => reason instanceof ApiRequestError && reason.status === 401)) onLogout()
  }, [error, detailError, onLogout])

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
          <div className="emergency-intro-head">
            <div>
              <h1>위급상황 모니터링</h1>
              <p className="emergency-muted">목록 또는 지도에서 상황을 선택해 상세 정보를 확인하세요.</p>
            </div>
            <div className="emergency-sync">
              {data && (
                <span className="emergency-sync-meta">
                  <span className={`emergency-live-dot${error ? ' paused' : ''}`} aria-hidden="true" />
                  {error ? '갱신 실패' : '5초마다 자동 갱신'} · {new Date(data.fetchedAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' })} 기준 (한국 시간)
                </span>
              )}
              <button className="emergency-button" type="button" onClick={() => handleLoad()} disabled={isLoading}>
                {isLoading ? '불러오는 중…' : '새로고침'}
              </button>
            </div>
          </div>
          <EmergencyFilter filter={filter} disabled={isLoading} onApply={handleFilterChange} />
          <div className="emergency-notices">
            {isLoading && <p className="emergency-notice" role="status">사건 목록을 불러오는 중입니다.</p>}
            {error && <p className="emergency-notice danger" role="alert">{error.message}</p>}
            {data && data.invalidCount > 0 && <p className="emergency-notice warning" role="alert">응답 형식 오류로 사건 {data.invalidCount}건을 표시하지 못했습니다. 관리자에게 문의해 주세요.</p>}
          </div>
        </div>
        <div className="emergency-mobile-controls" role="group" aria-label="보기 선택">
          <button aria-pressed={activeTab === 'list'} onClick={() => setActiveTab('list')}>목록</button>
          <button aria-pressed={activeTab === 'map'} onClick={() => setActiveTab('map')}>지도</button>
        </div>
        <div className="emergency-layout" data-active-tab={activeTab}>
          <div className="emergency-list-slot">
            <EmergencyList emergencies={emergencies} selectedId={activeId} onSelect={handleSelect} hasLoaded={data !== null} />
            <nav className="emergency-pagination" aria-label="목록 페이지 이동">
              <button className="emergency-button" type="button" disabled={isLoading || offset === 0} onClick={() => handleLoad(Math.max(0, offset - MONITORING_PAGE_SIZE))}>‹ 이전</button>
              <span className="emergency-muted">
                {data && data.total > 0 ? `${offset + 1}–${Math.min(offset + MONITORING_PAGE_SIZE, data.total)} / 총 ${data.total}건` : '–'}
              </span>
              <button className="emergency-button" type="button" disabled={isLoading || data?.nextOffset == null} onClick={() => {
                if (data?.nextOffset != null) handleLoad(data.nextOffset)
              }}>다음 ›</button>
            </nav>
          </div>
          <div className="emergency-map-slot">
            <EmergencyMap emergencies={emergencies} selectedId={activeId} onSelect={handleSelect} />
          </div>
          <button className="emergency-mobile-detail-link" onClick={handleShowDetail} disabled={!selectedEmergency}>
            {selectedEmergency ? `${selectedEmergency.person?.name ?? selectedEmergency.id} 상세 정보 보기 ↓` : '선택된 상황 없음'}
          </button>
          <div className="emergency-detail-slot" ref={detailRef} tabIndex={-1}>
            <EmergencyDetail emergency={selectedEmergency} detail={detail} isLoading={isDetailLoading} error={detailError} />
          </div>
        </div>
        <p className="emergency-disclaimer">목록과 선택한 사건의 상세는 5초마다 자동 갱신됩니다. 이름·연락처는 관제 API에서 제공되지 않습니다.</p>
      </main>
    </div>
  )
}
