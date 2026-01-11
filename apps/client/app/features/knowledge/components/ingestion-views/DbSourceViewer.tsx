import React from 'react';
import DBSchemaSelector from '@/app/features/knowledge/components/document-settings/DBSchemaSelector';
import { JoinConfig } from '@/app/features/knowledge/api/knowledgeApi';

interface DbSourceViewerProps {
  connectionId?: string;
  selectedDbItems: Record<string, string[]>;
  onChange: (items: Record<string, string[]>) => void;
  sensitiveColumns?: Record<string, string[]>;
  onSensitiveColumnsChange?: (items: Record<string, string[]>) => void;
  aliases?: Record<string, Record<string, string>>;
  onAliasesChange?: (items: Record<string, Record<string, string>>) => void;
  onEditConnection?: () => void;
  isEditingLoading?: boolean;
  enableAutoChunking?: boolean;
  onEnableAutoChunkingChange?: (enabled: boolean) => void;
  onJoinConfigChange?: (config: JoinConfig | null) => void;
}

export default function DbSourceViewer({
  connectionId,
  selectedDbItems,
  onChange,
  sensitiveColumns,
  onSensitiveColumnsChange,
  aliases,
  onAliasesChange,
  onEditConnection,
  isEditingLoading,
  enableAutoChunking,
  onEnableAutoChunkingChange,
  onJoinConfigChange,
}: DbSourceViewerProps) {
  if (!connectionId) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-400">
        <p>DB 연결 정보가 없습니다.</p>
      </div>
    );
  }

  return (
    <DBSchemaSelector
      connectionId={connectionId}
      value={selectedDbItems}
      onChange={onChange}
      sensitiveColumns={sensitiveColumns}
      onSensitiveColumnsChange={onSensitiveColumnsChange}
      aliases={aliases}
      onAliasesChange={onAliasesChange}
      onEditConnection={onEditConnection}
      isEditingLoading={isEditingLoading}
      enableAutoChunking={enableAutoChunking}
      onEnableAutoChunkingChange={onEnableAutoChunkingChange}
      onJoinConfigChange={onJoinConfigChange}
    />
  );
}
