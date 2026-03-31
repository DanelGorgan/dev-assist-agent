import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ToolProvider } from './tool-provider.interface';

@Injectable()
export class JiraToolsProvider implements ToolProvider {
  private readonly logger = new Logger(JiraToolsProvider.name);

  constructor(private configService: ConfigService) {}

  private get isConfigured(): boolean {
    return !!(
      this.configService.get('JIRA_API_TOKEN') &&
      this.configService.get('JIRA_EMAIL') &&
      this.configService.get('JIRA_BASE_URL')
    );
  }

  private getAuthHeader(): string {
    const email = this.configService.get<string>('JIRA_EMAIL');
    const token = this.configService.get<string>('JIRA_API_TOKEN');
    return Buffer.from(`${email}:${token}`).toString('base64');
  }

  private get baseUrl(): string {
    return (this.configService.get<string>('JIRA_BASE_URL') || '').replace(
      /\/$/,
      '',
    );
  }

  async getIssue(
    issueKey: string,
  ): Promise<{ key: string; summary: string; description: unknown } | null> {
    if (!this.isConfigured) return null;
    try {
      const res = await fetch(`${this.baseUrl}/rest/api/3/issue/${issueKey}`, {
        headers: {
          Authorization: `Basic ${this.getAuthHeader()}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        key: string;
        fields: { summary: string; description: unknown };
      };
      return {
        key: data.key,
        summary: data.fields.summary || '',
        description: data.fields.description,
      };
    } catch {
      return null;
    }
  }

  getTools(): DynamicStructuredTool[] {
    if (!this.isConfigured) {
      this.logger.warn('Jira credentials not set. Jira tools disabled.');
      return [];
    }

    this.logger.log('Jira tools enabled.');

    return [
      new DynamicStructuredTool({
        name: 'jira_create_ticket',
        description: 'Create a Jira ticket (Bug or Task).',
        schema: z.object({
          projectKey: z.string().describe('Project key (e.g., DEV)'),
          summary: z.string().describe('Ticket title'),
          description: z.string().describe('Ticket description'),
          issueType: z.string().default('Bug').describe('Bug or Task'),
        }),
        func: async (args: {
          projectKey: string;
          summary: string;
          description: string;
          issueType: string;
        }) => {
          const body = {
            fields: {
              project: { key: args.projectKey },
              summary: args.summary,
              description: args.description,
              issuetype: { name: args.issueType },
            },
          };

          try {
            const res = await fetch(`${this.baseUrl}/rest/api/2/issue`, {
              method: 'POST',
              headers: {
                Authorization: `Basic ${this.getAuthHeader()}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(body),
            });

            if (!res.ok)
              return `Failed to create Jira ticket: ${res.statusText}`;
            const data = (await res.json()) as { key: string };
            return `Jira ticket created: ${data.key}. URL: ${this.baseUrl}/browse/${data.key}`;
          } catch (e: unknown) {
            return `Failed to connect to Jira: ${(e as Error).message}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'jira_list_all_issues',
        description:
          'List issues from a Jira project. Returns key, summary, status, assignee.',
        schema: z.object({
          projectKey: z.string().describe('Project key (e.g., DEV)'),
          maxResults: z
            .number()
            .optional()
            .describe('Max results (default 20)'),
          status: z
            .string()
            .optional()
            .describe('Filter by status (e.g., "TO DO")'),
        }),
        func: async (args: {
          projectKey: string;
          maxResults?: number;
          status?: string;
        }) => {
          const maxResults = args.maxResults || 20;
          let jql = `project = ${args.projectKey}`;
          if (args.status) {
            jql += ` AND status = "${args.status}"`;
          }
          jql += ' ORDER BY created DESC';
          const encodedJql = encodeURIComponent(jql);

          try {
            const res = await fetch(
              `${this.baseUrl}/rest/api/3/search/jql?jql=${encodedJql}&maxResults=${maxResults}&fields=summary,status,issuetype,priority,assignee`,
              {
                headers: {
                  Authorization: `Basic ${this.getAuthHeader()}`,
                  'Content-Type': 'application/json',
                },
              },
            );

            if (!res.ok) {
              const errorBody = await res.text();
              this.logger.error(
                `Jira search failed: ${res.status} ${res.statusText} — ${errorBody}`,
              );
              return `Failed to query Jira: ${res.status} ${res.statusText} — ${errorBody}`;
            }

            const data = (await res.json()) as {
              issues: Array<{
                key: string;
                fields: {
                  summary: string;
                  status: { name: string };
                  issuetype: { name: string };
                  priority: { name: string };
                  assignee?: { displayName: string };
                };
              }>;
            };

            if (data.issues.length === 0)
              return 'No issues found in this project.';

            return data.issues
              .map((i) => {
                const assignee = i.fields.assignee?.displayName || 'Unassigned';
                return `[${i.key}] (${i.fields.issuetype.name} | ${i.fields.priority.name}) ${i.fields.summary} — Status: ${i.fields.status.name} — Assigned to: ${assignee}`;
              })
              .join('\n');
          } catch (e: unknown) {
            return `Error querying Jira: ${(e as Error).message}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'jira_list_unassigned_issues',
        description: 'List unassigned issues from a Jira project.',
        schema: z.object({
          projectKey: z.string().describe('Project key (e.g., DEV)'),
          maxResults: z
            .number()
            .optional()
            .describe('Max results (default 10)'),
        }),
        func: async (args: { projectKey: string; maxResults?: number }) => {
          const maxResults = args.maxResults || 10;
          const jql = encodeURIComponent(
            `project = ${args.projectKey} AND assignee is EMPTY ORDER BY created DESC`,
          );

          try {
            const res = await fetch(
              `${this.baseUrl}/rest/api/3/search/jql?jql=${jql}&maxResults=${maxResults}&fields=summary,status,issuetype,priority`,
              {
                headers: {
                  Authorization: `Basic ${this.getAuthHeader()}`,
                  'Content-Type': 'application/json',
                },
              },
            );

            if (!res.ok) {
              const errorBody = await res.text();
              this.logger.error(
                `Jira search failed: ${res.status} ${res.statusText} — ${errorBody}`,
              );
              return `Failed to query Jira: ${res.status} ${res.statusText} — ${errorBody}`;
            }

            const data = (await res.json()) as {
              issues: Array<{
                key: string;
                fields: {
                  summary: string;
                  status: { name: string };
                  issuetype: { name: string };
                  priority: { name: string };
                };
              }>;
            };

            if (data.issues.length === 0)
              return 'No unassigned issues found in this project.';

            return data.issues
              .map(
                (i) =>
                  `[${i.key}] (${i.fields.issuetype.name} | ${i.fields.priority.name}) ${i.fields.summary} — Status: ${i.fields.status.name}`,
              )
              .join('\n');
          } catch (e: unknown) {
            return `Error querying Jira: ${(e as Error).message}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'jira_assign_issue',
        description: 'Assign a Jira issue to a user.',
        schema: z.object({
          issueIdOrKey: z.string().describe('Issue key (e.g., DEV-42)'),
          accountId: z.string().describe('Atlassian account ID of assignee'),
        }),
        func: async (args: { issueIdOrKey: string; accountId: string }) => {
          const cleanKey = args.issueIdOrKey.replace(/[[\]]/g, '').trim();
          try {
            const res = await fetch(
              `${this.baseUrl}/rest/api/3/issue/${cleanKey}/assignee`,
              {
                method: 'PUT',
                headers: {
                  Authorization: `Basic ${this.getAuthHeader()}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ accountId: args.accountId }),
              },
            );

            if (!res.ok) {
              const errorBody = await res.text();
              this.logger.error(
                `Jira assign failed for ${cleanKey}: ${res.status} - ${errorBody}`,
              );
              return `Failed to assign ${cleanKey}: ${res.status} ${res.statusText}. Error: ${errorBody}`;
            }
            return `Successfully assigned ${cleanKey} to ${args.accountId}.`;
          } catch (e: unknown) {
            return `Error assigning issue: ${(e as Error).message}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'jira_get_transitions',
        description: 'Get available status transitions for a Jira issue.',
        schema: z.object({
          issueIdOrKey: z.string().describe('Issue key (e.g., DEV-42)'),
        }),
        func: async (args: { issueIdOrKey: string }) => {
          const cleanKey = args.issueIdOrKey.replace(/[[\]]/g, '').trim();
          try {
            const res = await fetch(
              `${this.baseUrl}/rest/api/3/issue/${cleanKey}/transitions`,
              {
                headers: {
                  Authorization: `Basic ${this.getAuthHeader()}`,
                  'Content-Type': 'application/json',
                },
              },
            );

            if (!res.ok)
              return `Failed to fetch transitions for ${cleanKey}: ${res.statusText}`;
            const data = (await res.json()) as {
              transitions: Array<{ id: string; name: string }>;
            };
            return data.transitions
              .map((t) => `ID ${t.id}: ${t.name}`)
              .join('\n');
          } catch (e: unknown) {
            return `Error fetching transitions: ${(e as Error).message}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'jira_transition_issue',
        description: 'Move a Jira issue to a new status.',
        schema: z.object({
          issueIdOrKey: z.string().describe('Issue key (e.g., DEV-42)'),
          transitionId: z
            .string()
            .describe('Transition ID from jira_get_transitions'),
        }),
        func: async (args: { issueIdOrKey: string; transitionId: string }) => {
          const cleanKey = args.issueIdOrKey.replace(/[[\]]/g, '').trim();
          try {
            const res = await fetch(
              `${this.baseUrl}/rest/api/3/issue/${cleanKey}/transitions`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Basic ${this.getAuthHeader()}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  transition: { id: args.transitionId },
                }),
              },
            );

            if (!res.ok)
              return `Failed to transition issue ${cleanKey}: ${res.statusText}`;
            return `Successfully moved ${cleanKey} to new status.`;
          } catch (e: unknown) {
            return `Error transitioning issue: ${(e as Error).message}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'jira_get_myself',
        description: 'Get current user account ID and details.',
        schema: z.object({}),
        func: async () => {
          try {
            const res = await fetch(`${this.baseUrl}/rest/api/3/myself`, {
              headers: {
                Authorization: `Basic ${this.getAuthHeader()}`,
                'Content-Type': 'application/json',
              },
            });

            if (!res.ok)
              return `Failed to fetch user details: ${res.statusText}`;
            const data = (await res.json()) as {
              accountId: string;
              displayName: string;
            };
            return JSON.stringify(
              {
                accountId: data.accountId,
                displayName: data.displayName,
              },
              null,
              2,
            );
          } catch (e: unknown) {
            return `Error fetching user details: ${(e as Error).message}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'jira_get_issue',
        description: 'Get full issue details: description, status, type.',
        schema: z.object({
          issueIdOrKey: z.string().describe('Issue key (e.g., DEV-42)'),
        }),
        func: async (args: { issueIdOrKey: string }) => {
          const cleanKey = args.issueIdOrKey.replace(/[[\]]/g, '').trim();
          try {
            const res = await fetch(
              `${this.baseUrl}/rest/api/3/issue/${cleanKey}`,
              {
                headers: {
                  Authorization: `Basic ${this.getAuthHeader()}`,
                  'Content-Type': 'application/json',
                },
              },
            );

            if (!res.ok)
              return `Failed to fetch issue ${cleanKey}: ${res.statusText}`;
            const data = (await res.json()) as {
              key: string;
              fields: {
                summary: string;
                description: string;
                status: { name: string };
                issuetype: { name: string };
              };
            };
            return JSON.stringify(
              {
                key: data.key,
                summary: data.fields.summary,
                description: data.fields.description,
                status: data.fields.status.name,
                issuetype: data.fields.issuetype.name,
              },
              null,
              2,
            );
          } catch (e: unknown) {
            return `Error fetching issue: ${(e as Error).message}`;
          }
        },
      }),
    ];
  }
}
