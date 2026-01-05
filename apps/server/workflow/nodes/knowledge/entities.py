from typing import List, Optional

from pydantic import BaseModel, Field, validator

from workflow.nodes.base.entities import BaseNodeData


class KnowledgeBaseRef(BaseModel):
  id: str
  name: Optional[str] = None


class QueryVariable(BaseModel):
  name: str
  value_selector: List[str] = Field(
    default_factory=list, description="[node_id, output_key] 형태의 경로"
  )


class KnowledgeNodeData(BaseNodeData):
  knowledgeBases: List[KnowledgeBaseRef] = Field(default_factory=list)
  queryVariables: List[QueryVariable] = Field(default_factory=list)
  userQuery: Optional[str] = None
  scoreThreshold: float = 0.5
  topK: int = 3

  @validator("scoreThreshold", pre=True, always=True)
  def clamp_score(cls, v):
    try:
      val = float(v)
    except Exception:
      return 0.5
    return max(0.0, min(1.0, val))

  @validator("topK", pre=True, always=True)
  def clamp_topk(cls, v):
    try:
      val = int(v)
    except Exception:
      val = 3
    return max(1, min(20, val))

  def validate(self) -> None:
    # 빈 변수를 미리 정리 (이름/selector 모두 비어있거나 불완전한 경우)
    cleaned_vars = []
    for var in self.queryVariables:
      name = (var.name or "").strip()
      selector = var.value_selector or []
      # 이름과 selector가 모두 비어있으면 무시
      if not name and (not selector or len(selector) < 2):
        continue
      # 이름은 있지만 selector가 불완전하면 무시
      if name and (not selector or len(selector) < 2):
        continue
      cleaned_vars.append(var)
    self.queryVariables = cleaned_vars

    if not self.knowledgeBases:
      raise ValueError("지식 베이스를 최소 1개 선택하세요.")

    query = (self.userQuery or "").strip()
    if not query:
      raise ValueError("입력 쿼리를 입력하세요.")
