# VibeMe - AI 실시간 음성 대화 서비스

🎤 **WebRTC + AWS Transcribe + Polly 기반 실시간 AI 음성 채팅**

실제 전화 통화처럼 자연스럽게 서로 말을 끊어가며 대화할 수 있는 고품질 AI 음성 대화 서비스입니다.

## ✨ 주요 특징

### 🎯 **실시간 자연스러운 대화**
- **전화 통화 방식**: 마이크 버튼 없이 연속적인 자연스러운 대화
- **스마트 인터럽트**: 사용자가 말하기 시작하면 AI 응답 즉시 중단
- **저지연 통신**: 250ms 주기 WebRTC 실시간 오디오 스트리밍
- **고급 VAD**: RMS 기반 음성 활동 감지로 정확한 대화 타이밍

### 🤖 **AI 서비스 통합**
- **AWS Transcribe**: 실시간 한국어 음성 인식 (STT)
- **OpenAI GPT-3.5**: 자연스러운 대화 생성
- **AWS Polly Neural**: 고품질 Seoyeon 음성 합성 (TTS)

### 🔧 **최적화된 성능**
- **WebRTC**: 실시간 양방향 오디오 스트리밍
- **스마트 필터링**: 배경 소음 제거 및 유효 음성만 처리
- **자동 중단**: 통화 종료 시 모든 처리 즉시 중단

## 🚀 빠른 시작

### 1. 프로젝트 설치

```bash
git clone https://github.com/nalbam/vibeme.git
cd vibeme
npm install
```

### 2. 환경 변수 설정

`.env` 또는 `.env.local` 파일을 생성하고 API 키를 설정하세요:

```env
# OpenAI Configuration
OPENAI_API_KEY="your-openai-api-key"

# AWS Configuration
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_REGION="ap-northeast-2"

# Server Configuration
PORT=3000
NODE_ENV=development
```

### 3. 서버 실행

```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

서버 실행 후 `http://localhost:3000`에서 서비스를 이용할 수 있습니다.

## 🎯 사용 방법

### 📞 **실시간 음성 대화**

1. **"통화 시작"** 버튼 클릭
2. **마이크 권한 허용**
3. **자연스럽게 대화**:
   - 말하기 시작하면 AI 응답이 즉시 중단됩니다
   - 연속적으로 대화 가능 (버튼 조작 불필요)
   - 전화 통화하듯 서로 말을 끊어가며 대화
4. **"통화 종료"** 클릭으로 대화 마무리

### 🎛️ **기능 설명**

- **🎤 실시간 음성 감지**: 말하기 시작하면 자동으로 TTS 중단
- **🔇 스마트 필터링**: 배경 소음과 실제 음성 구분
- **⚡ 빠른 응답**: 250ms 주기로 실시간 오디오 전송
- **🛑 즉시 중단**: 통화 종료 시 모든 처리 즉시 정지

## 🏗️ 시스템 아키텍처

### **데이터 흐름**
```
Client (WebRTC) → WebSocket → AWS Transcribe → OpenAI GPT → AWS Polly → Client
```

### **기술 스택**

#### **Backend**
- **Node.js**: 런타임 환경
- **Express**: 웹 프레임워크  
- **WebSocket (ws)**: 실시간 양방향 통신
- **AWS Transcribe Streaming**: 실시간 음성 인식
- **AWS Polly Neural**: 고품질 음성 합성
- **OpenAI GPT-3.5-turbo**: 대화 생성

#### **Frontend**
- **WebRTC**: 실시간 오디오 캡처 및 스트리밍
- **Web Audio API**: 고급 오디오 처리
- **WebSocket Client**: 실시간 서버 통신
- **Vanilla JavaScript**: 클라이언트 로직

### **핵심 알고리즘**

#### **음성 활동 감지 (VAD)**
```javascript
// RMS 기반 고급 음성 감지 (client.js:14-19)
- voiceThreshold: 0.01 (기본 음성 임계값)
- silenceThreshold: 0.005 (무음 임계값)
- bufferSize: 10 (최근 10개 청크로 음성 활동 판단)
- minVoiceFrames: 2 (최소 2프레임 연속 음성)
- 이중 검증: 연속성 + 평균 RMS 조건
```

#### **오디오 처리 파이프라인**
```javascript
// 클라이언트: 250ms 주기 전송
ScriptProcessor(4096) → Int16PCM → WebSocket

// 서버: 1초 분량 누적 후 처리  
AudioChunks → Validation → Transcribe → GPT → Polly
```

## 📁 프로젝트 구조

```
vibeme/
├── server.js                 # 메인 서버 (WebSocket + AWS 통합)
├── package.json              # 프로젝트 설정 및 의존성
├── .env.example             # 환경 변수 템플릿
└── public/                  # 클라이언트 파일
    ├── index.html          # 메인 페이지 (전화 통화 UI)
    └── client.js           # WebRTC 클라이언트 로직
```

## ⚙️ 주요 기능 구현

### **1. 실시간 음성 감지 및 인터럽트**

```javascript
// 사용자 음성 감지 시 TTS 즉시 중단
if (voiceActivity && !this.isSpeaking) {
    this.isSpeaking = true;
    this.stopCurrentAudio();      // TTS 중단
    this.sendStopTTSSignal();     // 서버에 중단 신호
}
```

### **2. 스마트 오디오 필터링**

```javascript
// 서버에서 유효한 음성만 처리
function isValidAudioData(audioBuffer) {
    - 최소 길이 검증 (0.5초 이상)
    - RMS 에너지 계산
    - 배경 소음 임계값 비교 (0.01)
}
```

### **3. 통화 상태 관리**

```javascript
// 통화 종료 시 모든 처리 중단
case 'end-call':
    connection.isProcessing = false;  // 처리 중단
    connection.audioChunks = [];     // 대기 큐 삭제
    // TTS 생성 및 전사 처리 차단
```

## 🛠️ 개발 환경 설정

### **필수 요구 사항**

- **Node.js**: >= 18.0.0
- **OpenAI API Key**: GPT 및 Whisper 사용
- **AWS 계정**: Transcribe 및 Polly 서비스 권한

### **AWS IAM 권한 설정**

필요한 AWS 서비스 권한:
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

### **브라우저 호환성**

- **Chrome**: 완전 지원 (권장)
- **Firefox**: WebRTC 지원
- **Safari**: 부분 지원
- **HTTPS 필수**: 마이크 권한 및 WebRTC 사용

## 🔧 성능 최적화 상세

### **메모리 관리**
- 대화 히스토리 20개 메시지 제한 (server.js:343-345)
- 임시 WAV 파일 자동 삭제 (server.js:234)
- WebSocket 연결 종료 시 모든 리소스 정리 (server.js:108-117)
- Base64 오디오 URL 자동 해제 (client.js:351)

### **지연 시간 최적화**
- 클라이언트: 250ms 주기 실시간 전송 (client.js:165)
- 서버: 16청크(1초) 누적 후 일괄 처리 (server.js:179)
- VAD 기반 즉시 TTS 인터럽트 (지연 < 100ms)
- ScriptProcessorNode 4096 버퍼 크기로 저지연 달성

### **오디오 품질 설정**
```javascript
// client.js:105-113 - 고품질 마이크 설정
audio: {
    echoCancellation: true,     // 에코 제거
    noiseSuppression: true,     // 노이즈 억제  
    autoGainControl: true,      // 자동 게인 조절
    sampleRate: 16000,          // 16kHz 샘플 레이트
    channelCount: 1             // 모노 채널
}
```

## 🚨 문제 해결 가이드

### **1. 음성 인식 문제**
```bash
# 1단계: 브라우저 콘솔 확인
F12 → Console → 오류 메시지 분석

# 2단계: 마이크 권한 확인
Chrome: 주소창 🔒 → 마이크 → 허용
Firefox: 주소창 🛡️ → 권한 → 마이크 허용

# 3단계: API 키 확인
# .env 또는 .env.local 파일 확인
OPENAI_API_KEY=sk-...
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# 4단계: 오디오 품질 디버깅
# client.js:151 - 음성 감지 디버그 로그 활성화
console.log('Voice detection debug:', {
    voiceActivity, consecutiveFrames, threshold, isSpeaking
});
```

### **2. TTS 재생 문제**
```bash
# 1단계: AWS Polly 권한 확인
IAM → 사용자 → 권한 → polly:SynthesizeSpeech 확인

# 2단계: 브라우저 자동재생 정책
Chrome: chrome://settings/content/sound → 허용
Firefox: about:preferences#privacy → 자동재생 설정

# 3단계: 네트워크 상태 확인
# server.js:403 - TTS 생성 시작 로그
'Generating TTS for: ...'
# server.js:429 - TTS 전송 완료 로그  
'TTS audio sent to client'
```

### **3. WebSocket 연결 문제**
```bash
# 1단계: 연결 상태 모니터링
F12 → Network → WS → 연결 상태 확인

# 2단계: 서버 로그 확인
# server.js:57 - 새 연결 로그
'New connection: [sessionId]'
# server.js:109 - 연결 종료 로그
'Connection closed: [sessionId]'

# 3단계: 포트 및 방화벽 확인
netstat -an | grep 3000  # 포트 사용 확인

# 4단계: 자동 재연결 기능
# client.js:63 - 3초 후 자동 재연결
setTimeout(() => this.setupWebSocket(), 3000);
```

## 📊 실시간 모니터링 및 디버깅

### **클라이언트 디버깅 (client.js)**
```javascript
// 음성 감지 상태 (client.js:151-157)
console.log('Voice detection debug:', {
    voiceActivity,           // 현재 음성 활동 여부
    consecutiveFrames,       // 연속 음성 프레임 수
    threshold: 0.01,         // 음성 임계값
    isSpeaking              // 사용자 발화 상태
});

// TTS 인터럽트 로그 (client.js:144, 365)
'🎤 User started speaking - TTS interrupted'
'🛑 TTS interrupted: user speaking'

// 오디오 재생 상태 (client.js:347, 353)
'🔊 AI response audio loaded, playing...'
'🎵 AI response playback finished'
```

### **서버 로그 (server.js)**
```javascript
// 연결 관리 (server.js:57, 109)
'New connection: [sessionId]'           // 새 연결 생성
'Connection closed: [sessionId]'        // 연결 종료

// 오디오 처리 파이프라인 (server.js:196, 269, 403, 429)
'Processing audio chunks, total size: X' // 오디오 청크 처리 시작
'Audio RMS: X.XX'                       // RMS 에너지 레벨
'Generating TTS for: [text]...'         // TTS 생성 시작
'TTS audio sent to client'              // TTS 전송 완료

// 대화 처리 (server.js:329, 325)
'Handling transcription: [text]'        // 전사 결과 처리
'Call ended, skipping transcription'    // 종료된 호출 무시

// 에러 처리 (server.js:104, 163, 208, 359, 433)
'WebSocket message error: [error]'      // 메시지 처리 오류
'Transcribe stream error: [error]'      // 전사 스트림 오류
'Audio processing error: [error]'       // 오디오 처리 오류
'Transcription handling error: [error]' // 전사 처리 오류
'TTS error: [error]'                   // TTS 생성 오류
```

### **성능 메트릭**
```javascript
// 지연 시간 측정
- 음성 → 전사: ~1-2초 (OpenAI Whisper)
- 전사 → AI 응답: ~0.5-1초 (GPT-3.5-turbo)
- AI 응답 → TTS: ~1-2초 (AWS Polly)
- TTS 인터럽트: ~100ms (실시간 VAD)

// 메모리 사용량
- 대화 히스토리: 최대 20개 메시지
- 오디오 버퍼: 16청크(1초) 누적
- 임시 파일: 즉시 삭제
```

## 🤝 기여하기

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🔗 관련 링크

- [OpenAI Platform](https://platform.openai.com/)
- [AWS Transcribe](https://aws.amazon.com/transcribe/)
- [AWS Polly](https://aws.amazon.com/polly/)
- [WebRTC Documentation](https://webrtc.org/)

---

**🎤 VibeMe**로 자연스러운 AI 음성 대화를 경험해보세요!