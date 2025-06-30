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
- **AWS Transcribe Streaming**: 실시간 한국어 음성 인식 (STT)
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

### **시스템 아키텍처**
```
Client (WebRTC) → WebSocket → AWS Transcribe Streaming → OpenAI GPT → AWS Polly → Client
```

### **기술 스택**

- **Backend**: Node.js, Express, WebSocket, OpenAI API, AWS SDK
- **Frontend**: WebRTC, Web Audio API, Vanilla JavaScript
- **AI Services**: AWS Transcribe, OpenAI GPT-3.5, AWS Polly
- **Audio**: 16kHz PCM, Echo Cancellation, Noise Suppression

## 📁 프로젝트 구조

```
vibeme/
├── server.js              # 메인 서버 (WebSocket + AI 통합)
├── package.json           # 프로젝트 설정 및 의존성
├── CLAUDE.md             # 개발자 가이드 (Claude Code용)
└── public/               # 프론트엔드
    ├── index.html        # 메인 UI (전화 통화 스타일)
    └── client.js         # WebRTC 클라이언트 로직
```

## 🛠️ 개발 환경 설정

### **필수 요구 사항**

- **Node.js**: >= 18.0.0
- **OpenAI API Key**: GPT 대화 생성용
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

## 🚨 문제 해결

### **음성 인식 안됨**
1. 브라우저 콘솔 오류 확인 (F12)
2. 마이크 권한 허용 확인
3. API 키 설정 확인 (.env 파일)

### **TTS 재생 안됨**
1. AWS Polly 권한 확인
2. 브라우저 자동재생 정책 설정
3. 네트워크 연결 상태 확인

### **연결 끊김**
1. WebSocket 연결 상태 모니터링
2. 방화벽 설정 확인 (포트 3000)
3. 네트워크 안정성 확인

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
- [AWS Polly](https://aws.amazon.com/polly/)
- [WebRTC Documentation](https://webrtc.org/)
- [개발 가이드](CLAUDE.md) - Claude Code 개발자용

---

**🎤 VibeMe**로 자연스러운 AI 음성 대화를 경험해보세요!