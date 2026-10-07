import type { EmergencyIncidentDetail } from '../../../../types/emergency'
import { formatSupply } from './format'

// 가이드가 요구한 물품과 실제 사용 기록은 서로 다른 값이므로 나눠서 보여준다. 필요 수량을 사용량으로 간주하지 않는다.
export default function DetailSupplies({ detail }: { detail: EmergencyIncidentDetail }) {
  const { usedSupplies } = detail.progress
  const required = detail.guide.execution.flatMap((step) => step.supplies)

  return (
    <>
      <section className="emergency-detail-section" aria-labelledby="emergency-used-supplies-heading">
        <h3 id="emergency-used-supplies-heading">실제 사용 물품</h3>
        {usedSupplies === null ? <p className="emergency-muted">사용 기록 미확인</p>
          : usedSupplies.length > 0 ? (
            <ul className="emergency-detail-list">
              {usedSupplies.map((supply, index) => <li key={`${supply.itemId}-${index}`}>{formatSupply(supply)}</li>)}
            </ul>
          ) : <p className="emergency-muted">사용한 물품 없음</p>}
      </section>
      <section className="emergency-detail-section" aria-labelledby="emergency-required-supplies-heading">
        <h3 id="emergency-required-supplies-heading">가이드 필요 물품</h3>
        {required.length > 0 ? (
          <ul className="emergency-detail-list">
            {required.map((supply, index) => <li key={`${supply.itemId}-${index}`}>{formatSupply(supply)}</li>)}
          </ul>
        ) : <p className="emergency-muted">필요 물품 없음</p>}
      </section>
    </>
  )
}
