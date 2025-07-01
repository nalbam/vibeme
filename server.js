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
                    await initializeTranscribeProcessing(sessionId);
                    ws.send(JSON.stringify({
                        type: 'call-ready',
                        sessionId: sessionId
                    }));
                    
                    // AI 첫 인사 메시지 생성 및 전송
                    setTimeout(async () => {
                        await sendWelcomeMessage(sessionId);
                    }, 1000); // 1초 후 인사말
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
            connection.transcribeStream = null; // 스트림 참조 제거
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
        console.log(`Starting AWS Transcribe stream for session: ${sessionId}`);

        // 오디오 스트림 생성 함수
        const createAudioStream = async function* () {
            let streamActive = true;

            // 연결이 활성 상태이고 처리 중일 때만 스트림 유지
            while (streamActive && connection.isProcessing) {
                if (connection.audioChunks.length > 0) {
                    const chunk = connection.audioChunks.shift();
                    yield { AudioEvent: { AudioChunk: chunk } };
                } else {
                    // 새 오디오 데이터를 기다림 (100ms 대기)
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // 연결 상태 재확인
                streamActive = activeConnections.has(sessionId) && connection.isProcessing;
            }
        };

        const command = new StartStreamTranscriptionCommand({
            LanguageCode: 'ko-KR',
            MediaEncoding: 'pcm',
            MediaSampleRateHertz: 16000,
            AudioStream: createAudioStream()
        });

        const response = await transcribeClient.send(command);
        connection.transcribeStream = response;

        console.log('AWS Transcribe stream started successfully');

        // 실시간 전사 결과 처리
        if (response.TranscriptResultStream) {
            try {
                for await (const event of response.TranscriptResultStream) {
                    // 연결이 종료되었으면 스트림 처리 중단
                    if (!connection.isProcessing || !activeConnections.has(sessionId)) {
                        console.log('Stream processing stopped for session:', sessionId);
                        break;
                    }

                    if (event.TranscriptEvent) {
                        const results = event.TranscriptEvent.Transcript.Results;
                        if (results && results.length > 0) {
                            const result = results[0];
                            if (!result.IsPartial && result.Alternatives && result.Alternatives.length > 0) {
                                const transcript = result.Alternatives[0].Transcript;
                                console.log('AWS Transcribe result:', transcript);
                                await handleTranscription(sessionId, transcript);
                            }
                        }
                    }
                }
            } catch (streamError) {
                console.log('Transcribe stream closed or interrupted:', streamError.message);
            }
        }

    } catch (error) {
        console.error('AWS Transcribe stream error:', error);
        // 에러 발생 시 연결 정리
        if (connection) {
            connection.transcribeStream = null;
        }
    }
}

// 오디오 스트림 처리 (AWS Transcribe 스트리밍용)
async function handleAudioStream(sessionId, audioData) {
    const connection = activeConnections.get(sessionId);
    if (!connection || !audioData || !connection.isProcessing) return;

    // PCM 데이터를 Buffer로 변환
    const audioBuffer = Buffer.from(new Int16Array(audioData).buffer);

    // 오디오 데이터 유효성 검증 (간단한 검증)
    if (audioBuffer.length < 1000) { // 너무 작은 청크는 무시
        return;
    }

    // 오디오 청크를 실시간 스트림용 큐에 추가
    connection.audioChunks.push(audioBuffer);

    // AWS Transcribe 스트리밍은 실시간으로 처리되므로 별도 처리 불필요
    // 스트림이 자동으로 큐에서 데이터를 가져가서 처리함

    console.log(`Audio chunk added to stream queue: ${audioBuffer.length} bytes`);
}

// AWS Transcribe 스트리밍 처리 시작
async function initializeTranscribeProcessing(sessionId) {
    const connection = activeConnections.get(sessionId);
    if (!connection) return;

    // 스트리밍 처리 시작
    connection.isProcessing = true;

    try {
        console.log('Initializing AWS Transcribe streaming for session:', sessionId);

        // AWS Transcribe 스트림 시작
        await startTranscribeStream(sessionId);

    } catch (error) {
        console.error('Transcribe initialization error:', error);
        connection.isProcessing = false;
    }
}

// OpenAI Whisper 관련 코드 제거됨 - AWS Transcribe 스트리밍으로 대체

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

// WAV 변환 함수 제거됨 - AWS Transcribe에서 PCM 직접 처리

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

    // AWS Transcribe 스트림은 isProcessing 플래그로 제어됨
    // 스트림 자체는 연결 종료시 자동으로 정리됨
    if (connection.transcribeStream) {
        try {
            // 처리 상태를 false로 설정하여 스트림 루프 중단
            connection.isProcessing = false;
            connection.transcribeStream = null;
            console.log(`Transcribe stream ended for session: ${sessionId}`);
        } catch (error) {
            console.error('Error ending transcribe stream:', error);
        }
    }
}

// AI 환영 메시지 전송
async function sendWelcomeMessage(sessionId) {
    const connection = activeConnections.get(sessionId);
    if (!connection || !connection.isProcessing) {
        console.log('Connection not found or not processing, skipping welcome message for session:', sessionId);
        return;
    }

    try {
        // 환영 메시지 생성
        const welcomeMessages = [
            '안녕하세요! 저는 VibeMe AI 어시스턴트입니다. 오늘 어떤 도움이 필요하신가요?',
            '반갑습니다! 실시간 음성 대화가 시작되었습니다. 편하게 말씀해 주세요.',
            '안녕하세요! 무엇을 도와드릴까요? 궁금한 것이 있으시면 언제든지 말씀해 주세요.',
            '환영합니다! 오늘 기분은 어떠신가요? 편하게 대화해요.'
        ];
        
        const randomWelcome = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
        
        console.log('Sending welcome message:', randomWelcome);

        // 대화 히스토리에 추가
        connection.conversationHistory.push({
            role: 'assistant', 
            content: randomWelcome
        });

        // TTS 생성 및 전송
        await generateAndStreamTTS(sessionId, randomWelcome);

        // 대화 로그 전송
        connection.ws.send(JSON.stringify({
            type: 'conversation',
            user: '',
            assistant: randomWelcome,
            timestamp: Date.now()
        }));

        console.log('Welcome message sent successfully for session:', sessionId);

    } catch (error) {
        console.error('Failed to send welcome message:', error);
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎤 VibeMe WebRTC + AWS Voice Chat running on port ${PORT}`);
    console.log(`📞 Real-time conversation with AWS Transcribe + Polly enabled`);
});
