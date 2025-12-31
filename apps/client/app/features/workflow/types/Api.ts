// API 요청 & 응답과 관련된 타입들을 정의합니다.

export interface WorkflowCreateRequest {
  app_id: string;
  name: string;
  description?: string;
}

export interface WorkflowResponse {
  id: string;
  app_id: string;
  marked_name: string | null;
  marked_comment: string | null;
  created_at: string;
  updated_at: string;
}
