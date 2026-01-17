import { WorkflowNodeRun } from '@/app/features/workflow/types/Api';

/**
 * 노드의 실행 시간을 계산합니다 (초 단위, 소수점 2자리).
 * started_at 또는 finished_at이 없으면 null을 반환합니다.
 */
export function getNodeDuration(node: WorkflowNodeRun): string | null {
  if (!node.started_at || !node.finished_at) return null;
  
  const start = new Date(node.started_at).getTime();
  const end = new Date(node.finished_at).getTime();
  const durationMs = end - start;
  
  if (durationMs < 0) return null;
  
  return (durationMs / 1000).toFixed(2);
}
