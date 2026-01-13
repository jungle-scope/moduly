from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel


class WorkflowNodeRunSchema(BaseModel):
    id: UUID
    node_id: str
    node_type: str
    status: str
    inputs: Optional[Dict[str, Any]]
    outputs: Optional[Dict[str, Any]]
    error_message: Optional[str]
    started_at: datetime
    finished_at: Optional[datetime]

    class Config:
        from_attributes = True


class WorkflowRunSchema(BaseModel):
    id: UUID
    workflow_id: UUID
    user_id: UUID
    status: str
    trigger_mode: str
    inputs: Optional[Dict[str, Any]]
    outputs: Optional[Dict[str, Any]]
    error_message: Optional[str]
    started_at: datetime
    finished_at: Optional[datetime]
    duration: Optional[float]
    workflow_version: Optional[int] = None
    deployment_id: Optional[UUID] = None
    total_tokens: Optional[int] = 0
    total_cost: Optional[float] = 0.0
    node_runs: List[WorkflowNodeRunSchema] = []

    class Config:
        from_attributes = True


class WorkflowRunListResponse(BaseModel):
    total: int
    items: List[WorkflowRunSchema]


# Dashboard Schemas
class StatsSummary(BaseModel):
    totalRuns: int
    successRate: float
    avgDuration: float
    totalCost: float
    avgTokenPerRun: float
    avgCostPerRun: float


class DailyRunStat(BaseModel):
    date: str
    count: int
    total_cost: float = 0.0
    total_tokens: int = 0


class RunCostStat(BaseModel):
    run_id: UUID
    started_at: datetime
    total_tokens: int
    total_cost: float


class FailureStat(BaseModel):
    node_id: str
    node_name: str
    count: int
    reason: str
    rate: str  # e.g. "5.2%"


class RecentFailure(BaseModel):
    run_id: UUID
    failed_at: datetime
    node_id: str
    error_message: str


class DashboardStatsResponse(BaseModel):
    summary: StatsSummary
    runsOverTime: List[DailyRunStat]
    minCostRuns: List[RunCostStat]
    maxCostRuns: List[RunCostStat]
    failureAnalysis: List[FailureStat]
    recentFailures: List[RecentFailure]
