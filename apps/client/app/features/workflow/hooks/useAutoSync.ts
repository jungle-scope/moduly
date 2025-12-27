import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { debounce } from 'lodash';
import { useReactFlow } from '@xyflow/react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { workflowApi } from '../api/workflowApi';
import { DEFAULT_NODES } from '../constants'; // 노드가 하나도 없을 때 쓸 기본값
import { AppNode } from '../types/Nodes';

export const useAutoSync = () => {
  const params = useParams(); // 주소창의 파라미터 읽기
  const workflowId = params.id as string;
  const { getViewport, setViewport } = useReactFlow(); // React Flow 인스턴스 접근

  // Zustand Store에서 상태들을 가져옵니다.
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const features = useWorkflowStore((state) => state.features);
  const environmentVariables = useWorkflowStore(
    (state) => state.environmentVariables,
  );
  const conversationVariables = useWorkflowStore(
    (state) => state.conversationVariables,
  );
  const setWorkflowData = useWorkflowStore((state) => state.setWorkflowData);

  // [중요] 로딩 완료 여부 체크
  const isLoadedRef = useRef(false);

  // 1. 초기 데이터 로딩 (페이지 진입 시 1회 실행)
  useEffect(() => {
    if (!workflowId) return; //TODO: 가져올 workflow 가 없다는 뜻. 주소로 접근한거면 유저에게 접근불가 메시지 보여줘야함

    const loadWorkflow = async () => {
      try {
        const data = await workflowApi.getDraftWorkflow(workflowId);

        if (data) {
          //TODO: 노드가 없으면 '에러' 대신 '기본값을 주입'하고 있습니다. 백엔드 연동되면 에러페이지 리다이렉트로 수정합니다.
          if (!data.nodes || data.nodes.length === 0) {
            console.warn('⚠️ 저장된 노드가 없어 기본 노드로 자동 복구합니다.');
            data.nodes = DEFAULT_NODES as AppNode[];
            // 기존에 작업하던 노드가 있는 경우 -> 저장된 그대로 불러옵니다.
          } else {
            console.log('[AutoSync] Existing nodes found:', data.nodes);
          }
          setWorkflowData(data);

          // 저장된 viewport를 React Flow에 적용 (복원)
          if (data.viewport) {
            setViewport(data.viewport);
            console.log('[AutoSync] Viewport restored:', data.viewport);
          }
        }

        // 데이터 로딩 완료 표시
        isLoadedRef.current = true;
      } catch (error) {
        console.error('Failed to load workflow:', error);
      }
    };

    isLoadedRef.current = false; // 다른 워크플로우로 이동했을 때를 대비해 초기화
    loadWorkflow();
  }, [workflowId, setWorkflowData, setViewport]);

  // 2. 자동 저장 (Debounce)
  // useRef 대신 useMemo를 사용하여 workflowId가 변경될 때만 함수를 재생성합니다.
  const debouncedSync = useMemo(
    () =>
      debounce(
        async (
          currentNodes: typeof nodes,
          currentEdges: typeof edges,
          currentFeatures: typeof features,
          currentEnvVars: typeof environmentVariables,
          currentConvVars: typeof conversationVariables,
        ) => {
          try {
            const currentViewport = getViewport();

            // 서버에 저장 요청 (이 부분은 1초 기다린 뒤에 딱 한 번만 실행됨)
            await workflowApi.syncDraftWorkflow(workflowId, {
              nodes: currentNodes,
              edges: currentEdges,
              viewport: currentViewport,
              features: currentFeatures,
              environmentVariables: currentEnvVars,
              conversationVariables: currentConvVars,
            });
          } catch (error) {
            console.error('Failed to sync workflow:', error);
          }
        },
        1000, // 1초 동안 추가 입력이 없으면 저장
        { maxWait: 300000 }, // 5분이 지나면 강제로 한 번 저장
      ),
    [workflowId, getViewport],
  );

  // 3. 수동 저장 트리거 (현재는 뷰포트 변경 이벤트 발생 시)
  const triggerSave = useCallback(() => {
    if (!isLoadedRef.current) {
      return;
    }

    debouncedSync(
      nodes,
      edges,
      features,
      environmentVariables,
      conversationVariables,
    );
  }, [
    debouncedSync,
    nodes,
    edges,
    features,
    environmentVariables,
    conversationVariables,
  ]);

  // 4. 노드/엣지 변경 자동 감지 및 저장 트리거
  useEffect(() => {
    // 빈 내용으로 덮어쓰기 방지하기 위해 로딩이 완료되지 않았으면 바로 리턴
    if (!isLoadedRef.current) {
      return;
    }

    debouncedSync(
      nodes,
      edges,
      features,
      environmentVariables,
      conversationVariables,
    );

    return () => {
      debouncedSync.cancel();
    };
  }, [
    debouncedSync,
    nodes,
    edges,
    features,
    environmentVariables,
    conversationVariables,
  ]);

  // triggerSave 함수를 반환, 외부에서 호출 가능하도록
  return { triggerSave };
};
