import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { execSync } from 'child_process';
import { ToolProvider } from './tool-provider.interface';
import { JiraToolsProvider } from './jira-tools.provider';

@Injectable()
export class GithubToolsProvider
  implements ToolProvider, OnModuleInit, OnModuleDestroy
{
  private client: Client;
  private transport: StdioClientTransport;
  private readonly logger = new Logger(GithubToolsProvider.name);
  private connected = false;
  private readonly workspaceDir: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly jiraToolsProvider: JiraToolsProvider,
  ) {
    this.workspaceDir = this.configService.get<string>('WORKSPACE_DIR');
  }

  async onModuleInit() {
    const token = this.configService.get<string>(
      'GITHUB_PERSONAL_ACCESS_TOKEN',
    );
    if (!token) {
      this.logger.warn(
        'GITHUB_PERSONAL_ACCESS_TOKEN not set. GitHub tools disabled.',
      );
      return;
    }

    this.transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: token,
        PATH: process.env.PATH || '',
      },
    });

    this.client = new Client(
      { name: 'devassist-github-client', version: '1.0.0' },
      { capabilities: {} },
    );

    try {
      await this.client.connect(this.transport);
      this.connected = true;
      this.logger.log('GitHub MCP Client connected successfully!');
    } catch (e: unknown) {
      this.logger.error(
        'Failed to connect to GitHub MCP: ' + (e as Error).message,
      );
    }
  }

  async onModuleDestroy() {
    if (this.transport) {
      await this.transport.close();
    }
  }

  getTools(): DynamicStructuredTool[] {
    if (!this.connected) return [];

    const githubTools = [
      new DynamicStructuredTool({
        name: 'github_get_file_contents',
        description: 'Read file or directory from GitHub repo.',
        schema: z.object({
          owner: z.string().describe('Repo owner'),
          repo: z.string().describe('Repo name'),
          path: z.string().describe('File or directory path'),
        }),
        func: async (args: { owner: string; repo: string; path: string }) => {
          const res = await this.client.callTool({
            name: 'get_file_contents',
            arguments: args,
          });
          type ContentItem = { type: string; text: string };
          if (
            res.content &&
            Array.isArray(res.content) &&
            (res.content[0] as ContentItem)?.type === 'text'
          ) {
            const data = JSON.parse(
              (res.content[0] as ContentItem).text,
            ) as unknown;
            if (Array.isArray(data)) {
              const items = data.map((item: { type: string; path: string }) => {
                const prefix = item.type === 'dir' ? '[DIR]' : '[FILE]';
                return `${prefix} ${item.path}`;
              });
              return `DIRECTORY CONTENTS:\n${items.join('\n')}`;
            }
            return `FILE_SHA: ${(data as { sha: string; content: string }).sha}\nCONTENT: ${(data as { sha: string; content: string }).content}`;
          }
          return JSON.stringify(res.content);
        },
      }),

      new DynamicStructuredTool({
        name: 'github_search_code',
        description: 'Search code or files in GitHub repo.',
        schema: z.object({
          owner: z.string().describe('Repo owner'),
          repo: z.string().describe('Repo name'),
          query: z
            .string()
            .describe('Search query (e.g., "filename:.spec.ts")'),
        }),
        func: async (args) => {
          try {
            const fullQuery = `repo:${args.owner}/${args.repo} ${args.query}`;
            const res = await this.client.callTool({
              name: 'search_code',
              arguments: {
                q: fullQuery,
              },
            });
            return JSON.stringify(res.content);
          } catch (e: unknown) {
            return `Error searching code: ${(e as Error).message}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'github_search_issues',
        description: 'Search GitHub issues and pull requests.',
        schema: z.object({
          query: z.string().describe('Search query'),
        }),
        func: async (args) => {
          const res = await this.client.callTool({
            name: 'search_issues',
            arguments: args,
          });
          return JSON.stringify(res.content);
        },
      }),

      new DynamicStructuredTool({
        name: 'github_create_branch',
        description: 'Create a new branch in GitHub repo.',
        schema: z.object({
          owner: z.string().describe('Repo owner'),
          repo: z.string().describe('Repo name'),
          branch: z.string().describe('New branch name'),
        }),
        func: async (args) => {
          try {
            const res = await this.client.callTool({
              name: 'create_branch',
              arguments: args,
            });
            return JSON.stringify(res.content);
          } catch (e: unknown) {
            return `Error creating branch: ${(e as Error).message}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'github_create_or_update_file',
        description: 'Create or update file in GitHub repo.',
        schema: z.object({
          owner: z.string().describe('Repo owner'),
          repo: z.string().describe('Repo name'),
          path: z.string().describe('File path'),
          content: z.string().describe('File content'),
          message: z.string().describe('Commit message'),
          branch: z.string().describe('Target branch'),
          sha: z.string().optional().describe('File SHA for updates'),
        }),
        func: async (args) => {
          try {
            const res = await this.client.callTool({
              name: 'create_or_update_file',
              arguments: args,
            });
            return JSON.stringify(res.content);
          } catch (e: unknown) {
            return `Error creating/updating file: ${(e as Error).message}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'github_create_pull_request',
        description: 'Create a pull request in GitHub repo.',
        schema: z.object({
          owner: z.string().describe('Repo owner'),
          repo: z.string().describe('Repo name'),
          title: z.string().describe('PR title'),
          body: z.string().describe('PR description'),
          head: z.string().describe('Branch with changes'),
          base: z
            .string()
            .default('main')
            .describe('Target branch (default: main)'),
        }),
        func: async (args) => {
          try {
            const res = await this.client.callTool({
              name: 'create_pull_request',
              arguments: args,
            });
            return JSON.stringify(res.content);
          } catch (e: unknown) {
            return `Error creating PR: ${(e as Error).message}`;
          }
        },
      }),
      new DynamicStructuredTool({
        name: 'github_delete_file',
        description: 'Delete a file from GitHub repo.',
        schema: z.object({
          owner: z.string().describe('Repo owner'),
          repo: z.string().describe('Repo name'),
          path: z.string().describe('File path'),
          message: z.string().describe('Commit message'),
          branch: z.string().describe('Target branch'),
          sha: z.string().describe('File SHA'),
        }),
        func: async (args) => {
          try {
            const res = await this.client.callTool({
              name: 'delete_file',
              arguments: args,
            });
            return JSON.stringify(res.content);
          } catch (e: unknown) {
            return `Error deleting file: ${(e as Error).message}`;
          }
        },
      }),
    ];

    const workspaceDir = this.workspaceDir;
    if (!workspaceDir) {
      return githubTools;
    }

    const mcpClient = this.client;
    const jiraProvider = this.jiraToolsProvider;
    const gitTools = [
      new DynamicStructuredTool({
        name: 'create_pr_from_local_changes',
        description:
          'Fetch Jira issue details, create branch, commit, push, and open a GitHub PR. Returns PR URL.',
        schema: z.object({
          issueKey: z.string().describe('Jira issue key (e.g., DEV-8)'),
          branchName: z.string().describe('Branch name'),
          owner: z.string().describe('Repo owner'),
          repo: z.string().describe('Repo name'),
          base: z
            .string()
            .default('main')
            .describe('Target branch (default: main)'),
        }),
        func: async (args) => {
          try {
            // Fetch Jira issue details automatically
            const issue = await jiraProvider.getIssue(args.issueKey);
            const summary = issue?.summary || args.issueKey;

            const commitMessage = `feat(${args.issueKey}): ${summary}`;
            const prTitle = `feat(${args.issueKey}): ${summary}`;
            const prBody = `Closes ${args.issueKey}\n\n## Summary\n${summary}\n\n## Changes\n- See diff for details`;

            execSync(`git checkout -b ${args.branchName}`, {
              cwd: workspaceDir,
              encoding: 'utf-8',
            });

            execSync('git add .', {
              cwd: workspaceDir,
              encoding: 'utf-8',
            });

            execSync(`git commit -m "${commitMessage}"`, {
              cwd: workspaceDir,
              encoding: 'utf-8',
            });

            execSync(`git push -u origin ${args.branchName}`, {
              cwd: workspaceDir,
              encoding: 'utf-8',
            });

            // Automatically create PR via GitHub MCP
            const prResult = await mcpClient.callTool({
              name: 'create_pull_request',
              arguments: {
                owner: args.owner,
                repo: args.repo,
                title: prTitle,
                body: prBody,
                head: args.branchName,
                base: args.base,
              },
            });

            const prContent = prResult.content as Array<{
              type: string;
              text: string;
            }>;
            const prData = JSON.parse(prContent[0].text) as {
              html_url: string;
            };
            return prData.html_url;
          } catch (e: unknown) {
            return `Error: ${(e as Error).message}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'run_git_command',
        description:
          'Run read-only git commands (git branch, git status, git log).',
        schema: z.object({
          command: z
            .string()
            .describe('Git command (e.g., "git branch --show-current")'),
        }),
        func: async (args: { command: string }) => {
          const allowedCommands = [
            'git branch',
            'git status',
            'git log',
            'git diff',
            'git show',
          ];

          const isAllowed = allowedCommands.some((cmd) =>
            args.command.startsWith(cmd),
          );

          if (!isAllowed) {
            return `Error: Command not allowed. Only read-only git commands are permitted: ${allowedCommands.join(', ')}`;
          }

          return await Promise.resolve().then(() => {
            try {
              const output = execSync(args.command, {
                cwd: workspaceDir,
                encoding: 'utf-8',
                maxBuffer: 1024 * 1024,
              });
              return output.trim();
            } catch (e: unknown) {
              return `Error executing git command: ${(e as Error).message}`;
            }
          });
        },
      }),

      new DynamicStructuredTool({
        name: 'get_current_branch',
        description: 'Get the current git branch name.',
        schema: z.object({}),
        func: async () => {
          return await Promise.resolve().then(() => {
            try {
              const output = execSync('git branch --show-current', {
                cwd: workspaceDir,
                encoding: 'utf-8',
              });
              return output.trim();
            } catch (e: unknown) {
              return `Error: ${(e as Error).message}`;
            }
          });
        },
      }),
    ];

    return [...githubTools, ...gitTools];
  }
}
