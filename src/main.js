import './style.css'
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as dat from 'dat.gui';
import { texture } from 'three/tsl';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9bd1e9);

const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.set(0, 1.5, 5);

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setAnimationLoop( animate );
document.body.appendChild( renderer.domElement );

const gui = new dat.GUI();
//OrbitControls
//const controls = new OrbitControls( camera, renderer.domElement );

//Grid Helper
const gridHelper = new THREE.GridHelper( 30, 30 );
scene.add( gridHelper );

//Light
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 5);
directionalLight.intensity = 1;
scene.add(directionalLight);

const earthRotation = { rotationSpeed: 0.001 };

// Light Position Control
const lightFolder = gui.addFolder('Sun (Directional Light)');
const lightPosition = {
  x: 5,
  y: 10,
  z: 5,
};
lightFolder.add(lightPosition, 'x', -50, 50).onChange((value) => {
  directionalLight.position.x = value;
});
lightFolder.add(lightPosition, 'y', -50, 50).onChange((value) => {
  directionalLight.position.y = value;
});
lightFolder.add(lightPosition, 'z', -50, 50).onChange((value) => {
  directionalLight.position.z = value;
});
lightFolder.open();

//GLTFLoader
const loader = new GLTFLoader();
let player;
// ./assets/star-wars-the-lars-homestead/source/sw-lars-homestead.glb
loader.load( './assets/cartoon_plane.glb', (gltf) => {
  player = gltf.scene;
  player.scale.set(1,1,1);
  player.position.y = 1;
	scene.add(player);
}, undefined, ( error ) => {
	console.error("Error loading model", error);
} );

// Bounded sphere for player
const playerSphere = new THREE.Sphere(new THREE.Vector3(0, 0.5, 0), 1);
// //debug sphere for the bounding sphere
const sphereGeometry = new THREE.SphereGeometry(playerSphere.radius, 16, 16);
const sphereMaterial = new THREE.MeshBasicMaterial({
  color: 0xff0000, // Red 
  wireframe: true,
});
const debugSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
debugSphere.position.copy(playerSphere.center); // Start at the same position as the sphere
scene.add(debugSphere);

const textureLoader = new THREE.TextureLoader();
const dayTexture = textureLoader.load('./assets/world.topo.bathy.200409.3x5400x2700.jpg');
const nightTexture = textureLoader.load('./assets/8k_earth_nightmap.jpg');
const emissiveMap = textureLoader.load('./assets/8k_earth_nightmap_edit.jpg');
const normalMap = textureLoader.load('./assets/Earth-normal-8k.jpeg');
const displacementMap = textureLoader.load('./assets/8081_earthbump10k.jpg');
const specularMap = textureLoader.load('./assets/8k_earth_specular_map.jpg');

// Create Earth material
const earthMaterial = new THREE.MeshStandardMaterial({
  map: dayTexture,         
  normalMap: normalMap,
  displacementMap: displacementMap,
  displacementScale: 10,
  // emissiveMap: nightTexture,
  // emissive: new THREE.Color(0xffcc00),
  // emissiveIntensity: 1,
  specularMap: specularMap,
});
// Create Earth geometry
const earthGeometry = new THREE.SphereGeometry(50, 64, 64); // Smooth sphere
//const ground = new THREE.Mesh(earthGeometry, earthMaterial);

// Add GUI for real-time adjustment
const normalOptions = {
  normalScaleX: 4,
  normalScaleY: 2,
};

gui.add(normalOptions, 'normalScaleX', 0, 5, 0.1).onChange((value) => {
  earthMaterial.normalScale.x = value;
});
gui.add(normalOptions, 'normalScaleY', 0, 5, 0.1).onChange((value) => {
  earthMaterial.normalScale.y = value;
});

const ground = new THREE.Mesh(earthGeometry, earthMaterial);
scene.add(ground);

// **Add Cloud Layer**
const cloudTexture = textureLoader.load('./assets/Earth-clouds.png');
const cloudGeometry = new THREE.SphereGeometry(50.25, 64, 64); // Slightly larger than Earth
const cloudMaterial = new THREE.MeshStandardMaterial({
  map: cloudTexture,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  side: THREE.DoubleSide, // Ensures both sides of the texture are visible
});

const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
scene.add(clouds);

// Mouse Tracking
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let targetPosition = new THREE.Vector3();

let targetDirection = new THREE.Vector3(0, 0, 1); // Initial direction (forward)
function animate() {
  if (player) {
    const movementSpeed = 0.05;

    // Ensure targetDirection is projected onto the tangent plane at the player's position
    const directionFromCenter = new THREE.Vector3()
      .subVectors(player.position, ground.position)
      .normalize();
    targetDirection.subVectors(targetDirection, directionFromCenter.multiplyScalar(targetDirection.dot(directionFromCenter))); // Project onto tangent plane
    targetDirection.normalize();

    // Move the player in the adjusted direction
    const movementVector = new THREE.Vector3().copy(targetDirection).multiplyScalar(movementSpeed);
    player.position.add(movementVector);

    // Constrain the player to the sphere's surface
    player.position.copy(
      new THREE.Vector3()
        .subVectors(player.position, ground.position)
        .normalize()
        .multiplyScalar(50 + 0.2) // Sphere radius + flying height
        .add(ground.position)
    );

    // Align the player with the ground
    alignPlayerWithGround();
    updateCameraPosition();
  }
  ground.rotation.y += earthRotation.rotationSpeed;
  clouds.rotation.y += earthRotation.rotationSpeed - 0.00005;
  renderer.render(scene, camera);
}


function alignPlayerWithGround() {
  if (player) {
    // Align the player's "up" vector to the sphere's surface
    const upVector = new THREE.Vector3().subVectors(player.position, ground.position).normalize();
    player.up.copy(upVector);

    // Ensure the player faces in the target direction
    const lookDirection = new THREE.Vector3().addVectors(player.position, targetDirection);
    player.lookAt(lookDirection);
  }
}

function updateCameraPosition() {
  if (player) {
    const heightOffset = 3;
    const distanceOffset = 10;

    // Get the direction from the sphere's center to the player
    const directionFromCenter = new THREE.Vector3()
      .subVectors(player.position, ground.position)
      .normalize();

    // Calculate the camera position
    const cameraPosition = new THREE.Vector3()
      .copy(directionFromCenter)
      .multiplyScalar(50 + distanceOffset) // Sphere radius + distanceOffset
      .add(new THREE.Vector3(0, heightOffset, 0)); // Add height offset

    camera.position.copy(cameraPosition);

    // Make the camera look at the player
    camera.lookAt(player.position);
  }
}

//Event Listeners
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Use raycaster to calculate the direction vector
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(ground);
  if (intersects.length > 0) {
    const pointOnSphere = intersects[0].point;

    // Update the target direction
    targetDirection = new THREE.Vector3().subVectors(pointOnSphere, player.position).normalize();
  }
});

window.addEventListener('keydown', (e) => {
  const forward = new THREE.Vector3(0, 0, 1); // Forward direction
  const right = new THREE.Vector3(1, 0, 0); // Right direction

  // Adjust target direction based on key input
  if (e.key === 'w' || e.key === 'ArrowUp') {
    targetDirection.add(forward).normalize();
  }
  if (e.key === 's' || e.key === 'ArrowDown') {
    targetDirection.sub(forward).normalize();
  }
  if (e.key === 'a' || e.key === 'ArrowLeft') {
    targetDirection.sub(right).normalize();
  }
  if (e.key === 'd' || e.key === 'ArrowRight') {
    targetDirection.add(right).normalize();
  }
});