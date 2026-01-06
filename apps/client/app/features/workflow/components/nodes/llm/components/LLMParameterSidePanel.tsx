import { X, HelpCircle, Plus, Trash2 } from 'lucide-react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { LLMNodeData } from '../../../../types/Nodes';

interface LLMParameterSidePanelProps {
  nodeId: string;
  data: LLMNodeData;
  onClose: () => void;
}

// 파라미터 설명 (한국어)
const PARAM_DESCRIPTIONS = {
  temperature:
    '값이 낮을수록 일관된 답변, 높을수록 창의적인 답변을 생성합니다.',
  top_p:
    '상위 확률 범위 내 단어에서만 선택합니다. Temperature와 함께 조절하세요.',
  max_tokens:
    '응답의 최대 길이를 제한합니다. 비용과 응답 시간에 영향을 줍니다.',
  presence_penalty:
    '새로운 주제로 전환하도록 유도합니다. 값이 높을수록 효과가 강합니다.',
  frequency_penalty:
    '같은 단어 반복을 억제합니다. 값이 높을수록 효과가 강합니다.',
  stop: '지정된 문자열이 나타나면 응답 생성을 즉시 중단합니다. (예: ###, END)',
};

export function LLMParameterSidePanel({
  nodeId,
  data,
  onClose,
}: LLMParameterSidePanelProps) {
  const { updateNodeData } = useWorkflowStore();

  // Extract current parameter values (with defaults)
  const params = data.parameters || {};
  const temperature = (params.temperature as number) ?? 0.7;
  const topP = (params.top_p as number) ?? 1.0;
  const maxTokens = (params.max_tokens as number) ?? 4096;
  const presencePenalty = (params.presence_penalty as number) ?? 0.0;
  const frequencyPenalty = (params.frequency_penalty as number) ?? 0.0;
  const stopSequences = (params.stop as string[]) ?? [];

  // Recommended Ranges
  const recommendTemp = [0.5, 1.0];
  const recommendTopP = [0.8, 1.0];
  const recommendMaxTokens = [2048, 4096];
  const recommendPresence = [-0.5, 0.5];
  const recommendFrequency = [-0.5, 0.5];

  // Handler to update a specific parameter
  const handleParamChange = (key: string, value: number) => {
    updateNodeData(nodeId, {
      parameters: {
        ...params,
        [key]: value,
      },
    });
  };

  // Handler for stop sequences
  const handleAddStopSequence = () => {
    if (stopSequences.length >= 4) return; // Max 4
    updateNodeData(nodeId, {
      parameters: {
        ...params,
        stop: [...stopSequences, ''],
      },
    });
  };

  const handleRemoveStopSequence = (index: number) => {
    const newSeqs = stopSequences.filter((_, i) => i !== index);
    updateNodeData(nodeId, {
      parameters: {
        ...params,
        stop: newSeqs.length > 0 ? newSeqs : undefined,
      },
    });
  };

  const handleUpdateStopSequence = (index: number, value: string) => {
    const newSeqs = [...stopSequences];
    newSeqs[index] = value;
    updateNodeData(nodeId, {
      parameters: {
        ...params,
        stop: newSeqs,
      },
    });
  };

  // Helper for rendering slider track
  const renderSlider = (
    paramKey: string,
    value: number,
    min: number,
    max: number,
    step: number,
    recommend: number[],
  ) => {
    const totalRange = max - min;
    const startPercent = ((recommend[0] - min) / totalRange) * 100;
    const endPercent = ((recommend[1] - min) / totalRange) * 100;
    const currentPercent = ((value - min) / totalRange) * 100;

    return (
      <div className="relative h-7">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2.5 rounded-full bg-gray-100 ring-1 ring-gray-200 overflow-hidden pointer-events-none">
          {/* Recommended Range */}
          <div
            className="absolute inset-y-0 bg-blue-200"
            style={{
              left: `${startPercent}%`,
              width: `${endPercent - startPercent}%`,
            }}
          />
          {/* Current Value Indicator Line */}
          <div
            className="absolute inset-y-0 w-0.5 bg-blue-600"
            style={{ left: `${currentPercent}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => handleParamChange(paramKey, Number(e.target.value))}
          className="absolute inset-0 w-full h-6 bg-transparent accent-blue-600 appearance-none cursor-pointer
                [&::-webkit-slider-runnable-track]:bg-transparent
                [&::-moz-range-track]:bg-transparent
                [&::-ms-track]:bg-transparent"
          style={{ background: 'transparent' }}
        />
      </div>
    );
  };

  // Helper for parameter description tooltip
  const DescTooltip = ({ text }: { text: string }) => (
    <div className="group relative inline-block ml-1">
      <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
      <div className="absolute z-50 hidden group-hover:block w-48 p-2 text-[11px] text-gray-600 bg-white border border-gray-200 rounded-lg shadow-lg left-0 top-5">
        {text}
        <div className="absolute -top-1 left-2 w-2 h-2 bg-white border-l border-t border-gray-200 rotate-45" />
      </div>
    </div>
  );

  return (
    <div
      className="absolute right-[400px] top-20 bottom-0 w-[320px] bg-white shadow-xl z-40 flex flex-col border-l border-gray-200"
      style={{
        transition: 'transform 0.3s ease-in-out',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">LLM 파라미터</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            모델 응답 특성을 조절합니다
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded text-gray-500 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Temperature */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <label className="text-xs font-medium text-gray-700">
                Temperature
              </label>
              <DescTooltip text={PARAM_DESCRIPTIONS.temperature} />
            </div>
            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
              {temperature.toFixed(1)}
            </span>
          </div>
          {renderSlider('temperature', temperature, 0, 2, 0.1, recommendTemp)}
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span>일관적</span>
            <span className="text-blue-500 font-medium">
              권장: {recommendTemp[0]}~{recommendTemp[1]}
            </span>
            <span>창의적</span>
          </div>
        </div>

        {/* Top P */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <label className="text-xs font-medium text-gray-700">Top P</label>
              <DescTooltip text={PARAM_DESCRIPTIONS.top_p} />
            </div>
            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
              {topP.toFixed(2)}
            </span>
          </div>
          {renderSlider('top_p', topP, 0, 1, 0.05, recommendTopP)}
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span className="whitespace-nowrap">집중</span>
            <span className="text-blue-500 font-medium">
              권장: {recommendTopP[0]}~{recommendTopP[1]}
            </span>
            <span className="whitespace-nowrap">다양</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div className="space-y-2">
          <div className="flex justify-between items.center">
            <div className="flex items-center">
              <label className="text-xs font-medium text-gray-700">
                Max Tokens
              </label>
              <DescTooltip text={PARAM_DESCRIPTIONS.max_tokens} />
            </div>
            <input
              type="number"
              className="w-20 text-xs font-mono text-right border border-gray-300 rounded px-1.5 py-0.5 focus:border-blue-500 focus:outline-none"
              value={maxTokens}
              onChange={(e) =>
                handleParamChange('max_tokens', Number(e.target.value))
              }
            />
          </div>
          {renderSlider(
            'max_tokens',
            maxTokens,
            1,
            8192,
            1,
            recommendMaxTokens,
          )}
          <div className="flex justify-center text-[10px] text-blue-500 font-medium">
            권장: {recommendMaxTokens[0]} ~ {recommendMaxTokens[1]}
          </div>
        </div>

        {/* Presence Penalty */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <label className="text-xs font-medium text-gray-700">
                Presence Penalty
              </label>
              <DescTooltip text={PARAM_DESCRIPTIONS.presence_penalty} />
            </div>
            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
              {presencePenalty.toFixed(1)}
            </span>
          </div>
          {renderSlider(
            'presence_penalty',
            presencePenalty,
            -2,
            2,
            0.1,
            recommendPresence,
          )}
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span className="whitespace-nowrap">반복 장려</span>
            <span className="text-blue-500 font-medium">
              권장: {recommendPresence[0]} ~ {recommendPresence[1]}
            </span>
            <span className="whitespace-nowrap">새 주제</span>
          </div>
        </div>

        {/* Frequency Penalty */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <label className="text-xs font-medium text-gray-700">
                Frequency Penalty
              </label>
              <DescTooltip text={PARAM_DESCRIPTIONS.frequency_penalty} />
            </div>
            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
              {frequencyPenalty.toFixed(1)}
            </span>
          </div>
          {renderSlider(
            'frequency_penalty',
            frequencyPenalty,
            -2,
            2,
            0.1,
            recommendFrequency,
          )}
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span className="whitespace-nowrap">반복 장려</span>
            <span className="text-blue-500 font-medium">
              권장: {recommendFrequency[0]} ~ {recommendFrequency[1]}
            </span>
            <span className="whitespace-nowrap">반복 금지</span>
          </div>
        </div>

        {/* Stop Sequences */}
        <div className="space-y-2 border-t border-gray-100 pt-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <label className="text-xs font-medium text-gray-700">
                Stop Sequences
              </label>
              <DescTooltip text={PARAM_DESCRIPTIONS.stop} />
            </div>
            <button
              onClick={handleAddStopSequence}
              disabled={stopSequences.length >= 4}
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded transition-colors ${
                stopSequences.length >= 4
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
            >
              <Plus className="w-3 h-3" />
              추가
            </button>
          </div>

          {stopSequences.length === 0 ? (
            <p className="text-[10px] text-gray-400 text-center py-2 border border-dashed border-gray-200 rounded">
              설정된 종료 문자열이 없습니다
            </p>
          ) : (
            <div className="space-y-1.5">
              {stopSequences.map((seq, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={seq}
                    onChange={(e) =>
                      handleUpdateStopSequence(index, e.target.value)
                    }
                    placeholder={`종료 문자열 ${index + 1}`}
                    className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={() => handleRemoveStopSequence(index)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-gray-400">최대 4개까지 설정 가능</p>
        </div>
      </div>
    </div>
  );
}
