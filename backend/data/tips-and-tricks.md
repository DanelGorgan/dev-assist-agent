# DevOps AI Agent - Tips & Tricks

## Getting the Best Results

### 1. Use Clear, Direct Commands
**Good:**
- "Assign DEV-8 to me"
- "Move DEV-8 to in progress"
- "Run tests in backend"
- "Create PR for DEV-8"

**Avoid:**
- "Can you maybe try to assign the task if possible?"
- "I think we should probably move this to done"

### 2. Use Gemini for Complex Operations
Switch to Gemini in `.env` for:
- Creating pull requests (much more reliable)
- Multi-step workflows
- Complex file operations
- When you need it to "just work"

```bash
USE_GEMINI=true
```

Llama is fine for:
- Simple queries ("tasks?", "what is DEV-8?")
- Single file operations
- Basic status checks

### 3. Case-Insensitive Commands
All of these work:
- "move to done" / "move to Done" / "move to DONE"
- "in progress" / "In Progress" / "IN PROGRESS"
- "review" / "Review" / "REVIEW"

### 4. Branch Names Are Auto-Generated
Don't specify branch names manually. The agent:
- Fetches the Jira issue summary
- Creates a descriptive name
- Adds a timestamp for uniqueness
- Example: `feat/DEV-8-move-tests-20260329-2041`

### 5. Verify Tests After Moving Files
Best practice workflow:
```
You: Move src/app.controller.spec.ts to test/app.controller.spec.ts
Agent: [Moves file, updates imports] Would you like me to run tests?
You: Yes
Agent: [Runs tests, reports results]
```

### 6. Single Action Commands
The agent works best with one command at a time:
```
✅ "Assign DEV-8 to me"
✅ "Move DEV-8 to in progress"
✅ "Create PR"

❌ "Assign DEV-8 to me, move it to in progress, run tests, and create a PR"
```

Exception: Some combined commands are supported:
- "Assign DEV-8 to me and move it to in progress" ✅

### 7. Check Work Before Creating PRs
Recommended flow:
1. Make changes (move files, edit code)
2. Run tests: "Run tests in backend"
3. Review changes: "Show me what changed"
4. Create PR: "Create PR"

### 8. Meaningful PR Descriptions
The agent auto-generates everything from the Jira issue:
- Title from Jira issue summary
- Body with summary and list of changes
- "Closes DEV-X" reference for automatic issue linking

No need to specify these manually!

### 9. Use Shortcuts
Quick commands:
- "tasks?" → List unassigned tasks
- "what is DEV-8?" → Get issue details
- "done" (after context) → Mark current task as done

### 10. Error Handling
If something fails:
- The agent will report the actual error (never hallucinate success)
- Try rephrasing the command
- Check if you're using Gemini (more reliable)
- Verify your environment variables are set correctly

## Common Workflows

### Starting a New Task
```
1. "tasks?" → See available work
2. "assign DEV-8 to me" → Take ownership
3. "move DEV-8 to in progress" → Update status
4. "what is DEV-8?" → Read requirements
```

### Making Changes
```
1. Edit files locally (in your IDE)
2. "Run tests" → Verify changes work
3. Review output
4. Fix any failures
```

### Creating a PR
```
1. "Create PR for DEV-8"
Agent will:
   - Fetch Jira issue details
   - Generate timestamp branch name
   - Create branch and commit
   - Push to GitHub
   - Create pull request
   - Return PR URL
```

### Moving Test Files
```
1. "Move src/app.spec.ts to test/app.spec.ts"
Agent will:
   - Move the file
   - Update import paths automatically
   - Suggest running tests
2. "yes" → Confirms test run
3. Agent runs tests and reports results
```

## Performance Tips

### Faster Responses with Llama
- Keep questions simple
- One action per message
- Use exact status names from Jira

### More Reliable with Gemini
- Complex multi-tool operations
- Better reasoning and planning
- Follows instructions more precisely
- Handles edge cases better

## Troubleshooting

### "Branch already exists"
- This should never happen with the new timestamp system
- If it does, the agent will auto-retry with a new timestamp
- Check that you're using the latest prompt version

### "Tests not found"
- Verify `workingDir` is correct
- For backend: `workingDir: "backend"`
- For frontend: `workingDir: "frontend"`
- For root: omit `workingDir` or use `"."`

### "Import paths broken after move"
- The agent uses `path.relative()` to calculate correct paths
- Works for any directory move (src→test, test→src, etc.)
- If imports are wrong, check the file was moved correctly

### "Jira transition failed"
- Verify the status exists in your workflow
- Check you have permission to transition
- Use case-insensitive names ("done" not "Done")

## Pro Tips

1. **Batch similar tasks**: Assign and move status in one command
2. **Always test after refactoring**: Use "run tests" frequently
3. **Let the agent name branches**: It's better at it than you think
4. **Trust but verify**: Review PR descriptions before merging
5. **Use Gemini for demos**: It's impressive and reliable
6. **Keep workspace tidy**: Agent works within WORKSPACE_DIR only
7. **Check tool results**: Agent never lies about success/failure

