# CLAUDE.md

This file provides technical guidance for Claude Code when working with this codebase.

## Development Commands

### Project Setup
- `npm install` - Install dependencies
- `npm run dev` - Development server with auto-restart
- `npm start` - Production server
- `npm test` - Run Jest tests

### Environment Configuration
Required `.env` or `.env.local` file:
```bash
OPENAI_API_KEY=sk-proj-...
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-northeast-2
PORT=3000
NODE_ENV=development
```

### Key Dependencies
- `@aws-sdk/client-polly` - TTS service
- `@aws-sdk/client-transcribe-streaming` - STT streaming
- `openai` - GPT conversation generation
- `ws` - WebSocket server
- `express` - Web server
- `dotenv` - Environment variables

## Code Architecture

### Core Files
**server.js (457 lines)**
- Lines 55-118: WebSocket connection management
- Lines 120-165: AWS Transcribe streaming implementation
- Lines 167-182: Real-time audio streaming handler
- Lines 184-199: Transcribe processing initialization
- Lines 245-280: Audio validation logic
- Lines 314-361: Transcription and conversation handling
- Lines 388-435: TTS generation with AWS Polly

**client.js (433 lines)**
- Lines 1-99: VibeMeWebRTC class and WebSocket handling
- Lines 100-193: WebRTC audio capture and call management
- Lines 268-302: Voice Activity Detection algorithm
- Lines 315-377: TTS playback and interrupt handling
- Lines 378-427: UI management and conversation logging

### Critical Implementation Details

**Voice Activity Detection (client.js:14-19)**
```javascript
voiceThreshold: 0.01          // Primary detection threshold
silenceThreshold: 0.005       // Silence detection threshold
bufferSize: 10               // RMS averaging buffer
minVoiceFrames: 2            // Minimum consecutive frames
```

**Audio Processing Pipeline**
- Client: 250ms chunk transmission (client.js:165)
- Server: Real-time streaming to AWS Transcribe
- Audio format: 16kHz, 16-bit PCM, mono
- No temporary files - direct streaming

**Session Management (server.js:59-65)**
```javascript
const connection = {
    ws: ws,                    // WebSocket instance
    transcribeStream: null,    // AWS Transcribe stream
    conversationHistory: [],   // Chat history (max 20)
    isProcessing: false,       // Processing state flag
    audioChunks: []           // Audio buffer queue
};
```

## Development Guidelines

### Audio Processing
- **Current threshold**: 0.01 RMS energy (server.js:272)
- **Minimum length**: 0.5 seconds for validation
- **Chunk size**: 1000+ bytes minimum for processing
- **Stream active**: Check `connection.isProcessing` flag

### Voice Detection Tuning
- **Quiet environment**: Lower threshold to 0.007-0.008
- **Noisy environment**: Raise threshold to 0.012-0.015
- **False positives**: Increase `minVoiceFrames` to 3
- **Delayed detection**: Decrease `minVoiceFrames` to 1

### Error Handling Patterns
- WebSocket errors: Check JSON parsing (server.js:103-105)
- Audio processing: Verify stream state (server.js:167-182)
- AWS Transcribe: Monitor stream lifecycle (server.js:120-165)
- TTS errors: Check Polly permissions (server.js:432-434)

### Memory Management
- Conversation history: Auto-pruned at 20 messages (server.js:343-345)
- Audio URLs: Auto-revoked to prevent leaks (client.js:351)
- Connection cleanup: Complete resource cleanup (server.js:108-117)
- Stream termination: Proper AWS stream closure

### Performance Optimization
- **Client transmission**: 250ms intervals for responsiveness
- **VAD response**: ~82ms (2 frames × 41ms)
- **ScriptProcessor**: 4096 buffer for low latency
- **Stream processing**: Real-time without accumulation

## Debugging and Troubleshooting

### Key Debug Points
**Audio Validation Issues**
- Check RMS calculation: server.js:269
- Verify buffer length: minimum 1000 bytes
- Monitor processing state: `connection.isProcessing`

**Voice Detection Problems**
- Debug output: 1% probability logging (client.js:151-157)
- Check consecutive frames counter
- Verify threshold settings vs environment noise

**Stream Management Issues**
- Monitor connection lifecycle: server.js:57, 109
- Check AWS Transcribe stream state
- Verify proper cleanup on disconnect

### Common Error Patterns
```javascript
// Stream processing errors
'AWS Transcribe stream error: [error]'        // server.js:187
'Stream processing stopped for session:'      // server.js:165
'Transcribe stream closed or interrupted:'    // server.js:182
'Audio chunk added to stream queue:'          // server.js:182

// Connection management
'New connection: [sessionId]'                 // server.js:57
'Connection closed: [sessionId]'              // server.js:109
'Transcribe stream ended for session:'       // server.js:408

// TTS processing
'Generating TTS for: [text]...'               // server.js:403
'TTS audio sent to client'                    // server.js:429
```

### AWS Transcribe Stream Management
- **Stream termination**: Use `isProcessing = false` flag, not `destroy()` method
- **Error handling**: Streams may close naturally when connection ends
- **Resource cleanup**: Always set `transcribeStream = null` after termination
- **State checking**: Verify both `connection.isProcessing` and `activeConnections.has(sessionId)`

### Testing Approach
- Use browser dev tools for WebRTC debugging
- Monitor WebSocket message flow
- Test VAD in different noise environments
- Verify AWS credentials and permissions
- Check stream termination and cleanup

## Code Modification Best Practices

### When Changing VAD Settings
1. Test in quiet and noisy environments
2. Monitor false positive/negative rates
3. Adjust thresholds incrementally (±0.001-0.002)
4. Update both client and server validation if needed

### When Modifying Audio Processing
1. Ensure proper stream state management
2. Maintain real-time processing requirements
3. Verify memory cleanup on all exit paths
4. Test connection drop scenarios

### When Working with AWS Services
1. Verify IAM permissions for Transcribe and Polly
2. Monitor AWS service quotas and limits
3. Handle network interruptions gracefully
4. Implement proper retry mechanisms

### Session State Management
1. Always check connection existence before processing
2. Use atomic operations for state changes
3. Implement proper cleanup in all error paths
4. Verify thread safety for concurrent connections