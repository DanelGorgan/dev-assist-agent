import { Injectable, Logger } from '@nestjs/common';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { GithubToolsProvider } from './github-tools.provider';
import { JiraToolsProvider } from './jira-tools.provider';
import { FilesystemToolsProvider } from './filesystem-tools.provider';
import { TestToolsProvider } from './test-tools.provider';

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);

  constructor(
    private githubTools: GithubToolsProvider,
    private jiraTools: JiraToolsProvider,
    private filesystemTools: FilesystemToolsProvider,
    private testTools: TestToolsProvider,
  ) {}

  getTools(): DynamicStructuredTool[] {
    const github = this.githubTools.getTools();
    const jira = this.jiraTools.getTools();
    const filesystem = this.filesystemTools.getTools();
    const test = this.testTools.getTools();

    const allTools = [...github, ...jira, ...filesystem, ...test];
    this.logger.log(
      `Loaded ${allTools.length} tools (GitHub: ${github.length}, Jira: ${jira.length}, Filesystem: ${filesystem.length}, Test: ${test.length})`,
    );

    return allTools;
  }
}
