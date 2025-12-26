import { useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { debounce } from 'lodash';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { workflowApi } from '../api/workflowApi';

export const useAutoSync = () => {
  const params = useParams();
  const workflowId = params.id as string;
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

  // 로딩 상태 관리

  const isLoadedRef = useRef(false);

  // 1. 초기 데이터 로딩
  useEffect(() => {
    if (!workflowId) return;

    const loadWorkflow = async () => {
      try {
        console.log('Loading workflow:', workflowId);
        const data = await workflowApi.getDraftWorkflow(workflowId);

        if (data) {
          setWorkflowData(data);
        }

        // 데이터 로딩 완료 표시
        isLoadedRef.current = true;
      } catch (error) {
        console.error('Failed to load workflow:', error);
      }
    };

    // 초기화: 다른 워크플로우로 이동 시 loaded 상태 초기화
    isLoadedRef.current = false;
    loadWorkflow();
  }, [workflowId, setWorkflowData]);

  // 2. 자동 저장 (Debounce)
  const syncRef = useRef(
    debounce(
      async (
        currentNodes: typeof nodes,
        currentEdges: typeof edges,
        currentFeatures: typeof features,
        currentEnvVars: typeof environmentVariables,
        currentConvVars: typeof conversationVariables,
      ) => {
        // 로딩이 완료되지 않았으면 저장하지 않음 (빈 상태로 덮어쓰기 방지)
        if (!isLoadedRef.current) {
          console.log('Skipping sync: Workflow not loaded yet');
          return;
        }

        // console.log('Syncing workflow...', workflowId);
        try {
          await workflowApi.syncDraftWorkflow(workflowId, {
            nodes: currentNodes,
            edges: currentEdges,
            viewport: { x: 0, y: 0, zoom: 1 },
            features: currentFeatures,
            environmentVariables: currentEnvVars,
            conversationVariables: currentConvVars,
          });
        } catch (error) {
          console.error('Failed to sync workflow:', error);
        }
      },
      500,
    ),
  );

  useEffect(() => {
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
