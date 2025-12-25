import { useEffect, useRef } from 'react';
import { debounce } from 'lodash';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { workflowApi } from '../api/workflowApi';

export const useAutoSync = () => {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const features = useWorkflowStore((state) => state.features);
  const environmentVariables = useWorkflowStore(
    (state) => state.environmentVariables,
  );
  const conversationVariables = useWorkflowStore(
    (state) => state.conversationVariables,
  );

  // 로컬 변경인지 초기 로드인지 추적할 방법이 필요함 (불필요한 동기화 방지)
  // 현재는 모든 변경에 대해 단순 Debounce 적용

  // useRef를 사용하여 debounced 함수를 '저장'만 하고, 렌더링 중에는 .current를 읽지 않도록 수정
  const syncRef = useRef(
    debounce(
      async (
        currentNodes: typeof nodes,
        currentEdges: typeof edges,
        currentFeatures: typeof features,
        currentEnvVars: typeof environmentVariables,
        currentConvVars: typeof conversationVariables,
      ) => {
        // F12 개발자 도구 콘솔에서 확인 가능하도록 로그 출력
        // eslint-disable-next-line no-console
        console.log('--- [Frontend Memory State] ---');
        // eslint-disable-next-line no-console
        console.log('Nodes:', currentNodes);
        // eslint-disable-next-line no-console
        console.log('Edges:', currentEdges);
        // console.log('Features:', currentFeatures);

        try {
          await workflowApi.syncDraftWorkflow('default-app-id', {
            // 실제 App ID 컨텍스트로 교체 필요
            nodes: currentNodes,
            edges: currentEdges,
            viewport: { x: 0, y: 0, zoom: 1 }, // Todo: ReactFlow 인스턴스에서 실제 뷰포트 가져오기
            features: currentFeatures,
            environmentVariables: currentEnvVars,
            conversationVariables: currentConvVars,
          });
          // console.log('Workflow synced successfully');
        } catch (error) {
          console.error('Failed to sync workflow:', error);
        }
      },
      500,
    ),
  );

  useEffect(() => {
    // 렌더링 중이 아니라 useEffect 내부(Side Effect)에서 호출하므로 안전함
    const debouncedSync = syncRef.current;

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
  }, [nodes, edges, features, environmentVariables, conversationVariables]);
};
