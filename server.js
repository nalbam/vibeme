require('dotenv').config();
require('dotenv').config({ path: '.env.local' });

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// OpenAI 설정
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// AWS Polly 설정
const polly = new PollyClient({
    region: process.env.AWS_REGION || 'ap-northeast-2',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 활성 연결 관리
const activeConnections = new Map();

// 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// WebRTC 시그널링 및 실시간 오디오 처리
wss.on('connection', (ws) => {
    const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    console.log(`New WebRTC connection: ${sessionId}`);
    
    activeConnections.set(sessionId, {
        ws: ws,
        isProcessing: false,
        conversationHistory: [],
        audioBuffer: [],
        vadTimer: null
    });

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());
            const connection = activeConnections.get(sessionId);
            
            switch (data.type) {
                case 'offer':
                case 'answer':
                case 'ice-candidate':
                    // WebRTC 시그널링 중계
                    ws.send(JSON.stringify(data));
                    break;
                    
                case 'audio-stream':
                    console.log('Received audio-stream message, data length:', data.audioData?.length);
                    await handleAudioStream(sessionId, data.audioData);
                    break;
                    
                case 'start-call':
                    ws.send(JSON.stringify({
                        type: 'call-ready',
                        sessionId: sessionId
                    }));
                    break;
                    
                case 'end-call':
                    if (connection) {
                        connection.isProcessing = false;
                        if (connection.vadTimer) {
                            clearTimeout(connection.vadTimer);
                        }
                    }
                    break;
            }
            
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });

    ws.on('close', () => {
        console.log(`WebRTC connection closed: ${sessionId}`);
        const connection = activeConnections.get(sessionId);
        if (connection && connection.vadTimer) {
            clearTimeout(connection.vadTimer);
        }
        activeConnections.delete(sessionId);
    });
});

// 실시간 오디오 스트림 처리
async function handleAudioStream(sessionId, audioData) {
    const connection = activeConnections.get(sessionId);
    if (!connection) {
        console.log('No connection found for session:', sessionId);
        return;
    }

    if (!audioData || audioData.length === 0) {
        console.log('Empty or invalid audio data received');
        return;
    }

    console.log('Received audio stream, length:', audioData.length, 'type:', typeof audioData[0]);

    // 오디오 데이터를 버퍼에 누적
    connection.audioBuffer.push(...audioData);
    console.log('Total buffer length after push:', connection.audioBuffer.length);
    
    // 3초 분량의 오디오 (16kHz * 3초 = 48000 샘플)가 쌓이면 처리
    const targetBufferSize = 48000;
    
    if (connection.audioBuffer.length >= targetBufferSize && !connection.isProcessing) {
        console.log('Buffer size reached target, processing audio immediately...');
        await processAccumulatedAudio(sessionId);
        return;
    }
    
    // VAD 타이머 (침묵 감지용) - 청크 기반 처리와 별도로 운영
    if (connection.vadTimer) {
        clearTimeout(connection.vadTimer);
    }
    
    // 4초 침묵 후 강제 처리 (백업용)
    connection.vadTimer = setTimeout(async () => {
        console.log('VAD timeout triggered, processing remaining audio...');
        await processAccumulatedAudio(sessionId);
    }, 4000);
}

// 누적된 오디오 처리
async function processAccumulatedAudio(sessionId) {
    const connection = activeConnections.get(sessionId);
    if (!connection || connection.isProcessing || connection.audioBuffer.length === 0) {
        console.log('Skipping audio processing:', {
            hasConnection: !!connection,
            isProcessing: connection?.isProcessing,
            bufferLength: connection?.audioBuffer?.length || 0
        });
        return;
    }
    
    connection.isProcessing = true;
    console.log('Processing accumulated audio, buffer length:', connection.audioBuffer.length);
    
    try {
        // 오디오 버퍼를 Int16Array로 변환 (클라이언트에서 전송한 형식과 일치)
        const combinedAudio = new Int16Array(connection.audioBuffer);
        connection.audioBuffer = []; // 버퍼 초기화
        
        console.log('Combined audio length:', combinedAudio.length);
        
        if (combinedAudio.length < 8000) { // 최소 0.5초 분량 (16kHz)
            console.log('Audio too short, skipping');
            connection.isProcessing = false;
            return;
        }
        
        // STT 처리
        const transcription = await processSTT(combinedAudio);
        if (!transcription) {
            connection.isProcessing = false;
            return;
        }
        
        // AI 응답 생성
        const aiResponse = await generateAIResponse(transcription, connection.conversationHistory);
        if (!aiResponse) {
            connection.isProcessing = false;
            return;
        }
        
        // 대화 히스토리 업데이트
        connection.conversationHistory.push(
            { role: 'user', content: transcription },
            { role: 'assistant', content: aiResponse }
        );
        
        // 히스토리 길이 제한
        if (connection.conversationHistory.length > 20) {
            connection.conversationHistory.splice(0, 2);
        }
        
        // TTS 생성 및 스트리밍
        await generateAndStreamTTS(sessionId, aiResponse);
        
        // 대화 로그 전송
        connection.ws.send(JSON.stringify({
            type: 'conversation',
            user: transcription,
            assistant: aiResponse,
            timestamp: Date.now()
        }));
        
    } catch (error) {
        console.error('Audio processing error:', error);
    } finally {
        connection.isProcessing = false;
    }
}

// 오디오 버퍼 결합
function combineAudioBuffers(buffers) {
    const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const buffer of buffers) {
        const uint8Buffer = new Uint8Array(buffer);
        combined.set(uint8Buffer, offset);
        offset += uint8Buffer.length;
    }
    
    return combined;
}

// STT 처리
async function processSTT(audioBuffer) {
    try {
        console.log('Processing STT for buffer of length:', audioBuffer.length);
        
        // PCM 데이터를 WAV 형식으로 변환
        const wavBuffer = createWavBuffer(audioBuffer);
        
        // 임시 파일로 저장
        const tempFilePath = path.join(__dirname, `temp_stream_${Date.now()}.wav`);
        fs.writeFileSync(tempFilePath, wavBuffer);
        
        console.log('Saved WAV file:', tempFilePath, 'size:', wavBuffer.length);
        
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: 'whisper-1',
            language: 'ko'
        });
        
        // 임시 파일 삭제
        fs.unlinkSync(tempFilePath);
        
        console.log('STT result:', transcription.text);
        return transcription.text;
        
    } catch (error) {
        console.error('STT error:', error);
        return null;
    }
}

// PCM을 WAV로 변환
function createWavBuffer(pcmBuffer) {
    const sampleRate = 16000;
    const numChannels = 1;
    const bitsPerSample = 16;
    
    // pcmBuffer는 이미 Int16Array이므로 길이는 샘플 수
    const dataLength = pcmBuffer.length * 2; // 16-bit samples = 2 bytes per sample
    const headerLength = 44;
    const totalLength = headerLength + dataLength;
    
    const wavBuffer = Buffer.alloc(totalLength);
    
    // WAV 헤더 작성
    wavBuffer.write('RIFF', 0);
    wavBuffer.writeUInt32LE(totalLength - 8, 4);
    wavBuffer.write('WAVE', 8);
    wavBuffer.write('fmt ', 12);
    wavBuffer.writeUInt32LE(16, 16); // PCM format chunk size
    wavBuffer.writeUInt16LE(1, 20); // PCM format
    wavBuffer.writeUInt16LE(numChannels, 22);
    wavBuffer.writeUInt32LE(sampleRate, 24);
    wavBuffer.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28);
    wavBuffer.writeUInt16LE(numChannels * bitsPerSample / 8, 32);
    wavBuffer.writeUInt16LE(bitsPerSample, 34);
    wavBuffer.write('data', 36);
    wavBuffer.writeUInt32LE(dataLength, 40);
    
    // PCM 데이터를 16-bit로 복사 (이미 올바른 형식)
    for (let i = 0; i < pcmBuffer.length; i++) {
        wavBuffer.writeInt16LE(pcmBuffer[i], headerLength + i * 2);
    }
    
    return wavBuffer;
}

// AI 응답 생성
async function generateAIResponse(userMessage, history) {
    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { 
                    role: 'system', 
                    content: '당신은 실시간 음성 대화를 하는 친근한 AI입니다. 자연스럽고 간결하게 대화하세요. 전화 통화하듯이 반응하세요.' 
                },
                ...history,
                { role: 'user', content: userMessage }
            ],
            max_tokens: 100,
            temperature: 0.7
        });
        
        return completion.choices[0].message.content;
        
    } catch (error) {
        console.error('AI response error:', error);
        return null;
    }
}

// TTS 생성 및 스트리밍
async function generateAndStreamTTS(sessionId, text) {
    const connection = activeConnections.get(sessionId);
    if (!connection) return;
    
    try {
        const command = new SynthesizeSpeechCommand({
            Text: text,
            OutputFormat: 'mp3',
            VoiceId: 'Seoyeon',
            Engine: 'neural',
            SampleRate: '22050'
        });
        
        const ttsResult = await polly.send(command);
        
        if (ttsResult.AudioStream) {
            const chunks = [];
            for await (const chunk of ttsResult.AudioStream) {
                chunks.push(chunk);
            }
            const audioBuffer = Buffer.concat(chunks);
            
            // 실시간 오디오 스트리밍
            connection.ws.send(JSON.stringify({
                type: 'audio-response',
                audioData: audioBuffer.toString('base64'),
                contentType: 'audio/mp3'
            }));
        }
        
    } catch (error) {
        console.error('TTS error:', error);
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎤 VibeMe Real-time Voice Chat running on port ${PORT}`);
    console.log(`📞 WebRTC P2P voice calling enabled`);
});