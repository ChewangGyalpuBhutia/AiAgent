# 📝 Development Notes

## What Was AI-Generated vs Hand-Written

### 🤖 AI-Generated (~60%)
- Express server boilerplate and route setup
- Pinecone client initialization and basic vector operations
- TypeScript config and package.json dependencies
- Initial Gemini API integration (heavily modified later)
- Basic text chunking and embedding pipeline

### ✋ Hand-Written (~40%)
- Plugin detection and execution system
- Session memory management with message history
- Context assembly logic (combining memory + documents + plugins)
- System prompt engineering for RAG
- Complete error handling and edge case management
- Request flow orchestration

## 🐛 Key Bugs and Solutions

1. **Pinecone Index Timing**: Added 60-second wait after index creation for serverless initialization
2. **Gemini API Parsing**: Added defensive parsing with `?.` operators to prevent crashes
3. **ES Modules Setup**: Configured proper TypeScript + ES modules in package.json 
4. **Model Loading Performance**: Implemented singleton pattern to cache embedding model
5. **Context Length Limits**: Reduced chunks to 500 chars, limited to top 3 results

## 🏗️ Agent Flow

### Request Pipeline
```
POST /agent/message → Session Memory → Vector Search → Plugin Detection → 
Context Assembly → Gemini API → Response Storage → Return
```

### Plugin System
- **Detection**: Simple keyword matching ("weather" triggers weather plugin)
- **Execution**: Async plugin functions return results
- **Integration**: Plugin outputs injected into LLM context

### Memory Management  
- In-memory storage per session_id
- Keeps last 2 messages for context
- Simple but effective for demo purposes

### Vector Store
- Pinecone serverless with 384-dim embeddings
- Local all-MiniLM-L6-v2 model for consistency
- 500-char chunks, top-3 retrieval

## 🚀 Tech Choices

**Pinecone vs ChromaDB**: Chose Pinecone for hosted solution, no infrastructure setup
**Gemini vs OpenAI**: Gemini 2.0 Flash for cost efficiency and speed  
**Local Embeddings**: all-MiniLM-L6-v2 for cost control and privacy
**In-Memory Sessions**: Simple development, not production-scalable (known trade-off)
