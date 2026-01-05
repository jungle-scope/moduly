import { NextRequest } from 'next/server';

/**
 * 워크플로우 스트리밍 실행을 위한 프록시 API Route
 *
 * Next.js의 rewrites는 SSE 응답을 버퍼링하기 때문에,
 * API Route를 통해 직접 스트리밍 프록시를 구현합니다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> },
) {
  console.log('[Stream Proxy] Request received');

  const resolvedParams = await params;
  const workflowId = resolvedParams.workflowId;
  console.log('[Stream Proxy] workflowId:', workflowId);

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  console.log('[Stream Proxy] backendUrl:', backendUrl);

  // Content-Type 확인
  const contentType = request.headers.get('content-type') || 'application/json';
  const isFormData = contentType.includes('multipart/form-data');

  // 요청 바디 읽기
  let body: BodyInit;
  if (isFormData) {
    // FormData는 그대로 전달
    body = await request.formData();
  } else {
    // JSON은 텍스트로 전달
    body = await request.text();
  }

  // FastAPI로 요청 전달
  const response = await fetch(
    `${backendUrl}/api/v1/workflows/${workflowId}/stream`,
    {
      method: 'POST',
      headers: isFormData
        ? {
            Cookie: request.headers.get('cookie') || '',
          }
        : {
            'Content-Type': 'application/json',
            Cookie: request.headers.get('cookie') || '',
          },
      body,
    },
  );

  // 에러 응답 처리
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return new Response(JSON.stringify(errorData), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 스트리밍 응답 전달 (버퍼링 없이)
  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Nginx 버퍼링 비활성화
    },
  });
}
