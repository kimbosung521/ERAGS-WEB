import { useRef, useState, type KeyboardEvent } from 'react'
import type { EmergencyIncidentDetail } from '../../../../types/emergency'
import DetailHistory from './DetailHistory'
import DetailInfo from './DetailInfo'
import DetailInjuries from './DetailInjuries'
import DetailSteps from './DetailSteps'
import DetailSupplies from './DetailSupplies'

const tabs = [
  { key: 'steps', label: '처치', Panel: DetailSteps },
  { key: 'injuries', label: '손상', Panel: DetailInjuries },
  { key: 'supplies', label: '물품', Panel: DetailSupplies },
  { key: 'history', label: '이력', Panel: DetailHistory },
  { key: 'info', label: '정보', Panel: DetailInfo },
] as const

type TabKey = (typeof tabs)[number]['key']

// 다른 사건을 선택해도 보던 탭은 유지한다. 같은 항목을 여러 사건에서 비교하기 쉽게 하기 위해서다.
export default function DetailTabs({ detail }: { detail: EmergencyIncidentDetail }) {
  const [active, setActive] = useState<TabKey>('steps')
  const tabRefs = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({})
  const current = tabs.find((tab) => tab.key === active) ?? tabs[0]
  const counts: Partial<Record<TabKey, number>> = {
    injuries: detail.guide.injuries.length, history: detail.history.length,
  }

  // 탭 목록 안에서는 좌우 화살표로 이동한다(WAI-ARIA 탭 패턴).
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const index = tabs.findIndex((tab) => tab.key === active)
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
    setActive(next.key)
    tabRefs.current[next.key]?.focus()
  }

  return (
    <div className="emergency-detail-tabs">
      <div className="emergency-tablist" role="tablist" aria-label="상세 정보" onKeyDown={handleKeyDown}>
        {tabs.map((tab) => (
          <button
            key={tab.key} ref={(element) => { tabRefs.current[tab.key] = element }}
            id={`emergency-tab-${tab.key}`} type="button" role="tab"
            aria-selected={tab.key === active} aria-controls={`emergency-tabpanel-${tab.key}`} tabIndex={tab.key === active ? 0 : -1}
            onClick={() => setActive(tab.key)}
          >
            {tab.label}{counts[tab.key] ? <small>{counts[tab.key]}</small> : null}
          </button>
        ))}
      </div>
      <div className="emergency-tabpanel" id={`emergency-tabpanel-${current.key}`} role="tabpanel" aria-labelledby={`emergency-tab-${current.key}`}>
        <current.Panel detail={detail} />
      </div>
    </div>
  )
}
