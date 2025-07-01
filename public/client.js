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

        // 음성 활동 감지 설정 (인터럽트 방지를 위해 더 엄격하게)
        this.voiceThreshold = 0.05; // 임계값 증가 (0.02 -> 0.05)
        this.silenceThreshold = 0.005;
        this.voiceDetectionBuffer = [];
        this.bufferSize = 15; // 최근 15개 청크로 음성 활동 판단 (더 긴 평가 시간)
        this.consecutiveVoiceFrames = 0; // 연속 음성 프레임 카운터
        this.minVoiceFrames = 5; // 최소 5프레임 연속 음성이어야 활동으로 인정 (더 엄격)

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

            // WebRTC 방식: ScriptProcessor로 실시간 오디오 캡처
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

                // 250ms마다 전송
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
        console.log('📞 Ending call - stopping all audio and processing');

        this.isCallActive = false;
        this.isSpeaking = false;

        // 현재 재생 중인 TTS 강제 중단
        this.stopCurrentAudio();

        // 서버에 TTS 중단 신호 전송
        this.sendStopTTSSignal();

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

    // 고급 음성 활동 감지 (더 엄격한 기준)
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

        // 현재 프레임이 임계값을 넘는지 확인
        const currentFrameHasVoice = rms > this.voiceThreshold;

        // 연속 음성 프레임 카운터 업데이트
        if (currentFrameHasVoice) {
            this.consecutiveVoiceFrames++;
        } else {
            this.consecutiveVoiceFrames = 0;
        }

        // 평균 RMS 계산 (추가 검증용)
        const avgRMS = this.voiceDetectionBuffer.reduce((a, b) => a + b, 0) / this.voiceDetectionBuffer.length;

        // 훨씬 더 엄격한 음성 활동 판단 (인터럽트 방지)
        // 1. 연속으로 minVoiceFrames 이상 음성이 감지되어야 함
        // 2. 평균 RMS도 임계값 이상이어야 함
        // 3. 현재 RMS가 높은 임계값을 넘어야 함
        const hasConsistentVoice = this.consecutiveVoiceFrames >= this.minVoiceFrames;
        const hasStrongSignal = avgRMS > this.voiceThreshold * 0.9; // 평균 임계값을 더 엄격하게
        const hasHighCurrentSignal = rms > this.voiceThreshold * 1.2; // 현재값도 높아야 함

        return hasConsistentVoice && hasStrongSignal && hasHighCurrentSignal;
    }

    // 현재 재생 중인 오디오 중단
    stopCurrentAudio() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
            console.log('🔇 TTS audio stopped');
            
            // 립싱크도 중지
            if (window.characterManager) {
                window.characterManager.onAIStopSpeaking();
            }
        }
    }

    async playAIResponse(audioBase64) {
        try {
            // 통화가 종료되었으면 재생하지 않음
            if (!this.isCallActive) {
                console.log('Call ended, skipping TTS playback');
                return;
            }

            // 사용자가 말하고 있으면 재생하지 않음
            if (this.isSpeaking) {
                console.log('User is speaking, skipping TTS playback');
                return;
            }

            // 이전 오디오가 재생 중이면 중단
            this.stopCurrentAudio();

            // 캐릭터 립싱크 시작
            if (window.characterManager) {
                window.characterManager.onAIStartSpeaking();
            }

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

            // 오디오 분석을 위한 Web Audio API 설정
            this.setupAudioAnalyzer(audio);

            audio.addEventListener('loadeddata', () => {
                console.log('🔊 AI response audio loaded, playing...');
            });

            audio.addEventListener('ended', () => {
                URL.revokeObjectURL(audioUrl);
                this.currentAudio = null;
                console.log('🎵 AI response playback finished');
                
                // 캐릭터 립싱크 중지
                if (window.characterManager) {
                    window.characterManager.onAIStopSpeaking();
                }
            });

            audio.addEventListener('error', (error) => {
                console.error('AI response playback error:', error);
                URL.revokeObjectURL(audioUrl);
                this.currentAudio = null;
                
                // 오류 시에도 립싱크 중지
                if (window.characterManager) {
                    window.characterManager.onAIStopSpeaking();
                }
            });

            // 사용자가 말하거나 통화가 종료되면 재생 중단하도록 이벤트 리스너 추가
            const checkInterruption = () => {
                if ((this.isSpeaking || !this.isCallActive) && this.currentAudio === audio) {
                    console.log('🛑 TTS interrupted:', this.isSpeaking ? 'user speaking' : 'call ended');
                    this.stopCurrentAudio();
                }
            };

            audio.addEventListener('timeupdate', checkInterruption);

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

    // 오디오 분석기 설정 (립싱크용) - AnalyserNode 사용
    setupAudioAnalyzer(audio) {
        try {
            if (!window.characterManager) return;

            // 오디오 컨텍스트 생성
            if (!this.analyzerAudioContext) {
                this.analyzerAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            const source = this.analyzerAudioContext.createMediaElementSource(audio);
            const analyzer = this.analyzerAudioContext.createAnalyser();
            
            analyzer.fftSize = 512;
            analyzer.smoothingTimeConstant = 0.8;
            const dataArray = new Uint8Array(analyzer.frequencyBinCount);

            source.connect(analyzer);
            analyzer.connect(this.analyzerAudioContext.destination);

            // 실시간 오디오 분석
            const analyzeAudio = () => {
                if (this.currentAudio === audio && !audio.paused && !audio.ended) {
                    analyzer.getByteFrequencyData(dataArray);
                    
                    // 음성 주파수 대역에서 평균 음량 계산
                    let sum = 0;
                    const startFreq = 10; // ~200Hz
                    const endFreq = 100;   // ~2000Hz
                    
                    for (let i = startFreq; i < endFreq; i++) {
                        sum += dataArray[i];
                    }
                    
                    const average = sum / (endFreq - startFreq);
                    const normalizedValue = average / 255.0;
                    
                    // 립싱크 업데이트
                    if (window.characterManager) {
                        window.characterManager.updateLipSyncFromAudio([normalizedValue]);
                    }
                    
                    requestAnimationFrame(analyzeAudio);
                }
            };

            // 오디오 재생 시작시 분석 시작
            audio.addEventListener('play', () => {
                if (this.analyzerAudioContext.state === 'suspended') {
                    this.analyzerAudioContext.resume();
                }
                analyzeAudio();
            });

        } catch (error) {
            console.error('Failed to setup audio analyzer:', error);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new VibeMeWebRTC();
});
