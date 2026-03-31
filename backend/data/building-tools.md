# Building Custom Tools for the DevOps AI Agent

## Overview

The agent is built on **LangChain** and uses the **Model Context Protocol (MCP)** to interface with external services. You can extend the agent by adding new tools in any of the three provider categories.

## Tool Provider Architecture

### Existing Providers

1. **JiraToolsProvider** (`backend/src/tools/jira-tools.provider.ts`)
   - Connects to Jira REST API
   - Provides task management tools (8 tools)

2. **GithubToolsProvider** (`backend/src/tools/github-tools.provider.ts`)
   - Connects to GitHub MCP server
   - Provides repository and PR tools (10 tools)

3. **FilesystemToolsProvider** (`backend/src/tools/filesystem-tools.provider.ts`)
   - Direct filesystem operations within workspace boundaries
   - No external MCP server needed (9 tools)

4. **TestToolsProvider** (`backend/src/tools/test-tools.provider.ts`)
   - Runs whitelisted test commands (yarn test, npm test, pnpm test)
   - Restricted to configured workspace directory (1 tool)

All providers implement the `ToolProvider` interface:

```typescript
interface ToolProvider {
  getTools(): Promise<DynamicStructuredTool[]>;
}
```

## Creating a New Tool

### Step 1: Choose Your Provider

Add tools to an existing provider or create a new one.

#### Example: Adding to TestToolsProvider

```typescript
// backend/src/mcp/test-tools.provider.ts

new DynamicStructuredTool({
  name: 'run_test_command',
  description: 'Run test commands in a specific directory',
  schema: z.object({
    command: z.string().describe('Test command to run'),
    workingDir: z.string().optional().describe('Working directory'),
  }),
  func: async (args) => {
    // Validate input
    const allowedCommands = ['yarn test', 'npm test'];
    if (!allowedCommands.includes(args.command)) {
      return 'Error: Command not allowed';
    }

    // Execute safely
    try {
      const output = execSync(args.command, {
        cwd: path.join(workspaceDir, args.workingDir || ''),
        encoding: 'utf-8',
      });
      return `Success: ${output}`;
    } catch (e) {
      return `Error: ${(e as Error).message}`;
    }
  },
}),
```

### Step 2: Define Schema with Zod

Use Zod for type-safe parameter validation:

```typescript
schema: z.object({
  filePath: z.string().describe('Path to the file'),
  content: z.string().describe('File content'),
  overwrite: z.boolean().optional().describe('Overwrite if exists'),
}),
```

**Important**: Always add `.describe()` - the LLM uses these descriptions!

### Step 3: Implement the Function

```typescript
func: async (args) => {
  // 1. Validate input
  if (!args.filePath) {
    return 'Error: filePath is required';
  }

  // 2. Security checks
  const fullPath = path.join(workspaceDir, args.filePath);
  if (!fullPath.startsWith(workspaceDir)) {
    return 'Error: Access denied. Path is outside workspace.';
  }

  // 3. Execute operation
  try {
    fs.writeFileSync(fullPath, args.content, 'utf-8');
    return `Successfully wrote file: ${args.filePath}`;
  } catch (e: unknown) {
    return `Error writing file: ${(e as Error).message}`;
  }
},
```

### Step 4: Update System Prompt

Add your tool to `backend/src/prompts/system-prompt.ts`:

```typescript
FILES:
- write_local_file(filePath, content): Write/overwrite file
- run_test_command(command, workingDir): Run tests  // ← Add here

=== COMMANDS ===

"Run tests" / "Test the changes"
→ CALL run_test_command(command: "yarn test", workingDir: "backend")
→ RESPOND with test results
```

## Best Practices

### 1. Always Return Strings

```typescript
// ✅ Good
return 'Success: File written';
return `Error: ${error.message}`;

// ❌ Bad
return { success: true }; // LLM expects string
throw new Error('Failed'); // Uncaught exception
```

### 2. Security First

```typescript
// Always validate paths
if (!fullPath.startsWith(workspaceDir)) {
  return 'Error: Access denied';
}

// Whitelist commands
const allowedCommands = ['yarn test', 'npm test'];
if (!allowedCommands.includes(command)) {
  return 'Error: Command not allowed';
}

// Sanitize input
const sanitized = command.replace(/[;&|]/g, '');
```

### 3. Descriptive Error Messages

```typescript
// ✅ Good
return 'Error: File not found at src/app.ts';
return 'Error: Branch "main" already exists';

// ❌ Bad
return 'Error';
return 'Failed';
```

### 4. Clear Success Messages

```typescript
// ✅ Good
return 'Successfully moved app.ts to test/app.ts';
return 'Tests passed: 10 passed, 0 failed';

// ❌ Bad
return 'OK';
return 'Done';
```

## Creating a New Provider

### Example: SlackToolsProvider

```typescript
// backend/src/mcp/slack-tools.provider.ts

import { Injectable } from '@nestjs/common';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ToolProvider } from './tool-provider.interface';

@Injectable()
export class SlackToolsProvider implements ToolProvider {
  async getTools(): Promise<DynamicStructuredTool[]> {
    return [
      new DynamicStructuredTool({
        name: 'slack_send_message',
        description: 'Send a message to a Slack channel',
        schema: z.object({
          channel: z.string().describe('Channel name (e.g., #dev-team)'),
          message: z.string().describe('Message to send'),
        }),
        func: async (args) => {
          try {
            // Call Slack API
            const response = await fetch(
              'https://slack.com/api/chat.postMessage',
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${process.env.SLACK_TOKEN}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  channel: args.channel,
                  text: args.message,
                }),
              },
            );

            if (!response.ok) {
              return `Error: Failed to send message`;
            }

            return `Message sent to ${args.channel}`;
          } catch (e) {
            return `Error: ${(e as Error).message}`;
          }
        },
      }),
    ];
  }
}
```

### Register the Provider

```typescript
// backend/src/tools/tools.module.ts

@Module({
  providers: [
    ToolsService,
    JiraToolsProvider,
    GithubToolsProvider,
    FilesystemToolsProvider,
    SlackToolsProvider, // ← Add here
  ],
  exports: [ToolsService],
})
export class ToolsModule {}
```

```typescript
// backend/src/tools/tools.service.ts

constructor(
  private jiraTools: JiraToolsProvider,
  private githubTools: GithubToolsProvider,
  private filesystemTools: FilesystemToolsProvider,
  private slackTools: SlackToolsProvider,  // ← Add here
) {}

getTools(): DynamicStructuredTool[] {
  const [jira, github, fs, slack] = [
    this.jiraTools.getTools(),
    this.githubTools.getTools(),
    this.filesystemTools.getTools(),
    this.slackTools.getTools(),  // ← Add here
  ];

  return [...jira, ...github, ...fs, ...slack];
}
```

## Advanced: Using MCP Servers

### Connecting to an MCP Server

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Initialize transport
this.transport = new StdioClientTransport({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-slack'],
  env: {
    SLACK_TOKEN: process.env.SLACK_TOKEN,
  },
});

// Connect client
this.client = new Client(
  { name: 'slack-client', version: '1.0.0' },
  { capabilities: {} },
);

await this.client.connect(this.transport);
```

### Calling MCP Tools

```typescript
const result = await this.client.callTool({
  name: 'send_message',
  arguments: {
    channel: args.channel,
    message: args.message,
  },
});

return JSON.stringify(result.content);
```

## Testing Your Tools

### Manual Testing

Start the backend and test via chat:

```bash
cd backend
yarn start:dev

# In another terminal, send test message
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Send message to #dev-team: Hello!"}'
```

### Unit Testing

```typescript
// backend/test/slack-tools.spec.ts

describe('SlackToolsProvider', () => {
  it('should send message to channel', async () => {
    const provider = new SlackToolsProvider();
    const tools = await provider.getTools();

    const sendMessageTool = tools.find((t) => t.name === 'slack_send_message');
    expect(sendMessageTool).toBeDefined();

    const result = await sendMessageTool?.func({
      channel: '#test',
      message: 'Hello',
    });

    expect(result).toContain('Message sent');
  });
});
```

## Debugging Tips

### 1. Log Tool Calls

```typescript
// backend/src/app.service.ts

private logToolCall(toolName: string, args: any) {
  this.logger.debug(`[tool] ${toolName}: ${JSON.stringify(args)}`);
}
```

### 2. Test Tools Independently

```typescript
const tools = await filesystemTools.getTools();
const testTool = tools.find((t) => t.name === 'run_test_command');

const result = await testTool?.func({
  command: 'yarn test',
  workingDir: 'backend',
});

console.log(result);
```

### 3. Validate Schema

```typescript
const schema = z.object({
  channel: z.string(),
  message: z.string(),
});

// Test validation
const valid = schema.safeParse({ channel: '#dev', message: 'hi' });
console.log(valid.success); // true

const invalid = schema.safeParse({ channel: 123 });
console.log(invalid.success); // false
```

## Common Patterns

### Pattern 1: File Operations

```typescript
new DynamicStructuredTool({
  name: 'backup_file',
  description: 'Create backup copy of a file',
  schema: z.object({
    filePath: z.string(),
  }),
  func: async (args) => {
    const fullPath = path.join(workspaceDir, args.filePath);

    // Security check
    if (!fullPath.startsWith(workspaceDir)) {
      return 'Error: Access denied';
    }

    // Create backup
    const backupPath = `${fullPath}.backup`;
    fs.copyFileSync(fullPath, backupPath);

    return `Backup created: ${args.filePath}.backup`;
  },
}),
```

### Pattern 2: API Calls

```typescript
new DynamicStructuredTool({
  name: 'deploy_to_staging',
  description: 'Deploy application to staging environment',
  schema: z.object({
    version: z.string(),
  }),
  func: async (args) => {
    try {
      const response = await fetch('https://api.deploy.com/staging', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.DEPLOY_TOKEN}` },
        body: JSON.stringify({ version: args.version }),
      });

      if (!response.ok) {
        return `Error: Deployment failed with status ${response.status}`;
      }

      const data = await response.json();
      return `Deployed version ${args.version} to staging. URL: ${data.url}`;
    } catch (e) {
      return `Error: ${(e as Error).message}`;
    }
  },
}),
```

### Pattern 3: Shell Commands

```typescript
new DynamicStructuredTool({
  name: 'run_linter',
  description: 'Run ESLint on the codebase',
  schema: z.object({
    fix: z.boolean().optional(),
  }),
  func: async (args) => {
    const command = args.fix ? 'yarn lint --fix' : 'yarn lint';

    try {
      const output = execSync(command, {
        cwd: workspaceDir,
        encoding: 'utf-8',
      });
      return `Linter passed:\n${output}`;
    } catch (e: any) {
      return `Linter found issues:\n${e.stdout || e.message}`;
    }
  },
}),
```

## Tool Naming Conventions

- Use `snake_case` for tool names
- Prefix with category: `jira_`, `github_`, `slack_`
- Be specific: `jira_assign_issue` not `assign`
- Use verbs: `get_`, `create_`, `update_`, `delete_`

## Prompt Engineering for Tools

When adding a tool, update the system prompt with:

1. **Tool listing** (with brief description)
2. **Command examples** (how users invoke it)
3. **Expected behavior** (what the agent should do)

Example:

```typescript
SLACK:
- slack_send_message(channel, message): Send message to Slack

=== COMMANDS ===

"Send message to #dev-team: Deployment complete"
→ CALL slack_send_message(channel: "#dev-team", message: "Deployment complete")
→ RESPOND: "Message sent to #dev-team"
```

## Troubleshooting

### Tool Not Available

- Check provider is registered in `mcp.module.ts`
- Check provider is injected in `mcp.service.ts`
- Restart the backend

### LLM Not Calling Tool

- Add clear examples to system prompt
- Make description more specific
- Test with Gemini (better at tool calling)

### Tool Errors

- Check return type is string
- Verify error handling catches all exceptions
- Add detailed logging

## Resources

- [LangChain DynamicStructuredTool](https://js.langchain.com/docs/modules/agents/tools/dynamic)
- [Zod Documentation](https://zod.dev/)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## Next Steps

1. Identify a repetitive task in your workflow
2. Create a tool to automate it
3. Add it to the appropriate provider
4. Update the system prompt
5. Test with simple commands
6. Iterate based on agent behavior
