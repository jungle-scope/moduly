'use client';

import Header from '@/app/features/dashboard/components/Header';
import { useWorkflowStore } from '../store/useWorkflowStore';

export default function WorkflowLayoutHeader() {
  const isFullscreen = useWorkflowStore((state) => state.isFullscreen);

  if (isFullscreen) {
    return null;
  }

  return <Header />;
}
