# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Project**: VibeMe - Real-time AI voice conversation service  
**Tech Stack**: Node.js + WebRTC + WebSocket + OpenAI + AWS  
**Architecture**: Client-server real-time audio streaming with AI processing  
**Status**: Production-ready with ongoing AWS Transcribe integration

## Common Development Commands

### Project Management
- `npm install` - Install dependencies
- `npm start` - Run production server
- `npm run dev` - Run development server with nodemon (recommended for development)
- `npm test` - Run Jest tests

### Environment Setup
- Create `.env` or `.env.local` file with required API keys:
  - `OPENAI_API_KEY` - OpenAI API key for GPT conversation generation
  - `AWS_ACCESS_KEY_ID` - AWS access key for Transcribe and Polly services
  - `AWS_SECRET_ACCESS_KEY` - AWS secret key
  - `AWS_REGION` - AWS region (default: ap-northeast-2)
  - `PORT` - Server port (default: 3000)
  - `NODE_ENV` - Environment (development/production)

## Architecture Overview

### System Design
This is a real-time AI voice conversation service that enables natural phone-like conversations between users and AI. The architecture follows a WebRTC + WebSocket pattern with AWS AI services integration.

**Data Flow:**
```
Client (WebRTC) → WebSocket → AWS Transcribe → OpenAI GPT → AWS Polly → Client
```

### Core Components

**Backend (`server.js`)**
- Express.js web server with WebSocket support
- Real-time audio processing and streaming
- AWS Transcribe integration for speech-to-text
- OpenAI GPT-3.5-turbo for conversation generation
- AWS Polly Neural for text-to-speech synthesis
- Connection state management with active session tracking

**Frontend (`public/client.js`, `public/index.html`)**
- WebRTC-based real-time audio capture and streaming
- Voice Activity Detection (VAD) using RMS-based algorithm
- Smart interrupt system that stops AI speech when user starts talking
- WebSocket client for bidirectional communication
- Phone-call-like UI with start/stop controls

### Key Technical Features

**Real-time Audio Processing:**
- 250ms audio chunk transmission for low latency
- 16kHz sample rate, 16-bit PCM encoding
- RMS-based voice activity detection with smart filtering
- Automatic background noise filtering

**Smart Conversation Flow:**
- Immediate TTS interruption when user starts speaking
- Conversation history management (limited to 20 messages)
- Session-based state management
- Graceful connection cleanup and resource management

**Performance Optimizations:**
- Audio validation to prevent processing invalid/silent audio
- Memory management with automatic resource cleanup
- WebSocket connection pooling and state tracking
- Threshold-based voice detection to minimize false positives

## Development Notes

### Audio Processing Pipeline
The system uses a sophisticated audio processing pipeline:
1. Client captures audio via WebRTC ScriptProcessorNode (4096 buffer size)
2. Audio is converted to 16-bit PCM and sent via WebSocket every 250ms
3. Server accumulates chunks until 1-second worth of audio is collected
4. Audio validation checks RMS energy levels before processing
5. Valid audio is sent to AWS Transcribe for real-time speech recognition

### Voice Activity Detection
The VAD system uses multiple validation layers (client.js:14-19):
- Primary threshold: 0.01 RMS energy (voiceThreshold)
- Secondary threshold: 0.005 for silence detection (silenceThreshold)
- Consecutive frame requirement: minimum 2 frames (minVoiceFrames)
- Buffer-based smoothing: 10-sample buffer for stability (bufferSize)

### Session Management
Each WebSocket connection maintains:
- `isProcessing` flag to control audio processing
- `audioChunks` array for buffering incoming audio
- Conversation history with automatic pruning
- Session-specific configuration and state

### Error Handling
- Graceful fallback for audio processing failures
- WebSocket reconnection capability
- AWS service error handling with appropriate user feedback
- Resource cleanup on connection termination

## Required AWS Permissions

The application requires the following AWS IAM permissions:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "transcribe:StartStreamTranscription",
                "polly:SynthesizeSpeech"
            ],
            "Resource": "*"
        }
    ]
}
```

## Browser Compatibility and Requirements

### Supported Browsers:
- **Chrome**: Full support (recommended) - best WebRTC performance
- **Firefox**: WebRTC supported - good compatibility
- **Safari**: Partial support - limited WebRTC features
- **Edge**: WebRTC supported - good compatibility

### Technical Requirements:
- **HTTPS mandatory**: Microphone access and WebRTC require secure context
- **Microphone permission**: User must grant microphone access
- **JavaScript enabled**: Required for WebSocket and audio processing
- **Web Audio API**: Required for real-time audio processing
- **WebSocket support**: Required for real-time communication

### Audio Configuration:
```javascript
// Optimal microphone settings (client.js:105-113)
audio: {
    echoCancellation: true,     // Reduces echo feedback
    noiseSuppression: true,     // Minimizes background noise
    autoGainControl: true,      // Normalizes audio levels
    sampleRate: 16000,          // 16kHz for optimal quality/bandwidth
    channelCount: 1             // Mono channel for efficiency
}
```

### Performance Considerations:
- Minimum stable internet connection for real-time audio streaming
- Adequate CPU for real-time audio processing (ScriptProcessorNode)
- Sufficient memory for audio buffering and conversation history
- Low-latency audio hardware recommended for best experience

## Current vs. Planned Implementation

### Current State (Working Implementation):
- ✅ WebRTC audio capture with advanced VAD
- ✅ WebSocket real-time communication
- ✅ OpenAI Whisper for speech-to-text (via file upload)
- ✅ OpenAI GPT-3.5-turbo for conversation
- ✅ AWS Polly Neural TTS (Seoyeon voice)
- ✅ Smart TTS interruption system
- ✅ Session management and cleanup

### In Progress (AWS Transcribe Integration):
- 🔄 AWS Transcribe Streaming implementation (server.js:120-165)
- 🔄 Real-time streaming STT without temporary files
- 🔄 Improved latency through streaming processing

### Architecture Evolution:
- **Phase 1** (Current): Hybrid OpenAI + AWS implementation
- **Phase 2** (Target): Full AWS AI services integration
- **Phase 3** (Future): Advanced conversation context and memory

This codebase represents a production-ready real-time voice conversation system with sophisticated audio processing, smart interruption handling, and robust session management.