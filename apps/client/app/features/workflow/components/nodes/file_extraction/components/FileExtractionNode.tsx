import React from 'react';
import { FileExtractionNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';

interface FileExtractionNodeProps {
  id: string;
  data: FileExtractionNodeData;
  selected?: boolean;
}

export const FileExtractionNode: React.FC<FileExtractionNodeProps> = ({
  data,
  selected,
}) => {
  return (
    <BaseNode data={data} selected={selected}>
      <div className="flex flex-col gap-2 p-1">
        <div className="text-xs text-gray-500">
          <p>PDF 파일에서 텍스트 추출</p>
          <div className="mt-2 rounded bg-gray-50 p-2 text-[10px] text-gray-400">
            {data.file_path_variable?.[0]
              ? `파일: ${data.file_path_variable[0]}`
              : '파일 경로를 선택해주세요'}
          </div>
        </div>
      </div>
    </BaseNode>
  );
};
