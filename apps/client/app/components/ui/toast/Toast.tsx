// apps/client/app/components/ui/toast/Toast.tsx
'use client';

import { useEffect, useState, useRef } from 'react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  duration?: number; // 기본값 2000ms (2초)
}

export function Toast({
  message,
  isVisible,
  onClose,
  duration = 1000,
}: ToastProps) {
  const [shouldRender, setShouldRender] = useState(isVisible);

  if (isVisible && !shouldRender) {
    setShouldRender(true);
  }

  // onClose가 변경되어도 타이머가 리셋되지 않도록 방어
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => onCloseRef.current(), duration);
      return () => clearTimeout(timer);
    } else {
      // 애니메이션 딜레이
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration]);

  if (!shouldRender) return null;

  return (
    <div
      className={`
        fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-200
        bg-gray-800/90 text-white px-4 py-2 rounded-lg shadow-lg
        text-sm font-medium transition-opacity duration-300
        ${isVisible ? 'opacity-100' : 'opacity-0'}
      `}
    >
      {message}
    </div>
  );
}
