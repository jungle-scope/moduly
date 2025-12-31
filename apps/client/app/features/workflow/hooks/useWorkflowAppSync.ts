import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { workflowApi } from '../api/workflowApi';

export const useWorkflowAppSync = () => {
  const params = useParams();
  const workflowId = params.id as string;
  const [currentAppId, setCurrentAppId] = useState<string>('');
  const { loadWorkflowsByApp } = useWorkflowStore();

  useEffect(() => {
    const loadWorkflowAppId = async () => {
      try {
        const data = await workflowApi.getWorkflow(workflowId);
        if (data.app_id) {
          setCurrentAppId(data.app_id);
        }
      } catch (error) {
        console.error('Failed to load workflow app_id:', error);
      }
    };

    if (workflowId) {
      loadWorkflowAppId();
    }
  }, [workflowId]);

  useEffect(() => {
    if (currentAppId) {
      loadWorkflowsByApp(currentAppId);
    }
  }, [currentAppId, loadWorkflowsByApp]);
};
