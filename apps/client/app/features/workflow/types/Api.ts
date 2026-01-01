// API 요청 & 응답과 관련된 타입들을 정의합니다.

export interface WorkflowCreateRequest {
  app_id: string;
}

export interface WorkflowResponse {
  id: string;
  app_id: string;
  created_at: string;
  updated_at: string;
}
