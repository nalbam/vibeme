class CharacterManager {
    constructor() {
        this.character = null;
        this.lipSyncMesh = null;
        this.lipSyncMorphs = {};
        this.eyeBlinkMorphs = {};
        this.smileMorphs = {};
        this.isAnimating = false;
        this.currentLipSyncValue = 0;
        this.targetLipSyncValue = 0;
        this.lipSyncSpeed = 0.15;

        // 자연스러운 움직임을 위한 변수들
        this.idleTime = 0;
        this.blinkTime = 0;
        this.nextBlinkTime = Math.random() * 3 + 2; // 2-5초 후 눈 깜빡임
        this.smileTime = 0;
        this.nextSmileTime = Math.random() * 10 + 8; // 8-18초 후 미소
        this.isSmiling = false;
        this.headRotation = { x: 0, y: 0, z: 0 };
        this.targetHeadRotation = { x: 0, y: 0, z: 0 };
        this.originalPosition = null;
        this.originalRotation = null;

        // 마우스 추적 변수들
        this.mousePosition = { x: 0, y: 0 };
        this.targetMouseRotation = { x: 0, y: 0 };
        this.currentMouseRotation = { x: 0, y: 0 };
        this.mouseTrackingIntensity = 0.3; // 마우스 추적 강도
        this.mouseTrackingSpeed = 0.05; // 마우스 추적 속도

        this.init();
    }

    init() {
        const canvas = document.getElementById('characterCanvas');
        const container = canvas.parentElement;

        // 씬
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);

        // 카메라 - 얼굴 클로즈업
        this.camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 1000);
        this.camera.position.set(0, 0, 0.5);
        this.camera.lookAt(0, 0, 0);

        // 렌더러
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // 그림자 및 톤 매핑 설정
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        // 자연스러운 조명 설정
        this.setupLighting();

        // 마우스 이벤트 리스너 설정
        this.setupMouseTracking();

        // GLB 로드
        this.loadCharacter();
        this.animate();
    }

    setupLighting() {
        // 부드러운 환경광 (전체적인 기본 조명)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        // 주요 조명 (얼굴 앞쪽에서 비추는 키 라이트)
        const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
        keyLight.position.set(0, 0.5, 1);
        keyLight.target.position.set(0, 0, 0);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 1024;
        keyLight.shadow.mapSize.height = 1024;
        keyLight.shadow.camera.near = 0.1;
        keyLight.shadow.camera.far = 5;
        keyLight.shadow.bias = -0.0001;
        this.scene.add(keyLight);
        this.scene.add(keyLight.target);

        // 채움 조명 (그림자를 부드럽게 하는 필 라이트)
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-0.5, 0.2, 0.5);
        this.scene.add(fillLight);

        // 림 라이트 (윤곽을 살리는 백라이트)
        const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
        rimLight.position.set(0, 0.3, -1);
        this.scene.add(rimLight);

        // 부드러운 포인트 라이트 (얼굴에 생동감)
        const faceLight = new THREE.PointLight(0xfff5e6, 0.5, 2);
        faceLight.position.set(0, 0.2, 0.8);
        this.scene.add(faceLight);

        console.log('Natural lighting setup complete');
    }

    setupMouseTracking() {
        const canvas = document.getElementById('characterCanvas');
        const container = canvas.parentElement;

        canvas.addEventListener('mousemove', (event) => {
            const rect = canvas.getBoundingClientRect();
            
            // 캔버스 내에서의 마우스 위치를 -1 ~ 1 범위로 정규화
            const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            this.mousePosition.x = x;
            this.mousePosition.y = y;
            
            // 마우스 위치에 따른 목표 회전값 계산
            this.targetMouseRotation.y = x * this.mouseTrackingIntensity; // 좌우 회전
            this.targetMouseRotation.x = y * this.mouseTrackingIntensity * 0.5; // 상하 회전 (약간 제한)
        });

        // 마우스가 캔버스를 벗어나면 중앙으로 돌아가기
        canvas.addEventListener('mouseleave', () => {
            this.targetMouseRotation.x = 0;
            this.targetMouseRotation.y = 0;
        });

        console.log('Mouse tracking setup complete');
    }

    loadCharacter() {
        const loader = new THREE.GLTFLoader();
        loader.load('./glbs/avata03.glb', (gltf) => {
            const model = gltf.scene;

            // 모델 크기 확인
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            console.log('Model size:', size);
            console.log('Model center:', center);

            // morphTargetDictionary 확인
            this.checkMorphTargets(model);

            // 모델을 원점으로 이동
            model.position.copy(center).multiplyScalar(-1);

            // 얼굴 클로즈업을 위한 크기 조정 (자연스러운 비율 유지)
            const scale = 2.5 / Math.max(size.x, size.y, size.z);
            model.scale.set(scale, scale, scale); // 동일한 비율로 확대

            // 얼굴이 화면 중앙에 오도록 Y축 조정 (위로)
            model.position.y -= 0.4;

            this.character = model;

            // 그림자 설정
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // 원래 위치와 회전 저장
            this.originalPosition = {
                x: model.position.x,
                y: model.position.y,
                z: model.position.z
            };
            this.originalRotation = {
                x: model.rotation.x,
                y: model.rotation.y,
                z: model.rotation.z
            };

            this.scene.add(model);
            console.log('Character loaded');
        });
    }

    checkMorphTargets(model) {
        console.log('=== Checking MorphTargets ===');

        model.traverse((child) => {
            if (child.isMesh) {
                console.log(`Mesh name: ${child.name}`);

                if (child.morphTargetDictionary) {
                    console.log('✓ morphTargetDictionary found!');
                    console.log('Available morph targets:', Object.keys(child.morphTargetDictionary));

                    // 립싱크용 모프 타겟 찾기
                    const lipSyncTargets = [
                        'mouthOpen', 'mouth_open', 'MouthOpen', 'Mouth_Open',
                        'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U',
                        'A', 'E', 'I', 'O', 'U', 'a', 'e', 'i', 'o', 'u'
                    ];

                    for (const target of lipSyncTargets) {
                        if (child.morphTargetDictionary[target] !== undefined) {
                            this.lipSyncMorphs[target] = child.morphTargetDictionary[target];
                            this.lipSyncMesh = child;
                            console.log(`✓ Found lip sync morph: ${target} (index: ${child.morphTargetDictionary[target]})`);
                        }
                    }

                    // 눈 깜빡임용 모프 타겟 찾기
                    const eyeBlinkTargets = [
                        'eyeBlinkLeft', 'eyeBlinkRight', 'blink', 'Blink',
                        'eyeClosed', 'eyesClose', 'EyeClose'
                    ];

                    for (const target of eyeBlinkTargets) {
                        if (child.morphTargetDictionary[target] !== undefined) {
                            this.eyeBlinkMorphs[target] = child.morphTargetDictionary[target];
                            console.log(`✓ Found eye blink morph: ${target} (index: ${child.morphTargetDictionary[target]})`);
                        }
                    }

                    // 미소용 모프 타겟 찾기
                    const smileTargets = [
                        'mouthSmile', 'smile', 'Smile', 'happy', 'Happy',
                        'mouthHappy', 'grin', 'Grin'
                    ];

                    for (const target of smileTargets) {
                        if (child.morphTargetDictionary[target] !== undefined) {
                            this.smileMorphs[target] = child.morphTargetDictionary[target];
                            console.log(`✓ Found smile morph: ${target} (index: ${child.morphTargetDictionary[target]})`);
                        }
                    }

                    // 첫 번째 모프를 기본값으로 사용
                    if (Object.keys(this.lipSyncMorphs).length === 0) {
                        const firstMorph = Object.keys(child.morphTargetDictionary)[0];
                        if (firstMorph) {
                            this.lipSyncMorphs['default'] = child.morphTargetDictionary[firstMorph];
                            this.lipSyncMesh = child;
                            console.log(`Using default morph for lip sync: ${firstMorph}`);
                        }
                    }
                } else {
                    console.log('✗ No morphTargetDictionary found');
                }
                console.log('---');
            }
        });

        console.log('=== MorphTarget Check Complete ===');
        console.log('Lip sync morphs available:', Object.keys(this.lipSyncMorphs));
        console.log('Smile morphs available:', Object.keys(this.smileMorphs));
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const deltaTime = 0.016; // ~60fps
        this.idleTime += deltaTime;
        this.blinkTime += deltaTime;
        this.smileTime += deltaTime;

        // 자연스러운 유휴 애니메이션
        this.updateIdleAnimation();

        // 눈 깜빡임
        this.updateEyeBlink();

        // 미소 애니메이션
        this.updateSmile();

        // 미세한 머리 움직임
        this.updateHeadMovement();

        // 마우스 추적 업데이트
        this.updateMouseTracking();

        // 립싱크 애니메이션 업데이트
        if (this.isAnimating) {
            this.updateLipSync();
        }

        this.renderer.render(this.scene, this.camera);
    }

    updateIdleAnimation() {
        if (!this.character || !this.originalPosition) return;

        // 자연스러운 호흡 애니메이션 (원래 위치 기준)
        const breathIntensity = 0.002;
        const breathSpeed = 0.8;
        const breathOffset = Math.sin(this.idleTime * breathSpeed) * breathIntensity;

        // 원래 위치를 기준으로 상대적 움직임 (스케일 변화 제거)
        this.character.position.y = this.originalPosition.y + breathOffset;
    }

    updateEyeBlink() {
        if (!this.lipSyncMesh || Object.keys(this.eyeBlinkMorphs).length === 0) return;

        // 자연스러운 눈 깜빡임
        if (this.blinkTime >= this.nextBlinkTime) {
            this.triggerBlink();
            this.blinkTime = 0;
            this.nextBlinkTime = Math.random() * 4 + 2; // 2-6초 후 다음 깜빡임
        }
    }

    triggerBlink() {
        if (!this.lipSyncMesh || Object.keys(this.eyeBlinkMorphs).length === 0) return;

        // 빠른 눈 깜빡임 애니메이션
        for (const morphIndex of Object.values(this.eyeBlinkMorphs)) {
            if (this.lipSyncMesh.morphTargetInfluences) {
                // 0.15초 동안 눈 깜빡임
                this.lipSyncMesh.morphTargetInfluences[morphIndex] = 1;
                setTimeout(() => {
                    if (this.lipSyncMesh && this.lipSyncMesh.morphTargetInfluences) {
                        this.lipSyncMesh.morphTargetInfluences[morphIndex] = 0;
                    }
                }, 150);
            }
        }
    }

    updateSmile() {
        if (!this.lipSyncMesh || Object.keys(this.smileMorphs).length === 0) return;

        // 자연스러운 미소
        if (this.smileTime >= this.nextSmileTime && !this.isSmiling) {
            this.triggerSmile();
            this.smileTime = 0;
            this.nextSmileTime = Math.random() * 15 + 10; // 10-25초 후 다음 미소
        }
    }

    triggerSmile() {
        if (!this.lipSyncMesh || Object.keys(this.smileMorphs).length === 0) return;

        this.isSmiling = true;
        console.log('😊 Character is smiling');

        // 부드럽게 미소 시작
        for (const morphIndex of Object.values(this.smileMorphs)) {
            if (this.lipSyncMesh.morphTargetInfluences) {
                // 0.5초에 걸쳐 미소 생성
                this.animateSmile(morphIndex, 0, 0.6, 500);
                
                // 2초 후 미소 유지하다가 1초에 걸쳐 사라짐
                setTimeout(() => {
                    this.animateSmile(morphIndex, 0.6, 0, 1000);
                    setTimeout(() => {
                        this.isSmiling = false;
                    }, 1000);
                }, 2000);
            }
        }
    }

    animateSmile(morphIndex, startValue, endValue, duration) {
        if (!this.lipSyncMesh || !this.lipSyncMesh.morphTargetInfluences) return;

        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease-in-out 함수로 부드러운 애니메이션
            const eased = progress < 0.5 
                ? 2 * progress * progress 
                : -1 + (4 - 2 * progress) * progress;
            
            const currentValue = startValue + (endValue - startValue) * eased;
            
            if (this.lipSyncMesh && this.lipSyncMesh.morphTargetInfluences) {
                this.lipSyncMesh.morphTargetInfluences[morphIndex] = currentValue;
            }
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }

    updateHeadMovement() {
        if (!this.character || !this.originalRotation) return;

        // 자연스러운 머리 움직임
        const headSpeed = 0.025;
        const headIntensity = 0.005;

        // 목표 회전값을 조금 더 자주 변경
        if (Math.random() < 0.0008) {
            this.targetHeadRotation.x = (Math.random() - 0.5) * headIntensity;
            this.targetHeadRotation.y = (Math.random() - 0.5) * headIntensity;
            this.targetHeadRotation.z = (Math.random() - 0.5) * headIntensity * 0.3;
        }

        // 부드럽게 목표값으로 이동
        this.headRotation.x += (this.targetHeadRotation.x - this.headRotation.x) * headSpeed;
        this.headRotation.y += (this.targetHeadRotation.y - this.headRotation.y) * headSpeed;
        this.headRotation.z += (this.targetHeadRotation.z - this.headRotation.z) * headSpeed;

        // 원래 회전을 기준으로 상대적 회전 적용 (자연스러운 움직임만)
        // 마우스 추적은 별도로 처리됨
        this.character.rotation.x = this.originalRotation.x + this.headRotation.x + this.currentMouseRotation.x;
        this.character.rotation.y = this.originalRotation.y + this.headRotation.y + this.currentMouseRotation.y;
        this.character.rotation.z = this.originalRotation.z + this.headRotation.z;
    }

    updateMouseTracking() {
        if (!this.character) return;

        // 마우스 추적 회전값을 부드럽게 보간
        this.currentMouseRotation.x += (this.targetMouseRotation.x - this.currentMouseRotation.x) * this.mouseTrackingSpeed;
        this.currentMouseRotation.y += (this.targetMouseRotation.y - this.currentMouseRotation.y) * this.mouseTrackingSpeed;
    }

    updateLipSync() {
        if (!this.lipSyncMesh || Object.keys(this.lipSyncMorphs).length === 0) return;

        // 더 부드럽고 반응적인 립싱크
        this.currentLipSyncValue += (this.targetLipSyncValue - this.currentLipSyncValue) * this.lipSyncSpeed;

        // 더 자연스러운 입 움직임을 위한 랜덤 변화
        const naturalVariation = (Math.random() - 0.5) * 0.1;
        const finalLipSyncValue = Math.max(0, Math.min(1, this.currentLipSyncValue + naturalVariation));

        // 모프 타겟 적용
        for (const morphIndex of Object.values(this.lipSyncMorphs)) {
            if (this.lipSyncMesh.morphTargetInfluences) {
                this.lipSyncMesh.morphTargetInfluences[morphIndex] = finalLipSyncValue;
            }
        }
    }

    updateLipSyncFromAudio(audioData) {
        if (!this.lipSyncMesh || Object.keys(this.lipSyncMorphs).length === 0) return;

        // 더 정교한 오디오 분석
        let sum = 0;
        let peak = 0;
        for (let i = 0; i < audioData.length; i++) {
            const abs = Math.abs(audioData[i]);
            sum += abs;
            peak = Math.max(peak, abs);
        }

        const average = sum / audioData.length;

        // RMS (Root Mean Square) 계산으로 더 정확한 음성 강도
        let rms = 0;
        for (let i = 0; i < audioData.length; i++) {
            rms += audioData[i] * audioData[i];
        }
        rms = Math.sqrt(rms / audioData.length);

        // 평균과 RMS를 조합하여 더 자연스러운 립싱크
        const intensity = (average * 0.7 + rms * 0.3) * 5;

        // 피크 값으로 급격한 소리 변화 감지
        const peakBoost = peak > 0.3 ? peak * 0.5 : 0;

        // 최종 립싱크 값 (0-1 범위)
        this.targetLipSyncValue = Math.min(1, intensity + peakBoost);

        // 립싱크 속도를 음성 강도에 따라 조정
        this.lipSyncSpeed = 0.1 + (intensity * 0.1);

        if (!this.isAnimating) {
            this.isAnimating = true;
        }
    }

    onAIStartSpeaking() {
        console.log('AI started speaking - starting lip sync');
        this.isAnimating = true;
    }

    onAIStopSpeaking() {
        console.log('AI stopped speaking - stopping lip sync');
        this.isAnimating = false;

        // 입을 닫기
        if (this.lipSyncMesh) {
            for (const morphIndex of Object.values(this.lipSyncMorphs)) {
                if (this.lipSyncMesh.morphTargetInfluences) {
                    this.lipSyncMesh.morphTargetInfluences[morphIndex] = 0;
                }
            }
        }
    }
}

// 전역 캐릭터 매니저 인스턴스
window.characterManager = new CharacterManager();
