import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { workflowApi } from '../api/workflowApi';
import { appApi } from '@/app/features/app/api/appApi';

export const useWorkflowAppSync = () => {
  const params = useParams();
  const workflowId = params.id as string;
  const [currentAppId, setCurrentAppId] = useState<string>('');
  const { loadWorkflowsByApp, setProjectInfo } = useWorkflowStore();

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

    if (workflowId) {
      loadWorkflowAppId();
    }
  }, [workflowId, setProjectInfo]);

  useEffect(() => {
    if (currentAppId) {
      loadWorkflowsByApp(currentAppId);
    }
  }, [currentAppId, loadWorkflowsByApp]);
};
