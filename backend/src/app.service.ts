import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { MemorySaver } from '@langchain/langgraph';
import { createAgent } from 'langchain';
import { HumanMessage } from '@langchain/core/messages';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { ToolsService } from './tools/tools.service';
import { buildSystemPrompt } from './prompts/system-prompt';
import { VECTOR_STORE } from './vector-store/vector-store.module';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);
  private agent!: ReturnType<typeof createAgent>;
  private readonly memory = new MemorySaver();
  private myAccountId = 'unknown';
  private modelName = 'Unknown';
  private llm: any;
  private tools: DynamicStructuredTool[] = [];

  constructor(
    private toolsService: ToolsService,
    @Inject(VECTOR_STORE) private vectorStore: PGVectorStore,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing ReAct Agent...');
    await this.initializeAgent();
  }

  async initializeAgent() {
    const ragTool = new DynamicStructuredTool({
      name: 'search_internal_knowledge',
      description:
        'Search internal documentation about DevAssist Agent: capabilities, tools, architecture, model configuration, tips and best practices. Use this to answer questions about who you are, what you can do, and how to use your features.',
      schema: z.object({
        query: z
          .string()
          .describe(
            'Search query (e.g., "agent capabilities", "available tools", "model comparison")',
          ),
      }),
      func: async (args) => {
        try {
          const results = await this.vectorStore.similaritySearch(
            args.query,
            5,
          );
          if (results.length === 0) {
            return 'No relevant documentation found.';
          }
          return results
            .map(
              (r: { pageContent: string; metadata?: { source?: string } }) =>
                `[Source: ${r.metadata?.source || 'unknown'}]\n${r.pageContent}`,
            )
            .join('\n\n---\n\n');
        } catch (e) {
          this.logger.error(`RAG search failed: ${(e as Error).message}`);
          return 'Error searching knowledge base.';
        }
      },
    });

    const mcpTools = this.toolsService.getTools();
    this.tools = [ragTool, ...mcpTools];

    // Pre-fetch Jira identity to inject into prompt (improves reliability)
    const jiraTools = this.toolsService.getTools();
    const getMyself = jiraTools.find((t) => t.name === 'jira_get_myself');
    if (getMyself) {
      try {
        const identityJson = (await getMyself.func({})) as string;
        const identity = JSON.parse(identityJson) as { accountId: string };
        this.myAccountId = identity.accountId;
      } catch (e) {
        this.logger.error(
          `Failed to pre-fetch Jira identity: ${(e as Error).message}`,
        );
      }
    }

    this.logger.log(`Agent identity loaded: ${this.myAccountId}`);

    const useGemini = process.env.USE_GEMINI === 'true';
    const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1';

    if (useGemini) {
      const { ChatGoogleGenerativeAI } =
        await import('@langchain/google-genai');
      this.llm = new ChatGoogleGenerativeAI({
        model: 'gemini-2.0-flash-exp',
        apiKey: process.env.GOOGLE_API_KEY,
        temperature: 0,
      });
      this.modelName = 'Google Gemini 2.0 Flash';
      this.logger.log('Using Gemini 2.0 Flash Exp');
    } else {
      const { ChatOllama } = await import('@langchain/ollama');
      this.llm = new ChatOllama({
        baseUrl: 'http://localhost:11434',
        model: ollamaModel,
        temperature: 0,
      });
      this.modelName = `Ollama ${ollamaModel}`;
      this.logger.log(`Using Ollama with model: ${ollamaModel}`);
    }

    // Generate initial timestamp for agent creation
    const timestamp = this.generateTimestamp();

    this.agent = createAgent({
      model: this.llm as Parameters<typeof createAgent>[0]['model'],
      tools: this.tools,
      checkpointer: this.memory,
      systemPrompt: buildSystemPrompt(
        this.myAccountId,
        this.modelName,
        timestamp,
      ),
    });

    this.logger.log(
      `Agent compiled successfully with ${this.tools.length} tools!`,
    );
  }

  private generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}${month}${day}-${hours}${minutes}`;
  }

  getHello(): string {
    return 'DevAssist Agent API is running!';
  }

  async chat(message: string): Promise<string> {
    if (!this.agent) {
      return '⚠️ ERROR: Agent is not initialized. Please configure API keys.';
    }

    this.logger.log(`Received message: ${message}`);

    // Generate fresh timestamp for this request and update system prompt
    const timestamp = this.generateTimestamp();
    this.logger.debug(`Generated timestamp: ${timestamp}`);

    // Rebuild agent with fresh timestamp in system prompt
    this.agent = createAgent({
      model: this.llm as Parameters<typeof createAgent>[0]['model'],
      tools: this.tools,
      checkpointer: this.memory,
      systemPrompt: buildSystemPrompt(
        this.myAccountId,
        this.modelName,
        timestamp,
      ),
    });

    const config = {
      configurable: { thread_id: 'thread-1' },
      recursion_limit: 100,
    };
    const inputs = { messages: [new HumanMessage(message)] };

    const response = (await this.agent.invoke(inputs, config)) as {
      messages: Array<{
        content: string;
        name?: string;
        _getType?: () => string;
      }>;
    };

    // Count tool calls for verification
    let toolCallCount = 0;
    const toolCalls: string[] = [];

    // Log all messages from the agent's reasoning chain
    for (const msg of response.messages) {
      const type = msg._getType?.() || 'unknown';
      const preview =
        typeof msg.content === 'string'
          ? msg.content.slice(0, 200)
          : JSON.stringify(msg.content).slice(0, 200);
      this.logger.debug(`[${type}] ${msg.name || ''}: ${preview}`);

      if (type === 'tool' && msg.name) {
        toolCallCount++;
        toolCalls.push(msg.name);
      }
    }

    this.logger.warn(`🔧 Tool calls made: ${toolCallCount}`);
    if (toolCalls.length > 0) {
      this.logger.warn(`🔧 Tools called: ${toolCalls.join(', ')}`);
    } else {
      this.logger.error(
        '❌ WARNING: No tools were called! Agent may be hallucinating.',
      );
    }

    // Find the last tool message result (used as fallback if LLM paraphrases instead of quoting)
    let lastToolResult: string | undefined;
    for (const msg of response.messages) {
      const type = msg._getType?.() || 'unknown';
      if (type === 'tool' && typeof msg.content === 'string') {
        lastToolResult = msg.content;
      }
    }

    const finalMessage = response.messages[response.messages.length - 1];
    const finalContent =
      typeof finalMessage.content === 'string'
        ? finalMessage.content
        : JSON.stringify(finalMessage.content, null, 2);

    // Llama tends to paraphrase tool results instead of quoting them.
    // If the final response contains no URL but the tool returned one, use the tool result directly.
    const resolvedContent =
      lastToolResult &&
      lastToolResult.includes('http') &&
      !finalContent.includes('http')
        ? lastToolResult
        : finalContent;

    this.logger.log(`Agent response: ${resolvedContent.slice(0, 300)}`);

    return resolvedContent;
  }
}
