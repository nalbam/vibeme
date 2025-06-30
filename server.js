require('dotenv').config();
require('dotenv').config({ path: '.env.local' });

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const path = require('path');
const OpenAI = require('openai');
const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
const { 
    TranscribeStreamingClient, 
    StartStreamTranscriptionCommand 
} = require('@aws-sdk/client-transcribe-streaming');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// OpenAI 설정 (대화 생성용)
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// AWS 설정
const awsConfig = {
    region: process.env.AWS_REGION || 'ap-northeast-2',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
};

const polly = new PollyClient(awsConfig);
const transcribeClient = new TranscribeStreamingClient(awsConfig);

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

// WebSocket 연결 처리
wss.on('connection', (ws) => {
    const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    console.log(`New connection: ${sessionId}`);
    
    const connection = {
        ws: ws,
        transcribeStream: null,
        conversationHistory: [],
        isProcessing: false,
        audioChunks: []
    };
    
    activeConnections.set(sessionId, connection);

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());
            
            switch (data.type) {
                case 'start-call':
                    await startTranscribeStream(sessionId);
                    ws.send(JSON.stringify({
                        type: 'call-ready',
                        sessionId: sessionId
                    }));
                    break;
                    
                case 'audio-stream':
                    await handleAudioStream(sessionId, data.audioData);
                    break;
                    
                case 'stop-tts':
                    // TTS 중단 신호 처리
                    console.log('TTS stop signal received');
                    break;
                    
                case 'end-call':
                    await endTranscribeStream(sessionId);
                    // 진행 중인 처리 중단
                    const connection = activeConnections.get(sessionId);
                    if (connection) {
                        connection.isProcessing = false;
                        connection.audioChunks = []; // 대기 중인 오디오 청크 삭제
                        console.log('Call ended - stopped processing for session:', sessionId);
                    }
                    break;
            }
            
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });

    ws.on('close', () => {
        console.log(`Connection closed: ${sessionId}`);
        const connection = activeConnections.get(sessionId);
        if (connection) {
            connection.isProcessing = false; // 모든 처리 중단
            connection.audioChunks = []; // 대기 중인 오디오 삭제
        }
        endTranscribeStream(sessionId);
        activeConnections.delete(sessionId);
    });
});

// AWS Transcribe 스트림 시작
async function startTranscribeStream(sessionId) {
    const connection = activeConnections.get(sessionId);
    if (!connection) return;

    try {
        console.log(`Starting Transcribe stream for session: ${sessionId}`);
        
        // 오디오 스트림 생성
        const audioStream = async function* () {
            while (connection.audioChunks.length > 0) {
                const chunk = connection.audioChunks.shift();
                yield { AudioEvent: { AudioChunk: chunk } };
            }
        };

        const command = new StartStreamTranscriptionCommand({
            LanguageCode: 'ko-KR',
            MediaEncoding: 'pcm',
            MediaSampleRateHertz: 16000,
            AudioStream: audioStream()
        });

        const response = await transcribeClient.send(command);
        
        // 실시간 전사 결과 처리
        if (response.TranscriptResultStream) {
            for await (const event of response.TranscriptResultStream) {
                if (event.TranscriptEvent) {
                    const results = event.TranscriptEvent.Transcript.Results;
                    if (results && results.length > 0) {
                        const result = results[0];
                        if (!result.IsPartial && result.Alternatives && result.Alternatives.length > 0) {
                            const transcript = result.Alternatives[0].Transcript;
                            console.log('Transcription result:', transcript);
                            await handleTranscription(sessionId, transcript);
                        }
                    }
                }
            }
        }
        
    } catch (error) {
        console.error('Transcribe stream error:', error);
    }
}

// 오디오 스트림 처리
async function handleAudioStream(sessionId, audioData) {
    const connection = activeConnections.get(sessionId);
    if (!connection || !audioData) return;

    // PCM 데이터를 Buffer로 변환
    const audioBuffer = Buffer.from(new Int16Array(audioData).buffer);
    
    // 오디오 청크를 큐에 추가
    connection.audioChunks.push(audioBuffer);
    
    // 더 많은 데이터가 쌓였을 때만 처리 (1초 분량으로 증가)
    if (connection.audioChunks.length >= 16) { // 16kHz * 1초 / 1024 samples per chunk
        await processAudioChunks(sessionId);
    }
}

// 오디오 청크 일괄 처리
async function processAudioChunks(sessionId) {
    const connection = activeConnections.get(sessionId);
    if (!connection || connection.isProcessing) return;

    connection.isProcessing = true;
    
    try {
        // 청크들을 결합
        const combinedAudio = Buffer.concat(connection.audioChunks);
        connection.audioChunks = [];
        
        console.log('Processing audio chunks, total size:', combinedAudio.length);
        
        // 오디오 데이터 유효성 검증
        if (!isValidAudioData(combinedAudio)) {
            console.log('Invalid audio data detected, skipping processing');
            return;
        }
        
        // AWS Transcribe로 전송 (실제 구현에서는 스트리밍 방식 사용)
        await processWithTranscribe(sessionId, combinedAudio);
        
    } catch (error) {
        console.error('Audio processing error:', error);
    } finally {
        connection.isProcessing = false;
    }
}

// AWS Transcribe로 음성 인식 (임시 구현 - 실제로는 스트리밍 사용)
async function processWithTranscribe(sessionId, audioBuffer) {
    const connection = activeConnections.get(sessionId);
    if (!connection) return;

    try {
        // 임시: OpenAI Whisper 사용 (AWS Transcribe 스트리밍 완전 구현까지)
        const fs = require('fs');
        const tempFilePath = path.join(__dirname, `temp_${sessionId}_${Date.now()}.wav`);
        
        // PCM to WAV 변환
        const wavBuffer = createWavBuffer(audioBuffer);
        fs.writeFileSync(tempFilePath, wavBuffer);
        
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: 'whisper-1',
            language: 'ko'
        });
        
        fs.unlinkSync(tempFilePath);
        
        if (transcription.text.trim()) {
            await handleTranscription(sessionId, transcription.text);
        }
        
    } catch (error) {
        console.error('Transcribe processing error:', error);
    }
}

// 오디오 데이터 유효성 검증
function isValidAudioData(audioBuffer) {
    if (!audioBuffer || audioBuffer.length === 0) {
        return false;
    }
    
    // 최소 길이 체크 (0.5초 이상)
    if (audioBuffer.length < 16000) { // 16kHz * 0.5초 * 2 bytes
        console.log('Audio too short:', audioBuffer.length);
        return false;
    }
    
    // RMS 에너지 계산
    let sum = 0;
    const samples = audioBuffer.length / 2; // 16-bit samples
    
    for (let i = 0; i < audioBuffer.length; i += 2) {
        const sample = audioBuffer.readInt16LE(i);
        sum += sample * sample;
    }
    
    const rms = Math.sqrt(sum / samples);
    const normalizedRMS = rms / 32768; // 16-bit 정규화
    
    console.log('Audio RMS:', normalizedRMS);
    
    // 최소 에너지 임계값 (배경 소음보다 충분히 높아야 함)
    const minEnergyThreshold = 0.01;
    
    if (normalizedRMS < minEnergyThreshold) {
        console.log('Audio energy too low, likely silence or noise');
        return false;
    }
    
    return true;
}

// PCM을 WAV로 변환
function createWavBuffer(pcmBuffer) {
    const sampleRate = 16000;
    const numChannels = 1;
    const bitsPerSample = 16;
    
    const dataLength = pcmBuffer.length;
    const headerLength = 44;
    const totalLength = headerLength + dataLength;
    
    const wavBuffer = Buffer.alloc(totalLength);
    
    // WAV 헤더
    wavBuffer.write('RIFF', 0);
    wavBuffer.writeUInt32LE(totalLength - 8, 4);
    wavBuffer.write('WAVE', 8);
    wavBuffer.write('fmt ', 12);
    wavBuffer.writeUInt32LE(16, 16);
    wavBuffer.writeUInt16LE(1, 20);
    wavBuffer.writeUInt16LE(numChannels, 22);
    wavBuffer.writeUInt32LE(sampleRate, 24);
    wavBuffer.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28);
    wavBuffer.writeUInt16LE(numChannels * bitsPerSample / 8, 32);
    wavBuffer.writeUInt16LE(bitsPerSample, 34);
    wavBuffer.write('data', 36);
    wavBuffer.writeUInt32LE(dataLength, 40);
    
    // PCM 데이터 복사
    pcmBuffer.copy(wavBuffer, headerLength);
    
    return wavBuffer;
}

// 전사 결과 처리
async function handleTranscription(sessionId, transcript) {
    const connection = activeConnections.get(sessionId);
    if (!connection) {
        console.log('Connection not found, skipping transcription handling for session:', sessionId);
        return;
    }

    // 통화가 종료된 경우 전사 결과 처리하지 않음
    if (!connection.isProcessing) {
        console.log('Call ended, skipping transcription handling for session:', sessionId);
        return;
    }

    console.log('Handling transcription:', transcript);
    
    try {
        // AI 응답 생성
        const aiResponse = await generateAIResponse(transcript, connection.conversationHistory);
        if (!aiResponse) return;
        
        // 대화 히스토리 업데이트
        connection.conversationHistory.push(
            { role: 'user', content: transcript },
            { role: 'assistant', content: aiResponse }
        );
        
        // 히스토리 길이 제한 (메모리 관리)
        if (connection.conversationHistory.length > 20) {
            connection.conversationHistory.splice(0, 2);
        }
        
        // TTS 생성 및 전송
        await generateAndStreamTTS(sessionId, aiResponse);
        
        // 대화 로그 전송
        connection.ws.send(JSON.stringify({
            type: 'conversation',
            user: transcript,
            assistant: aiResponse,
            timestamp: Date.now()
        }));
        
    } catch (error) {
        console.error('Transcription handling error:', error);
    }
}

// AI 응답 생성
async function generateAIResponse(userMessage, history) {
    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { 
                    role: 'system', 
                    content: '당신은 실시간 음성 대화를 하는 친근한 AI 어시스턴트입니다. 자연스럽고 간결하게 대화하세요. 전화 통화하듯이 반응하고, 상대방이 말을 끊을 수 있음을 고려해 핵심부터 말하세요.' 
                },
                ...history,
                { role: 'user', content: userMessage }
            ],
            max_tokens: 150,
            temperature: 0.8
        });
        
        return completion.choices[0].message.content;
        
    } catch (error) {
        console.error('AI response error:', error);
        return null;
    }
}

// AWS Polly TTS 생성 및 스트리밍
async function generateAndStreamTTS(sessionId, text) {
    const connection = activeConnections.get(sessionId);
    if (!connection) {
        console.log('Connection not found, skipping TTS for session:', sessionId);
        return;
    }
    
    // 통화가 종료되었거나 처리 중단된 경우 TTS 생성하지 않음
    if (!connection.isProcessing) {
        console.log('Call ended or processing stopped, skipping TTS for session:', sessionId);
        return;
    }
    
    try {
        console.log('Generating TTS for:', text.substring(0, 50) + '...');
        
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
            
            console.log('TTS audio sent to client');
        }
        
    } catch (error) {
        console.error('TTS error:', error);
    }
}

// Transcribe 스트림 종료
async function endTranscribeStream(sessionId) {
    const connection = activeConnections.get(sessionId);
    if (!connection) return;

    if (connection.transcribeStream) {
        try {
            connection.transcribeStream.destroy();
            connection.transcribeStream = null;
            console.log(`Transcribe stream ended for session: ${sessionId}`);
        } catch (error) {
            console.error('Error ending transcribe stream:', error);
        }
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎤 VibeMe WebRTC + AWS Voice Chat running on port ${PORT}`);
    console.log(`📞 Real-time conversation with AWS Transcribe + Polly enabled`);
});