import { StartNode } from './start/components/StartNode';
import { LLMNode } from './llm/components/LLMNode';
// import EndNode from './EndNode';

// NOTE: [LLM] llmNode 타입을 등록하여 ReactFlow에서 렌더링 가능하게 함
export const nodeTypes = {
  startNode: StartNode,
  llmNode: LLMNode,
  // endNode: EndNode,
};
