
import { useState, useEffect } from 'react';
import { appApi } from '@/app/features/app/api/appApi';
import { workflowApi } from '@/app/features/workflow/api/workflowApi';
import { WorkflowRun } from '@/app/features/workflow/types/Api';
import { LogFilters } from '@/app/features/workflow/components/logs/LogFilterBar';

export interface GlobalWorkflowRun extends WorkflowRun {
  workflow_name: string;
}

export function useGlobalLogs() {
  const [logs, setLogs] = useState<GlobalWorkflowRun[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<GlobalWorkflowRun[]>([]);
  const [apps, setApps] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial Load: Fetch Apps and ALL Logs (First Page)
  useEffect(() => {
    loadGlobalLogs();
  }, []);

  const loadGlobalLogs = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch Apps
      const appList = await appApi.listApps();
      // Filter out apps with no workflow? Or just assume one-to-one?
      // Mapped services for filter dropdown
      const services = appList.map(app => ({
          id: app.workflow_id || app.id,
          name: app.name
      }));
      setApps(services);

      // 2. Fetch Recent Runs from EACH App
      // Limit to 20 per app to avoid overload
      const promises = appList.map(async (app) => {
        const workflowId = app.workflow_id || app.id;
        try {
            const result = await workflowApi.getWorkflowRuns(workflowId, 1, 20);
            // Inject Workflow Name
            return result.items.map((run: WorkflowRun) => ({
                ...run,
                workflow_name: app.name,
                // Ensure workflow_id is correct if missing from response
                workflow_id: run.workflow_id || workflowId
            } as GlobalWorkflowRun));
        } catch (e) {
            console.warn(`Failed to fetch runs for ${app.name}`, e);
            return [];
        }
      });

      const results = await Promise.all(promises);
      const allLogs = results.flat();

      // 3. Sort by Started At Desc
      const sortedLogs = allLogs.sort(
        (a: GlobalWorkflowRun, b: GlobalWorkflowRun) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      );

      setLogs(sortedLogs);
      setFilteredLogs(sortedLogs);

    } catch (err) {
      console.error("Failed to load global logs", err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (filters: LogFilters) => {
    let result = [...logs];

    // Status Filter
    if (filters.status !== 'all') {
      result = result.filter(log => log.status === filters.status);
    }

    // Service Filter
    if (filters.serviceId !== 'all') {
       result = result.filter(log => log.workflow_id === filters.serviceId);
    }

    // Date Range Filter
    if (filters.dateRange.start) {
      result = result.filter(log => new Date(log.started_at) >= filters.dateRange.start!);
    }
    if (filters.dateRange.end) {
      // Add end of day buffer if needed, but handled by date-fns typically
      result = result.filter(log => new Date(log.started_at) <= filters.dateRange.end!);
    }

    // Version Filter - Global view might not support version filtering easily unless we aggregate versions too?
    // User didn't explicitly ask for version filtering in global view, but it's in the bar. 
    // We can implement text match or strict match if version is available.
    if (filters.version !== 'all') {
         // Assuming version is available
         result = result.filter(log => String(log.workflow_version) === filters.version);
    }

    setFilteredLogs(result);
  };

  return { 
    logs: filteredLogs, 
    filterApps: apps, 
    loading, 
    applyFilters,
    reload: loadGlobalLogs 
  };
}
