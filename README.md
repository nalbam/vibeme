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
// RMS 기반 고급 음성 감지
- 임계값: 0.02 (엄격한 기준)
- 연속성 검증: 최소 3프레임 연속 음성
- 이중 검증: 현재 + 평균 RMS 조건
- 버퍼 크기: 15 샘플로 안정적 판단
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

## 🔧 성능 최적화

### **메모리 관리**
- 대화 히스토리 20개 메시지로 제한
- 오디오 파일 사용 후 자동 해제
- WebSocket 연결 정리 시 모든 리소스 해제

### **지연 시간 최적화**
- 250ms 주기 오디오 전송으로 빠른 반응성
- 1초 분량 누적으로 안정적 처리
- VAD 기반 즉시 인터럽트

### **오디오 품질**
- 16kHz 샘플 레이트
- 16-bit PCM 인코딩
- Echo Cancellation 및 Noise Suppression 활성화

## 🚨 문제 해결

### **1. 음성 인식 안됨**
```bash
# 브라우저 콘솔 확인
F12 → Console → 오류 메시지 확인

# 마이크 권한 확인
Settings → Privacy → Microphone → 허용

# AWS 자격 증명 확인
AWS_ACCESS_KEY_ID 및 AWS_SECRET_ACCESS_KEY 설정
```

### **2. TTS 재생 안됨**
```bash
# AWS Polly 권한 확인
IAM → Policies → polly:SynthesizeSpeech 권한

# 브라우저 자동재생 정책
Chrome → Settings → Privacy → Site Settings → Sound
```

### **3. 연결 끊김**
```bash
# WebSocket 연결 상태 확인
Network → WS → 연결 상태 모니터링

# 방화벽 및 프록시 설정 확인
Port 3000 접근 허용
```

## 📊 모니터링 및 디버깅

### **클라이언트 디버깅**
```javascript
// 음성 감지 상태 확인
console.log('Voice detection debug:', {
    voiceActivity,
    consecutiveFrames,
    threshold,
    isSpeaking
});
```

### **서버 로그**
```javascript
// 오디오 처리 상태
"Processing audio chunks, total size: X"
"Audio RMS: X.XX"
"Generating TTS for: ..."
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