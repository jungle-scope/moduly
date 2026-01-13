/**
 * useAuthRedirect 훅 테스트
 *
 * 로그인 상태에 따른 자동 리다이렉트 기능을 테스트합니다.
 * - 로그인 상태: 지정된 경로로 리다이렉트
 * - 비로그인 상태: 현재 페이지 유지
 *
 * 실행 방법:
 *   cd apps/client
 *   npm test -- --run
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useAuthRedirect } from './useAuthRedirect';

// next/navigation 모킹
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// authApi 모킹
const mockMe = vi.fn();
vi.mock('../api/authApi', () => ({
  authApi: {
    me: () => mockMe(),
  },
}));

// ============================================================================
// 테스트
// ============================================================================

describe('useAuthRedirect 훅 테스트', () => {
  beforeEach(() => {
    // 각 테스트 전에 모든 mock 초기화
    vi.clearAllMocks();
    mockReplace.mockReset();
    mockMe.mockReset();
    cleanup();
  });

  it('로그인 상태이면 지정된 경로로 리다이렉트된다', async () => {
    // authApi.me()가 성공하면 로그인 상태
    mockMe.mockResolvedValueOnce({ user: { id: '1', email: 'test@test.com' } });

    renderHook(() => useAuthRedirect('/dashboard'));

    // API 호출 완료 후 리다이렉트 확인
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('커스텀 리다이렉트 경로를 사용할 수 있다', async () => {
    mockMe.mockResolvedValueOnce({ user: { id: '1', email: 'test@test.com' } });

    renderHook(() => useAuthRedirect('/custom-path'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/custom-path');
    });
  });

  it('비로그인 상태이면 isLoading이 false가 된다', async () => {
    // authApi.me()가 실패하면 비로그인 상태
    mockMe.mockRejectedValueOnce(new Error('Unauthorized'));

    const { result } = renderHook(() => useAuthRedirect('/dashboard'));

    // API 호출 실패 후 isLoading이 false가 되어야 함
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('초기 상태에서 isLoading은 true이다', () => {
    // API 호출을 pending 상태로 유지
    mockMe.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useAuthRedirect('/dashboard'));

    expect(result.current.isLoading).toBe(true);
  });
});
