require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const path = require('path');

const OpenAIService = require('./services/openai');
const PollyService = require('./services/polly');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Initialize services
let openaiService;
let pollyService;

try {
  openaiService = new OpenAIService();
  console.log('✅ OpenAI service initialized');
} catch (error) {
  console.error('❌ Failed to initialize OpenAI service:', error.message);
}

try {
  pollyService = new PollyService();
  console.log('✅ AWS Polly service initialized');
} catch (error) {
  console.error('❌ Failed to initialize Polly service:', error.message);
}

// Store conversation history for each connection
const conversationHistory = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Basic route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  
  // Generate unique session ID for this connection
  const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  conversationHistory.set(sessionId, []);
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message:', data);
      
      if (data.type === 'message' && data.text) {
        // Get conversation history for this session
        const history = conversationHistory.get(sessionId) || [];
        
        if (openaiService) {
          // Get AI response
          const result = await openaiService.generateResponse(data.text, history);
          
          // Update conversation history
          history.push({ role: 'user', content: data.text });
          history.push({ role: 'assistant', content: result.response });
          
          // Keep only last 20 messages to prevent memory issues
          if (history.length > 20) {
            history.splice(0, history.length - 20);
          }
          
          conversationHistory.set(sessionId, history);
          
          // Send text response first
          ws.send(JSON.stringify({
            type: 'response',
            text: result.response,
            timestamp: Date.now(),
            usage: result.usage
          }));
          
          // Generate TTS audio if Polly service is available
          if (pollyService) {
            try {
              const ttsResult = await pollyService.synthesizeSpeechToBase64(result.response);
              
              if (ttsResult.success) {
                ws.send(JSON.stringify({
                  type: 'audio',
                  audioBase64: ttsResult.audioBase64,
                  contentType: ttsResult.contentType,
                  text: result.response,
                  timestamp: Date.now()
                }));
              } else {
                console.error('TTS generation failed:', ttsResult.error);
              }
            } catch (ttsError) {
              console.error('TTS error:', ttsError);
            }
          }
          
        } else {
          // Fallback if OpenAI service is not available
          ws.send(JSON.stringify({
            type: 'response',
            text: '죄송합니다. AI 서비스가 현재 사용할 수 없습니다.',
            timestamp: Date.now()
          }));
        }
      }
      
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
    // Clean up conversation history
    conversationHistory.delete(sessionId);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 VibeMe server running on port ${PORT}`);
  console.log(`📱 Open http://localhost:${PORT} to access the demo`);
});