/* 
개발 과정 중 테스트를 용이하게 하기 위한 결과 모달입니다.
실제로 결과를 유저에게 보여줄지는 모르기 때문에, 정해지면 이후에 해당 파일을 삭제해주세요.

현재 기능은
- workflowEngine의 실행 결과를 별도의 모달 창에 표시한다.
*/

'use client';

interface ResultModalProps {
  result: any;
  onClose: () => void;
}

export function ResultModal({ result, onClose }: ResultModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              테스트 실행 결과
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              워크플로우가 성공적으로 실행되었습니다
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1">
          <div className="space-y-4">
            {Object.entries(result).map(([nodeId, output]: [string, any]) => (
              <div
                key={nodeId}
                className="border border-gray-200 rounded-lg p-4 bg-gray-50"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <h3 className="font-medium text-gray-700">{nodeId}</h3>
                </div>
                <pre className="text-sm text-gray-600 overflow-x-auto bg-white p-3 rounded border border-gray-200">
                  {JSON.stringify(output, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
