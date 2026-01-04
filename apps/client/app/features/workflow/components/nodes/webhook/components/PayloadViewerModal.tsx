import { X } from 'lucide-react';

interface PayloadViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: Record<string, unknown> | null;
}

export function PayloadViewerModal({
  isOpen,
  onClose,
  payload,
}: PayloadViewerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-3xl max-h-[80vh] bg-white rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Captured Webhook Payload</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* JSON Content */}
        <div className="flex-1 overflow-auto p-6">
          <pre className="text-sm bg-gray-50 p-4 rounded border overflow-x-auto">
            <code>{JSON.stringify(payload, null, 2)}</code>
          </pre>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-500 rounded hover:bg-purple-600 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
