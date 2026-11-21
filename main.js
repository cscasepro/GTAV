import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 1. Scena, Kamera i Renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Kolor nieba

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// 2. Oświetlenie
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// 3. Podłoga z siatką (żeby było widać, że postać faktycznie się przemieszcza)
const floorGeo = new THREE.PlaneGeometry(200, 200);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const grid = new THREE.GridHelper(200, 100, 0x000000, 0x555555);
scene.add(grid);

// Zmienne postaci i animacji
let mixer;
let walkAction;
let franklin;
let rootBone = null; // Kość bioder do blokady "cofania się"
const keys = { w: false, s: false, a: false, d: false };

// 4. Ładowanie modelu Franklina (.glb)
const loader = new GLTFLoader();
loader.load('franklin.glb', (gltf) => {
    franklin = gltf.scene;
    franklin.scale.set(1, 1, 1);
    scene.add(franklin);

    // Szukamy głównej kości szkieletu (hips/root), żeby zablokować teleportowanie w kółko
    franklin.traverse((child) => {
        if (child.isBone && !rootBone) {
            rootBone = child;
        }
    });

    if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(franklin);
        walkAction = mixer.clipAction(gltf.animations[0]);
        walkAction.play();
        walkAction.paused = true; // Na starcie postać stoi w miejscu!
    }
}, undefined, (error) => {
    console.error('Błąd ładowania modelu:', error);
});

// 5. Obsługa klawiatury
window.addEventListener('keydown', (e) => handleKey(e, true));
window.addEventListener('keyup', (e) => handleKey(e, false));

function handleKey(e, isDown) {
    switch(e.key.toLowerCase()) {
        case 'w': case 'arrowup': keys.w = isDown; break;
        case 's': case 'arrowdown': keys.s = isDown; break;
        case 'a': case 'arrowleft': keys.a = isDown; break;
        case 'd': case 'arrowright': keys.d = isDown; break;
    }
}

// 6. Pętla gry
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (franklin) {
        const moveSpeed = 3.5 * delta;
        const turnSpeed = 2.8 * delta; // Prędkość płynnego obracania się
        let isMoving = false;

        // Płynne obracanie postacią (A / D)
        if (keys.a) {
            franklin.rotation.y += turnSpeed;
        }
        if (keys.d) {
            franklin.rotation.y -= turnSpeed;
        }

        // Ruch do przodu i do tyłu zgodnie z kierunkiem, w którym patrzy Franklin
        if (keys.w) {
            franklin.translateZ(moveSpeed);
            isMoving = true;
        }
        if (keys.s) {
            franklin.translateZ(-moveSpeed * 0.6); // Wolniejsze cofanie
            isMoving = true;
        }

        // Odtwarzanie lub zatrzymywanie animacji chodzenia
        if (walkAction) {
            if (isMoving) {
                walkAction.paused = false;
                // Jeśli idziemy do tyłu (S), puszczamy animację od tyłu
                walkAction.timeScale = keys.s && !keys.w ? -0.8 : 1.0;
            } else {
                walkAction.paused = true; // Zatrzymuje animację, gdy stoisz
            }
        }

        // Aktualizacja animacji
        if (mixer) {
            mixer.update(delta);
        }

        // BLOKADA COFANIA SIĘ (Root Motion Fix):
        // Zerujemy przesunięcie kości bioder w poziomie (X i Z), zostawiając tylko ruch góra-dół (Y)
        if (rootBone) {
            rootBone.position.x = 0;
            rootBone.position.z = 0;
        }

        // Kamera za plecami Franklina (TPP jak w GTA)
        const cameraOffset = new THREE.Vector3(0, 2.2, -4.5); // Za plecami i lekko w górze
        cameraOffset.applyQuaternion(franklin.quaternion);
        const targetCameraPos = franklin.position.clone().add(cameraOffset);
        
        // Płynne podążanie kamery (lerp)
        camera.position.lerp(targetCameraPos, 0.1);
        
        // Kamera patrzy na plecy/głowę Franklina
        const lookTarget = franklin.position.clone().add(new THREE.Vector3(0, 1.4, 0));
        camera.lookAt(lookTarget);
    }

    renderer.render(scene, camera);
}

animate();

// Dopasowanie do rozmiaru okna
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
