import React from 'react';

interface MaxLengthSettingProps {
  maxLength?: number;
  // 부모가 "값"만 받아갈 수 있도록 콜백을 받습니다.
  onChange: (value: number | undefined) => void;
  error?: string | null;
}

// 텍스트 길이 제한 설정
export const MaxLengthSetting = ({
  maxLength,
  onChange,
  error,
}: MaxLengthSettingProps) => {
  return (
    <div className="flex flex-col gap-1">
      <div className="mt-1 flex items-center gap-2">
        <span className="">최대 길이:</span>
        <input
          type="number"
          value={maxLength || ''}
          onChange={(e) =>
            onChange(e.target.value ? Number(e.target.value) : undefined)
          }
          className={`h-6 w-16 rounded border px-2 focus:outline-none focus:border-primary ${
            error ? 'border-red-500' : 'border-border'
          }`}
          placeholder="255"
        />
      </div>
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  );
};
