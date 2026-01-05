import React from 'react';
import DBSchemaSelector from '@/app/features/knowledge/components/document-settings/DBSchemaSelector';

interface DbSourceViewerProps {
  connectionId?: string;
  selectedDbItems: Record<string, string[]>;
  onChange: (items: Record<string, string[]>) => void;
}

export default function DbSourceViewer({
  connectionId,
  selectedDbItems,
  onChange,
}: DbSourceViewerProps) {
  return (
    <DBSchemaSelector
      connectionId={connectionId}
      value={selectedDbItems}
      onChange={onChange}
    />
  );
}
