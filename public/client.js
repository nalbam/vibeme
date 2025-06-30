class VibeMeWebRTC {
    constructor() {
        this.ws = null;
        this.localStream = null;
        this.audioContext = null;
        this.scriptProcessor = null;
        this.isCallActive = false;
        this.isConnected = false;
        this.currentAudio = null;
        this.isSpeaking = false;
        this.sessionId = null;
        
        // 음성 활동 감지 설정
        this.voiceThreshold = 0.01;
        this.silenceThreshold = 0.005;
        this.voiceDetectionBuffer = [];
        this.bufferSize = 10; // 최근 10개 청크로 음성 활동 판단
        
        this.init();
    }
    
    init() {
        this.setupWebSocket();
        this.setupEventListeners();
        this.initWelcomeTime();
        this.updateStatus('연결 중...', 'connecting');
    }
    
    initWelcomeTime() {
        const welcomeTime = document.getElementById('welcomeTime');
        if (welcomeTime) {
            welcomeTime.textContent = this.formatTime(new Date());
        }
    }
    
    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.isConnected = true;
            this.updateStatus('연결됨 - 통화 시작 가능', 'connected');
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            } catch (error) {
                console.error('WebSocket message parsing error:', error);
            }
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.isConnected = false;
            this.updateStatus('연결 끊김 - 재연결 중...', 'disconnected');
            setTimeout(() => this.setupWebSocket(), 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateStatus('연결 오류', 'disconnected');
        };
    }
    
    setupEventListeners() {
        const callButton = document.getElementById('callButton');
        const endCallButton = document.getElementById('endCallButton');
        
        callButton.addEventListener('click', () => this.startCall());
        endCallButton.addEventListener('click', () => this.endCall());
    }
    
    async handleWebSocketMessage(data) {
        switch (data.type) {
            case 'call-ready':
                console.log('Call ready, session:', data.sessionId);
                this.sessionId = data.sessionId;
                break;
                
            case 'audio-response':
                await this.playAIResponse(data.audioData);
                break;
                
            case 'conversation':
                this.addConversationToLog(data.user, data.assistant, data.timestamp);
                break;
                
            default:
                console.log('Unknown message type:', data.type);
        }
    }
    
    async startCall() {
        try {
            this.updateStatus('마이크 접근 권한 요청 중...', 'connecting');
            
            // 고품질 마이크 설정
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 16000,
                    channelCount: 1
                }
            });
            
            console.log('Microphone access granted');
            
            // Web Audio API 설정
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });
            
            const source = this.audioContext.createMediaStreamSource(this.localStream);
            
            // ScriptProcessor로 실시간 오디오 캡처 (WebRTC 방식)
            this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
            
            let audioBuffer = [];
            let lastSendTime = Date.now();
            
            this.scriptProcessor.onaudioprocess = (event) => {
                if (!this.isCallActive) return;
                
                const inputData = event.inputBuffer.getChannelData(0);
                const now = Date.now();
                
                // 실시간 음성 활동 감지
                const voiceActivity = this.detectAdvancedVoiceActivity(inputData);
                
                // 사용자가 말하기 시작하면 TTS 중단
                if (voiceActivity && !this.isSpeaking) {
                    this.isSpeaking = true;
                    this.stopCurrentAudio();
                    this.sendStopTTSSignal();
                    console.log('🎤 User started speaking - TTS interrupted');
                } else if (!voiceActivity && this.isSpeaking) {
                    this.isSpeaking = false;
                    console.log('🔇 User stopped speaking');
                }
                
                // 16-bit PCM으로 변환
                const audioData = this.convertFloat32ToInt16(inputData);
                audioBuffer.push(...audioData);
                
                // 250ms마다 전송 (더 빠른 반응성을 위해)
                if (now - lastSendTime > 250) {
                    if (audioBuffer.length > 0) {
                        this.sendAudioStream(audioBuffer);
                        audioBuffer = [];
                        lastSendTime = now;
                    }
                }
            };
            
            source.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.audioContext.destination);
            
            // 통화 시작
            this.isCallActive = true;
            this.updateCallButtons(true);
            this.updateStatus('📞 실시간 음성 대화 중...', 'calling');
            
            // 서버에 통화 시작 알림
            this.ws.send(JSON.stringify({
                type: 'start-call'
            }));
            
            console.log('WebRTC real-time voice call started');
            
        } catch (error) {
            console.error('Failed to start call:', error);
            this.updateStatus('마이크 접근 실패', 'disconnected');
        }
    }
    
    endCall() {
        this.isCallActive = false;
        this.isSpeaking = false;
        
        // 현재 재생 중인 TTS 중단
        this.stopCurrentAudio();
        
        // 오디오 스트림 정리
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        // Web Audio API 정리
        if (this.scriptProcessor) {
            this.scriptProcessor.disconnect();
            this.scriptProcessor = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        // 서버에 통화 종료 알림
        if (this.ws && this.isConnected) {
            this.ws.send(JSON.stringify({
                type: 'end-call'
            }));
        }
        
        this.updateCallButtons(false);
        this.updateStatus('통화 종료됨', 'connected');
        
        console.log('Call ended');
    }
    
    sendAudioStream(audioData) {
        if (this.ws && this.isConnected && this.isCallActive) {
            try {
                this.ws.send(JSON.stringify({
                    type: 'audio-stream',
                    audioData: Array.from(audioData)
                }));
            } catch (error) {
                console.error('Failed to send audio stream:', error);
            }
        }
    }
    
    sendStopTTSSignal() {
        if (this.ws && this.isConnected) {
            this.ws.send(JSON.stringify({
                type: 'stop-tts',
                sessionId: this.sessionId
            }));
        }
    }
    
    convertFloat32ToInt16(float32Array) {
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return int16Array;
    }
    
    // 고급 음성 활동 감지
    detectAdvancedVoiceActivity(audioData) {
        // RMS 계산
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i] * audioData[i];
        }
        const rms = Math.sqrt(sum / audioData.length);
        
        // 버퍼에 추가
        this.voiceDetectionBuffer.push(rms);
        if (this.voiceDetectionBuffer.length > this.bufferSize) {
            this.voiceDetectionBuffer.shift();
        }
        
        // 평균 RMS 계산
        const avgRMS = this.voiceDetectionBuffer.reduce((a, b) => a + b, 0) / this.voiceDetectionBuffer.length;
        
        // 음성 활동 판단
        return avgRMS > this.voiceThreshold;
    }
    
    // 현재 재생 중인 오디오 중단
    stopCurrentAudio() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
            console.log('🔇 TTS audio stopped');
        }
    }
    
    async playAIResponse(audioBase64) {
        try {
            // 사용자가 말하고 있으면 재생하지 않음
            if (this.isSpeaking) {
                console.log('User is speaking, skipping TTS playback');
                return;
            }
            
            // 이전 오디오가 재생 중이면 중단
            this.stopCurrentAudio();
            
            // Base64를 Blob으로 변환
            const audioData = atob(audioBase64);
            const audioArray = new Uint8Array(audioData.length);
            for (let i = 0; i < audioData.length; i++) {
                audioArray[i] = audioData.charCodeAt(i);
            }
            
            const audioBlob = new Blob([audioArray], { type: 'audio/mp3' });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            // 오디오 재생
            const audio = new Audio(audioUrl);
            this.currentAudio = audio;
            
            audio.addEventListener('loadeddata', () => {
                console.log('🔊 AI response audio loaded, playing...');
            });
            
            audio.addEventListener('ended', () => {
                URL.revokeObjectURL(audioUrl);
                this.currentAudio = null;
                console.log('🎵 AI response playback finished');
            });
            
            audio.addEventListener('error', (error) => {
                console.error('AI response playback error:', error);
                URL.revokeObjectURL(audioUrl);
                this.currentAudio = null;
            });
            
            // 사용자가 말하기 시작하면 재생 중단하도록 이벤트 리스너 추가
            const checkUserSpeaking = () => {
                if (this.isSpeaking && this.currentAudio === audio) {
                    this.stopCurrentAudio();
                }
            };
            
            audio.addEventListener('timeupdate', checkUserSpeaking);
            
            await audio.play();
            
        } catch (error) {
            console.error('Failed to play AI response:', error);
        }
    }
    
    addConversationToLog(userText, assistantText, timestamp) {
        // 사용자 메시지
        this.addMessage(userText, 'user', timestamp);
        
        // AI 응답
        this.addMessage(assistantText, 'bot', timestamp);
    }
    
    addMessage(text, sender, timestamp = null) {
        const chatContainer = document.getElementById('chatContainer');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = text;
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = this.formatTime(timestamp ? new Date(timestamp) : new Date());
        
        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timeDiv);
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    formatTime(date) {
        return date.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    }
    
    updateStatus(text, className) {
        const statusElement = document.getElementById('status');
        statusElement.textContent = text;
        statusElement.className = `status ${className}`;
    }
    
    updateCallButtons(inCall) {
        const callButton = document.getElementById('callButton');
        const endCallButton = document.getElementById('endCallButton');
        
        callButton.style.display = inCall ? 'none' : 'inline-block';
        endCallButton.style.display = inCall ? 'inline-block' : 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new VibeMeWebRTC();
});