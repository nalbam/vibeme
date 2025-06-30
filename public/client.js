class VibeMeWebRTC {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.currentAudio = null;
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.initWelcomeTime();
        this.updateStatus('준비완료', 'connected');
    }
    
    initWelcomeTime() {
        const welcomeTime = document.getElementById('welcomeTime');
        if (welcomeTime) {
            welcomeTime.textContent = this.formatTime(new Date());
        }
    }
    
    setupEventListeners() {
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        const voiceButton = document.getElementById('voiceButton');
        const stopAudioButton = document.getElementById('stopAudioButton');
        
        sendButton.addEventListener('click', () => this.sendTextMessage());
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendTextMessage();
        });
        voiceButton.addEventListener('click', () => this.toggleVoiceChat());
        stopAudioButton.addEventListener('click', () => this.stopAudio());
    }
    
    async sendTextMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message) return;
        
        this.addMessage(message, 'user');
        messageInput.value = '';
        this.setSendButtonState(false);
        
        try {
            // AI 응답 생성
            const chatResponse = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });
            
            const chatResult = await chatResponse.json();
            
            if (chatResult.success) {
                this.addMessage(chatResult.response, 'bot');
                
                // TTS 생성 및 재생
                await this.generateAndPlayTTS(chatResult.response);
            } else {
                this.addMessage('응답 생성에 실패했습니다.', 'bot');
            }
            
        } catch (error) {
            console.error('Text message error:', error);
            this.addMessage('오류가 발생했습니다.', 'bot');
        } finally {
            this.setSendButtonState(true);
        }
    }
    
    async toggleVoiceChat() {
        if (this.isRecording) {
            this.stopVoiceRecording();
        } else {
            await this.startVoiceRecording();
        }
    }
    
    async startVoiceRecording() {
        try {
            this.updateStatus('마이크 접근 요청 중...', 'connected');
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 16000
                }
            });
            
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm'
            });
            
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = async () => {
                await this.processVoiceInput();
                stream.getTracks().forEach(track => track.stop());
            };
            
            this.mediaRecorder.start();
            this.isRecording = true;
            this.updateVoiceButtonState(true);
            this.updateStatus('🎤 음성 녹음 중... (다시 클릭하여 중지)', 'connected');
            
        } catch (error) {
            console.error('Voice recording error:', error);
            this.updateStatus('마이크 접근 권한이 필요합니다', 'disconnected');
        }
    }
    
    stopVoiceRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.updateVoiceButtonState(false);
            this.updateStatus('음성 처리 중...', 'connected');
        }
    }
    
    async processVoiceInput() {
        try {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            
            if (audioBlob.size < 1000) {
                this.updateStatus('음성이 너무 짧습니다', 'disconnected');
                return;
            }
            
            // STT 처리
            const formData = new FormData();
            formData.append('audio', audioBlob, 'audio.webm');
            
            this.updateStatus('음성을 텍스트로 변환 중...', 'connected');
            
            const sttResponse = await fetch('/api/speech-to-text', {
                method: 'POST',
                body: formData
            });
            
            const sttResult = await sttResponse.json();
            
            if (!sttResult.success || !sttResult.text) {
                this.updateStatus('음성을 인식하지 못했습니다', 'disconnected');
                return;
            }
            
            const userText = sttResult.text;
            this.addMessage(userText, 'user');
            
            // AI 응답 생성
            this.updateStatus('AI 응답 생성 중...', 'connected');
            
            const chatResponse = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userText })
            });
            
            const chatResult = await chatResponse.json();
            
            if (chatResult.success) {
                this.addMessage(chatResult.response, 'bot');
                
                // TTS 생성 및 재생
                await this.generateAndPlayTTS(chatResult.response);
                this.updateStatus('음성 대화 완료', 'connected');
            } else {
                this.addMessage('응답 생성에 실패했습니다.', 'bot');
                this.updateStatus('응답 생성 실패', 'disconnected');
            }
            
        } catch (error) {
            console.error('Voice processing error:', error);
            this.updateStatus('음성 처리 오류', 'disconnected');
        }
    }
    
    async generateAndPlayTTS(text) {
        try {
            this.updateStatus('음성 생성 중...', 'connected');
            
            const ttsResponse = await fetch('/api/text-to-speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            
            const ttsResult = await ttsResponse.json();
            
            if (ttsResult.success) {
                await this.playAudio(ttsResult.audioBase64);
            } else {
                console.error('TTS generation failed');
            }
            
        } catch (error) {
            console.error('TTS error:', error);
        }
    }
    
    async playAudio(audioBase64) {
        try {
            if (this.currentAudio) {
                this.currentAudio.pause();
            }
            
            const audioData = atob(audioBase64);
            const audioArray = new Uint8Array(audioData.length);
            for (let i = 0; i < audioData.length; i++) {
                audioArray[i] = audioData.charCodeAt(i);
            }
            
            const audioBlob = new Blob([audioArray], { type: 'audio/mp3' });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            this.currentAudio = new Audio(audioUrl);
            this.showStopAudioButton(true);
            this.updateStatus('🔊 음성 재생 중...', 'connected');
            
            this.currentAudio.addEventListener('ended', () => {
                URL.revokeObjectURL(audioUrl);
                this.currentAudio = null;
                this.showStopAudioButton(false);
                this.updateStatus('준비완료', 'connected');
            });
            
            this.currentAudio.addEventListener('error', (error) => {
                console.error('Audio playback error:', error);
                URL.revokeObjectURL(audioUrl);
                this.currentAudio = null;
                this.showStopAudioButton(false);
                this.updateStatus('음성 재생 오류', 'disconnected');
            });
            
            await this.currentAudio.play();
            
        } catch (error) {
            console.error('Audio playback error:', error);
            this.updateStatus('음성 재생 오류', 'disconnected');
        }
    }
    
    stopAudio() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
            this.showStopAudioButton(false);
            this.updateStatus('준비완료', 'connected');
        }
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
            hour12: true
        });
    }
    
    updateStatus(text, className) {
        const statusElement = document.getElementById('status');
        statusElement.textContent = text;
        statusElement.className = `status ${className}`;
    }
    
    setSendButtonState(enabled) {
        document.getElementById('sendButton').disabled = !enabled;
    }
    
    updateVoiceButtonState(recording) {
        const voiceButton = document.getElementById('voiceButton');
        if (recording) {
            voiceButton.classList.add('recording');
            voiceButton.textContent = '⏹️';
        } else {
            voiceButton.classList.remove('recording');
            voiceButton.textContent = '🎤';
        }
    }
    
    showStopAudioButton(show) {
        const stopAudioButton = document.getElementById('stopAudioButton');
        stopAudioButton.style.display = show ? 'inline-block' : 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new VibeMeWebRTC();
});