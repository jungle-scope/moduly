'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { AppIcon } from './app-icon';
import { AppIconPicker } from './app-icon-picker';
import { AppIconSelection, CreateAppProps } from './types';
import { twMerge } from 'tailwind-merge';

// 임시 API 함수 (나중에 실제 서비스 파일로 이동해야 함)
// 실제 백엔드 연동 전 UI 테스트를 위한 모의 함수입니다.
const createApp = async (data: {
  name: string;
  description: string;
  icon: string;
  icon_background: string;
}) => {
  console.log('API 요청 데이터:', data);
  // 네트워크 지연 효과 시뮬레이션 (0.8초)
  return new Promise((resolve) => setTimeout(resolve, 800));
};

/**
 * 앱 생성 모달 컴포넌트
 *
 * 사용자가 새로운 앱을 생성할 때 사용하는 팝업창입니다.
 * 앱 이름, 설명, 아이콘을 입력받아 생성을 요청합니다.
 */
export default function CreateAppModal({ onSuccess, onClose }: CreateAppProps) {
  // --- 상태 관리 (State) ---

  // 입력 필드 상태
  const [name, setName] = useState(''); // 앱 이름
  const [description, setDescription] = useState(''); // 앱 설명

  // 앱 아이콘 상태 (이모지 및 배경색)
  const [appIcon, setAppIcon] = useState<AppIconSelection>({
    emoji: '🤖',
    bg: '#FFEAD5',
  });

  // 아이콘 선택 팝업 표시 여부
  const [showAppIconPicker, setShowAppIconPicker] = useState(false);

  // 로딩 상태 (API 요청 중일 때 true)
  const [loading, setLoading] = useState(false);

  // 중복 생성 방지를 위한 Ref
  const isCreatingRef = useRef(false);
  const modalRef = useRef<HTMLDivElement>(null); // 현재는 e.target === e.currentTarget 방식으로 구현되어 있어 사용되지 않습니다. (삭제 가능)

  // --- 유효성 검사 (Validation) ---
  const validate = () => {
    // 앱 이름은 필수 입력 사항입니다.
    if (!name.trim()) {
      // 실제 앱에서는 Toast(토스트) 메시지 컴포넌트를 사용하는 것이 좋습니다.
      toast.error('앱 이름을 입력해주세요.');
      return false;
    }
    return true;
  };

  // --- 생성 핸들러 (Submit Handler) ---
  const handleCreate = useCallback(async () => {
    // 이미 생성 요청 중이면 중복 실행 방지
    if (isCreatingRef.current) return;

    // 유효성 검사 실패 시 중단
    if (!validate()) return;

    // 생성 시작 상태 설정
    isCreatingRef.current = true;
    setLoading(true);

    try {
      // API 호출
      await createApp({
        name: name.trim(),
        description: description.trim(),
        icon: appIcon.emoji,
        icon_background: appIcon.bg,
      });

      // 성공 처리
      console.log('앱 생성 성공');
      toast.success('앱이 성공적으로 생성되었습니다.');
      onSuccess(); // 부모 컴포넌트에 성공 알림 (목록 새로고침 등)
      onClose(); // 모달 닫기
    } catch (error) {
      console.error('앱 생성 실패:', error);
      toast.error('앱 생성에 실패했습니다.');
    } finally {
      // 상태 초기화
      isCreatingRef.current = false;
      setLoading(false);
    }
  }, [name, description, appIcon, onSuccess, onClose]);

  // --- 키보드 단축키 (Keyboard Shortcuts) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Enter 또는 Ctrl+Enter로 폼 제출 (빠른 생성)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleCreate();
      }

      // Escape(ESC) 키로 모달 닫기
      if (e.key === 'Escape') {
        // 아이콘 선택 창이 열려있으면 그것만 닫기
        if (showAppIconPicker) {
          setShowAppIconPicker(false);
          e.stopPropagation(); // 이벤트 전파 중단
        } else {
          // 아니라면 모달 전체 닫기
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCreate, onClose, showAppIconPicker]);

  // --- 모달 외부 클릭 처리 (Backdrop Click) ---
  const handleBackdropClick = (e: React.MouseEvent) => {
    // e.target: 사용자가 실제로 클릭한 요소 (예: 배경, 모달 내부 글자, 버튼 등)
    // e.currentTarget: 이벤트 핸들러(onClick)가 부착된 요소 (여기서는 배경 div)

    // 클릭된 요소가 배경(dimmed layer) 자체일 때만 닫기
    // (모달 내부를 클릭했을 때는 e.target이 모달 내부 요소이므로 이 조건이 거짓이 되어 닫히지 않음)
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    // 배경 (Backdrop)
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      {/* 모달 본문 */}
      <div
        role="dialog"
        aria-modal="true"
        className="w-[400px] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl overflow-hidden transform transition-all animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-zinc-800"
      >
        <div className="p-6">
          {/* 헤더: 제목 및 닫기 버튼 */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-50">
              앱 생성
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* 입력 폼 영역 */}
          <div className="space-y-5">
            {/* 앱 이름 및 아이콘 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                앱 이름 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                {/* 아이콘 선택기 */}
                <div className="relative">
                  <AppIcon
                    icon={appIcon}
                    onClick={() => setShowAppIconPicker(!showAppIconPicker)}
                    className="shadow-sm border border-zinc-200 dark:border-zinc-700 w-10 h-10 hover:ring-2 ring-blue-100 transition-all"
                  />
                  {showAppIconPicker && (
                    <AppIconPicker
                      currentIcon={appIcon}
                      onSelect={(newIcon) => {
                        setAppIcon(newIcon);
                        // 아이콘 선택 후 닫지 않고 색상도 고를 수 있게 유지
                      }}
                      onClose={() => setShowAppIconPicker(false)}
                    />
                  )}
                </div>
                {/* 이름 입력 필드 */}
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="앱 이름을 입력하세요"
                  className={twMerge(
                    'flex-1 h-10 px-3 rounded-lg border bg-transparent outline-none transition-all text-sm',
                    'border-zinc-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10',
                    'dark:border-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500',
                  )}
                />
              </div>
            </div>

            {/* 앱 설명 입력 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                앱 설명
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="앱에 대한 설명을 입력하세요"
                className={twMerge(
                  'w-full h-28 px-3 py-2 rounded-lg border bg-transparent outline-none transition-all text-sm resize-none',
                  'border-zinc-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10',
                  'dark:border-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500',
                )}
              />
            </div>
          </div>

          {/* 하단 버튼 영역 (취소 / 생성) */}
          <div className="flex items-center justify-end gap-3 mt-8">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleCreate}
              disabled={loading}
              className={twMerge(
                'px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition-all flex items-center gap-2',
                loading && 'opacity-70 cursor-not-allowed',
              )}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  생성 중...
                </>
              ) : (
                '생성'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
