import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import * as path from 'path';
import { execSync } from 'child_process';
import { ToolProvider } from './tool-provider.interface';

@Injectable()
export class TestToolsProvider implements ToolProvider {
  private readonly logger = new Logger(TestToolsProvider.name);
  private readonly workspaceDir: string | undefined;

  constructor(private configService: ConfigService) {
    this.workspaceDir = this.configService.get<string>('WORKSPACE_DIR');
  }

  getTools(): DynamicStructuredTool[] {
    const workspaceDir = this.workspaceDir;

    if (!workspaceDir) {
      this.logger.warn('WORKSPACE_DIR not set. Test tools disabled.');
      return [];
    }

    return [
      new DynamicStructuredTool({
        name: 'run_test_command',
        description:
          'Run test commands in a specific directory (e.g., "yarn test" in backend/).',
        schema: z.object({
          command: z
            .string()
            .describe('Test command to run (e.g., "yarn test", "npm test")'),
          workingDir: z
            .string()
            .optional()
            .describe('Relative path to working directory (e.g., "backend")'),
        }),
        func: async (args: { command: string; workingDir?: string }) => {
          const allowedCommands = [
            'yarn test',
            'npm test',
            'npm run test',
            'yarn run test',
            'pnpm test',
          ];

          const isAllowed = allowedCommands.some(
            (cmd) => args.command === cmd || args.command.startsWith(cmd + ' '),
          );

          if (!isAllowed) {
            return `Error: Command not allowed. Only test commands are permitted: ${allowedCommands.join(', ')}`;
          }

          return await Promise.resolve().then(() => {
            try {
              const cwd = args.workingDir
                ? path.join(workspaceDir, args.workingDir)
                : workspaceDir;

              if (!cwd.startsWith(workspaceDir)) {
                return 'Error: Access denied. Path is outside workspace.';
              }

              const output = execSync(args.command, {
                cwd,
                encoding: 'utf-8',
                maxBuffer: 1024 * 1024 * 5,
              });
              return `Tests executed successfully in ${args.workingDir || 'root'}:\n${output}`;
            } catch (e: unknown) {
              const error = e as {
                stdout?: string;
                stderr?: string;
                message: string;
              };
              return `Tests failed:\n${error.stdout || ''}\n${error.stderr || error.message}`;
            }
          });
        },
      }),
    ];
  }
}
