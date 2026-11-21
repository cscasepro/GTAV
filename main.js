import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 1. Scena, Kamera i Renderowanie
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 3, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 2. Oświetlenie (żeby model nie był czarny)
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// 3. Prosta podłoga (szachownica / płaszczyzna)
const floorGeo = new THREE.PlaneGeometry(50, 50);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Zmienne do animacji i postaci
let mixer;
let franklin;
const keys = { w: false, s: false, a: false, d: false };

// 4. Ładowanie modelu Franklina (.glb)
const loader = new GLTFLoader();
loader.load('franklin.glb', (gltf) => {
    franklin = gltf.scene;
    franklin.scale.set(1, 1, 1); // W razie potrzeby dopasuj skalę
    scene.add(franklin);

    // Sprawdzamy czy model ma animacje
    if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(franklin);
        const action = mixer.clipAction(gltf.animations[0]); // Odpalamy pierwszą animację z pliku
        action.play();
    }
}, undefined, (error) => {
    console.error('Błąd podczas ładowania modelu:', error);
});

// 5. Obsługa klawiatury (WASD)
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

// 6. Pętla gry (Renderowanie co klatkę)
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // Aktualizacja animacji modelu
    if (mixer) {
        mixer.update(delta);
    }

    // Proste poruszanie postacią po podłodze
    if (franklin) {
        const speed = 3.5 * delta;
        if (keys.w) {
            franklin.position.z -= speed;
            franklin.rotation.y = Math.PI; // Zwrot w przód
        }
        if (keys.s) {
            franklin.position.z += speed;
            franklin.rotation.y = 0; // Zwrot w tył
        }
        if (keys.a) {
            franklin.position.x -= speed;
            franklin.rotation.y = -Math.PI / 2;
        }
        if (keys.d) {
            franklin.position.x += speed;
            franklin.rotation.y = Math.PI / 2;
        }

        // Kamera podąża za Franklinem
        camera.position.x = franklin.position.x;
        camera.position.z = franklin.position.z + 5;
        camera.lookAt(franklin.position.x, franklin.position.y + 1, franklin.position.z);
    }

    renderer.render(scene, camera);
}

animate();

// Dopasowanie rozmiaru okna przeglądarki
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
