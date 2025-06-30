# VibeMe - AI 실시간 음성 대화 서비스

🎤 WebRTC + AWS Transcribe + Polly 기반 실시간 AI 음성 채팅

VibeMe는 AWS Transcribe, Polly, OpenAI GPT를 활용한 실시간 AI 음성 대화 서비스입니다. WebRTC와 WebSocket을 통해 음성 인식부터 AI 응답 생성, TTS 재생까지 완전 자동화된 음성 대화 경험을 제공합니다.

## 🎯 주요 특징

- **실시간 음성 인식**: AWS Transcribe 스트리밍으로 즉시 음성을 텍스트로 변환
- **자연스러운 AI 대화**: OpenAI GPT-3.5-turbo를 통한 지능적인 대화 생성
- **고품질 음성 합성**: AWS Polly Neural TTS로 자연스러운 한국어 음성 출력
- **음성 활동 감지**: 사용자 발화 감지 시 TTS 자동 중단으로 자연스러운 대화 흐름
- **WebRTC 기반**: 실시간 오디오 스트리밍과 최적화된 품질 제어

## 🏗️ 시스템 아키텍처

```
┌─────────────────┐    WebSocket    ┌─────────────────┐
│   클라이언트     │◄──────────────►│   Express 서버   │
│  (브라우저)      │                │                │
└─────────────────┘                └─────────────────┘
         │                                   │
         │ WebRTC Audio Stream              │
         ▼                                   ▼
┌─────────────────┐                ┌─────────────────┐
│  Web Audio API  │                │  AWS Services   │
│  - 음성 캡처     │                │ - Transcribe     │
│  - 음성 감지     │                │ - Polly         │
│  - TTS 재생     │                │                │
└─────────────────┘                └─────────────────┘
                                            │
                                            ▼
                                   ┌─────────────────┐
                                   │   OpenAI API    │
                                   │   (GPT-3.5)     │
                                   └─────────────────┘
```

## 🚀 빠른 시작

### 사전 요구사항

- Node.js 18.0.0 이상
- AWS 계정 (Transcribe, Polly 서비스 활성화)
- OpenAI API 키

### 설치 및 실행

1. **저장소 클론**
   ```bash
   git clone https://github.com/nalbam/vibeme.git
   cd vibeme
   ```

2. **의존성 설치**
   ```bash
   npm install
   ```

3. **환경 변수 설정**
   ```bash
   # .env 파일 생성
   OPENAI_API_KEY=your_openai_api_key
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   AWS_REGION=ap-northeast-2
   PORT=3000
   ```

4. **서비스 실행**
   ```bash
   # 개발 모드
   npm run dev

   # 프로덕션 모드
   npm start
   ```

5. **브라우저에서 접속**
   ```
   http://localhost:3000
   ```

## 🎵 오디오 처리 파이프라인

### 입력 처리 (음성 → 텍스트)
1. **마이크 캡처**: Web Audio API로 16kHz PCM 오디오 실시간 수집
2. **음성 활동 감지**: RMS 기반 연속 프레임 분석으로 사용자 발화 감지
3. **스트리밍 전송**: 250ms 청크로 WebSocket을 통해 서버 전송
4. **실시간 전사**: AWS Transcribe 스트리밍으로 즉시 텍스트 변환

### 출력 처리 (텍스트 → 음성)
1. **AI 응답 생성**: OpenAI GPT-3.5-turbo로 자연스러운 대화 생성
2. **음성 합성**: AWS Polly Neural TTS로 고품질 한국어 음성 생성
3. **스트리밍 재생**: Base64 인코딩으로 실시간 오디오 전송 및 재생
4. **지능적 중단**: 사용자 발화 감지 시 TTS 자동 중단

## 📂 프로젝트 구조

```
vibeme/
├── server.js              # Express 서버 및 WebSocket 핸들러
├── public/
│   ├── index.html         # 메인 웹 인터페이스
│   └── client.js          # 클라이언트 WebRTC 및 음성 처리
├── package.json           # 프로젝트 의존성 및 스크립트
├── setup.sh               # 배포 스크립트
└── README.md              # 프로젝트 문서
```

## 🔧 핵심 기술 스택

### 백엔드
- **Express.js**: HTTP 서버 및 정적 파일 서빙
- **WebSocket (ws)**: 실시간 양방향 통신
- **AWS SDK**: Transcribe 스트리밍 및 Polly TTS
- **OpenAI API**: GPT-3.5-turbo 대화 생성

### 프론트엔드
- **Web Audio API**: 실시간 오디오 캡처 및 처리
- **WebRTC**: 고품질 마이크 접근 및 음성 스트리밍
- **WebSocket Client**: 서버와의 실시간 통신
- **HTML5 Audio**: TTS 오디오 재생

### AWS 서비스
- **Transcribe Streaming**: 실시간 음성 인식 (한국어)
- **Polly Neural**: 고품질 TTS (Seoyeon 음성)

## ⚙️ 핵심 기능 상세

### 음성 활동 감지 (VAD)
```javascript
// 고급 음성 활동 감지 알고리즘
- RMS(Root Mean Square) 에너지 계산
- 연속 프레임 기반 음성 활동 판단
- 동적 임계값 조정으로 배경 소음 필터링
- 최소 2프레임 연속 음성 감지로 잘못된 트리거 방지
```

### 실시간 스트리밍
```javascript
// AWS Transcribe 스트리밍 처리
- 비동기 제너레이터를 통한 오디오 스트림 생성
- 실시간 전사 결과 처리 및 부분/완전 결과 구분
- 연결 상태 모니터링 및 안전한 스트림 종료
```

### 대화 흐름 제어
```javascript
// 자연스러운 대화 경험
- 사용자 발화 감지 시 즉시 TTS 중단
- 대화 히스토리 관리 (최대 20턴)
- 실시간 대화 로그 표시
```

## 🎛️ 개발 명령어

```bash
# 개발 서버 실행 (nodemon)
npm run dev

# 프로덕션 서버 실행
npm start

# 테스트 실행
npm test

# 의존성 설치
npm install
```

## 🌐 환경 설정

### 필수 환경 변수
```bash
OPENAI_API_KEY=sk-...           # OpenAI API 키
AWS_ACCESS_KEY_ID=AKIA...       # AWS 액세스 키
AWS_SECRET_ACCESS_KEY=...       # AWS 시크릿 키
AWS_REGION=ap-northeast-2       # AWS 리전 (한국)
PORT=3000                       # 서버 포트
```

### AWS 권한 설정
IAM 사용자에게 다음 서비스 권한 필요:
- Amazon Transcribe (transcribe:StartStreamTranscription)
- Amazon Polly (polly:SynthesizeSpeech)

## 🐛 문제 해결

### 일반적인 문제

1. **마이크 접근 권한 오류**
   - HTTPS 환경에서 실행 필요
   - 브라우저 마이크 권한 확인

2. **AWS 인증 오류**
   - 환경 변수 올바른 설정 확인
   - IAM 권한 검증

3. **WebSocket 연결 실패**
   - 방화벽/프록시 설정 확인
   - 포트 접근성 검증

4. **음성 인식 정확도 낮음**
   - 마이크 품질 및 환경 소음 확인
   - 발음 명확성 및 말하기 속도 조절

### 성능 최적화

- **음성 감지 임계값 조정**: `client.js`의 `voiceThreshold` 값 튜닝
- **오디오 청크 크기**: 네트워크 환경에 따라 전송 간격 조정
- **대화 히스토리 제한**: 메모리 사용량 관리를 위한 히스토리 길이 제한

## 📈 성능 지표

- **음성 인식 지연시간**: ~200-500ms
- **AI 응답 생성**: ~1-2초
- **TTS 생성 및 재생**: ~500ms-1초
- **전체 응답 시간**: ~2-4초

## 🤝 기여하기

1. Fork 프로젝트
2. Feature 브랜치 생성 (`git checkout -b feature/AmazingFeature`)
3. 변경사항 커밋 (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치에 Push (`git push origin feature/AmazingFeature`)
5. Pull Request 생성

## 📄 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 🙏 감사의 말

- AWS Transcribe 및 Polly 서비스
- OpenAI GPT API
- Web Audio API 및 WebRTC 표준
