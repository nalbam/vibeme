const AWS = require('aws-sdk');

class PollyService {
    constructor() {
        // AWS 설정
        AWS.config.update({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION || 'us-east-1'
        });
        
        this.polly = new AWS.Polly();
        this.defaultVoice = 'Seoyeon'; // 한국어 여성 음성
        this.defaultEngine = 'neural'; // 더 자연스러운 음성
        this.sampleRate = '22050';
        this.outputFormat = 'mp3';
    }
    
    async synthesizeSpeech(text, options = {}) {
        try {
            const params = {
                Text: text,
                OutputFormat: options.outputFormat || this.outputFormat,
                VoiceId: options.voiceId || this.defaultVoice,
                Engine: options.engine || this.defaultEngine,
                SampleRate: options.sampleRate || this.sampleRate,
                TextType: 'text'
            };
            
            console.log('Polly synthesis params:', params);
            
            const result = await this.polly.synthesizeSpeech(params).promise();
            
            if (!result.AudioStream) {
                throw new Error('No audio stream received from Polly');
            }
            
            return {
                success: true,
                audioStream: result.AudioStream,
                contentType: result.ContentType,
                requestCharacters: result.RequestCharacters
            };
            
        } catch (error) {
            console.error('Polly synthesis error:', error);
            
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async synthesizeSpeechToBase64(text, options = {}) {
        try {
            const result = await this.synthesizeSpeech(text, options);
            
            if (!result.success) {
                return result;
            }
            
            // AudioStream을 Base64로 변환
            const audioBase64 = result.audioStream.toString('base64');
            
            return {
                success: true,
                audioBase64: audioBase64,
                contentType: result.contentType,
                requestCharacters: result.requestCharacters
            };
            
        } catch (error) {
            console.error('Polly base64 conversion error:', error);
            
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // 사용 가능한 한국어 음성 목록
    getKoreanVoices() {
        return [
            { id: 'Seoyeon', name: '서연', gender: 'Female', language: 'ko-KR' }
        ];
    }
    
    // 긴 텍스트를 청크로 나누는 헬퍼 메서드
    splitTextIntoChunks(text, maxLength = 3000) {
        if (text.length <= maxLength) {
            return [text];
        }
        
        const chunks = [];
        let currentChunk = '';
        
        // 문장 단위로 나누기
        const sentences = text.split(/[.!?]+/).filter(s => s.trim());
        
        for (const sentence of sentences) {
            const trimmedSentence = sentence.trim();
            if (!trimmedSentence) continue;
            
            if ((currentChunk + trimmedSentence).length > maxLength) {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                    currentChunk = '';
                }
                
                // 단일 문장이 너무 긴 경우
                if (trimmedSentence.length > maxLength) {
                    const words = trimmedSentence.split(' ');
                    let wordChunk = '';
                    
                    for (const word of words) {
                        if ((wordChunk + ' ' + word).length > maxLength) {
                            if (wordChunk) {
                                chunks.push(wordChunk.trim());
                                wordChunk = word;
                            } else {
                                chunks.push(word);
                            }
                        } else {
                            wordChunk += (wordChunk ? ' ' : '') + word;
                        }
                    }
                    
                    if (wordChunk) {
                        currentChunk = wordChunk;
                    }
                } else {
                    currentChunk = trimmedSentence;
                }
            } else {
                currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
            }
        }
        
        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks.length > 0 ? chunks : [text];
    }
    
    // 스트리밍을 위한 청크별 음성 합성
    async synthesizeTextChunks(text, options = {}, onChunk) {
        try {
            const chunks = this.splitTextIntoChunks(text);
            const results = [];
            
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const result = await this.synthesizeSpeechToBase64(chunk, options);
                
                if (result.success) {
                    results.push(result);
                    
                    if (onChunk) {
                        onChunk({
                            chunkIndex: i,
                            totalChunks: chunks.length,
                            audioBase64: result.audioBase64,
                            contentType: result.contentType,
                            text: chunk
                        });
                    }
                } else {
                    console.error(`Failed to synthesize chunk ${i}:`, result.error);
                }
            }
            
            return {
                success: true,
                chunks: results,
                totalChunks: chunks.length
            };
            
        } catch (error) {
            console.error('Chunk synthesis error:', error);
            
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = PollyService;