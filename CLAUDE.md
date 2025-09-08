# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a voice-enabled hotel reservation cancellation system using Amazon Nova Sonic for bidirectional audio streaming. The application processes real-time voice interactions through WebSockets, enabling natural conversations for canceling hotel reservations.

## Development Commands

```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Start production server (requires build)
npm start

# Development server with ts-node
npm run dev

# The application runs on http://localhost:3000
```

## Architecture

### Backend Stack
- **TypeScript** with Node.js (CommonJS modules)
- **Express.js** server with Socket.IO for WebSocket communication
- **AWS Bedrock Runtime** for Nova Sonic AI model integration
- **RxJS** for reactive stream management

### Frontend Stack
- **Vanilla JavaScript** (ES modules) in public/src/
- **WebAudio API** for audio processing
- **Socket.IO client** for real-time communication

### Key Communication Flow
1. Browser captures audio via MediaRecorder API
2. Audio streams through Socket.IO to Express server
3. Server forwards audio to AWS Bedrock Nova Sonic via bidirectional streaming
4. AI responses stream back through the same pipeline
5. Browser plays audio responses and displays text transcripts

## Important Files and Their Roles

### Server-Side (TypeScript)
- `src/server.ts` - Express server with Socket.IO handlers, session management, and cleanup logic
- `src/client.ts` - Nova Sonic bidirectional stream client implementation with queue management
- `src/hotel-confirmation.ts` - Business logic for hotel reservation lookups and cancellations
- `src/consts.ts` - Configuration constants, tool schemas, and system prompts
- `src/types.ts` - TypeScript type definitions for the application

### Client-Side (JavaScript)
- `public/src/main.js` - Main application logic, audio handling, and UI management
- `public/src/lib/play/AudioPlayer.js` - Audio playback implementation
- `public/src/lib/util/ChatHistoryManager.js` - Chat history management

## Session Management

The application implements robust session management:
- Each Socket.IO connection creates a unique session
- Sessions have automatic cleanup after 5 minutes of inactivity
- Proper cleanup sequence on disconnect: endAudioContent → endPrompt → close
- Force close mechanism for stuck sessions

## Audio Configuration

Default audio settings (defined in `src/consts.ts`):
- **Input**: 16kHz, 16-bit, mono LPCM
- **Output**: 24kHz, 16-bit, mono LPCM
- **Voice**: Tiffany voice ID
- Base64 encoding for transmission

## Tool Integration

The system uses two main tools for hotel operations:
1. **GetReservation** - Looks up reservations by name and check-in date
2. **CancelReservation** - Processes cancellation with confirmation

Tool schemas are defined in `src/consts.ts` and implemented in `src/hotel-confirmation.ts`.

## Environment Configuration

Required environment variables:
- `AWS_PROFILE` - AWS profile name (defaults to 'nalbam-admin')
- `AWS_REGION` - AWS region (defaults to 'us-east-1')
- `PORT` - Server port (defaults to 3000)

AWS credentials are loaded using the `fromIni` provider from AWS SDK.

## Error Handling Patterns

The codebase implements defensive error handling:
- Try-catch blocks around all async operations
- Timeout mechanisms for session cleanup (3-second timeout)
- Queue overflow protection in audio streaming
- Graceful shutdown handling with SIGINT

## WebSocket Events

### Client → Server
- `audioInput` - Streams audio chunks
- `promptStart` - Initiates conversation
- `systemPrompt` - Sets system context
- `audioStart` - Begins audio streaming
- `stopAudio` - Ends conversation

### Server → Client
- `contentStart` - Signals response beginning
- `textOutput` - Text transcriptions
- `audioOutput` - Audio response chunks
- `toolUse` - Tool invocation notifications
- `toolResult` - Tool execution results
- `contentEnd` - Response completion
- `streamComplete` - Full stream completion
- `error` - Error notifications

## Development Notes

- The project uses TypeScript strict mode
- No test framework is currently configured
- No linting or formatting tools are configured
- Frontend code is vanilla JavaScript (not TypeScript)
- Audio processing includes Voice Activity Detection (VAD) in the browser
- The system enforces single-role behavior (hotel cancellation agent only)