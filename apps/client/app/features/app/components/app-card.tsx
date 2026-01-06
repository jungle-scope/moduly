'use client';

import { SquarePen } from 'lucide-react';
import { type App } from '../api/appApi';

interface AppCardProps {
  app: App;
  onClick: (app: App) => void;
  onEdit: (e: React.MouseEvent, app: App) => void;
}

export default function AppCard({ app, onClick, onEdit }: AppCardProps) {
  return (
    <div
      onClick={() => onClick(app)}
      className="group cursor-pointer rounded-xl border border-gray-200/60 bg-white py-8 px-6 shadow-sm transition-all hover:shadow-md hover:border-gray-300"
    >
      {/* 카드 헤더 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            {app.name}
          </h3>
          <p className="text-xs text-gray-500">{app.description}</p>
        </div>
        {/* 아이콘 */}
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0 ml-3"
          style={{ backgroundColor: app.icon?.background_color }}
        >
          {app.icon?.content}
        </div>
      </div>

      {/* 푸터 */}
      <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-[8px] text-blue-600 font-medium">U</span>
          </div>
          <span>
            • Edited{' '}
            {new Date(app.updated_at).toLocaleDateString('en-US', {
              month: '2-digit',
              day: '2-digit',
              year: '2-digit',
            })}
          </span>
        </div>
        <button
          onClick={(e) => onEdit(e, app)}
          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
          title="앱 정보 수정"
        >
          <SquarePen className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
