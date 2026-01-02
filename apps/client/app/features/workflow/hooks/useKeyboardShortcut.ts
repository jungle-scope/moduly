import { useEffect, useRef } from 'react';

type KeyCombo = string | string[];

/**
 * useKeyboardShortcut
 * 특정 키 조합을 감지하여 콜백을 실행하는 훅입니다.
 *
 * @param keys 감지할 키 또는 키 배열. 예: 'k', ['Control', 'k'], ['Meta', 'k']
 * @param callback 실행할 콜백 함수
 * @param options 옵션 (preventDefault 등)
 */
export function useKeyboardShortcut(
  keys: KeyCombo,
  callback: (e: KeyboardEvent) => void,
  options: { preventDefault?: boolean } = { preventDefault: true },
) {
  // 최신 콜백을 유지하기 위한 ref
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      const targetKey = keysArray[keysArray.length - 1].toLowerCase();

      // 모디파이어 키 확인
      const hasMeta =
        keysArray.includes('Meta') || keysArray.includes('Command');
      const hasCtrl =
        keysArray.includes('Control') || keysArray.includes('Ctrl');
      const hasAlt = keysArray.includes('Alt');
      const hasShift = keysArray.includes('Shift');

      // 실제 눌린 키가 타겟 키와 일치하는지 확인
      const isKeyMatch = event.key.toLowerCase() === targetKey;

      if (
        isKeyMatch &&
        (hasMeta ? event.metaKey : true) &&
        (hasCtrl ? event.ctrlKey : true) &&
        (hasAlt ? event.altKey : true) &&
        (hasShift ? event.shiftKey : true)
      ) {
        if (options.preventDefault) {
          event.preventDefault();
        }
        callbackRef.current(event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keys, options.preventDefault]);
}
