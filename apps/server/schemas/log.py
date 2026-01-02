from typing import Any, Dict, List, Optional
from datetime import datetime
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
    workflow_version: Optional[int] = None # [NEW]
    deployment_id: Optional[UUID] = None   # [NEW]
    total_tokens: Optional[int] = 0        # [NEW]
    total_cost: Optional[float] = 0.0      # [NEW]
    
    # 리스트 조회시에는 node_runs 제외할 수도 있지만, 상세 조회시 포함
    node_runs: List[WorkflowNodeRunSchema] = []

    class Config:
        from_attributes = True

class WorkflowRunListResponse(BaseModel):
    total: int
    items: List[WorkflowRunSchema]

# [NEW] Dashboard Schemas
class StatsSummary(BaseModel):
    totalRuns: int
    successRate: float
    avgDuration: float
    totalCost: float
    avgTokenPerRun: float  # [NEW] Requested by user
    avgCostPerRun: float   # [NEW] Requested by user

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
    rate: str # e.g. "5.2%"

class RecentFailure(BaseModel): # [NEW] Requested by user
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


