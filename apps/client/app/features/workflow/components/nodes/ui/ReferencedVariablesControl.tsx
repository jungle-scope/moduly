import React from 'react';
import { Plus, Trash2, ArrowRight } from 'lucide-react';
import { AppNode } from '../../../types/Nodes';
import { getNodeOutputs } from '../../../utils/getNodeOutputs';

export interface ReferencedVariable {
  name: string;
  value_selector: string[]; // [노드ID, 출력키]
}

interface ReferencedVariablesControlProps {
  variables: ReferencedVariable[];
  upstreamNodes: AppNode[];
  onUpdate: (
    index: number,
    field: 'name' | 'value_selector',
    value: string | string[],
  ) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  placeholder?: string;
  emptyMessage?: string;
  title?: string;
  description?: string;
  showAddButton?: boolean;
  showRemoveButton?: boolean;
  showItemLabel?: boolean;
  hideAlias?: boolean;
}

export const ReferencedVariablesControl: React.FC<
  ReferencedVariablesControlProps
> = ({
  variables,
  upstreamNodes,
  onUpdate,
  onAdd,
  onRemove,
  placeholder = '변수명',
  emptyMessage = '추가된 변수가 없습니다.',
  title = 'Referenced Variables',
  description = '필드에서 사용할 변수를 정의하고, 이전 노드의 출력값과 연결하세요.',
  showAddButton = true,
  showRemoveButton = true,
  showItemLabel = true,
  hideAlias = false,
}) => {
  const handleSelectorUpdate = (
    index: number,
    position: 0 | 1,
    value: string,
  ) => {
    const currentSelector = [...(variables[index].value_selector || [])];

    if (currentSelector.length < 2) {
      currentSelector[0] = currentSelector[0] || '';
      currentSelector[1] = currentSelector[1] || '';
    }

    currentSelector[position] = value;

    // 노드가 변경되면(인덱스 0), 출력 키(인덱스 1) 초기화
    if (position === 0) {
      currentSelector[1] = '';
    }

    onUpdate(index, 'value_selector', currentSelector);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          {title && (
            <h4 className="text-xs font-semibold text-gray-700">{title}</h4>
          )}
          {description && (
            <p className="text-[10px] text-gray-500">{description}</p>
          )}
        </div>

        {showAddButton && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Add Variable"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      {variables.length === 0 && (
        <div className="text-xs text-gray-400 p-2 text-center border border-dashed border-gray-200 rounded">
          {emptyMessage}
        </div>
      )}

      {variables.map((variable, index) => {
        const selectedSourceNodeId = variable.value_selector?.[0] || '';
        const selectedVarKey = variable.value_selector?.[1] || '';

        const selectedNode = upstreamNodes.find(
          (n) => n.id === selectedSourceNodeId,
        );
        const availableOutputs = selectedNode
          ? getNodeOutputs(selectedNode)
          : [];

        return (
          <div
            key={index}
            className="flex flex-col gap-1 rounded border border-gray-200 bg-gray-50 p-2"
          >
            {/* 아이템 헤더 */}
            {(showItemLabel || showRemoveButton) && (
              <div className="flex items-center justify-between mb-1">
                {showItemLabel ? (
                  <span className="text-[10px] uppercase font-bold text-gray-400">
                    Var #{index + 1}
                  </span>
                ) : (
                  <span />
                )}
                {showRemoveButton && (
                  <button
                    onClick={() => onRemove(index)}
                    className="text-xs text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-row gap-2 items-center">
              {/* (1) 노드 선택 드롭다운 */}
              <div className="flex-[3]">
                <select
                  className="w-full rounded border border-gray-300 p-1.5 text-xs truncate focus:border-blue-500 focus:outline-none"
                  value={selectedSourceNodeId}
                  onChange={(e) =>
                    handleSelectorUpdate(index, 0, e.target.value)
                  }
                >
                  <option value="">노드 선택</option>
                  {upstreamNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {(n.data as { title?: string })?.title || n.type}
                    </option>
                  ))}
                </select>
              </div>

              {/* (2) 출력값 선택 */}
              <div className="flex-[3] relative">
                <select
                  className={`w-full rounded border p-1.5 text-xs truncate focus:border-blue-500 focus:outline-none ${
                    !selectedSourceNodeId
                      ? 'bg-gray-100 text-gray-400 border-gray-200'
                      : 'border-gray-300 bg-white'
                  }`}
                  value={selectedVarKey}
                  onChange={(e) =>
                    handleSelectorUpdate(index, 1, e.target.value)
                  }
                  disabled={!selectedSourceNodeId}
                >
                  <option value="">
                    {!selectedSourceNodeId ? '출력 선택' : '출력값 선택'}
                  </option>
                  {availableOutputs.map((outKey: string) => (
                    <option key={outKey} value={outKey}>
                      {outKey}
                    </option>
                  ))}
                </select>
              </div>

              {!hideAlias && (
                <>
                  {/* 화살표 아이콘 */}
                  <div className="flex-none text-gray-400">
                    <ArrowRight className="w-3 h-3" />
                  </div>

                  {/* (3) 변수명 (별칭) 입력 */}
                  <div className="flex-[2]">
                    <input
                      type="text"
                      className="w-full rounded border border-gray-300 p-1.5 text-xs focus:border-blue-500 focus:outline-none"
                      placeholder={placeholder}
                      value={variable.name}
                      onChange={(e) => onUpdate(index, 'name', e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
