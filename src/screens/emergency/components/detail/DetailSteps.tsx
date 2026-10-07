import type { EmergencyIncidentDetail } from '../../../../types/emergency'
import { formatSupply, hasProgressRecord } from './format'

export default function DetailSteps({ detail }: { detail: EmergencyIncidentDetail }) {
  const { guide, progress } = detail
  const completed = new Set(progress.completedStepIds)
  const hasProgress = hasProgressRecord(detail)

  return (
    <>
      {progress.blockedReason && <p className="emergency-notice warning">막힌 사유: {progress.blockedReason}</p>}
      {guide.execution.length > 0 ? (
        <ol className="emergency-detail-list">
          {guide.execution.map((step) => {
            const state = !hasProgress ? null
              : completed.has(step.executionStepId) ? 'done'
              : progress.currentStepId === step.executionStepId ? 'current' : null
            return (
              <li key={step.executionStepId} className={state ? `step-${state}` : undefined}>
                {state && <span className="emergency-step-badge">{state === 'done' ? '완료' : '진행 중'}</span>}
                <p>{step.instruction}</p>
                {step.supplies.length > 0 && <p className="emergency-muted">가이드 필요 물품: {step.supplies.map(formatSupply).join(', ')}</p>}
              </li>
            )
          })}
        </ol>
      ) : <p className="emergency-muted">저장된 처치 단계 없음</p>}
    </>
  )
}
