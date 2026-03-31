import { Module } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { GithubToolsProvider } from './github-tools.provider';
import { JiraToolsProvider } from './jira-tools.provider';
import { FilesystemToolsProvider } from './filesystem-tools.provider';
import { TestToolsProvider } from './test-tools.provider';

@Module({
  providers: [
    ToolsService,
    GithubToolsProvider,
    JiraToolsProvider,
    FilesystemToolsProvider,
    TestToolsProvider,
  ],
  exports: [ToolsService],
})
export class ToolsModule {}
