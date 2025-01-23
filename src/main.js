import './style.css'
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9bd1e9);

const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.set(0, 1.5, 5);

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setAnimationLoop( animate );
document.body.appendChild( renderer.domElement );

//OrbitControls
//const controls = new OrbitControls( camera, renderer.domElement );

//Grid Helper
const gridHelper = new THREE.GridHelper( 30, 30 );
scene.add( gridHelper );

//Light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Color, Intensity
scene.add(ambientLight);

//GLTFLoader
const loader = new GLTFLoader();
let player;
// ./assets/star-wars-the-lars-homestead/source/sw-lars-homestead.glb
loader.load( './assets/shiba.glb', (gltf) => {
  player = gltf.scene;
  player.scale.set(1,1,1);
  player.position.y = 0.5;
	scene.add(player);
}, undefined, ( error ) => {
	console.error("Error loading model", error);
} );
// Bounded sphere for player
const playerSphere = new THREE.Sphere(new THREE.Vector3(0, 0.5, 0), 1);
// // Draw a debug sphere for the bounding sphere
const sphereGeometry = new THREE.SphereGeometry(playerSphere.radius, 16, 16);
const sphereMaterial = new THREE.MeshBasicMaterial({
  color: 0xff0000, // Red color
  wireframe: true, // Make it a wireframe
});
const debugSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
debugSphere.position.copy(playerSphere.center); // Start at the same position as the sphere
scene.add(debugSphere);

//Ground
const ground = new THREE.Mesh( 
  new THREE.BoxGeometry( 50, 1, 50 ),
  new THREE.MeshBasicMaterial( { color: 0x00ff00 } ) 
);
ground.position.y = -1;
scene.add( ground );

// Mouse Tracking
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let targetPosition = new THREE.Vector3();

//Cube
// const cube = new THREE.Mesh( 
//   new THREE.BoxGeometry( 0.5, 0.5, 0.5 ),
//   new THREE.MeshBasicMaterial( { color: 0xff0000 } ) 
// );
// scene.add( cube );



function animate() {
  if (player) {
    // Rotate the player to face the target position only in the xz plane
    const direction = new THREE.Vector3();
    direction.subVectors(targetPosition, player.position).normalize();
    // Ignore the y component to only consider the xz plane
    direction.y = 0;
    direction.normalize();
    const lookAtPosition = player.position.clone().add(direction);
    player.lookAt(lookAtPosition);
    
    // Update the player's bounding sphere
    playerSphere.center.copy(player.position);
    debugSphere.position.copy(playerSphere.center);
  }
	// ground.rotation.x += 0.01;
	// ground.rotation.y += 0.01;
  //controls.update();
  
	renderer.render( scene, camera );

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

  // Project the mouse position into the scene
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(ground);
  if (intersects.length > 0) {
    targetPosition.copy(intersects[0].point);
  }
});

window.addEventListener('keydown', (e) => {
  if(e.key == 'w' || e.key == 'W' || e.key == 'ArrowUp') {
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(player.quaternion); // Rotate forward vector by player's rotation
    player.position.add(forward.multiplyScalar(0.1));
  }
  if(e.key == 's' || e.key == 'S' || e.key == 'ArrowDown'){
    player.position.z += 0.1;
  }
  if(e.key == 'a' || e.key == 'A' || e.key == 'ArrowLeft'){
    player.position.x -= 0.1;
  }
  if(e.key == 'd' || e.key == 'D' || e.key == 'ArrowRight'){
    player.position.x += 0.1;
  }
  player.position.y = 0.5;  //To make sure the player is locked in y axis
  updateCameraPosition() 
});

function updateCameraPosition() {
  if (player) {
      // Set camera position relative to model
      const height = 3; // Height above the model
      const distance = 5; // Distance behind the model
      camera.position.set(player.position.x, player.position.y + height, player.position.z + distance);
      camera.lookAt(player.position);
  }
}