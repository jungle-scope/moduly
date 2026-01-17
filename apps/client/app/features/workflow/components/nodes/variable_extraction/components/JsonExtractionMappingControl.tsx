import React from 'react';
import { Plus, Trash2, ArrowRight } from 'lucide-react';

export interface ExtractionMapping {
  name: string;
  json_path: string;
}

interface JsonExtractionMappingControlProps {
  mappings: ExtractionMapping[];
  onUpdate: (
    index: number,
    field: 'name' | 'json_path',
    value: string,
  ) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  placeholder?: string;
  emptyMessage?: string;
  title?: string;
  description?: string;
  showAddButton?: boolean;
}

export const JsonExtractionMappingControl: React.FC<
  JsonExtractionMappingControlProps
> = ({
  mappings,
  onUpdate,
  onAdd,
  onRemove,
  placeholder = '변수명',
  emptyMessage = '추출할 변수가 없습니다.',
  title = '추출 변수',
  description = 'JSON 경로와 매핑할 변수명을 입력하세요.',
  showAddButton = true,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          {title && (
            <h4 className="text-xs font-semibold text-gray-700">{title}</h4>
          )}
          {description && (
            <p className="text-xs text-gray-500">{description}</p>
          )}
        </div>

        {showAddButton && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="변수 추가"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      {mappings.length === 0 && (
        <div className="text-xs text-gray-400 p-2 text-center border border-dashed border-gray-200 rounded">
          {emptyMessage}
        </div>
      )}

      {mappings.map((mapping, index) => (
        <div
          key={index}
          className="group flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500/50" />
                <span className="text-[10px] font-bold tracking-wider text-gray-400">
                  매핑 {index + 1}
                </span>
              </div>
            <button
              onClick={() => onRemove(index)}
              className="flex h-5 w-5 items-center justify-center rounded text-gray-400 opacity-0 bg-transparent transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              title="삭제"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>

          <div className="flex flex-row items-center gap-2">
            {/* JSON Path Input */}
             <div className="flex-[4]">
              <input
                type="text"
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 placeholder:text-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                placeholder="추출할 키"
                value={mapping.json_path}
                onChange={(e) => onUpdate(index, 'json_path', e.target.value)}
              />
            </div>

            {/* Arrow Icon */}
            <div className="flex flex-none items-center justify-center text-gray-400">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100">
                <ArrowRight className="h-3 w-3 text-gray-500" />
              </div>
            </div>

            {/* Variable Name Input */}
            <div className="flex-[3]">
              <input
                type="text"
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-blue-600 placeholder:font-normal placeholder:text-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                placeholder="사용할 변수명"
                value={mapping.name}
                onChange={(e) => onUpdate(index, 'name', e.target.value)}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
