import { useEffect, useRef, useMemo } from 'react';
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

  // Zustand Store에서 상태들을 가져오기
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const features = useWorkflowStore((state) => state.features);
  const envVariables = useWorkflowStore((state) => state.envVariables);
  const runtimeVariables = useWorkflowStore((state) => state.runtimeVariables);
  const setWorkflowData = useWorkflowStore((state) => state.setWorkflowData);

  // 로딩 완료 여부 체크
  const isLoadedRef = useRef(false);

  // 1. 초기 데이터 로딩 (페이지 진입 시 1회 실행)
  useEffect(() => {
    if (!workflowId) return; //TODO: 가져올 workflow 가 없다는 뜻. 주소로 접근한거면 유저에게 접근불가 메시지 보여줘야함

    const loadWorkflow = async () => {
      try {
        const data = await workflowApi.getDraftWorkflow(workflowId);

        if (data) {
          if (data.features?.noteNodes) {
            if (data.nodes) {
              data.nodes = [...data.nodes, ...data.features.noteNodes];
            } else {
              data.nodes = data.features.noteNodes;
            }
          }

          if (data.nodes && data.nodes.length > 0) {
            data.nodes = data.nodes.map((node: any) => {
              // TODO: 임시 마이그레이션 로직, 삭제 필요
              if (node.type === 'start') {
                return { ...node, type: 'startNode' };
              }
              return node;
            });

            //TODO: 노드가 없으면 '에러' 대신 '기본값을 주입'하고 있습니다. 백엔드 연동되면 에러페이지 리다이렉트로 수정합니다.
          } else {
            data.nodes = DEFAULT_NODES as AppNode[];
          }
          setWorkflowData(data, workflowId);

          // 저장된 viewport를 React Flow에 적용
          if (data.viewport) {
            setViewport(data.viewport);
          }
        }

        isLoadedRef.current = true;
      } catch {
        // Failed to load workflow
      }
    };

    isLoadedRef.current = false; // 다른 워크플로우로 이동했을 때를 대비해 초기화
    loadWorkflow();
  }, [workflowId, setWorkflowData, setViewport]);

  // 2. 자동 저장 (Debounce)
  const debouncedSync = useMemo(
    () =>
      debounce(
        async (
          currentNodes: typeof nodes,
          currentEdges: typeof edges,
          currentFeatures: typeof features,
          currentEnvVars: typeof envVariables,
          currentRuntimeVars: typeof runtimeVariables,
        ) => {
          if (!workflowId) {
            return;
          }
          try {
            const currentViewport = getViewport();

            // Note 노드와 일반 노드 분리
            const realNodes = currentNodes.filter((n) => n.type !== 'note');
            const noteNodes = currentNodes.filter((n) => n.type === 'note');

            // features에 noteNodes 저장
            const featuresToSave = {
              ...currentFeatures,
              noteNodes,
            };

            // 서버에 저장 요청
            await workflowApi.syncDraftWorkflow(workflowId, {
              nodes: realNodes, // 엔진용 깨끗한 노드 목록
              edges: currentEdges,
              viewport: currentViewport,
              features: featuresToSave,
              envVariables: currentEnvVars,
              runtimeVariables: currentRuntimeVars,
            });
          } catch {
            // Failed to sync workflow
          }
        },
        1000, // 1초 동안 추가 입력이 없으면 저장
        { maxWait: 300000 }, // 5분이 지나면 강제로 한 번 저장
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workflowId],
  );

  // debouncedSync가 변경되면 ref 업데이트
  const debouncedSyncRef = useRef(debouncedSync);

  useEffect(() => {
    debouncedSyncRef.current = debouncedSync;
  }, [debouncedSync]);

  useEffect(() => {
    // 빈 내용으로 덮어쓰기 방지하기 위해 로딩이 완료되지 않았으면 바로 리턴
    if (!isLoadedRef.current) return;

    debouncedSyncRef.current(
      nodes,
      edges,
      features,
      envVariables,
      runtimeVariables,
    );
  }, [nodes, edges, features, envVariables, runtimeVariables]);
};
