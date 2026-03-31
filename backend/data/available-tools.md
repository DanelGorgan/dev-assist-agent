# Available Tools Reference

This document lists all tools available to the DevOps AI Agent, organized by category.

## Tool Categories

- **Jira Tools** (8 tools) - Issue tracking and project management
- **Filesystem Tools** (9 tools) - Local file operations
- **GitHub Tools** (10 tools) - Git operations and GitHub API interactions
- **Test Tools** (1 tool) - Running test suites
- **Knowledge Tools** (1 tool) - RAG-based documentation search

**Total: 29 tools**

## Context Variables

The agent has access to these injected context variables (not tools):

- **Current Timestamp** - Pre-generated timestamp in `YYYYMMDD-HHMM` format, unique for each request
  - Used for creating unique branch names
  - Example value: `20260330-1445`
  - No tool call needed - directly available in context

---

## Jira Tools

### jira_list_all_issues

List Jira issues from a project filtered by status.

**Parameters:**

- `projectKey` (string) - The Jira project key (e.g., "DEV")
- `status` (string, optional) - Filter by status (e.g., "To Do", "In Progress", "Done")

**Use Cases:**

- Finding unassigned tasks
- Viewing all issues in a specific status
- Getting an overview of project work

**Example:** List all "To Do" tasks in the DEV project

---

### jira_get_issue

Get detailed information about a specific Jira issue.

**Parameters:**

- `issueIdOrKey` (string) - The issue key (e.g., "DEV-8")

**Use Cases:**

- Reading task requirements
- Understanding what needs to be done
- Checking issue description and details

**Example:** Get details for DEV-8 to understand the task

---

### jira_get_myself

Get the current authenticated user's Jira account information.

**Parameters:** None

**Use Cases:**

- Retrieving your account ID for assignment
- Verifying Jira connection
- Checking your user details

**Example:** Get my Jira account ID for assigning tasks

---

### jira_assign_issue

Assign a Jira issue to a user.

**Parameters:**

- `issueIdOrKey` (string) - The issue key (e.g., "DEV-8")
- `accountId` (string) - The Jira account ID of the assignee

**Use Cases:**

- Taking ownership of a task
- Assigning work to team members
- Managing task allocation

**Example:** Assign DEV-8 to myself

---

### jira_get_transitions

Get available status transitions for a Jira issue.

**Parameters:**

- `issueIdOrKey` (string) - The issue key (e.g., "DEV-8")

**Use Cases:**

- Finding valid status transitions
- Understanding workflow options
- Checking what statuses are available

**Example:** See what statuses I can move DEV-8 to

---

### jira_transition_issue

Move a Jira issue to a different status.

**Parameters:**

- `issueIdOrKey` (string) - The issue key (e.g., "DEV-8")
- `transitionId` (string) - The ID of the transition to execute

**Use Cases:**

- Moving tasks through workflow (To Do → In Progress → Review → Done)
- Updating task status
- Marking work as complete

**Example:** Move DEV-8 from "To Do" to "In Progress"

---

## Filesystem Tools

### read_local_file

Read the contents of a file from the workspace.

**Parameters:**

- `filePath` (string) - Relative path to the file from workspace root

**Use Cases:**

- Reading source code
- Checking configuration files
- Reviewing file contents before editing

**Example:** Read backend/src/app.service.ts

---

### write_local_file

Write or completely overwrite a file in the workspace.

**Parameters:**

- `filePath` (string) - Relative path to the file
- `content` (string) - Full file content to write

**Use Cases:**

- Creating new files
- Completely replacing file contents
- Writing configuration files

**Example:** Create a new service file with initial boilerplate

---

### replace_lines_in_file

Replace specific text within a file (targeted editing).

**Parameters:**

- `filePath` (string) - Relative path to the file
- `oldText` (string) - Text to find and replace
- `newText` (string) - Replacement text

**Use Cases:**

- Making surgical edits to existing files
- Updating specific functions or lines
- Refactoring code without rewriting entire file

**Example:** Update a function implementation in app.service.ts

---

### append_to_file

Append text to the end of an existing file.

**Parameters:**

- `filePath` (string) - Relative path to the file
- `content` (string) - Text to append

**Use Cases:**

- Adding new environment variables to .env
- Appending new exports to index files
- Adding new lines to configuration files

**Example:** Add a new environment variable to .env

---

### list_local_directory

List all files and directories in a given path.

**Parameters:**

- `dirPath` (string, default: ".") - Relative path to directory

**Use Cases:**

- Exploring project structure
- Finding files in a directory
- Understanding codebase organization

**Example:** List all files in backend/src/

---

### search_local_files

Find files by extension in the workspace.

**Parameters:**

- `extension` (string) - File extension to search for (e.g., ".spec.ts")

**Use Cases:**

- Finding all test files
- Locating all TypeScript files
- Discovering files of a specific type

**Example:** Find all .spec.ts test files

---

### search_and_read_files

Search for files containing a keyword and return their contents.

**Parameters:**

- `keyword` (string) - Keyword to search for in file contents
- `maxFiles` (string, optional) - Maximum number of files to return (default: 3)

**Use Cases:**

- Finding where a function is defined
- Searching for usage of a class
- Locating code by keyword

**Example:** Find files that use the "AppService" class

---

### move_local_file

Move or rename a file, automatically updating relative imports.

**Parameters:**

- `sourcePath` (string) - Current file path
- `destPath` (string) - New file path

**Use Cases:**

- Moving test files to test directory
- Reorganizing code structure
- Renaming files while preserving imports

**Example:** Move src/app.spec.ts to test/app.spec.ts

**Smart Features:**

- Automatically updates relative import paths
- Works for any directory structure
- Preserves file functionality after move

---

### delete_local_file

Delete a file from the workspace.

**Parameters:**

- `filePath` (string) - Relative path to file to delete

**Use Cases:**

- Removing unused files
- Cleaning up old code
- Deleting temporary files

**Example:** Delete an obsolete configuration file

---

---

## GitHub Tools (Git & Repository Management)

### get_current_branch

Get the name of the current Git branch.

**Parameters:** None

**Use Cases:**

- Checking which branch you're on
- Verifying branch before creating PR
- Understanding current workspace state

**Example:** See what branch I'm currently working on

---

### run_git_command

Execute read-only git commands for repository information.

**Parameters:**

- `command` (string) - Git command to run (e.g., "git branch --show-current", "git status")

**Use Cases:**

- Checking git status
- Viewing git logs
- Getting branch information
- Checking diff of changes

**Allowed Commands:**

- `git branch` - List or show branches
- `git status` - Show working tree status
- `git log` - Show commit history
- `git diff` - Show changes
- `git show` - Show various types of objects

**Security:** Only read-only commands are permitted. No write operations.

**Example:** Check the current git status

---

### create_pr_from_local_changes

Create a complete pull request from local changes in a single call. Automatically fetches Jira issue details to populate the PR title and body.

**Parameters:**

- `issueKey` (string) - Jira issue key (e.g., "DEV-8") — used to fetch title and summary
- `branchName` (string) - Name for the new branch (must end with -YYYYMMDD-HHMM timestamp)
- `owner` (string) - GitHub repository owner
- `repo` (string) - GitHub repository name
- `base` (string, default: "main") - Target branch for the PR

**Use Cases:**

- Creating PRs with one command
- Automating the full commit → push → PR workflow

**Example:** Create a PR for DEV-8 with timestamped branch

**Smart Features:**

- Auto-fetches Jira summary for PR title and body
- Creates branch with unique timestamp
- Commits all staged changes
- Pushes to GitHub
- Creates pull request via GitHub API
- Returns PR URL

---

### github_create_pull_request

Create a pull request on GitHub (for existing branches).

**Parameters:**

- `owner` (string) - Repository owner
- `repo` (string) - Repository name
- `title` (string) - PR title
- `body` (string) - PR description
- `head` (string) - Source branch
- `base` (string) - Target branch (usually "main" or "master")

**Use Cases:**

- Creating PR from existing branch
- Manual PR creation
- Custom PR workflows

**Example:** Create a PR from feature branch to main

---

### github_get_file_contents

Read file or directory contents from a GitHub repository.

**Parameters:**

- `owner` (string) - Repository owner
- `repo` (string) - Repository name
- `path` (string) - File or directory path in the repo

**Use Cases:**

- Reading files from GitHub
- Checking repository structure
- Comparing local vs remote files

**Example:** Read README.md from the repository

---

### github_search_code

Search for code or files in a GitHub repository.

**Parameters:**

- `owner` (string) - Repository owner
- `repo` (string) - Repository name
- `query` (string) - Search query (e.g., "filename:.spec.ts")

**Use Cases:**

- Finding specific files in repository
- Searching for code patterns
- Locating test files or configurations

**Example:** Find all test files in the repository

---

### github_search_issues

Search GitHub issues and pull requests.

**Parameters:**

- `query` (string) - Search query (e.g., "repo:owner/name is:pr")

**Use Cases:**

- Finding existing PRs
- Checking if branch name already exists
- Searching for related issues

**Example:** Check if a PR with this branch name already exists

---

## Test Tools

### run_test_command

Run test commands in a specific directory of the workspace.

**Parameters:**

- `command` (string) - Test command to execute (e.g., "yarn test", "npm test")
- `workingDir` (string, optional) - Directory to run tests in (e.g., "backend", "frontend")

**Use Cases:**

- Running unit tests after code changes
- Verifying test files after moving them
- Checking that changes don't break existing tests
- Validating new features

**Allowed Commands:**

- `yarn test` - Run tests with Yarn
- `npm test` - Run tests with npm
- `pnpm test` - Run tests with pnpm
- `npm run test` - Alternative npm syntax
- `yarn run test` - Alternative Yarn syntax

**Security:** Only whitelisted test commands are permitted. No arbitrary shell execution.

**Example:** Run tests in the backend directory after moving test files

**Output:** Returns test results including pass/fail counts and error messages

---

## Knowledge Tools

### search_internal_knowledge

Search the RAG vector database for internal documentation and guidelines.

**Parameters:**

- `query` (string) - Natural language search query

**Use Cases:**

- Finding information about how to use the agent
- Looking up best practices and tips
- Understanding agent capabilities
- Learning how to build custom tools
- Comparing model performance

**Knowledge Sources:**

- Agent overview and capabilities
- Tips and tricks for usage
- Tool building guide
- Model configuration and comparison
- Company coding guidelines

**Example:** Search for information about creating custom tools

**Returns:** Top 3 most relevant text chunks from the documentation

---

## Tool Usage Patterns

### Sequential Workflows

**Task Assignment Flow:**

1. `jira_list_all_issues` - Find unassigned tasks
2. `jira_assign_issue` - Assign to yourself
3. `jira_transition_issue` - Move to "In Progress"

**File Move and Test Flow:**

1. `move_local_file` - Move test file to new location
2. `run_test_command` - Verify tests still pass
3. If pass → Continue
4. If fail → Fix imports and retry

**PR Creation Flow:**

1. Use Current Timestamp from context (pre-generated for each request)
2. Build branch name with timestamp (e.g., `"feat/DEV-8-fix-" + currentTimestamp`)
3. `create_pr_from_local_changes` - fetches Jira details internally, creates branch, commits, pushes, and opens the PR in one call
4. PR URL is returned directly

### Tool Combinations

**Code Search and Edit:**

1. `search_and_read_files` - Find files with keyword
2. `read_local_file` - Read specific file
3. `replace_lines_in_file` - Make targeted edits

**Directory Exploration:**

1. `list_local_directory` - See what's in a folder
2. `search_local_files` - Find files by extension
3. `read_local_file` - Read specific files

## Security and Constraints

### Filesystem Tools

- All operations restricted to `WORKSPACE_DIR`
- Cannot access files outside workspace
- Path validation on every operation

### Git Commands

- Only read-only commands allowed
- No destructive operations (force push, delete, etc.)
- Safe for automated execution

### Test Commands

- Whitelisted commands only (yarn test, npm test, pnpm test)
- No arbitrary shell execution
- Limited to test runners

### GitHub Tools

- Requires valid GitHub Personal Access Token
- Respects repository permissions
- API rate limits apply

## Tips for Effective Tool Usage

1. **Always verify before acting** - Use read tools before write tools
2. **Test after changes** - Run tests after moving or editing files
3. **Use sequential operations** - Break complex tasks into simple tool calls
4. **Check tool responses** - Verify success before proceeding
5. **Leverage search tools** - Find information before making assumptions
