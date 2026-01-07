import React, { cloneElement, isValidElement } from 'react';
import {
  getNodesByCategory,
  getNodeDefinition,
} from '../../config/nodeRegistry';

// 카테고리 표시 이름 매핑
const categoryDisplayNames: Record<string, string> = {
  trigger: 'Trigger',
  llm: 'LLM',
  plugin: 'Plugin',
  workflow: '서브 모듈',
  logic: 'Logic',
  database: 'Database',
  data: 'Data',
};

interface NodeSelectorProps {
  onSelect: (nodeDefId: string) => void;
}

export function NodeSelector({ onSelect }: NodeSelectorProps) {
  return (
    <div className="space-y-3">
      {Array.from(getNodesByCategory().entries()).map(
        ([categoryKey, categoryNodes]) => (
          <div key={categoryKey}>
            <div className="text-xs font-semibold text-gray-500 mb-2">
              {categoryDisplayNames[categoryKey] || categoryKey}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {categoryNodes.map((nodeDef) => (
                <button
                  key={nodeDef.id}
                  onClick={() => onSelect(nodeDef.id)}
                  disabled={!nodeDef.implemented}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded transition-colors text-left ${
                    nodeDef.implemented
                      ? 'text-gray-700 hover:bg-gray-50 cursor-pointer'
                      : 'text-gray-400 cursor-not-allowed opacity-50'
                  }`}
                  title={
                    nodeDef.implemented
                      ? nodeDef.description
                      : '아직 구현되지 않았습니다'
                  }
                >
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center text-xs shrink-0"
                    style={{ backgroundColor: nodeDef.color }}
                  >
                    {nodeDef.type === 'workflowNode' &&
                    isValidElement(nodeDef.icon)
                      ? cloneElement(
                          nodeDef.icon as React.ReactElement,
                          {
                            className: 'w-3.5 h-3.5 text-white',
                          } as any,
                        )
                      : nodeDef.icon}
                  </div>
                  <span className="truncate">{nodeDef.name}</span>
                </button>
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  );
}
