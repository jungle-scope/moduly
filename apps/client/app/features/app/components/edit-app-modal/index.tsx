'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { appApi, type App } from '../../api/appApi';
import { AppIcon } from '../create-app-modal/AppIcon';
import { AppIconPicker } from '../create-app-modal/AppIconPicker';
import { AppIconSelection } from '../create-app-modal/types';
import { twMerge } from 'tailwind-merge';

interface EditAppProps {
  app: App;
  onSuccess: () => void;
  onClose: () => void;
}

/**
 * 앱 수정 모달 컴포넌트
 */
export default function EditAppModal({
  app,
  onSuccess,
  onClose,
}: EditAppProps) {
  // --- 상태 관리 (State) ---

  // 입력 필드 상태 (초기값은 props로 받은 앱 정보)
  const [name, setName] = useState(app.name);
  const [description, setDescription] = useState(app.description || '');

  // 앱 아이콘 상태
  const [appIcon, setAppIcon] = useState<AppIconSelection>({
    emoji: app.icon.content,
    bg: app.icon.background_color,
  });

  // 공개 여부 상태
  const [isMarket, setIsMarket] = useState(app.is_market ?? false);

  // 아이콘 선택 팝업 표시 여부
  const [showAppIconPicker, setShowAppIconPicker] = useState(false);

  // 로딩 상태
  const [loading, setLoading] = useState(false);

  // 중복 실행 방지 Ref
  const isSubmittingRef = useRef(false);

  // --- 수정 핸들러 ---
  const handleUpdate = useCallback(async () => {
    if (isSubmittingRef.current) return;

    if (!name.trim()) {
      toast.error('앱 이름을 입력해주세요.');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    try {
      await appApi.updateApp(app.id, {
        name: name.trim(),
        description: description.trim(),
        icon: {
          type: 'emoji',
          content: appIcon.emoji,
          background_color: appIcon.bg,
        },
        is_market: isMarket,
      });

      toast.success('앱 정보가 수정되었습니다.');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('앱 수정 실패:', error);
      if (
        error.response?.status === 400 &&
        error.response?.data?.detail === 'App with this name already exists.'
      ) {
        toast.error('이미 존재하는 앱 이름입니다.');
        return;
      }
      toast.error('앱 수정에 실패했습니다.');
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  }, [app.id, name, description, appIcon, isMarket, onSuccess, onClose]);

  // --- 키보드 단축키 ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleUpdate();
      }
      if (e.key === 'Escape') {
        if (showAppIconPicker) {
          setShowAppIconPicker(false);
          e.stopPropagation();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUpdate, onClose, showAppIconPicker]);

  // --- 모달 외부 클릭 ---
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-[400px] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl overflow-hidden transform transition-all animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-zinc-800"
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-50">
              앱 정보 수정
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

          <div className="space-y-5">
            {/* 앱 이름 및 아이콘 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                앱 이름 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                <div className="relative">
                  <AppIcon
                    icon={appIcon}
                    onClick={() => setShowAppIconPicker(!showAppIconPicker)}
                    className="shadow-sm border border-zinc-200 dark:border-zinc-700 w-10 h-10 hover:ring-2 ring-blue-100 transition-all"
                  />
                  {showAppIconPicker && (
                    <AppIconPicker
                      currentIcon={appIcon}
                      onSelect={(newIcon) => setAppIcon(newIcon)}
                      onClose={() => setShowAppIconPicker(false)}
                    />
                  )}
                </div>
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

            {/* 앱 설명 */}
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

            {/* 공개 범위 */}
            <div className="pt-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                공개 범위
              </label>
              <div className="flex gap-4">
                <label
                  className={twMerge(
                    'flex-1 flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                    !isMarket
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 ring-1 ring-blue-500'
                      : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600',
                  )}
                >
                  <div className="pt-0.5">
                    <input
                      type="radio"
                      name="edit-visibility"
                      className="sr-only"
                      checked={!isMarket}
                      onChange={() => setIsMarket(false)}
                    />
                    <div
                      className={twMerge(
                        'w-4 h-4 rounded-full border flex items-center justify-center',
                        !isMarket
                          ? 'border-blue-500'
                          : 'border-zinc-300 dark:border-zinc-600',
                      )}
                    >
                      {!isMarket && (
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                      비공개 (Private)
                    </div>
                    <div className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                      나만 볼 수 있습니다.
                    </div>
                  </div>
                </label>

                {/* 공개 선택 옵션: 배포된 앱만 공개로 설정 가능하도록 제한 */}
                <label
                  className={twMerge(
                    'flex-1 flex items-start gap-3 p-3 rounded-lg border transition-all',
                    isMarket
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 ring-1 ring-blue-500 cursor-pointer'
                      : app.active_deployment_id
                        ? 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600 cursor-pointer'
                        : 'border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50 cursor-not-allowed opacity-60', // 배포되지 않은 경우 비활성화 스타일
                  )}
                >
                  <div className="pt-0.5">
                    <input
                      type="radio"
                      name="edit-visibility"
                      className="sr-only"
                      // 배포 ID가 없으면 입력 비활성화
                      disabled={!app.active_deployment_id}
                      checked={isMarket}
                      onChange={() => {
                        // 배포된 경우에만 상태 변경 허용 (UI에서 disabled 처리되지만 이중 안전장치)
                        if (app.active_deployment_id) {
                          setIsMarket(true);
                        }
                      }}
                    />
                    <div
                      className={twMerge(
                        'w-4 h-4 rounded-full border flex items-center justify-center',
                        isMarket
                          ? 'border-blue-500'
                          : 'border-zinc-300 dark:border-zinc-600',
                      )}
                    >
                      {isMarket && (
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                      공개 (Public)
                    </div>
                    <div className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                      {/* 배포 여부에 따른 안내 문구 분기 처리 */}
                      {!app.active_deployment_id ? (
                        <span className="text-amber-600 dark:text-amber-500">
                          앱을 배포해야 공개로 전환할 수 있습니다.
                        </span>
                      ) : (
                        '모든 사용자가 볼 수 있습니다.'
                      )}
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-8">
            <button
              onClick={async () => {
                if (
                  window.confirm(
                    '정말 이 앱을 삭제하시겠습니까? 삭제된 앱은 복구할 수 없습니다.',
                  )
                ) {
                  try {
                    setLoading(true);
                    await appApi.deleteApp(app.id);
                    toast.success('앱이 삭제되었습니다.');
                    onSuccess();
                    onClose();
                  } catch (error) {
                    console.error('앱 삭제 실패:', error);
                    toast.error('앱 삭제에 실패했습니다.');
                    setLoading(false);
                  }
                }
              }}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              앱 삭제
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-white/5 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleUpdate}
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
                    저장 중...
                  </>
                ) : (
                  '저장'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
