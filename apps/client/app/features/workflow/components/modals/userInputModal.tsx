/* 
개발 과정 중 테스트를 용이하게 하기 위한 유저 입력 모달입니다.
실제로 어떤 식으로 입력을 받을지는 모르기 때문에, 정해지면 이후에 해당 파일을 삭제해주세요.

현재 기능은
- 시작 노드에서 설정한 변수대로, 유저의 입력을 받는다.
- 해당 input들을 POST api/v1/workflows/{workflowId}/execute로 전달한다. (실제로 요청을 보내는 함수는 EditorHeader.tsx의 handleModalSubmit 함수입니다)
*/

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
      if (v.type === 'number') {
        initial[v.name] = 0;
      } else if (v.type === 'checkbox') {
        initial[v.name] = false;
      } else if (v.type === 'select') {
        initial[v.name] = v.options?.[0]?.value || '';
      } else if (v.type === 'file') {
        // file은 별도 state에서 관리
        initial[v.name] = null;
      } else {
        initial[v.name] = '';
      }
    });
    return initial;
  });

  // 파일 전용 state
  const [files, setFiles] = useState<Record<string, File | null>>({});

  const handleChange = (name: string, value: any) => {
    setInputs((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    // 파일이 있는지 확인
    const hasFiles = Object.values(files).some((file) => file !== null);

    if (hasFiles) {
      // FormData 생성
      const formData = new FormData();

      // JSON 데이터 추가 (file 타입 제외)
      const jsonInputs: Record<string, any> = {};
      Object.entries(inputs).forEach(([key, value]) => {
        if (value !== null) {
          jsonInputs[key] = value;
        }
      });
      formData.append('inputs', JSON.stringify(jsonInputs));

      // 파일들 추가
      Object.entries(files).forEach(([key, file]) => {
        if (file) {
          formData.append(`file_${key}`, file);
        }
      });

      onSubmit(formData);
    } else {
      // 파일 없으면 기존 방식 (JSON)
      onSubmit(inputs);
    }
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
                  {variable.type === 'checkbox' ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={inputs[variable.name] || false}
                        onChange={(e) =>
                          handleChange(variable.name, e.target.checked)
                        }
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {variable.label || variable.name}
                        {variable.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </span>
                    </label>
                  ) : variable.type === 'select' ? (
                    <>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {variable.label || variable.name}
                        {variable.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </label>
                      <select
                        value={inputs[variable.name] || ''}
                        onChange={(e) =>
                          handleChange(variable.name, e.target.value)
                        }
                        required={variable.required}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {variable.options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : variable.type === 'file' ? (
                    <>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {variable.label || variable.name}
                        {variable.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </label>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setFiles((prev) => ({
                            ...prev,
                            [variable.name]: file,
                          }));
                        }}
                        required={variable.required}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      {files[variable.name] && (
                        <p className="text-xs text-gray-500 mt-1">
                          선택됨: {files[variable.name]!.name}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {variable.label || variable.name}
                        {variable.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </label>
                      {variable.type === 'paragraph' ? (
                        <textarea
                          value={inputs[variable.name] || ''}
                          onChange={(e) =>
                            handleChange(variable.name, e.target.value)
                          }
                          required={variable.required}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                          placeholder={
                            variable.placeholder || `${variable.name} 입력`
                          }
                        />
                      ) : (
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
                          placeholder={
                            variable.placeholder || `${variable.name} 입력`
                          }
                        />
                      )}
                    </>
                  )}
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
