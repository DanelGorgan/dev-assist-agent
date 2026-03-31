import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { ToolProvider } from './tool-provider.interface';

@Injectable()
export class FilesystemToolsProvider implements ToolProvider {
  private readonly logger = new Logger(FilesystemToolsProvider.name);
  private readonly workspaceDir: string | undefined;

  constructor(private configService: ConfigService) {
    this.workspaceDir = this.configService.get<string>('WORKSPACE_DIR');
  }

  private searchFilesRecursive(
    dir: string,
    pattern: RegExp,
    results: string[] = [],
  ): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === '.git'
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        this.searchFilesRecursive(fullPath, pattern, results);
      } else if (pattern.test(entry.name)) {
        const relativePath = path.relative(this.workspaceDir || '', fullPath);
        results.push(relativePath);
      }
    }

    return results;
  }

  private async searchFilesRecursiveAsync(
    dir: string,
    pattern: RegExp,
    results: string[] = [],
  ): Promise<string[]> {
    const entries = await fsPromises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === '.git'
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.searchFilesRecursiveAsync(fullPath, pattern, results);
      } else if (pattern.test(entry.name)) {
        const relativePath = path.relative(this.workspaceDir || '', fullPath);
        results.push(relativePath);
      }
    }

    return results;
  }

  getTools(): DynamicStructuredTool[] {
    if (!this.workspaceDir) {
      this.logger.warn('WORKSPACE_DIR not set. Filesystem tools disabled.');
      return [];
    }

    this.logger.log(
      `Filesystem tools enabled. Workspace: ${this.workspaceDir}`,
    );
    const workspaceDir = this.workspaceDir;

    return [
      new DynamicStructuredTool({
        name: 'read_local_file',
        description: 'Read a file from the workspace.',
        schema: z.object({
          filePath: z.string().describe('Relative path to file'),
        }),

        func: async (args: { filePath: string }) => {
          const fullPath = path.join(workspaceDir, args.filePath);

          if (!fullPath.startsWith(workspaceDir)) {
            return 'Error: Access denied. Path is outside workspace.';
          }

          try {
            return await fsPromises.readFile(fullPath, 'utf-8');
          } catch {
            return `Error: Could not read file at ${args.filePath}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'write_local_file',
        description: 'Write or overwrite a file in the workspace.',
        schema: z.object({
          filePath: z.string().describe('Relative path to file'),
          content: z.string().describe('Full file content'),
        }),

        func: async (args: { filePath: string; content: string }) => {
          const fullPath = path.join(workspaceDir, args.filePath);

          if (!fullPath.startsWith(workspaceDir)) {
            return 'Error: Access denied. Path is outside workspace.';
          }

          try {
            const dir = path.dirname(fullPath);
            await fsPromises.mkdir(dir, { recursive: true });
            this.logger.debug(
              `Writing file ${args.filePath} with content length: ${args.content?.length || 0} chars`,
            );
            this.logger.debug(
              `Content preview: ${args.content?.slice(0, 100)}...`,
            );
            await fsPromises.writeFile(fullPath, args.content, 'utf-8');
            return `Successfully wrote file: ${args.filePath}`;
          } catch (e: unknown) {
            return `Error writing file: ${(e as Error).message}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'replace_lines_in_file',
        description: 'Replace specific text in a file.',
        schema: z.object({
          filePath: z.string().describe('Relative path to file'),
          oldText: z.string().describe('Exact text to find and replace'),
          newText: z.string().describe('New replacement text'),
        }),

        func: async (args: {
          filePath: string;
          oldText: string;
          newText: string;
        }) => {
          const fullPath = path.join(workspaceDir, args.filePath);

          if (!fullPath.startsWith(workspaceDir)) {
            return 'Error: Access denied. Path is outside workspace.';
          }

          try {
            await fsPromises.access(fullPath);
          } catch {
            return `Error: File not found: ${args.filePath}`;
          }

          const content = await fsPromises.readFile(fullPath, 'utf-8');

          if (!content.includes(args.oldText)) {
            return `Error: Could not find the exact text to replace in ${args.filePath}. Make sure oldText matches exactly.`;
          }

          const newContent = content.replace(args.oldText, args.newText);
          await fsPromises.writeFile(fullPath, newContent, 'utf-8');

          return `Successfully replaced text in ${args.filePath}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'append_to_file',
        description: 'Append text to end of file (.env, config files, etc).',
        schema: z.object({
          filePath: z.string().describe('Relative path to file'),
          content: z.string().describe('Text to append'),
        }),

        func: async (args: { filePath: string; content: string }) => {
          const fullPath = path.join(workspaceDir, args.filePath);

          if (!fullPath.startsWith(workspaceDir)) {
            return 'Error: Access denied. Path is outside workspace.';
          }

          await fsPromises.appendFile(fullPath, args.content, 'utf-8');
          return `Successfully appended to ${args.filePath}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'list_local_directory',
        description: 'List files and directories.',
        schema: z.object({
          dirPath: z
            .string()
            .default('.')
            .describe('Relative path to directory'),
        }),

        func: async (args: { dirPath: string }) => {
          const fullPath = path.join(workspaceDir, args.dirPath);

          if (!fullPath.startsWith(workspaceDir)) {
            return 'Error: Access denied. Path is outside workspace.';
          }

          try {
            const entries = await fsPromises.readdir(fullPath, {
              withFileTypes: true,
            });
            const items = entries.map((entry) => {
              const prefix = entry.isDirectory() ? '[DIR]' : '[FILE]';
              return `${prefix} ${entry.name}`;
            });
            return `DIRECTORY: ${args.dirPath}\n${items.join('\n')}`;
          } catch (e: unknown) {
            return `Error listing directory: ${(e as Error).message}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'search_local_files',
        description: 'Find files by extension (.spec.ts, .ts, .tsx, etc).',
        schema: z.object({
          extension: z
            .string()
            .describe('File extension with dot (e.g., ".spec.ts")'),
        }),

        func: async (args: { extension: string }) => {
          try {
            const pattern = new RegExp(
              `${args.extension.replace(/\./g, '\\.')}$`,
            );
            const files = await this.searchFilesRecursiveAsync(
              workspaceDir,
              pattern,
            );

            if (files.length === 0) {
              return `No files found with extension: ${args.extension}`;
            }

            return `Found ${files.length} files:\n${files.join('\n')}`;
          } catch (e: unknown) {
            return `Error searching files: ${(e as Error).message}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'search_and_read_files',
        description:
          'Search .ts files by keyword and return matching file contents.',
        schema: z.object({
          keyword: z.string().describe('Keyword to search for in file content'),
          maxFiles: z
            .string()
            .optional()
            .describe('Max files to return (default 3)'),
        }),

        func: async (args: { keyword: string; maxFiles?: string }) => {
          const files = await this.searchFilesRecursiveAsync(
            workspaceDir,
            /\.ts$/,
          );
          const keyword = args.keyword.toLowerCase();
          const matchingFiles: string[] = [];

          for (const file of files) {
            const fullPath = path.join(workspaceDir, file);
            try {
              const content = await fsPromises.readFile(fullPath, 'utf-8');
              if (content.toLowerCase().includes(keyword)) {
                matchingFiles.push(file);
              }
            } catch {
              continue;
            }
          }

          if (matchingFiles.length === 0) {
            return `No files found containing keyword: ${args.keyword}`;
          }

          const maxFiles = parseInt(args.maxFiles || '3', 10);
          const filesToRead = matchingFiles.slice(0, maxFiles);
          const results: string[] = [];

          for (const file of filesToRead) {
            const fullPath = path.join(workspaceDir, file);
            try {
              const content = await fsPromises.readFile(fullPath, 'utf-8');
              results.push(`\n=== FILE: ${file} ===\n${content}\n`);
            } catch (e: unknown) {
              results.push(
                `\n=== FILE: ${file} ===\nError reading: ${(e as Error).message}\n`,
              );
            }
          }

          return `Found ${matchingFiles.length} files containing "${args.keyword}". Showing first ${filesToRead.length}:\n${results.join('\n')}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'delete_local_file',
        description: 'Delete a file from the workspace.',
        schema: z.object({
          filePath: z.string().describe('Relative path to file'),
        }),

        func: async (args: { filePath: string }) => {
          const fullPath = path.join(workspaceDir, args.filePath);

          if (!fullPath.startsWith(workspaceDir)) {
            return 'Error: Access denied. Path is outside workspace.';
          }

          try {
            await fsPromises.unlink(fullPath);
            return `Successfully deleted file: ${args.filePath}`;
          } catch (e: unknown) {
            return `Error deleting file: ${(e as Error).message}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'move_local_file',
        description: 'Move or rename a file. Automatically updates imports.',
        schema: z.object({
          sourcePath: z.string().describe('Current file path'),
          destPath: z.string().describe('New file path'),
        }),

        func: async (args: { sourcePath: string; destPath: string }) => {
          const sourceFullPath = path.join(workspaceDir, args.sourcePath);
          const destFullPath = path.join(workspaceDir, args.destPath);

          if (
            !sourceFullPath.startsWith(workspaceDir) ||
            !destFullPath.startsWith(workspaceDir)
          ) {
            return 'Error: Access denied. Path is outside workspace.';
          }

          try {
            let content = await fsPromises.readFile(sourceFullPath, 'utf-8');

            const sourceDir = path.dirname(args.sourcePath);
            const destDir = path.dirname(args.destPath);

            if (sourceDir !== destDir) {
              content = content.replace(
                /from\s+['"](\..+?)['"]/g,
                (match: string, importPath: string) => {
                  const isRelativeImport =
                    importPath.startsWith('./') || importPath.startsWith('../');
                  if (!isRelativeImport) return match;

                  const resolvedFromSource = path.join(sourceDir, importPath);
                  const newRelativePath = path.relative(
                    destDir,
                    resolvedFromSource,
                  );

                  const normalizedPath = newRelativePath.startsWith('.')
                    ? newRelativePath
                    : `./${newRelativePath}`;

                  return `from '${normalizedPath.replace(/\\/g, '/')}'`;
                },
              );
            }

            const destDirPath = path.dirname(destFullPath);
            await fsPromises.mkdir(destDirPath, { recursive: true });
            await fsPromises.writeFile(destFullPath, content, 'utf-8');
            await fsPromises.unlink(sourceFullPath);

            return `Successfully moved ${args.sourcePath} to ${args.destPath}`;
          } catch (e: unknown) {
            return `Error moving file: ${(e as Error).message}`;
          }
        },
      }),
    ];
  }
}
