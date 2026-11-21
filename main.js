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

// 2. Oświetlenie i podłoga
scene.add(new THREE.AmbientLight(0xffffff, 1.2));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
dirLight.position.set(10, 25, 10);
scene.add(dirLight);

const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
scene.add(new THREE.GridHelper(300, 150, 0x000000, 0x555555));

// Zmienne gry
let mixer;
let franklin;
let rootBone = null;
const actions = {};
let activeAction = null;

let weaponType = 'fists'; // 'fists' lub 'gun'
let isWheelOpen = false;
let isLockedInAction = false;
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

// 4. Ładowanie modelu i wszystkich animacji (w tym nowych z Twojego screena)
loader.load('Walking.fbx', (object) => {
    franklin = object;
    franklin.scale.set(0.01, 0.01, 0.01);
    scene.add(franklin);

    franklin.traverse((child) => {
        if (child.isBone && !rootBone) rootBone = child;
    });

    mixer = new THREE.AnimationMixer(franklin);

    if (object.animations.length > 0) {
        actions['walk'] = mixer.clipAction(object.animations[0]);
        activeAction = actions['walk'];
        activeAction.play();
        activeAction.paused = true;
    }

    // Ładowanie dodatkowych animacji
    loadExtraAnimation('Pistol Walk.fbx', 'pistolWalk');
    loadExtraAnimation('Boxing.fbx', 'boxing');
    loadExtraAnimation('Gunplay.fbx', 'gunplay'); // Strzelanie / celowanie
    loadExtraAnimation('Receive Uppercut To The Face.fbx', 'hit1');
    loadExtraAnimation('Walking To Dying.fbx', 'hit2');
    loadExtraAnimation('Falling Forward Death.fbx', 'death1');
    loadExtraAnimation('Falling Back Death.fbx', 'death2');
}, undefined, (err) => console.error('Błąd ładowania:', err));

function loadExtraAnimation(filename, actionName) {
    loader.load(filename, (animObj) => {
        if (animObj.animations && animObj.animations.length > 0) {
            actions[actionName] = mixer.clipAction(animObj.animations[0]);
        }
    }, undefined, (err) => console.warn(`Brak pliku ${filename}`));
}

// Jednorazowe akcje (atak, postrzał)
function triggerAction(actionName, duration = 0, callback = null) {
    if (!actions[actionName] || isDead) return;
    isLockedInAction = true;
    playAnimation(actionName, false, 0.1);

    const onFinished = (e) => {
        if (e.action === actions[actionName]) {
            mixer.removeEventListener('finished', onFinished);
            isLockedInAction = false;
            if (callback) callback();
        }
    };
    mixer.addEventListener('finished', onFinished);

    // Zabezpieczenie czasowe, gdyby animacja nie zgłosiła końca
    if (duration > 0) {
        setTimeout(() => {
            isLockedInAction = false;
            mixer.removeEventListener('finished', onFinished);
            if (callback) callback();
        }, duration * 1000);
    }
}

// 5. Obsługa klawiatury i myszy
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'w' || key === 'arrowup') keys.w = true;
    if (key === 's' || key === 'arrowdown') keys.s = true;
    if (key === 'a' || key === 'arrowleft') keys.a = true;
    if (key === 'd' || key === 'arrowright') keys.d = true;

    // Koło wyboru broni pod F
    if (key === 'f') {
        isWheelOpen = true;
        document.getElementById('weapon-wheel').style.display = 'block';
    }

    // Zmiana broni strzałkami góra/dół gdy koło jest otwarte
    if (isWheelOpen) {
        if (key === 'arrowup' || key === 'w') {
            weaponType = 'fists';
            document.getElementById('opt-fists').classList.add('active');
            document.getElementById('opt-gun').classList.remove('active');
        } else if (key === 'arrowdown' || key === 's') {
            weaponType = 'gun';
            document.getElementById('opt-gun').classList.add('active');
            document.getElementById('opt-fists').classList.remove('active');
        }
    }

    // Losowe trafienie / postrzał pod klawiszem G
    if (key === 'g') {
        const hits = ['hit1', 'hit2'];
        const randomHit = hits[Math.floor(Math.random() * hits.length)];
        triggerAction(randomHit, 1.0);
    }

    // Śmierć (losowa animacja upadku) pod klawiszem K
    if (key === 'k' && !isDead) {
        isDead = true;
        const deaths = ['death1', 'death2'];
        const randomDeath = deaths[Math.floor(Math.random() * deaths.length)];
        playAnimation(randomDeath, false, 0.2);

        // Automatyczne wstanie po 3 sekundach
        setTimeout(() => {
            isDead = false;
            isLockedInAction = false;
            playAnimation('walk', true, 0.3);
        }, 3000);
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'w' || key === 'arrowup') keys.w = false;
    if (key === 's' || key === 'arrowdown') keys.s = false;
    if (key === 'a' || key === 'arrowleft') keys.a = false;
    if (key === 'd' || key === 'arrowright') keys.d = false;

    // Zamknięcie koła wyboru broni po puszczeniu F
    if (key === 'f') {
        isWheelOpen = false;
        document.getElementById('weapon-wheel').style.display = 'none';
    }
});

// Lewy przycisk myszy (LPM) -> Bije lub Strzela (Gunplay)
window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && !isLockedInAction && !isDead && !isWheelOpen) {
        if (weaponType === 'fists') {
            triggerAction('boxing', 0.8);
        } else if (weaponType === 'gun') {
            // Strzał / Gunplay
            triggerAction('gunplay', 0.6);
        }
    }
});

// 6. Pętla gry
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (franklin) {
        const moveSpeed = 3.8 * delta;
        const turnSpeed = 2.8 * delta;
        let isMoving = false;

        if (!isLockedInAction && !isDead && !isWheelOpen) {
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

            // Wybór animacji ruchu w zależności od wybranej broni
            let currentWalk = (weaponType === 'gun' && actions['pistolWalk']) ? 'pistolWalk' : 'walk';

            if (isMoving) {
                playAnimation(currentWalk, true);
                if (activeAction) {
                    activeAction.paused = false;
                    activeAction.timeScale = (keys.s && !keys.w) ? -0.8 : 1.0;
                }
            } else if (activeAction) {
                if (activeAction !== actions[currentWalk]) {
                    playAnimation(currentWalk, true, 0.1);
                }
                activeAction.paused = true;
            }
        }

        if (mixer) mixer.update(delta);

        // Blokada Root Motion
        if (rootBone) {
            rootBone.position.x = 0;
            rootBone.position.z = 0;
        }

        // Kamera TPP
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
