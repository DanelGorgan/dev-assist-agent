import { DynamicStructuredTool } from '@langchain/core/tools';

export interface ToolProvider {
  getTools(): DynamicStructuredTool[];
}
