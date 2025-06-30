class VibeMeClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.audioContext = null;
        this.currentAudio = null;
        this.init();
    }
    
    init() {
        this.setupWebSocket();
        this.setupEventListeners();
        this.setupAudio();
    }
    
    setupAudio() {
        // Initialize Web Audio API
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
        }
    }
    
    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.isConnected = true;
            this.updateStatus('연결됨', 'connected');
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.isConnected = false;
            this.updateStatus('연결 끊김', 'disconnected');
            
            // Attempt to reconnect after 3 seconds
            setTimeout(() => {
                this.setupWebSocket();
            }, 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateStatus('연결 오류', 'disconnected');
        };
    }
    
    setupEventListeners() {
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        const stopAudioButton = document.getElementById('stopAudioButton');
        
        sendButton.addEventListener('click', () => {
            this.sendMessage();
        });
        
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
        
        stopAudioButton.addEventListener('click', () => {
            this.stopAudio();
        });
    }
    
    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message || !this.isConnected) {
            return;
        }
        
        // Add user message to chat
        this.addMessage(message, 'user');
        
        // Send to server
        this.ws.send(JSON.stringify({
            type: 'message',
            text: message,
            timestamp: Date.now()
        }));
        
        // Clear input
        messageInput.value = '';
        
        // Disable send button temporarily
        this.setSendButtonState(false);
    }
    
    handleMessage(data) {
        switch (data.type) {
            case 'response':
                this.addMessage(data.text, 'bot');
                this.setSendButtonState(true);
                break;
            case 'audio':
                this.playAudio(data.audioBase64, data.contentType);
                break;
            case 'error':
                this.addMessage(`오류: ${data.message}`, 'bot');
                this.setSendButtonState(true);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }
    
    async playAudio(audioBase64, contentType) {
        try {
            // Stop current audio if playing
            if (this.currentAudio) {
                this.currentAudio.pause();
                this.currentAudio = null;
            }
            
            // Convert base64 to blob
            const audioData = atob(audioBase64);
            const audioArray = new Uint8Array(audioData.length);
            for (let i = 0; i < audioData.length; i++) {
                audioArray[i] = audioData.charCodeAt(i);
            }
            
            const audioBlob = new Blob([audioArray], { type: contentType });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            // Create and play audio element
            this.currentAudio = new Audio(audioUrl);
            
            // Show stop button
            this.showStopAudioButton(true);
            
            this.currentAudio.play();
            
            // Clean up URL after playing
            this.currentAudio.addEventListener('ended', () => {
                URL.revokeObjectURL(audioUrl);
                this.currentAudio = null;
                this.showStopAudioButton(false);
            });
            
            // Handle play errors
            this.currentAudio.addEventListener('error', (error) => {
                console.error('Audio playback error:', error);
                URL.revokeObjectURL(audioUrl);
                this.currentAudio = null;
                this.showStopAudioButton(false);
            });
            
        } catch (error) {
            console.error('Error playing audio:', error);
        }
    }
    
    addMessage(text, sender) {
        const chatContainer = document.getElementById('chatContainer');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        messageDiv.textContent = text;
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    updateStatus(text, className) {
        const statusElement = document.getElementById('status');
        statusElement.textContent = text;
        statusElement.className = `status ${className}`;
    }
    
    setSendButtonState(enabled) {
        const sendButton = document.getElementById('sendButton');
        sendButton.disabled = !enabled;
    }
    
    stopAudio() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
            this.showStopAudioButton(false);
        }
    }
    
    showStopAudioButton(show) {
        const stopAudioButton = document.getElementById('stopAudioButton');
        stopAudioButton.style.display = show ? 'inline-block' : 'none';
    }
}

// Initialize the client when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new VibeMeClient();
});