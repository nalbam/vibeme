# VibeMe - AI Voice Chatbot Demo

🎤 실시간 AI 음성 챗봇 데모 서비스

## 📋 주요 기능

- **AI 대화**: OpenAI GPT를 활용한 자연스러운 한국어 대화
- **음성 합성**: AWS Polly를 통한 실시간 TTS (Text-to-Speech)
- **실시간 통신**: WebSocket 기반 즉시 응답
- **웹 기반 UI**: 간단하고 직관적인 채팅 인터페이스

## 🚀 빠른 시작

### 1. 저장소 복제 및 의존성 설치

```bash
git clone <repository-url>
cd vibeme
npm install
```

### 2. 환경 변수 설정

`.env.example` 파일을 `.env`로 복사하고 필요한 API 키를 설정합니다:

```bash
cp .env.example .env
```

`.env` 파일 수정:
```env
# OpenAI API Configuration
OPENAI_API_KEY="your-openai-api-key-here"

# AWS Configuration  
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_REGION="ap-northeast-2"

# Server Configuration
PORT=3000
NODE_ENV=development
```

### 3. 개발 서버 실행

```bash
npm run dev
```
또는
```bash
npm start
```

서버가 시작되면 `http://localhost:3000`에서 데모를 확인할 수 있습니다.

## 🛠️ 기술 스택

### Backend
- **Node.js**: 런타임 환경
- **Express**: 웹 프레임워크
- **WebSocket (ws)**: 실시간 통신
- **OpenAI API**: GPT 모델 활용
- **AWS Polly**: 음성 합성 (TTS)

### Frontend
- **HTML5/CSS3**: UI 구성
- **Vanilla JavaScript**: 클라이언트 로직
- **Web Audio API**: 오디오 재생

## 📁 프로젝트 구조

```
vibeme/
├── server.js              # 메인 서버 파일
├── package.json           # 프로젝트 설정
├── .env.example          # 환경 변수 템플릿
├── services/             # 서비스 모듈
│   ├── openai.js        # OpenAI API 서비스
│   └── polly.js         # AWS Polly TTS 서비스
└── public/              # 클라이언트 파일
    ├── index.html       # 메인 페이지
    └── client.js        # 클라이언트 스크립트
```

## 🔧 주요 구성 요소

### 1. OpenAI 서비스 (`services/openai.js`)
- GPT 모델을 활용한 대화 생성
- 대화 히스토리 관리
- 스트리밍 응답 지원

### 2. AWS Polly 서비스 (`services/polly.js`)  
- 한국어 TTS 음성 합성
- Base64 오디오 인코딩
- 긴 텍스트 청크 분할 처리

### 3. WebSocket 서버
- 실시간 메시지 전송
- 세션별 대화 히스토리 관리
- 오디오 스트리밍

### 4. 클라이언트 인터페이스
- 반응형 채팅 UI
- 실시간 오디오 재생
- 연결 상태 표시

## 🔐 필수 설정

### OpenAI API 키 발급
1. [OpenAI Platform](https://platform.openai.com/)에서 계정 생성
2. API 키 생성 후 `.env` 파일에 설정

### AWS 설정
1. AWS 계정 생성 및 IAM 사용자 생성
2. Polly 서비스 권한 부여
3. Access Key와 Secret Key를 `.env` 파일에 설정

## 🎯 사용법

1. 웹 브라우저에서 `http://localhost:3000` 접속
2. 텍스트 입력창에 메시지 입력
3. 전송 버튼 클릭 또는 Enter 키 입력
4. AI 응답 텍스트가 화면에 표시됨
5. 자동으로 음성으로 변환되어 재생됨
6. 🔇 버튼으로 음성 재생 중단 가능

## 🚨 문제 해결

### 1. OpenAI API 오류
- API 키가 올바른지 확인
- 사용량 한도 초과 여부 확인
- 네트워크 연결 상태 확인

### 2. AWS Polly 오류  
- AWS 자격 증명 확인
- 리전 설정 확인 (한국어는 ap-northeast-2 권장)
- IAM 권한 설정 확인

### 3. 오디오 재생 안됨
- 브라우저 자동재생 정책 확인
- HTTPS 환경에서 테스트
- 브라우저 콘솔에서 오류 메시지 확인

## 📊 성능 최적화

- 대화 히스토리는 최근 20개 메시지로 제한
- 긴 텍스트는 자동으로 청크 분할하여 TTS 처리
- 오디오 파일은 사용 후 자동으로 메모리에서 해제

## 🤝 기여하기

1. Fork the repository
2. Create a feature branch
3. Commit your changes  
4. Push to the branch
5. Create a Pull Request

## 📄 라이선스

MIT License