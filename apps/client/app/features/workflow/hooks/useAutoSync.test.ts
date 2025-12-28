import { renderHook, act } from '@testing-library/react';
import { useAutoSync } from './useAutoSync';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { workflowApi } from '../api/workflowApi';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// 1. Next.js의 useParams 모킹 (workflowId 제공)
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'test-workflow-id' }),
}));

// 2. React Flow 모킹 (viewport 관련 함수 제공)
// 안정적인 함수 참조를 위해 모킹 함수를 미리 생성
const mockGetViewport = vi.fn(() => ({ x: 0, y: 0, zoom: 1 }));
const mockSetViewport = vi.fn();

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    getViewport: mockGetViewport,
    setViewport: mockSetViewport,
  }),
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// 3. API 모킹 (실제 서버 요청 방지)
vi.mock('../api/workflowApi', () => ({
  workflowApi: {
    getDraftWorkflow: vi.fn(),
    syncDraftWorkflow: vi.fn(),
  },
}));

// 4. Zustand 초기화 헬퍼 (테스트 간 상태 간섭 방지)
const initialStoreState = useWorkflowStore.getState();
const resetStore = () => useWorkflowStore.setState(initialStoreState, true);

describe('useAutoSync Hook', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    vi.useFakeTimers(); // 시간 제어를 위해 타이머 모킹
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('데이터 로딩 전에는 노드가 변경되어도 저장 API를 호출하지 않아야 한다 (데이터 보호)', async () => {
    // API가 아직 응답하지 않음 (로딩 중 상태 유지: isLoadedRef = false)
    (workflowApi.getDraftWorkflow as any).mockReturnValue(
      new Promise(() => {}),
    );

    renderHook(() => useAutoSync());

    // 노드 변경 시도
    act(() => {
      useWorkflowStore.setState({ nodes: [{ id: 'new', data: {} } as any] });
    });

    // 5초가 지나도
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // 저장 API는 절대 호출되면 안 됨!
    expect(workflowApi.syncDraftWorkflow).not.toHaveBeenCalled();
  });

  it('데이터 로딩 후, 노드가 변경되고 1초가 지나면 저장 API가 호출되어야 한다 (최종 저장)', async () => {
    // API가 즉시 응답함 (로딩 완료 상태: isLoadedRef = true)
    (workflowApi.getDraftWorkflow as any).mockResolvedValue({
      nodes: [],
      edges: [],
    });

    renderHook(() => useAutoSync());

    // 로딩 완료를 기다림 (Promises 처리)
    await act(async () => {
      await Promise.resolve();
    });

    // 노드 변경 발생
    act(() => {
      useWorkflowStore.setState({
        nodes: [{ id: 'updated', data: {} } as any],
      });
    });

    // 1초(1000ms) 흐른 뒤 (디바운스 시간)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // 저장 API가 정확히 1번 호출되었는지 확인
    expect(workflowApi.syncDraftWorkflow).toHaveBeenCalledTimes(1);
  });
});
