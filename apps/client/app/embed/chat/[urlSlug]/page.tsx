/* 임베딩된 페이지입니다. 일단은 챗봇이라고 가정하고 만들었습니다. */

'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import './embed-reset.css';

interface DeploymentInfo {
  url_slug: string;
  name: string;
  version: number;
  description?: string;
  type: string;
  input_schema?: {
    variables: Array<{
      name: string;
      type: string;
      label: string;
    }>;
  };
  output_schema?: {
    outputs: Array<{
      variable: string;
      label: string;
    }>;
  };
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function EmbedChatPage() {
  const params = useParams();
  const urlSlug = params.urlSlug as string;

  const [deploymentInfo, setDeploymentInfo] = useState<DeploymentInfo | null>(
    null,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 배포 정보 가져오기
  useEffect(() => {
    async function fetchDeploymentInfo() {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/v1/deployments/public/${urlSlug}/info`,
        );

        if (!response.ok) {
          throw new Error('배포된 워크플로우를 찾을 수 없습니다.');
        }

        const data = await response.json();
        setDeploymentInfo(data);

        // 환영 메시지 추가 (선택사항)
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: `안녕하세요! ${data.name}입니다. 무엇을 도와드릴까요?`,
            timestamp: new Date(),
          },
        ]);
      } catch (err: any) {
        setError(err.message || '배포 정보를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    if (urlSlug) {
      fetchDeploymentInfo();
    }
  }, [urlSlug]);

  // 메시지 전송 처리
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() || sending) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');
    setSending(true);

    try {
      // 실제 API 호출
      const response = await fetch(`/api/v1/run-public/${urlSlug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: deploymentInfo?.input_schema?.variables.reduce(
            (acc, variable) => {
              // 첫 번째 input 변수에 사용자 메시지 매핑
              // TODO: 추후 다중 입력 변수 지원 시 개선 필요
              if (Object.keys(acc).length === 0) {
                acc[variable.name] = currentInput;
              }
              return acc;
            },
            {} as Record<string, string>,
          ),
        }),
      });

      if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.status}`);
      }

      const data = await response.json();

      // 응답에서 결과 추출
      let assistantContent = '';

      if (data.status === 'success' && data.results) {
        // results 객체에서 AnswerNode의 answer 찾기
        for (const nodeResult of Object.values(data.results)) {
          if (
            nodeResult &&
            typeof nodeResult === 'object' &&
            'answer' in nodeResult
          ) {
            assistantContent = (nodeResult as { answer: string }).answer;
            break;
          }
        }

        // answer를 찾지 못한 경우, 첫 번째 결과값 사용
        if (!assistantContent) {
          const firstResult = Object.values(data.results)[0];
          if (typeof firstResult === 'string') {
            assistantContent = firstResult;
          } else if (firstResult && typeof firstResult === 'object') {
            // 객체인 경우 첫 번째 값 추출 시도
            const firstValue = Object.values(firstResult)[0];
            assistantContent =
              typeof firstValue === 'string'
                ? firstValue
                : '응답을 처리할 수 없습니다.';
          } else {
            assistantContent = '응답을 처리할 수 없습니다.';
          }
        }
      } else {
        assistantContent = data.message || '응답을 처리할 수 없습니다.';
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      // 에러 메시지 표시
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  // 로딩 상태
  if (loading) {
    return (
      <div
        id="embed-chat-root"
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          margin: 0,
          padding: 0,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-block',
              width: '32px',
              height: '32px',
              border: '3px solid #e5e7eb',
              borderTopColor: '#4AAED9',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          ></div>
          <p style={{ marginTop: '16px', fontSize: '14px', color: '#6b7280' }}>
            로딩 중...
          </p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div
        id="embed-chat-root"
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          margin: 0,
          padding: 0,
        }}
      >
        <div style={{ textAlign: 'center', padding: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              margin: '0 auto',
              color: '#ef4444',
            }}
          >
            ⚠️
          </div>
          <h2
            style={{
              marginTop: '16px',
              fontSize: '18px',
              fontWeight: '600',
              color: '#111827',
            }}
          >
            오류가 발생했습니다
          </h2>
          <p style={{ marginTop: '8px', fontSize: '14px', color: '#6b7280' }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  // 채팅 인터페이스
  return (
    <div
      id="embed-chat-root"
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f9fafb',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          flexShrink: 0,
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          padding: '16px',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        }}
      >
        <h1
          style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#111827',
            margin: 0,
          }}
        >
          {deploymentInfo?.name || '채팅'}
        </h1>
      </div>

      {/* 메시지 영역 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '75%',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor:
                  message.role === 'user' ? '#4AAED9' : '#ffffff',
                color: message.role === 'user' ? '#ffffff' : '#111827',
                fontSize: '14px',
                lineHeight: '1.5',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                wordWrap: 'break-word',
              }}
            >
              {message.content}
            </div>
            <span
              style={{
                fontSize: '11px',
                color: '#9ca3af',
                marginTop: '4px',
                padding: '0 4px',
              }}
            >
              {message.timestamp.toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        ))}

        {sending && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              }}
            >
              <span style={{ fontSize: '14px', color: '#6b7280' }}>
                입력 중...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 입력 영역 */}
      <div
        style={{
          flexShrink: 0,
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          padding: '16px',
        }}
      >
        <form
          onSubmit={handleSendMessage}
          style={{
            display: 'flex',
            gap: '8px',
          }}
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="메시지를 입력하세요..."
            disabled={sending}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              backgroundColor: sending ? '#f3f4f6' : '#ffffff',
              color: '#111827',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#4AAED9';
              e.target.style.boxShadow = '0 0 0 3px rgba(74, 174, 217, 0.15)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#d1d5db';
              e.target.style.boxShadow = 'none';
            }}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || sending}
            style={{
              padding: '12px 24px',
              background:
                !inputValue.trim() || sending
                  ? '#9ca3af'
                  : 'linear-gradient(to right, #4AAED9, #22D3EE)',
              color: '#ffffff',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              border: 'none',
              cursor: !inputValue.trim() || sending ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (inputValue.trim() && !sending) {
                e.currentTarget.style.background =
                  'linear-gradient(to right, #3D9BC5, #06B6D4)';
              }
            }}
            onMouseLeave={(e) => {
              if (inputValue.trim() && !sending) {
                e.currentTarget.style.background =
                  'linear-gradient(to right, #4AAED9, #22D3EE)';
              }
            }}
          >
            전송
          </button>
        </form>
      </div>
    </div>
  );
}
