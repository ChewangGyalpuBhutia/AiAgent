# 🧠 AI Agent Server - Pluggable RAG System

A TypeScript-based AI Agent server with Retrieval-Augmented Generation (RAG), session memory, and extensible plugin system. Built for the Backend AI Agent internship assignment.

## 🚀 Features

- **AI-Powered Chat**: Session-based conversations using Google Gemini 2.0 Flash
- **RAG (Retrieval-Augmented Generation)**: Vector search over markdown documents using Pinecone
- **Plugin System**: Extensible plugin architecture (Weather plugin included)
- **Session Memory**: Persistent conversation history per session
- **Local Embeddings**: Uses Xenova/all-MiniLM-L6-v2 for document vectorization
- **TypeScript**: Fully typed codebase with proper error handling

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   User Query    │───▶│ Agent Server │───▶│  Gemini API     │
└─────────────────┘    └──────┬───────┘    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Vector Store    │
                    │ (Pinecone)      │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Plugin System   │
                    │ (Weather, etc.) │
                    └─────────────────┘
```

### Request Flow
1. **Message Reception**: `/agent/message` endpoint receives user query and session ID
2. **Memory Retrieval**: Last 2 messages from session memory loaded
3. **Vector Search**: Top 3 relevant document chunks retrieved from Pinecone
4. **Plugin Detection**: Message analyzed for plugin triggers (weather, math, etc.)
5. **Context Assembly**: Memory + documents + plugin results combined
6. **AI Generation**: Gemini generates response with full context
7. **Memory Storage**: User message and AI response stored in session

## 📋 Prerequisites

- Node.js 18+
- TypeScript
- Pinecone account and API key
- Google Gemini API key

## 🛠️ Setup

### 1. Clone and Install
```bash
git clone <repository-url>
cd AiAgent
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
PINECONE_API_KEY=your_pinecone_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
```

### 3. Prepare Documents
Ensure your `documents/` folder contains markdown files. The system will automatically:
- Chunk documents into 500-character segments
- Generate embeddings using all-MiniLM-L6-v2
- Store in Pinecone vector database

### 4. Run the Server
```bash
# Development mode with auto-reload
npm run dev

```

The server will initialize the vector store on first run (may take 1-2 minutes).

## 📡 API Usage

### Chat with AI Agent
```bash
# Basic chat
curl -X POST http://localhost:3000/agent/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tell me about Blogging With Markdown: All You Need to Know",
    "session_id": "123"
  }'

# Follow-up with memory
curl -X POST http://localhost:3000/agent/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "can you elaborate on Tell me about Blogging With Markdown: All You Need to Know",
    "session_id": "123"
  }'

# Weather plugin trigger
curl -X POST http://localhost:3000/agent/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the weather in Bangalore?",
    "session_id": "123"
  }'
```

### Response Format
```json
{
  "response": "Based on the documents I have, markdown is a lightweight markup language..."
}
```

### Error Responses
```json
{
  "error": "Both message and session_id are required"
}
```

## 🔌 Plugin System

### Current Plugins
- **Weather Plugin**: Triggered by mentions of "weather" in user messages
- Returns mock weather data (can be extended with real API)

### Adding New Plugins
1. Add plugin function to the `plugins` object in `agent-server.ts`:
```typescript
const plugins = {
  weather: async (location: string) => `Weather in ${location}: 24°C, Sunny`,
  math: async (expression: string) => {
    // Math evaluation logic
    return `Result: ${eval(expression)}`;
  }
};
```

2. Update the `detectPlugin` function:
```typescript
const detectPlugin = (message: string) => {
  if (message.toLowerCase().includes('weather')) return 'weather';
  if (message.toLowerCase().includes('calculate')) return 'math';
  return null;
};
```

## 📊 Vector Store Details

- **Embedding Model**: Xenova/all-MiniLM-L6-v2 (384 dimensions)
- **Vector Database**: Pinecone (serverless, AWS us-east-1)
- **Chunk Size**: 500 characters
- **Similarity Metric**: Cosine similarity
- **Retrieval**: Top 3 most relevant chunks per query

## 🗃️ Session Memory

- **Storage**: In-memory (resets on server restart)
- **Capacity**: Last 2 messages per session for context
- **Format**: `{ role: 'user' | 'assistant', content: string }`

## 📝 System Prompts

The agent uses carefully crafted system prompts that include:
```
You are a helpful AI assistant that answers questions based on the provided context.
Guidelines:
1. Be concise but helpful
2. Use the context when relevant
3. If you used a tool/plugin, mention it
4. Maintain a friendly tone
```

Context includes:
- Relevant document chunks
- Plugin outputs
- Conversation history

## 🚀 Deployment

### Vercel Deployment
```bash
npm install -g vercel
vercel

# Set environment variables in Vercel dashboard
```

### Railway Deployment
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway init
railway up
```

## 🧪 Testing Examples

### Document Knowledge
```bash
curl -X POST https://your-deployed-url.com/agent/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I create a markdown blog?",
    "session_id": "test123"
  }'
```

### Plugin Usage
```bash
curl -X POST https://your-deployed-url.com/agent/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Check weather in Mumbai",
    "session_id": "test123"
  }'
```

### Memory Test
```bash
# First message
curl -X POST https://your-deployed-url.com/agent/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "My name is John",
    "session_id": "memory_test"
  }'

# Follow-up
curl -X POST https://your-deployed-url.com/agent/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What did I just tell you?",
    "session_id": "memory_test"
  }'
```

## 🛡️ Error Handling

- **Graceful API Failures**: Fallback responses when external APIs fail
- **Validation**: Request body validation for required fields
- **Logging**: Comprehensive error logging and debugging information
- **Type Safety**: Full TypeScript coverage prevents runtime errors

## 📁 Project Structure

```
AiAgent/
├── src/
│   ├── agent-server.ts     # Main Express server and agent logic
│   └── vectorStore.ts      # Pinecone integration and embeddings
├── documents/              # Markdown files for RAG
│   ├── daext-blogging-with-markdown-complete-guide.md
│   ├── john-apostol-custom-markdown-blog.md
│   ├── just-files-nextjs-blog-with-react-markdown.md
│   ├── webex-boosting-ai-performance-llm-friendly-markdown.md
│   └── wikipedia-lightweight-markup-language.md
├── package.json
├── tsconfig.json
├── vercel.json
├── README.md
└── NOTES.md
```

## 🔧 Configuration

### TypeScript Configuration
- ES modules enabled
- Strict type checking
- Target: ES2022

### Vercel Configuration
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install"
}
```

## 🚨 Known Limitations

1. **Memory Storage**: In-memory session storage (not persistent)
2. **Plugin Detection**: Simple keyword-based detection
3. **Rate Limiting**: No built-in rate limiting
4. **Authentication**: No authentication system
5. **Batch Processing**: Documents processed sequentially

## 🔮 Future Enhancements

- [ ] Persistent session storage (Redis/Database)
- [ ] Advanced plugin intent detection using NLP
- [ ] Rate limiting and authentication
- [ ] Streaming responses
- [ ] Multi-modal support (images, PDFs)
- [ ] Plugin marketplace
- [ ] Performance monitoring
- [ ] Caching layer for embeddings

## 📄 License

MIT License - see LICENSE file for details.
