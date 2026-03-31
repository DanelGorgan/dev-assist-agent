# DevOps AI Agent - Overview

## Purpose

The DevOps AI Agent is an autonomous assistant that integrates with your development workflow to help manage tasks, code changes, and deployments. It bridges the gap between Jira task management, local filesystem operations, and GitHub pull requests.

## Core Capabilities

### 1. Jira Integration
- List unassigned tasks from your project
- Assign tasks to yourself or team members
- Move tasks through workflow states (To Do → In Progress → Review → Done)
- Fetch task details and descriptions
- Case-insensitive status matching (e.g., "done", "Done", "DONE" all work)

### 2. Filesystem Operations
- Read, write, and edit local files
- Move files with automatic import path updates
- Search for files by extension or keyword
- Delete files safely within workspace boundaries
- Smart relative import resolution (works for any directory structure)

### 3. GitHub Integration
- Create branches with unique timestamp-based names
- Commit and push local changes
- Create pull requests with meaningful descriptions
- Auto-populate PR details from Jira issues
- Search code and issues in repositories

### 4. Test Execution
- Run tests in specific directories (backend/, frontend/, etc.)
- Verify test files after moving them
- Report detailed test results (pass/fail counts, error messages)
- Support for yarn, npm, and pnpm test commands

## Key Features

### AI Self-Reflection
The agent uses self-reflection principles to:
- Think before acting (understand the task purpose)
- Verify tool responses (never hallucinate success)
- Learn from errors (retry with different approaches)
- Reason about changes (explain what and why)

### Smart Branch Management
- Automatic timestamp suffixes guarantee unique branch names
- Format: `feat/DEV-X-description-YYYYMMDD-HHMM`
- No more "branch already exists" errors
- Never requires retry logic

### Meaningful Pull Requests
PRs include:
- Jira issue summary in title (auto-fetched from Jira)
- Summary in body
- List of changes made
- "Closes DEV-X" reference for automatic linking

### Workflow Flexibility
Unlike rigid multi-step workflows, the agent executes single commands independently:
- "Are there unassigned tasks?" → Lists tasks
- "Assign DEV-8 to me" → Assigns task
- "Move DEV-8 to in progress" → Updates status
- "Run tests" → Executes test suite
- "Create PR" → Creates pull request

You control the order and pace.

## Current LLM Configuration

### Llama 3.1 (Default - Local)
- **Status**: Currently active
- **Performance**: Limited tool-calling reliability
- **Pros**: Free, runs locally, privacy-focused
- **Cons**: May require multiple attempts for complex multi-tool operations
- **Best for**: Simple single-action commands

### Google Gemini (Recommended)
- **Status**: Available via toggle
- **Performance**: Infinitely better tool-calling and reasoning
- **Pros**: Superior accuracy, better multi-step planning, excellent at following instructions
- **Cons**: Requires API key, cloud-based
- **Best for**: Complex workflows, creating PRs, managing multiple tasks

### Switching Models
Set in `backend/.env`:
```bash
# Use Gemini (recommended)
USE_GEMINI=true

# Use local Llama
USE_GEMINI=false
OLLAMA_MODEL=llama3.1
```

Other tested models:
- `qwen2.5:7b` - Better than llama3.1 for tool calling
- `llama3.1` - Baseline local option

## Architecture

### Model Context Protocol (MCP)
The agent uses MCP servers to interact with external services:
- **GitHub MCP**: Repository operations, PR management
- **Jira MCP**: Issue tracking, status transitions
- **Filesystem MCP**: Local file operations, git commands

### Tool Categories
1. **Jira Tools** (`JiraToolsProvider`) — 8 tools
2. **GitHub Tools** (`GithubToolsProvider`) — 10 tools
3. **Filesystem Tools** (`FilesystemToolsProvider`) — 9 tools
4. **Test Tools** (`TestToolsProvider`) — 1 tool
5. **Knowledge Tool** (`search_internal_knowledge`) — 1 tool (RAG via `nomic-embed-text` + pgvector)

All tools are dynamically loaded and injected into the LLM context.

## Security Features

- Workspace boundaries enforced (no access outside WORKSPACE_DIR)
- Git commands restricted to read-only operations
- Test commands limited to safe test runners
- No arbitrary shell command execution
- All file operations validated before execution

## Getting Started

1. Configure environment variables (`.env`)
2. Set Jira credentials and project key
3. Set GitHub personal access token
4. Choose your LLM (Gemini recommended)
5. Start chatting with the agent

Example first commands:
- "Are there unassigned tasks?"
- "Assign DEV-8 to me and move it to in progress"
- "Get details for DEV-8"
- "Run tests in backend"

