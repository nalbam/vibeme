class CharacterManager {
    constructor() {
        this.lipSyncMesh = null;
        this.lipSyncMorphs = {};
        this.isAnimating = false;
        this.currentLipSyncValue = 0;
        this.targetLipSyncValue = 0;
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
        this.renderer = new THREE.WebGLRenderer({ canvas: canvas });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        
        // 조명
        this.scene.add(new THREE.AmbientLight(0xffffff, 1));
        
        // GLB 로드
        this.loadCharacter();
        this.animate();
    }

    loadCharacter() {
        const loader = new THREE.GLTFLoader();
        loader.load('./glbs/avata02.glb', (gltf) => {
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
            
            // 얼굴 클로즈업을 위한 크기 조정 (더 크게)
            const scale = 2.5 / Math.max(size.x, size.y, size.z);
            model.scale.setScalar(scale);
            
            // 얼굴이 화면 중앙에 오도록 Y축 조정 (아래로)
            model.position.y -= 0.4;
            
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
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // 립싱크 애니메이션 업데이트
        if (this.isAnimating) {
            this.updateLipSync();
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    updateLipSync() {
        if (!this.lipSyncMesh || Object.keys(this.lipSyncMorphs).length === 0) return;

        // 간단한 사인파 기반 립싱크 (테스트용)
        const time = Date.now() * 0.01;
        this.targetLipSyncValue = (Math.sin(time) + 1) * 0.5; // 0-1 범위

        // 부드러운 전환
        this.currentLipSyncValue += (this.targetLipSyncValue - this.currentLipSyncValue) * 0.1;

        // 모프 타겟 적용
        for (const morphIndex of Object.values(this.lipSyncMorphs)) {
            if (this.lipSyncMesh.morphTargetInfluences) {
                this.lipSyncMesh.morphTargetInfluences[morphIndex] = this.currentLipSyncValue;
            }
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