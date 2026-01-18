import React from 'react';
import { Plus, Trash2, ArrowRight } from 'lucide-react';
import { AppNode } from '../../../types/Nodes';
import { getNodeOutputs } from '../../../utils/getNodeOutputs';
import { RoundedSelect } from '../../ui/RoundedSelect';

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
  placeholder = '변수 이름',
  emptyMessage = '등록된 입력변수가 없습니다.',
  title = '입력변수',
  description = '이 섹션에서 입력변수를 등록하고, 이전 노드의 출력값과 연결하세요.',
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
      {/* 헤더: 타이틀 또는 설명 + 추가 버튼 */}
      {(title || description || showAddButton) && (
        <div className="flex flex-col gap-1">
          {/* 타이틀이 있는 경우: 타이틀 + 버튼 같은 줄 */}
          {title && (
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-gray-700">{title}</h4>
              {showAddButton && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd();
                  }}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                  title="입력변수 추가"
                >
                  <Plus className="w-4 h-4 text-gray-600" />
                </button>
              )}
            </div>
          )}
          {/* 설명 + (타이틀 없을 때만 버튼) */}
          {description && (
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-gray-500 flex-1">{description}</p>
              {!title && showAddButton && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd();
                  }}
                  className="p-1 hover:bg-gray-200 rounded transition-colors shrink-0"
                  title="입력변수 추가"
                >
                  <Plus className="w-4 h-4 text-gray-600" />
                </button>
              )}
            </div>
          )}
          {/* 타이틀과 설명 모두 없으면 버튼만 표시 */}
          {!title && !description && showAddButton && (
            <div className="flex justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd();
                }}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="입력변수 추가"
              >
                <Plus className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          )}
        </div>
      )}

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
            className="group flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
          >
            {/* 아이템 헤더 (옵션) */}
            {(showItemLabel || showRemoveButton) && (
              <div className="flex items-center justify-between">
                {showItemLabel && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500/50" />
                    <span className="text-[10px] font-bold tracking-wider text-gray-400">
                      입력변수 {index + 1}
                    </span>
                  </div>
                )}
                <div className="flex-1" />
                {showRemoveButton && (
                  <button
                    onClick={() => onRemove(index)}
                    className="flex h-5 w-5 items-center justify-center rounded text-gray-400 opacity-0 bg-transparent transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    title="입력변수 삭제"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-row items-center gap-2">
              {/* (1) Source Group: Node & Output */}
              <div className="flex flex-[4] flex-col gap-1 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <RoundedSelect
                    value={selectedSourceNodeId}
                    onChange={(val) =>
                      handleSelectorUpdate(index, 0, val as string)
                    }
                    options={[
                      { label: '노드 선택', value: '' },
                      ...upstreamNodes.map((n) => ({
                        label: (n.data as { title?: string })?.title || n.type,
                        value: n.id,
                      })),
                    ]}
                    placeholder="노드 선택"
                    className="py-1.5 text-xs"
                  />
                </div>

                <div className="relative flex-1">
                  <RoundedSelect
                    value={selectedVarKey}
                    onChange={(val) =>
                      handleSelectorUpdate(index, 1, val as string)
                    }
                    options={[
                      {
                        label: !selectedSourceNodeId
                          ? '출력 선택'
                          : '출력값 선택',
                        value: '',
                      },
                      ...availableOutputs.map((outKey: string) => ({
                        label: outKey,
                        value: outKey,
                      })),
                    ]}
                    disabled={!selectedSourceNodeId}
                    placeholder={
                      !selectedSourceNodeId ? '출력 선택' : '출력값 선택'
                    }
                    className="py-1.5 text-xs"
                  />
                </div>
              </div>

              {!hideAlias && (
                <>
                  {/* 화살표 아이콘 */}
                  <div className="flex flex-none items-center justify-center text-gray-400">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100">
                      <ArrowRight className="h-3 w-3 text-gray-500" />
                    </div>
                  </div>

                  {/* (3) 변수명 (별칭) 입력 */}
                  <div className="flex-[3]">
                    <input
                      type="text"
                      className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-blue-600 placeholder:font-normal placeholder:text-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
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
