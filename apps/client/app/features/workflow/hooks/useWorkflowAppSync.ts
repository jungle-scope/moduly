import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { workflowApi } from '../api/workflowApi';
import { appApi } from '@/app/features/app/api/appApi';

export const useWorkflowAppSync = () => {
  const params = useParams();
  const workflowId = params.id as string;
  const [currentAppId, setCurrentAppId] = useState<string>('');
  const { loadWorkflowsByApp, setProjectInfo, setActiveWorkflowIdSafe } =
    useWorkflowStore();

  useEffect(() => {
    const loadWorkflowAppId = async () => {
      try {
        const data = await workflowApi.getWorkflow(workflowId);
        if (data.app_id) {
          setCurrentAppId(data.app_id);

          // 앱 정보 가져오기 (이름, 아이콘)
          try {
            const app = await appApi.getApp(data.app_id);
            setProjectInfo(app.name, app.icon);
          } catch (appError) {
            console.error('Failed to load app details:', appError);
          }
        }
      } catch (error) {
        console.error('Failed to load workflow app_id:', error);
      }
    };

    // URL의 workflowId가 변경되면 현재 활성 워크플로우 ID도 업데이트
    // 단, 여기서 직접 loadWorkflowsByApp을 호출하진 않음 (아래 effect에서 처리)
    if (workflowId) {
      loadWorkflowAppId();
    }
  }, [workflowId, setProjectInfo, setActiveWorkflowIdSafe]);

  useEffect(() => {
    const initWorkflows = async () => {
      if (currentAppId) {
        await loadWorkflowsByApp(currentAppId);
        // 워크플로우 목록 로드 후 활성 워크플로우 식별자만 설정 (데이터 덮어쓰기 방지)
        setActiveWorkflowIdSafe(workflowId);
      }
    };
    initWorkflows();
  }, [currentAppId, loadWorkflowsByApp, workflowId, setActiveWorkflowIdSafe]);
};
