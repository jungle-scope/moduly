import React, { useMemo, useState, useRef } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { TemplateNodeData, TemplateVariable } from '../../../../types/Nodes';

import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { ReferencedVariablesControl } from '../../ui/ReferencedVariablesControl';

interface TemplateNodePanelProps {
  nodeId: string;
  data: TemplateNodeData;
}

/**
 * [참고] 캐럿 좌표 가져오기
 * Textarea의 커서 위치(top, left)를 계산하기 위해 Mirror Div를 사용합니다.
 */
const getCaretCoordinates = (
  element: HTMLTextAreaElement,
  position: number,
) => {
  const div = document.createElement('div');
  const style = window.getComputedStyle(element);

  // 스타일 복사
  Array.from(style).forEach((prop) => {
    div.style.setProperty(prop, style.getPropertyValue(prop));
  });

  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.top = '0';
  div.style.left = '0';

  // Textarea의 내용을 복사하되, 커서 위치까지만 span으로 감싸서 위치 계산
  const textContent = element.value.substring(0, position);
  const span = document.createElement('span');
  span.textContent = textContent;
  span.id = 'caret-span';

  div.textContent = textContent; // span을 쓰지 않고 textContent로 넣은 뒤 마지막에 span을 추가하는 방식 등 여러 방법이 있지만
  // 가장 간단하게는:
  div.innerHTML =
    textContent.replace(/\n/g, '<br>') + '<span id="caret-marker">|</span>';

  document.body.appendChild(div);

  const marker = div.querySelector('#caret-marker');
  const coordinates = {
    top: marker
      ? marker.getBoundingClientRect().top - div.getBoundingClientRect().top
      : 0,
    left: marker
      ? marker.getBoundingClientRect().left - div.getBoundingClientRect().left
      : 0,
    height: parseInt(style.lineHeight) || 20, // 기본 줄 높이
  };

  document.body.removeChild(div);
  return coordinates;
};

export const TemplateNodePanel: React.FC<TemplateNodePanelProps> = ({
  nodeId,
  data,
}) => {
  const { nodes, edges, updateNodeData } = useWorkflowStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });

  // 1. 상위 노드
  const upstreamNodes = useMemo(() => {
    return getUpstreamNodes(nodeId, nodes, edges);
  }, [nodeId, nodes, edges]);

  // 템플릿 변경 핸들러
  const handleTemplateChange = (value: string) => {
    updateNodeData(nodeId, { template: value });
  };

  // 변수 추가 핸들러
  const handleAddVariable = () => {
    const newVar: TemplateVariable = {
      name: '',
      value_selector: [],
    };
    updateNodeData(nodeId, {
      variables: [...(data.variables || []), newVar],
    });
  };

  // 변수 삭제 핸들러
  const handleRemoveVariable = (index: number) => {
    const newVars = [...(data.variables || [])];
    newVars.splice(index, 1);
    updateNodeData(nodeId, { variables: newVars });
  };

  // 변수 업데이트 핸들러
  const handleUpdateVariable = (
    index: number,
    field: keyof TemplateVariable,
    value: any,
  ) => {
    const newVars = [...(data.variables || [])];
    newVars[index] = { ...newVars[index], [field]: value };
    updateNodeData(nodeId, { variables: newVars });
  };

  // 선택자 업데이트 핸들러

  // [자동완성] '{{' 트리거 확인
  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    const value = target.value;
    const selectionEnd = target.selectionEnd;

    // 커서 앞의 2글자가 {{ 인지 확인
    if (value.substring(selectionEnd - 2, selectionEnd) === '{{') {
      // 이미 {{ }} 닫혀있는지 체크는 생략하고 단순 트리거 구현
      // 위치 계산
      const coords = getCaretCoordinates(target, selectionEnd);
      setSuggestionPos({
        top: target.offsetTop + coords.top + coords.height, // Line height 아래
        left: target.offsetLeft + coords.left,
      });
      setShowSuggestions(true);
    } else {
      // 입력 중이 아니면 숨김
      if (showSuggestions && !value.substring(0, selectionEnd).endsWith('{{')) {
        const lastOpen = value.lastIndexOf('{{', selectionEnd);
        const lastClose = value.lastIndexOf('}}', selectionEnd);
        if (lastOpen === -1 || lastClose > lastOpen) {
          setShowSuggestions(false);
        }
      }
    }
  };

  // [자동완성] 변수 삽입
  const insertVariable = (varName: string) => {
    const currentValue = data.template || '';
    const textarea = textareaRef.current;
    if (!textarea) return;

    const selectionEnd = textarea.selectionEnd;
    const lastOpen = currentValue.lastIndexOf('{{', selectionEnd);

    if (lastOpen !== -1) {
      const prefix = currentValue.substring(0, lastOpen);
      const suffix = currentValue.substring(selectionEnd);
      const newValue = `${prefix}{{ ${varName} }}${suffix}`;
      handleTemplateChange(newValue);
      setShowSuggestions(false);

      setTimeout(() => {
        const newCursorPos = prefix.length + varName.length + 5; // {{_var_}} 길이
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  // [유효성 검사] 등록되지 않은 변수 확인
  const validationErrors = useMemo(() => {
    const template = data.template || '';
    const registeredNames = new Set(
      (data.variables || []).map((v) => v.name?.trim()).filter(Boolean),
    );
    const errors: string[] = [];

    const regex = /{{\s*([^}]+?)\s*}}/g;
    let match;
    while ((match = regex.exec(template)) !== null) {
      const varName = match[1].trim();
      if (varName && !registeredNames.has(varName)) {
        errors.push(varName);
      }
    }
    return Array.from(new Set(errors)); // 중복 제거
  }, [data.template, data.variables]);

  return (
    <div className="flex flex-col gap-2">
      {/* 1. 변수 매핑 */}
      <CollapsibleSection title="Variables">
        <ReferencedVariablesControl
          variables={data.variables || []}
          upstreamNodes={upstreamNodes}
          onUpdate={handleUpdateVariable}
          onAdd={handleAddVariable}
          onRemove={handleRemoveVariable}
          title=""
          description="템플릿에서 사용할 변수를 정의하고, 이전 노드의 출력값과 연결하세요."
        />
      </CollapsibleSection>

      {/* 2. 템플릿 에디터 */}
      <CollapsibleSection title="Template">
        <div className="flex flex-col gap-2 relative">
          <p className="text-xs text-gray-500">
            Jinja2 문법을 사용하여 템플릿을 작성하세요. 설정한 변수는{' '}
            <code className="bg-gray-100 px-1 rounded text-gray-700">
              {`{{ variable_name }}`}
            </code>{' '}
            형태로 삽입됩니다.
          </p>

          <div className="relative w-full">
            <textarea
              ref={textareaRef}
              className="w-full min-h-[150px] rounded border border-gray-300 p-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
              value={data.template || ''}
              onChange={(e) => handleTemplateChange(e.target.value)}
              onKeyUp={handleKeyUp}
              onClick={() => setShowSuggestions(false)}
              placeholder="예: 안녕하세요, {{ user_name }}님!"
            />

            {/* [자동완성] 드롭다운 오버레이 */}
            {showSuggestions && (
              <div
                className="absolute bg-white border border-gray-200 shadow-lg rounded z-50 w-48 max-h-40 overflow-y-auto"
                style={{
                  top: suggestionPos.top,
                  left: suggestionPos.left,
                }}
              >
                {(data.variables || []).length > 0 ? (
                  (data.variables || []).map((v, i) => (
                    <div
                      key={i}
                      className="px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer"
                      onClick={() => insertVariable(v.name)}
                    >
                      {v.name || '(unnamed)'}
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-gray-400 italic">
                    위에서 변수를 먼저 등록해주세요.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* [유효성 검사] 경고 블록 */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-xs">
              <p className="font-semibold mb-1">
                ⚠️ 등록되지 않은 변수가 감지되었습니다:
              </p>
              <ul className="list-disc list-inside">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
};
