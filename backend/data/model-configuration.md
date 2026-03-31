# Model Configuration and Comparison

## Supported Models

### 1. Google Gemini (Recommended)

**Model:** `gemini-2.5-pro` (chat/reasoning)
**Embeddings:** `nomic-embed-text` via Ollama (local)

**Performance:**
- ✅ **Infinitely better** than local Llama models
- ✅ Superior tool-calling accuracy
- ✅ Better multi-step reasoning
- ✅ Follows complex instructions precisely
- ✅ Handles edge cases gracefully

**Configuration:**
```bash
# backend/.env
USE_GEMINI=true
GOOGLE_API_KEY=your_gemini_api_key
```

**Pros:**
- Extremely reliable for PR creation
- Handles complex multi-tool workflows
- Better at understanding context
- Generates meaningful PR descriptions
- Rarely hallucinates success

**Cons:**
- Requires API key (get from Google AI Studio)
- Cloud-based (privacy consideration)
- Usage costs (though generous free tier)

**Best For:**
- Production use
- Creating pull requests
- Complex file refactoring
- Multi-step workflows
- Demos and presentations

**Cost:** 
- Free tier: 60 requests/minute
- Paid: ~$0.001 per 1000 characters

### 2. Llama 3.1 (Local - Default)

**Model:** `llama3.1` (8B parameters)

**Performance:**
- ⚠️ Limited tool-calling reliability
- ⚠️ May require multiple attempts
- ⚠️ Struggles with complex multi-tool operations
- ✅ Works for simple commands
- ✅ Privacy-focused (runs locally)

**Configuration:**
```bash
# backend/.env
USE_GEMINI=false
OLLAMA_MODEL=llama3.1
```

**Pros:**
- Completely free
- Runs locally via Ollama
- No API key needed
- No usage limits
- Privacy-preserving

**Cons:**
- Tool calling is unreliable
- May not follow complex instructions
- Slower for multi-step operations
- Sometimes ignores system prompt rules

**Best For:**
- Testing and development
- Simple single-action commands
- When privacy is critical
- Learning and experimentation

**Requirements:**
- Ollama installed locally
- ~4-8GB RAM

### 3. Qwen 2.5 (Local - Partial Alternative)

**Model:** `qwen2.5:7b`

**Performance:**
- ✅ Better at generating summaries and step-by-step reasoning than Llama
- ⚠️ Still fails on multi-step tool-calling chains
- ⚠️ Not reliable enough for end-to-end workflows like PR creation
- ✅ Good for knowledge queries and planning responses

**Configuration:**
```bash
# backend/.env
USE_GEMINI=false
OLLAMA_MODEL=qwen2.5:7b
```

**Pros:**
- Better tool-calling than Llama
- Still runs locally
- Free and private
- Smaller model size

**Best For:**
- Knowledge queries and descriptive responses
- When privacy is critical and Gemini is unavailable
- Avoid for multi-tool action workflows

## Switching Models

### At Runtime
```bash
# Edit backend/.env
USE_GEMINI=true  # or false

# Restart backend
cd backend
yarn start:dev
```

### Dynamic Model Selection

You can even build a tool to switch models:
```typescript
new DynamicStructuredTool({
  name: 'switch_model',
  description: 'Switch between Gemini and local Llama',
  schema: z.object({
    useGemini: z.boolean(),
  }),
  func: async (args) => {
    process.env.USE_GEMINI = args.useGemini.toString();
    return `Switched to ${args.useGemini ? 'Gemini' : 'Llama'}. Restart required.`;
  },
}),
```

## Model Comparison Table

| Feature | Gemini 2.5 Pro | Llama 3.1 | Qwen 2.5 |
|---------|----------------|-----------|----------|
| Tool Calling | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| Instruction Following | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| Summarisation / Reasoning | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| Speed | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Cost | Free/Paid | Free | Free |
| Privacy | Cloud | Local | Local |
| PR Creation | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| Multi-tool Workflows | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| Reliability | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

## Real-World Performance

### PR Creation Reliability (empirical observation)
- **Gemini 2.5 Pro**: High reliability — handles multi-tool workflows in a single turn
- **Qwen 2.5**: Good at generating summaries and step-by-step reasoning, but still fails on multi-step tool-calling chains
- **Llama 3.1**: Limited — struggles beyond 2 sequential tool calls; use single-action commands

### Branch Naming Compliance
- **Gemini**: Always includes timestamp
- **Qwen 2.5**: Usually includes timestamp
- **Llama 3.1**: Often forgets timestamp, causing failures

### Multi-Step Commands
Example: "Assign DEV-8 to me and move it to in progress"
- **Gemini**: Executes both steps correctly
- **Qwen 2.5**: May execute only one step
- **Llama 3.1**: May simulate instead of calling tools

## Optimization Tips

### For Gemini
- Use detailed system prompts
- Trust the model to handle complex workflows
- Less hand-holding needed

### For Local Models (Llama/Qwen)
- Keep commands simple and atomic
- One action per message
- Use explicit, direct language
- Verify outputs manually
- Add more examples in system prompt

## Future Models

### Potential Additions
- **Claude** (Anthropic API via `@langchain/anthropic`)
- **GPT-4o** (OpenAI API)
- **Llama 3.2** (via Ollama — already available)
- **Mistral** (via Ollama)

### Adding a New Model

```typescript
// backend/src/app.service.ts

const modelConfig = {
  gemini: () => new ChatGoogleGenerativeAI({
    modelName: 'gemini-2.0-flash',
  }),
  llama: () => new ChatOllama({
    model: this.configService.get('OLLAMA_MODEL'),
  }),
};

const useModel = this.configService.get('USE_GEMINI') === 'true' ? 'gemini' : 'llama';
this.model = modelConfig[useModel]();
```

## Recommendation

**For Production:**
Use **Gemini** - it's worth the minimal cost for the reliability and time saved.

**For Development / Knowledge Queries:**
Use **Qwen 2.5** - better reasoning and summaries than Llama, but avoid for multi-tool action workflows.

**For Simple Queries:**
Any model works fine for basic commands like "tasks?" or "what is DEV-8?".

## Getting Started with Gemini

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Add to `backend/.env`:
```bash
GOOGLE_API_KEY=your_key_here
USE_GEMINI=true
```
4. Restart backend
5. Enjoy reliable automation! 🎯

