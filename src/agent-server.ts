import express from 'express';
import bodyParser from 'body-parser';
import { initializeVectorStore, getRelevantChunks } from './vectorStore.js';
import dotenv from 'dotenv';
dotenv.config();

// Configuration
const PORT = process.env.PORT || 3000;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log(`GEMINI_API_KEY: ${GEMINI_API_KEY ? 'Set' : 'Not Set'}`);

// Initialize Express
const app = express();
app.use(bodyParser.json());

// Session memory
const sessionMemory: Record<string, Array<{ role: string; content: string }>> = {};

// Helper functions
const getSessionMessages = (sessionId: string) => sessionMemory[sessionId] || [];
const addMessageToSession = (sessionId: string, message: { role: string; content: string }) => {
  sessionMemory[sessionId] = [...(sessionMemory[sessionId] || []), message];
};

// Plugins
const plugins = {
  weather: async (location: string) => `Weather in ${location}: 24°C, Sunny`,
};

const detectPlugin = (message: string) => {
  try {
    if (message.toLowerCase().includes('weather')) return 'weather';
    return null;
  } catch (error) {
    console.log(error)
    return null
  }

};

// Gemini API call for RAG
const generateWithGemini = async (prompt: string, message: string, context: string): Promise<string> => {
  try {
    const response = await fetch(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `${prompt}\n\n${context}` },
              { text: `Question: ${message}` }
            ]
          }],
          generationConfig: {
            temperature: 0.3,
            topP: 0.95,
            maxOutputTokens: 1024
          }
        })
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Gemini API error:', response.status, errorBody);
      return "Sorry, I'm having trouble generating a response right now.";
    }

    const data = await response.json();
    console.log(data)

    // Improved response extraction
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      console.error('Unexpected Gemini response format:', JSON.stringify(data, null, 2));
      return "I received an unexpected response format from the AI service.";
    }

    return generatedText;
  } catch (error) {
    console.error('Gemini API request failed:', error);
    return "Sorry, I encountered an error while generating a response.";
  }
};

// Generate RAG response
const generateRAGResponse = async (message: string, sessionId: string): Promise<string> => {
  try {
    // 1. Get relevant document chunks
    const relevantChunks = await getRelevantChunks(message, 3);

    // 2. Get conversation history
    const sessionMessages = getSessionMessages(sessionId);
    const lastTwoMessages = sessionMessages.slice(-2);

    // 3. Check for plugin execution
    const pluginType = detectPlugin(message);
    console.log(pluginType)
    const pluginResult = pluginType ? await plugins[pluginType](message) : null;

    // 4. Build context
    const contextParts = [];

    if (relevantChunks.length > 0) {
      contextParts.push('Relevant Documents:');
      relevantChunks.forEach((chunk, i) => {
        contextParts.push(`[Document ${i + 1} from ${chunk.source}]: ${chunk.content}`);
      });
    }

    if (pluginResult) {
      contextParts.push(`Plugin Output: ${pluginResult}`);
    }
    console.log("dfdf",contextParts)

    if (lastTwoMessages.length > 0) {
      contextParts.push('Conversation History:');
      lastTwoMessages.forEach(msg => {
        contextParts.push(`${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`);
      });
    }

    const context = contextParts.join('\n\n');
    console.log(context)

    // 5. Generate system prompt
    const systemPrompt = `You are a helpful AI assistant that answers questions based on the provided context.
      Guidelines:
      1. Be concise but helpful
      2. Use the context when relevant
      3. If you used a tool/plugin, mention it
      4. Maintain a friendly tone`;

    // 6. Call Gemini API
    return generateWithGemini(systemPrompt, message, context);
  } catch (error) {
    console.error('Error generating RAG response:', error);
    return "Sorry, I encountered an error while generating a response.";
  }
};

// API Endpoint
app.post('/agent/message', async (req, res) => {
  try {
    const { message, session_id } = req.body;

    if (!message || !session_id) {
      return res.status(400).json({ error: 'Both message and session_id are required' });
    }

    // Add user message to memory
    addMessageToSession(session_id, { role: 'user', content: message });
    console.log("here")

    // Generate RAG response
    const response = await generateRAGResponse(message, session_id);
    console.log("here2")
    // Add AI response to memory
    addMessageToSession(session_id, { role: 'assistant', content: response });
    console.log("here3")
    res.json({ response });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const startServer = async () => {
  await initializeVectorStore();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`POST /agent/message with { "message": "...", "session_id": "..." }`);
  });
};

startServer().catch(console.error);