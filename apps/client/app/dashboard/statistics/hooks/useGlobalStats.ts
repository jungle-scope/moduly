
import { useState, useEffect } from 'react';
import { appApi } from '@/app/features/app/api/appApi';
import { workflowApi } from '@/app/features/workflow/api/workflowApi';
import { DashboardStatsResponse } from '@/app/features/workflow/types/Api';

export interface GlobalStats {
  totalServices: number;
  totalTokens: number;
  totalCost: number;
  runsOverTime: { date: string; count: number; total_cost: number; total_tokens: number }[];
  recentFailures: {
    run_id: string;
    node_id: string;
    error_message: string;
    failed_at: string;
    workflow_name: string;
    workflow_id: string;
  }[];
  services: {
    id: string;
    name: string;
    stats: DashboardStatsResponse | null;
    thisMonth: {
        cost: number;
        tokens: number;
        runs: number;
    };
  }[];
  top3Expensive: {
    id: string;
    name: string;
    cost: number;
    tokens: number;
    runs: number;
  }[];
  thisMonthTotals: {
      cost: number;
      tokens: number;
      activeServices: number;
  };
  topExpensiveModels: {
      model_name: string;
      provider_name: string;
      total_cost: number;
      total_tokens: number;
  }[];
}

export function useGlobalStats() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGlobalStats();
  }, []);

  const loadGlobalStats = async () => {
    try {
      setLoading(true);
      
      setLoading(true);
      
      // 1. Fetch apps and Top Models in parallel
      const [apps, topModels] = await Promise.all([
          appApi.listApps(),
          workflowApi.getTopExpensiveModels().catch(err => {
              console.warn("Failed to fetch top models", err);
              return [];
          })
      ]);
      
      // 2. Fetch stats for each app in parallel
      const statsPromises = apps.map(async (app) => {
        const workflowId = app.workflow_id || app.id;
        try {
            const targetId = app.workflow_id || app.id;
            if(!targetId) return { app, stats: null };

            const stats = await workflowApi.getDashboardStats(targetId);
            return { app, stats };
        } catch (e) {
            console.warn(`Failed to load stats for app ${app.name}`, e);
            return { app, stats: null };
        }
      });

      const results = await Promise.all(statsPromises);
      const successfulResults = results.filter(r => r.stats !== null);

      // 3. Aggregate Data
      let totalTokens = 0;
      let totalCost = 0;
      const runsOverTimeMap = new Map<string, { count: number; total_cost: number; total_tokens: number }>();
      let allFailures: any[] = [];
      
      // [NEW] Calculate This Month Stats (based on local time)
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed

      const processedServices = successfulResults.map(({ app, stats }) => {
          if (!stats) return null;

          // Calculate "This Month" from runsOverTime
          let monthCost = 0;
          let monthTokens = 0;
          let monthRuns = 0;

          stats.runsOverTime.forEach(day => {
              const d = new Date(day.date);
              if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
                  monthCost += day.total_cost;
                  monthTokens += day.total_tokens;
                  monthRuns += day.count;
              }
          });

          return {
              id: app.workflow_id || app.id,
              name: app.name,
              stats,
              thisMonth: {
                  cost: monthCost,
                  tokens: monthTokens,
                  runs: monthRuns
              }
          };
      }).filter(s => s !== null) as GlobalStats['services'];

      // ... (Rest of aggregation logic remains similar, but we use processedServices loop)
      
      processedServices.forEach((service) => {
        const stats = service.stats!; // already filtered nulls

        stats.runsOverTime.forEach(day => {
            const current = runsOverTimeMap.get(day.date) || { count: 0, total_cost: 0, total_tokens: 0 };
            runsOverTimeMap.set(day.date, {
                count: current.count + day.count,
                total_cost: current.total_cost + day.total_cost,
                total_tokens: current.total_tokens + day.total_tokens
            });
        });

        const failuresWithInfo = stats.recentFailures.map(f => ({
            ...f,
            workflow_name: service.name,
            workflow_id: service.id
        }));
        allFailures = [...allFailures, ...failuresWithInfo];
      });

      // Recalculate Totals from Chart Data
      let aggTokens = 0;
      let aggCost = 0;
      Array.from(runsOverTimeMap.values()).forEach(v => {
          aggTokens += v.total_tokens;
          aggCost += v.total_cost;
      });

      const runsOverTime = Array.from(runsOverTimeMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const recentFailures = allFailures
        .sort((a, b) => new Date(b.failed_at).getTime() - new Date(a.failed_at).getTime())
        .slice(0, 10);

      // [NEW] Top 3 Expensive Services (This Month)
      const top3Expensive = [...processedServices]
        .sort((a, b) => b.thisMonth.cost - a.thisMonth.cost)
        .slice(0, 3)
        .map(s => ({
            id: s.id,
            name: s.name,
            cost: s.thisMonth.cost,
            tokens: s.thisMonth.tokens,
            runs: s.thisMonth.runs
        }));

      setStats({
        totalServices: apps.length,
        totalTokens: aggTokens,
        totalCost: aggCost,
        runsOverTime,
        recentFailures,
        services: processedServices,
        top3Expensive,
        thisMonthTotals: {
            cost: processedServices.reduce((acc, curr) => acc + curr.thisMonth.cost, 0),
            tokens: processedServices.reduce((acc, curr) => acc + curr.thisMonth.tokens, 0),
            activeServices: processedServices.filter(s => s.thisMonth.runs > 0).length
        },
        topExpensiveModels: topModels // [NEW]
      });

    } catch (err) {
      console.error("Failed to aggregate global stats", err);
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading, reload: loadGlobalStats };
}
