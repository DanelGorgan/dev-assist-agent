# Ciklum AI Academy - Mock Architecture Guidelines

## 1. Objective
All agents developed at the Ciklum AI Academy must be self-reflective, maintain clear context boundaries, and effectively use vector databases (like pgvector) to inform their reasoning.

## 2. Engineering Standards
- **Error Handling**: Use structured try-catch blocks and log descriptive error messages. Agents should wrap tool calls cleanly to avoid crashing the server if an MCP server or LLM endpoint fails.
- **RAG Architecture**: Documents must be grouped, chunked via `RecursiveCharacterTextSplitter`, and embedded into a Vector Database. The agent must retrieve at least 3 matching chunks for any analytical response query.

## 3. Deployment
- Use Docker Compose locally.
- Services must gracefully restart unless manually stopped.
- Connect to port 5433 to avoid standard port collisions on macOS/Windows setups.
