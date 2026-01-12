'use client';

interface InputStepProps {
  deploymentType: string;
  description: string;
  onDescriptionChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isDeploying: boolean;
}

export function InputStep({
  deploymentType,
  description,
  onDescriptionChange,
  onCancel,
  onSubmit,
  isDeploying,
}: InputStepProps) {
  return (
    <>
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">
          {deploymentType} 배포
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          현재 워크플로우를 배포하여 사용할 수 있게 만듭니다.
        </p>
      </div>

      <div className="p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          배포 설명 (선택)
        </label>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-none"
          placeholder="이번 배포에 대한 설명을 적어주세요 (예: V1.0 출시)"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
      </div>

      <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          취소
        </button>
        <button
          onClick={onSubmit}
          disabled={isDeploying}
          className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
        >
          {isDeploying ? (
            <>
              <svg
                className="animate-spin h-4 w-4 text-white"
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
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              배포중...
            </>
          ) : (
            '다음'
          )}
        </button>
      </div>
    </>
  );
}
