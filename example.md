# DevAssist Agent capstone Proposal

### 1. Requirements Analysis
This capstone project requires evolving a standard RAG chatbot into an autonomous **AI-Agentic System** capable of reasoning, taking actions, and reflecting on its outputs. 

**Core Agentic Components:**
- **Data Preparation & RAG**: Contextual data stored and retrieved via vector search.
- **Tool-Calling Mechanisms**: The agent determines when to trigger external actions (e.g., executing an MCP tool).
- **Reasoning & Reflection**: The agent analyzes outputs, logs, or metrics to self-correct before giving a final answer.
- **Evaluation**: Mechanism to measure the agent's accuracy and reliability.

**Academy Deliverables:**
- **Public GitHub Repo** with source code, a `README.md`, and an `architecture.mmd` (Mermaid architectural diagram).
- **Demo Video** (~5 mins) showcasing the CI/CD fix automation tool-calling.
- **Submission Form** with the attached public links.

---

### 2. Proposed Use Case: "DevAssist Agent"
The DevAssist Agent acts as an autonomous DevOps and engineering assistant. It monitors pipelines, diagnoses failures, creates tracking tickets, and proposes automated fixes.

* **Domain**: CI/CD Pipeline Monitoring, PR Automation, and Issue Tracking.
* **Knowledge Base (RAG)**: Internal coding standards, architecture guidelines, and previous post-mortems stored in your local PostgreSQL DB.
* **MCP Integrations**:
  * **GitHub MCP**: Read repositories, fetch pull requests, monitor GitHub Actions workflow runs, and dynamically create new PRs with proposed code fixes.
  * **JIRA MCP**: Create tasks or bug tickets automatically when an issue is identified.
  * **PostgreSQL MCP**: Allow the agent to query database schemas or application metrics.
  * **Filesystem MCP**: Inspect local project structures, documentation, and specific file logs.

**Workflow Example:**
1. **Detection**: The agent detects a failing test step in a PR's GitHub Actions workflow.
2. **Analysis**: The agent fetches the failure logs via the GitHub MCP and analyzes them to identify the root cause.
3. **Tracking**: The agent uses the JIRA MCP to create a ticket documenting the issue and its findings.
4. **Resolution**: The agent proposes a code fix based on the repo context and creates a PR with the solution.
5. **Verification**: The agent monitors the newly created PR's pipeline to verify that the fix successfully runs.

**Example Queries**:
1. *"Check the latest GitHub Actions run on the `main` branch. Identify any failing steps and create a JIRA ticket for them."*
2. *"Can you analyze the logs for the failing CI pipeline on PR #42, find the root cause, create a JIRA issue, and open a PR with the proposed fix?"*
3. *"What is our standard error-handling protocol according to the internal docs?"*

---

### 3. High-Level Architecture Overview
1. **Frontend (React)**: 
   - A chat interface that displays real-time status indicators when the agent is "Analyzing Logs", "Creating JIRA Ticket", or "Drafting PR".
2. **Backend (Node.js/NestJS + LangChain)**: 
   - Receives the prompt and orchestrates the LangChain `AgentExecutor` (powered by the Gemini API or a local Ollama model).
   - Provides the agent with a suite of defined Tools (RAG retriever, GitHub MCP, JIRA MCP).
3. **Database (PostgreSQL + pgvector in Docker)**: 
   - Stores chunked document embeddings for the internal knowledge base.
4. **Reflection Loop**: 
   - Before submitting a PR, the agent uses a reflection prompt to double-check if the proposed code fix directly addresses the exact error found in the CI logs and adheres to the coding standards retrieved via RAG.

---

### 4. Step-by-Step Implementation Plan

#### Phase 1: Environment & Infrastructure
- [ ] Set up the monorepo structure (React frontend, NestJS backend).
- [ ] Create a `docker-compose.yml` that provisions PostgreSQL with the `pgvector` extension.
- [ ] Configure environment variables for LangChain, LLM API keys, JIRA tokens, GitHub Personal Access Tokens, and database connections.

#### Phase 2: Data Ingestion (RAG Setup)
- [ ] Gather markdown files representing your coding standards and documentation.
- [ ] Write a NestJS script using LangChain document loaders/splitters to chunk data.
- [ ] Generate embeddings and save them into the PostgreSQL pgvector tables.

#### Phase 3: Agent & Tool Creation (Backend)
- [ ] Initialize the LangChain Agent in NestJS.
- [ ] **Create Tool 1 (RAG)**: Searches pgvector for relevant standard practices.
- [ ] **Create Tool 2 (GitHub Explorer)**: Integrates GitHub MCP to fetch CI/CD logs, inspect files, and read PRs.
- [ ] **Create Tool 3 (JIRA Integration)**: Integrates JIRA MCP to generate detailed bug tickets.
- [ ] **Create Tool 4 (PR Creator)**: Uses GitHub MCP to mutate the repository state (branch creation, commit, open PR).

#### Phase 4: Reasoning & Reflection Loop
- [ ] Implement self-reflection logic (e.g., using LangGraph or an internal critique prompt). The agent must verify its proposed fix against the CI logs and coding standards before executing the PR Creator tool.

#### Phase 5: Frontend Interface
- [ ] Build the React chat UI. Ensure it visually handles tool-calling streams so you can show the mentors exactly *how* the agent is reasoning through each automated CI/CD step.

#### Phase 6: Final Deliverables & Polish
- [ ] Write the `README.md` and design the `architecture.mmd` file.
- [ ] Record the 5-minute video demonstrating the workflow: a failing action -> log analysis -> JIRA ticket creation -> automated PR with fix.
