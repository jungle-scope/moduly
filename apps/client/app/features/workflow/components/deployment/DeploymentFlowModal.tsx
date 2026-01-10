'use client';

import { useState, useEffect } from 'react';
import { DeploymentStep, DeploymentType, DeploymentResult } from './types';
import { InputStep, SuccessStep, ErrorStep } from './DeployStep';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  deploymentType: DeploymentType;
  onDeploy: (description: string) => Promise<DeploymentResult>;
}

// ========== Main Component ==========

export function DeploymentFlowModal({
  isOpen,
  onClose,
  deploymentType,
  onDeploy,
}: Props) {
  const [currentStep, setCurrentStep] = useState<DeploymentStep>('input');
  const [description, setDescription] = useState('');
  const [deploymentResult, setDeploymentResult] =
    useState<DeploymentResult | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('input');
      setDescription('');
      setDeploymentResult(null);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isDeploying) {
          // Confirm before closing during deployment
          if (confirm('배포가 진행 중입니다. 정말 닫으시겠습니까?')) {
            onClose();
          }
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isDeploying, onClose]);

  // Handle deployment submission
  const handleSubmit = async () => {
    setIsDeploying(true);

    try {
      const result = await onDeploy(description);
      setDeploymentResult(result);

      if (result.success) {
        setCurrentStep('success');
      } else {
        setCurrentStep('error');
      }
    } catch (error: any) {
      setDeploymentResult({
        success: false,
        message: error.message || '알 수 없는 오류가 발생했습니다.',
      });
      setCurrentStep('error');
    } finally {
      setIsDeploying(false);
    }
  };

  // Handle retry on error
  const handleRetry = () => {
    setCurrentStep('input');
    setDeploymentResult(null);
  };

  if (!isOpen) return null;

  // Get deployment type display name
  const getDeploymentTypeName = () => {
    switch (deploymentType) {
      case 'api':
        return 'REST API';
      case 'webapp':
        return '웹 앱';
      case 'widget':
        return '웹사이트 위젯';
      case 'workflow_node':
        return '서브 모듈';
      default:
        return '배포';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 flex flex-col overflow-hidden">
        {/* Step Indicator */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2 mb-2">
            {/* Step 1 */}
            <div
              className={`flex-1 h-1 rounded-full transition-all ${
                currentStep === 'input' ? 'bg-blue-500' : 'bg-gray-200'
              }`}
            />
            <div
              className={`flex-1 h-1 rounded-full transition-all ${
                currentStep === 'success' || currentStep === 'error'
                  ? 'bg-blue-500'
                  : 'bg-gray-200'
              }`}
            />
          </div>

          {/* Step Labels */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 text-center">
              <span
                className={`text-xs ${currentStep === 'input' ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}
              >
                설명 입력
              </span>
            </div>
            <div className="flex-1 text-center">
              <span
                className={`text-xs ${currentStep === 'success' || currentStep === 'error' ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}
              >
                배포 성공
              </span>
            </div>
          </div>
        </div>

        {/* Content - render based on current step */}
        <div className="flex-1 transition-all duration-300">
          {currentStep === 'input' && (
            <InputStep
              deploymentType={getDeploymentTypeName()}
              description={description}
              onDescriptionChange={setDescription}
              onCancel={onClose}
              onSubmit={handleSubmit}
              isDeploying={isDeploying}
            />
          )}

          {currentStep === 'success' && deploymentResult && (
            <SuccessStep
              result={deploymentResult}
              deploymentType={deploymentType}
              onClose={onClose}
            />
          )}

          {currentStep === 'error' && deploymentResult && (
            <ErrorStep
              message={
                deploymentResult.message || '배포 중 오류가 발생했습니다.'
              }
              onRetry={handleRetry}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
