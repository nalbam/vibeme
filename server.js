require('dotenv').config();
require('dotenv').config({ path: '.env.local' });

const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const OpenAI = require('openai');
const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');

const app = express();
const server = http.createServer(app);

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

// Multer 설정
const upload = multer({
    limits: { fileSize: 25 * 1024 * 1024 }
});

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// 음성 인식 API
app.post('/api/speech-to-text', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file' });
        }

        const tempFilePath = path.join(__dirname, `temp_${Date.now()}.webm`);
        fs.writeFileSync(tempFilePath, req.file.buffer);

        try {
            const transcription = await openai.audio.transcriptions.create({
                file: fs.createReadStream(tempFilePath),
                model: 'whisper-1',
                language: 'ko'
            });

            res.json({ 
                success: true, 
                text: transcription.text 
            });

        } finally {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }

    } catch (error) {
        console.error('Speech-to-text error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to process audio' 
        });
    }
});

// AI 챗 API
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'No message provided' });
        }

        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: '당신은 친근한 AI 어시스턴트입니다. 한국어로 간결하게 답변하세요.' },
                { role: 'user', content: message }
            ],
            max_tokens: 150
        });

        const response = completion.choices[0].message.content;

        res.json({
            success: true,
            response: response
        });

    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to generate response' 
        });
    }
});

// TTS API
app.post('/api/text-to-speech', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'No text provided' });
        }

        const command = new SynthesizeSpeechCommand({
            Text: text,
            OutputFormat: 'mp3',
            VoiceId: 'Seoyeon',
            Engine: 'neural'
        });

        const ttsResult = await polly.send(command);

        if (ttsResult.AudioStream) {
            const chunks = [];
            for await (const chunk of ttsResult.AudioStream) {
                chunks.push(chunk);
            }
            const audioBuffer = Buffer.concat(chunks);
            const audioBase64 = audioBuffer.toString('base64');
            
            res.json({
                success: true,
                audioBase64: audioBase64,
                contentType: 'audio/mp3'
            });
        } else {
            throw new Error('No audio stream received');
        }

    } catch (error) {
        console.error('TTS error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to generate speech' 
        });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`VibeMe server running on port ${PORT}`);
});