'use client';

import { useState } from 'react';
import { WorkflowVariable } from '../../types/Nodes';

interface UserInputModalProps {
  variables: WorkflowVariable[];
  onClose: () => void;
  onSubmit: (inputs: Record<string, any>) => void;
}

export function UserInputModal({
  variables,
  onClose,
  onSubmit,
}: UserInputModalProps) {
  const [inputs, setInputs] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    variables.forEach((v) => {
      initial[v.name] = v.type === 'number' ? 0 : '';
    });
    return initial;
  });

  const handleChange = (name: string, value: any) => {
    setInputs((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    onSubmit(inputs);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            워크플로우 실행
          </h2>
          <p className="text-sm text-gray-600 mt-1">변수 값을 입력해주세요</p>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1">
          {variables.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              입력할 변수가 없습니다
            </p>
          ) : (
            <div className="space-y-4">
              {variables.map((variable) => (
                <div key={variable.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {variable.name}
                    {variable.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </label>
                  <input
                    type={variable.type === 'number' ? 'number' : 'text'}
                    value={inputs[variable.name] || ''}
                    onChange={(e) =>
                      handleChange(
                        variable.name,
                        variable.type === 'number'
                          ? Number(e.target.value)
                          : e.target.value,
                      )
                    }
                    required={variable.required}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`${variable.name} 입력`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            실행
          </button>
        </div>
      </div>
    </div>
  );
}
