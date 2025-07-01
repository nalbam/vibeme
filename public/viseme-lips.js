class VisemeLips {
    constructor() {
        this.svgElement = null;
        this.lipPath = null;
        this.currentViseme = 'rest';
        this.isAnimating = false;
        this.animationSpeed = 0.15;
        this.currentMorphValue = 0;
        this.targetMorphValue = 0;
        
        // Viseme 형태별 SVG 패스 정의 (더 크게, 중앙 배치)
        this.visemeShapes = {
            'rest': 'M80,60 Q100,55 120,60 Q100,70 80,60 Z',           // 휴식 상태
            'aa': 'M70,50 Q100,35 130,50 Q100,85 70,50 Z',            // 'ah' 소리 (크게 벌림)
            'E': 'M75,55 Q100,50 125,55 Q100,75 75,55 Z',             // 'eh' 소리 (중간 벌림)
            'I': 'M80,58 Q100,55 120,58 Q100,68 80,58 Z',             // 'ih' 소리 (약간 벌림)
            'O': 'M85,55 Q100,45 115,55 Q100,75 85,55 Z',             // 'oh' 소리 (원형)
            'U': 'M88,58 Q100,50 112,58 Q100,70 88,58 Z',             // 'oo' 소리 (작은 원형)
            'B': 'M80,62 Q100,60 120,62 Q100,65 80,62 Z',             // 'b', 'p', 'm' 소리 (입술 닫힘)
            'F': 'M80,58 Q100,55 120,58 Q100,70 80,58 Z',             // 'f', 'v' 소리
            'TH': 'M78,58 Q100,52 122,58 Q100,70 78,58 Z',            // 'th' 소리
            'S': 'M82,60 Q100,56 118,60 Q100,68 82,60 Z',             // 's', 'z' 소리
            'SH': 'M85,58 Q100,52 115,58 Q100,70 85,58 Z',            // 'sh', 'zh' 소리
            'L': 'M80,58 Q100,55 120,58 Q100,70 80,58 Z',             // 'l' 소리
            'R': 'M82,58 Q100,52 118,58 Q100,68 82,58 Z',             // 'r' 소리
            'W': 'M86,55 Q100,48 114,55 Q100,72 86,55 Z'              // 'w' 소리
        };

        this.init();
    }

    init() {
        this.createSVG();
        this.animate();
    }

    createSVG() {
        // SVG 컨테이너 생성
        const container = document.getElementById('characterCanvas').parentElement;
        
        // SVG 오버레이 생성 (더 크게)
        this.svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svgElement.setAttribute('width', '200');
        this.svgElement.setAttribute('height', '120');
        this.svgElement.style.position = 'absolute';
        this.svgElement.style.bottom = '60px';
        this.svgElement.style.left = '50%';
        this.svgElement.style.transform = 'translateX(-50%)';
        this.svgElement.style.pointerEvents = 'none';
        this.svgElement.style.zIndex = '10';

        // 입술 패스 생성
        this.lipPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.lipPath.setAttribute('d', this.visemeShapes['rest']);
        this.lipPath.setAttribute('fill', '#ff6b6b');
        this.lipPath.setAttribute('stroke', '#d63031');
        this.lipPath.setAttribute('stroke-width', '2');
        this.lipPath.style.filter = 'drop-shadow(0 3px 6px rgba(0,0,0,0.4))';

        this.svgElement.appendChild(this.lipPath);
        container.appendChild(this.svgElement);

        console.log('Viseme SVG lips created');
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // 부드러운 모프 보간
        this.currentMorphValue += (this.targetMorphValue - this.currentMorphValue) * this.animationSpeed;

        // 현재 viseme에 맞는 입술 모양 업데이트
        this.updateLipShape();
    }

    updateLipShape() {
        if (!this.lipPath) return;

        const currentShape = this.visemeShapes[this.currentViseme] || this.visemeShapes['rest'];
        
        // 간단하게 직접 패스 적용 (보간 없이 테스트)
        this.lipPath.setAttribute('d', currentShape);
        
        console.log('Updated lip shape to:', this.currentViseme, 'Morph value:', this.currentMorphValue);
    }

    interpolatePaths(path1, path2, t) {
        // 간단한 패스 보간 (실제로는 더 복잡한 SVG 패스 보간이 필요)
        // 여기서는 기본적인 구현만 제공
        if (t <= 0) return path1;
        if (t >= 1) return path2;
        
        // t 값에 따라 현재 viseme 모양 반환
        return t > 0.5 ? path2 : path1;
    }

    // 오디오 데이터에서 viseme 추정
    analyzeAudioForViseme(audioData) {
        if (!audioData || audioData.length === 0) {
            this.setViseme('rest', 0);
            return;
        }

        // RMS 계산
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i] * audioData[i];
        }
        const rms = Math.sqrt(sum / audioData.length);

        // 주파수 분석을 통한 간단한 viseme 추정
        const intensity = Math.min(rms * 5, 1);

        console.log('Viseme Audio Analysis - RMS:', rms, 'Intensity:', intensity);

        if (intensity < 0.1) {
            this.setViseme('rest', 0);
        } else if (intensity < 0.3) {
            // 낮은 강도 - 작은 입 모양
            this.setViseme('I', intensity);
        } else if (intensity < 0.6) {
            // 중간 강도 - 중간 입 모양
            this.setViseme('E', intensity);
        } else {
            // 높은 강도 - 큰 입 모양
            this.setViseme('aa', intensity);
        }
    }

    // 주파수 기반 viseme 분석 (더 정교함)
    analyzeFrequencyForViseme(frequencyData) {
        if (!frequencyData || frequencyData.length === 0) {
            this.setViseme('rest', 0);
            return;
        }

        // 주파수 대역별 에너지 계산
        const lowFreq = this.getFrequencyBandEnergy(frequencyData, 0, 10);     // ~200Hz
        const midFreq = this.getFrequencyBandEnergy(frequencyData, 10, 50);    // 200Hz~1kHz  
        const highFreq = this.getFrequencyBandEnergy(frequencyData, 50, 100);  // 1kHz~2kHz

        const totalEnergy = lowFreq + midFreq + highFreq;

        console.log('Viseme Frequency Analysis - Low:', lowFreq, 'Mid:', midFreq, 'High:', highFreq, 'Total:', totalEnergy);

        if (totalEnergy < 0.05) { // 임계값을 낮춤
            this.setViseme('rest', 0);
            return;
        }

        // 주파수 특성에 따른 viseme 결정
        const lowRatio = lowFreq / totalEnergy;
        const midRatio = midFreq / totalEnergy;
        const highRatio = highFreq / totalEnergy;

        let viseme = 'rest';
        let intensity = Math.min(totalEnergy * 3, 1); // 강도를 증폭

        if (lowRatio > 0.6) {
            // 저주파 우세 - 모음 'aa', 'O'
            viseme = intensity > 0.5 ? 'aa' : 'O';
        } else if (midRatio > 0.5) {
            // 중주파 우세 - 모음 'E', 'I'
            viseme = intensity > 0.5 ? 'E' : 'I';
        } else if (highRatio > 0.4) {
            // 고주파 우세 - 자음 'S', 'SH'
            viseme = 'S';
        } else {
            // 균등한 분포 - 기본 모음
            viseme = 'E';
        }

        console.log('Selected Viseme:', viseme, 'Intensity:', intensity);
        this.setViseme(viseme, intensity);
    }

    getFrequencyBandEnergy(frequencyData, startBin, endBin) {
        let sum = 0;
        for (let i = startBin; i < Math.min(endBin, frequencyData.length); i++) {
            sum += frequencyData[i] / 255.0;
        }
        return sum / (endBin - startBin);
    }

    setViseme(viseme, intensity = 1) {
        console.log('Setting Viseme:', viseme, 'Intensity:', intensity);
        this.currentViseme = viseme;
        this.targetMorphValue = Math.max(0, Math.min(1, intensity));
        this.isAnimating = this.targetMorphValue > 0;
    }

    // AI 말하기 시작
    onAIStartSpeaking() {
        console.log('Viseme lips: AI started speaking');
        this.isAnimating = true;
    }

    // AI 말하기 종료
    onAIStopSpeaking() {
        console.log('Viseme lips: AI stopped speaking');
        this.isAnimating = false;
        this.setViseme('rest', 0);
    }

    // 오디오 데이터로 립싱크 업데이트
    updateFromAudio(audioData) {
        if (!this.isAnimating) return;
        this.analyzeAudioForViseme(audioData);
    }

    // 주파수 데이터로 립싱크 업데이트 (더 정확함)
    updateFromFrequency(frequencyData) {
        if (!this.isAnimating) return;
        this.analyzeFrequencyForViseme(frequencyData);
    }

    // SVG 제거
    destroy() {
        if (this.svgElement && this.svgElement.parentElement) {
            this.svgElement.parentElement.removeChild(this.svgElement);
        }
    }
}

// 전역 viseme lips 인스턴스
window.visemeLips = new VisemeLips();