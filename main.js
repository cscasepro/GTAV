import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// 1. Scena, Kamera i Renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// 2. Oświetlenie
scene.add(new THREE.AmbientLight(0xffffff, 1.2));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
dirLight.position.set(10, 25, 10);
scene.add(dirLight);

// 3. Podłoga z siatką
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
scene.add(new THREE.GridHelper(300, 150, 0x000000, 0x555555));

// Zmienne postaci i animacji
let mixer;
let franklin;
let rootBone = null;
const actions = {};
let activeAction = null;

// Stany postaci
let moveMode = 'walk'; // 'walk', 'pistol', 'rifle', 'swim'
let isLockedInAction = false; // Blokada ruchu podczas ciosu / śmierci
let isDead = false;

const keys = { w: false, s: false, a: false, d: false };
const loader = new FBXLoader();

// Płynne przełączanie animacji
function playAnimation(name, loop = true, fadeDuration = 0.2) {
    const nextAction = actions[name];
    if (!nextAction) return;

    if (activeAction === nextAction && nextAction.isRunning()) return;

    nextAction.reset();
    nextAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
    nextAction.clampWhenFinished = !loop;
    nextAction.play();

    if (activeAction && activeAction !== nextAction) {
        activeAction.crossFadeTo(nextAction, fadeDuration, true);
    }
    activeAction = nextAction;
}

// 4. Ładowanie głównego modelu z pliku Walking.fbx
loader.load('Walking.fbx', (object) => {
    franklin = object;
    franklin.scale.set(0.01, 0.01, 0.01); // Standardowa skala Mixamo -> Three.js
    scene.add(franklin);

    // Szukamy głównej kości bioder (Hips), aby zablokować przesuwanie się w kółko
    franklin.traverse((child) => {
        if (child.isBone && !rootBone) {
            rootBone = child;
        }
    });

    mixer = new THREE.AnimationMixer(franklin);

    if (object.animations.length > 0) {
        actions['walk'] = mixer.clipAction(object.animations[0]);
        activeAction = actions['walk'];
        activeAction.play();
        activeAction.paused = true;
    }

    // Doładowanie wszystkich pozostałych animacji z Twojego repozytorium
    loadExtraAnimation('Pistol Walk.fbx', 'pistol');
    loadExtraAnimation('Rifle Walk.fbx', 'rifle');
    loadExtraAnimation('Swimming.fbx', 'swim');
    loadExtraAnimation('Boxing.fbx', 'boxing');
    loadExtraAnimation('Receive Uppercut To The Face.fbx', 'hit');
    loadExtraAnimation('Walking To Dying.fbx', 'dying');
}, undefined, (err) => {
    console.error('Błąd ładowania Walking.fbx:', err);
});

function loadExtraAnimation(filename, actionName) {
    loader.load(filename, (animObj) => {
        if (animObj.animations && animObj.animations.length > 0) {
            actions[actionName] = mixer.clipAction(animObj.animations[0]);
        }
    }, undefined, (err) => {
        console.warn(`Nie udało się załadować ${filename}:`, err);
    });
}

// Funkcja odpalająca jednorazową akcję (cios, trafienie, śmierć)
function triggerOneShotAction(actionName, isFatal = false) {
    if (!actions[actionName] || isLockedInAction || isDead) return;

    isLockedInAction = true;
    if (isFatal) isDead = true;

    playAnimation(actionName, false, 0.15);

    const onFinished = (e) => {
        if (e.action === actions[actionName]) {
            mixer.removeEventListener('finished', onFinished);
            
            if (isFatal) {
                // Po 2 sekundach od śmierci postać wstaje
                setTimeout(() => {
                    isDead = false;
                    isLockedInAction = false;
                    playAnimation(moveMode, true, 0.3);
                }, 2000);
            } else {
                isLockedInAction = false;
            }
        }
    };
    mixer.addEventListener('finished', onFinished);
}

// 5. Obsługa klawiatury
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'w' || key === 'arrowup') keys.w = true;
    if (key === 's' || key === 'arrowdown') keys.s = true;
    if (key === 'a' || key === 'arrowleft') keys.a = true;
    if (key === 'd' || key === 'arrowright') keys.d = true;

    // Przełączanie stylów poruszania się
    if (key === '1') moveMode = 'walk';
    if (key === '2' && actions['pistol']) moveMode = 'pistol';
    if (key === '3' && actions['rifle']) moveMode = 'rifle';
    if (key === '4' && actions['swim']) moveMode = 'swim';

    // Jednorazowe akcje
    if (key === 'f') triggerOneShotAction('boxing', false);
    if (key === 'g') triggerOneShotAction('hit', false);
    if (key === 'k') triggerOneShotAction('dying', true);
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'w' || key === 'arrowup') keys.w = false;
    if (key === 's' || key === 'arrowdown') keys.s = false;
    if (key === 'a' || key === 'arrowleft') keys.a = false;
    if (key === 'd' || key === 'arrowright') keys.d = false;
});

// 6. Pętla gry
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (franklin) {
        const moveSpeed = (moveMode === 'swim' ? 2.5 : 3.8) * delta;
        const turnSpeed = 2.8 * delta;
        let isMoving = false;

        if (!isLockedInAction && !isDead) {
            if (keys.a) franklin.rotation.y += turnSpeed;
            if (keys.d) franklin.rotation.y -= turnSpeed;

            if (keys.w) {
                franklin.translateZ(moveSpeed);
                isMoving = true;
            }
            if (keys.s) {
                franklin.translateZ(-moveSpeed * 0.6);
                isMoving = true;
            }

            // Wybór aktywnej animacji ruchu
            const targetAnim = actions[moveMode] ? moveMode : 'walk';

            if (isMoving || moveMode === 'swim') {
                playAnimation(targetAnim, true);
                if (activeAction) {
                    activeAction.paused = false;
                    activeAction.timeScale = (keys.s && !keys.w) ? -0.8 : 1.0;
                }
            } else if (activeAction) {
                // Jeśli zmieniliśmy tryb (np. z 1 na 2) stojąc w miejscu, podmieniamy pozę i pauzujemy
                if (activeAction !== actions[targetAnim]) {
                    playAnimation(targetAnim, true, 0.1);
                }
                activeAction.paused = true;
            }
        }

        if (mixer) mixer.update(delta);

        // Blokada Root Motion (żeby nie teleportował się z powrotem)
        if (rootBone) {
            rootBone.position.x = 0;
            rootBone.position.z = 0;
        }

        // Kamera TPP podążająca za Franklinem
        const cameraOffset = new THREE.Vector3(0, 2.2, -4.5);
        cameraOffset.applyQuaternion(franklin.quaternion);
        camera.position.lerp(franklin.position.clone().add(cameraOffset), 0.1);
        camera.lookAt(franklin.position.clone().add(new THREE.Vector3(0, 1.4, 0)));
    }

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
