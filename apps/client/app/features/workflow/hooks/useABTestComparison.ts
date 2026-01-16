'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { WorkflowRun } from '@/app/features/workflow/types/Api';
import { workflowApi } from '@/app/features/workflow/api/workflowApi';

/**
 * A/B 테스트 비교를 위한 Custom Hook
 * 
 * @param workflowId - 워크플로우 ID
 * @returns A/B 테스트 관련 상태 및 함수
 */
export const useABTestComparison = (workflowId: string) => {
  // === State ===
  const [isOpen, setIsOpen] = useState(false);
  const [runA, setRunA] = useState<WorkflowRun | null>(null);
  const [runB, setRunB] = useState<WorkflowRun | null>(null);
  const [selectionTarget, setSelectionTarget] = useState<'A' | 'B' | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  
  const sectionRef = useRef<HTMLDivElement>(null);

  // === Effects ===
  // Auto-scroll to A/B Section when opened
  useEffect(() => {
    if (isOpen && sectionRef.current) {
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 100);
    }
  }, [isOpen]);

  // ESC 키로 A/B 테스트 모드 종료
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        reset();
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  // === Functions ===
  const reset = useCallback(() => {
    setRunA(null);
    setRunB(null);
    setSelectionTarget(null);
  }, []);

  const toggle = useCallback((newOpen?: boolean) => {
    const nextOpen = newOpen ?? !isOpen;
    setIsOpen(nextOpen);
    
    // A/B 테스트 열릴 때 자동으로 A 선택 모드 시작
    if (nextOpen && !runA) {
      setSelectionTarget('A');
    }
  }, [isOpen, runA]);

  const selectRun = useCallback((log: WorkflowRun): { handled: boolean } => {
    if (selectionTarget === 'A') {
      if (runB?.id === log.id) {
        alert('이미 B(비교군)로 선택된 실행입니다. 다른 실행을 선택해주세요.');
        return { handled: true };
      }
      setRunA(log);
      
      // B가 없으면 자동으로 B 선택 모드로 전환
      if (!runB) {
        setSelectionTarget('B');
      } else {
        setSelectionTarget(null);
        // Auto-scroll
        setTimeout(() => {
          sectionRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }, 100);
      }
      return { handled: true };
    }
    
    if (selectionTarget === 'B') {
      if (runA?.id === log.id) {
        alert('이미 A(기준)로 선택된 실행입니다. 다른 실행을 선택해주세요.');
        return { handled: true };
      }
      setRunB(log);
      setSelectionTarget(null);
      
      if (runA) {
        setTimeout(() => {
          sectionRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }, 100);
      }
      return { handled: true };
    }

    return { handled: false };
  }, [selectionTarget, runA, runB]);

  const startCompare = useCallback(async (): Promise<{
    selectedLog: WorkflowRun;
    compareLog: WorkflowRun;
  } | null> => {
    if (!runA || !runB) return null;

    setIsComparing(true);
    try {
      // A/B 모두 상세 정보 가져오기
      const [detailedA, detailedB] = await Promise.all([
        workflowApi.getWorkflowRun(workflowId, runA.id),
        workflowApi.getWorkflowRun(workflowId, runB.id),
      ]);
      return { selectedLog: detailedA, compareLog: detailedB };
    } catch (err) {
      console.error('Failed to fetch A/B run details:', err);
      // 실패 시 기존 데이터로 진행
      return { selectedLog: runA, compareLog: runB };
    } finally {
      setIsComparing(false);
    }
  }, [workflowId, runA, runB]);

  return {
    // State
    isOpen,
    runA,
    runB,
    selectionTarget,
    isComparing,
    sectionRef,
    
    // Functions
    toggle,
    reset,
    selectRun,
    startCompare,
    setSelectionTarget,
  };
};
