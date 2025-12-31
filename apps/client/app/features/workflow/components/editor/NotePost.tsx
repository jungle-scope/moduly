import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { type NodeProps, type Node, NodeResizer } from '@xyflow/react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';

interface NotePostData extends Record<string, unknown> {
  content?: string;
}

function NotePost({ id, data, selected }: NodeProps<Node<NotePostData>>) {
  const { updateNodeData } = useWorkflowStore();
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(data.content || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(content.length, content.length);
    }
  }, [isEditing, content.length]);

  const handleDoubleClick = useCallback(() => {
    if (!isEditing) {
      setIsEditing(true);
    }
  }, [isEditing]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setContent(newContent);
      updateNodeData(id, { content: newContent });
    },
    [id, updateNodeData],
  );

  const handleBlur = useCallback(() => {
    setIsEditing(false);
  }, []);

  return (
    <>
      <NodeResizer
        color="#fbbf24"
        isVisible={selected}
        minWidth={150}
        minHeight={80}
      />
      <div
        className="bg-amber-50 border-2 border-yellow-400 rounded-lg shadow-xl p-3 w-full h-full cursor-text"
        onDoubleClick={handleDoubleClick}
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full h-full bg-transparent border-none outline-none resize-none text-sm text-gray-700 placeholder-gray-400"
            placeholder="메모 입력..."
          />
        ) : (
          <div className="text-sm text-gray-700 whitespace-pre-wrap w-full h-full overflow-auto">
            {content || (
              <span className="text-gray-400 italic">더블클릭하여 입력...</span>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default memo(NotePost);
