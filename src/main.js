import './style.css'
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as dat from 'dat.gui';
import { texture } from 'three/tsl';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';


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
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Smooth movement
controls.dampingFactor = 0.05;
controls.rotateSpeed = 0.5;
controls.enablePan = true;
controls.enableZoom = true;

//Grid Helper
const gridHelper = new THREE.GridHelper( 30, 30 );
scene.add( gridHelper );

//Light
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 5);
directionalLight.intensity = 1;
scene.add(directionalLight);

const lightHelperGeometry = new THREE.SphereGeometry(2, 16, 16);
const lightHelperMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
const lightHelper = new THREE.Mesh(lightHelperGeometry, lightHelperMaterial);
// scene.add(lightHelper); 

const earthRotation = { rotationSpeed: 0.001 };

//GLTFLoader
const loader = new GLTFLoader();
let player;
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

// Create the composer with a RenderPass and a BloomPass
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomParams = {
  exposure: 1,
  bloomStrength: 0.1,
  bloomThreshold: 1,
  bloomRadius: 1
};
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  bloomParams.bloomStrength,
  bloomParams.bloomRadius,
  bloomParams.bloomThreshold
);
composer.addPass(bloomPass);
gui.add(bloomParams, 'bloomStrength', 0, 3, 0.1).onChange((value) => {
  bloomPass.strength = value;
});
gui.add(bloomParams, 'bloomThreshold', 0, 1, 0.01).onChange((value) => {
  bloomPass.threshold = value;
});
gui.add(bloomParams, 'bloomRadius', 0, 1, 0.01).onChange((value) => {
  bloomPass.radius = value;
});

//Star Map
const starTextureLoader = new THREE.TextureLoader();
const starMap = starTextureLoader.load('./assets/starmap_8k_edit.jpg'); // Load NASA star map

const starsGeometry = new THREE.SphereGeometry(500, 640, 640); // Large sphere
const starsMaterial = new THREE.MeshBasicMaterial({
  map: starMap,
  side: THREE.BackSide // Render texture inside the sphere
});

const starSphere = new THREE.Mesh(starsGeometry, starsMaterial);
scene.add(starSphere);


const textureLoader = new THREE.TextureLoader();
const dayTexture = textureLoader.load('./assets/world.topo.bathy.200409.3x5400x2700.jpg');
const nightTexture = textureLoader.load('./assets/8k_earth_nightmap.jpg');
const emissiveMap = textureLoader.load('./assets/8k_earth_nightmap_edit.jpg');
const normalMap = textureLoader.load('./assets/Earth-normal-8k.jpeg');
const displacementMap = textureLoader.load('./assets/8081_earthbump10k.jpg');
const specularMap = textureLoader.load('./assets/8k_earth_specular_map.jpg');
// const borderMap = textureLoader.load('./assets/A_large_blank_world_map_with_oceans_marked_in_blue.PNG');
// borderMap.encoding = THREE.sRGBEncoding;

// Create Earth shader material
const earthMaterial = new THREE.ShaderMaterial({
  uniforms: {
    dayTexture: { value: dayTexture },
    displacementMap: { value: displacementMap },
    normalMap: { value: normalMap },
    specularMap: { value: specularMap },
    emissiveMap: { value: nightTexture },
    //borderMap: { value: borderMap },
    displacementScale: { value: 1 }, 
    lightDirection: { value: new THREE.Vector3() }, // Placeholder, will update in render loop
  },
  vertexShader: `
    uniform sampler2D displacementMap;
    uniform float displacementScale;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vUv = uv;

      float displacement = texture2D(displacementMap, uv).r;
      vec3 displacedPosition = position + normal * displacement * displacementScale;

      vNormal = normalize(normalMatrix * normal);
      vViewPosition = (modelViewMatrix * vec4(displacedPosition, 1.0)).xyz;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
    }

  `,
  fragmentShader: `
    uniform sampler2D dayTexture;
    uniform sampler2D normalMap;
    uniform sampler2D specularMap;
    uniform sampler2D emissiveMap;
    // uniform sampler2D borderMap;
    uniform vec3 lightDirection; 

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
        vec3 normalTex = texture2D(normalMap, vUv).rgb * 2.0 - 1.0;
        vec3 adjustedNormal = normalize(normalTex + vNormal);

        // Correct light direction from Three.js
        vec3 lightDir = normalize(lightDirection);

        // Diffuse lighting (standard)
        float lightIntensity = max(dot(adjustedNormal, lightDir), 0.0);
        vec3 color = texture2D(dayTexture, vUv).rgb * lightIntensity;

        // Specular reflection calculation
        float specularStrength = texture2D(specularMap, vUv).r;
        vec3 viewDir = normalize(-vViewPosition); // Fix view direction
        vec3 reflectDir = reflect(-lightDir, adjustedNormal);
        float specular = pow(max(dot(viewDir, reflectDir), 0.0), 32.0) * specularStrength;

        // Emissive lighting (night glow)
        vec3 emissive = texture2D(emissiveMap, vUv).rgb * (1.0 - lightIntensity) * 2.0;

        // Blend borders
        // vec4 borderColor = texture2D(borderMap, vUv);
        // color = mix(color, vec3(0.0, 0.0, 0.0), borderColor.r);

        // Final output
        gl_FragColor = vec4(color + (specular * vec3(1.0)) + emissive, 1.0);
    }
  `,
});

const earthGeometry = new THREE.SphereGeometry(50, 128, 128);

// Atmospheric glow
const atmosphereMaterial = new THREE.ShaderMaterial({
  uniforms: {},
  vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    void main() {
      float intensity = pow(0.6 - dot(vNormal, vec3(0, 0, 1.0)), 3.0);
      gl_FragColor = vec4(0.0, 0.3, 0.8, intensity);
    }
  `,
  blending: THREE.AdditiveBlending,
  side: THREE.BackSide,
  transparent: true,
});
const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(50.5, 128, 128), atmosphereMaterial);
scene.add(atmosphere);

// Light Position Control
let lightSpeed = 0.005;
let x_val = 75;
let y_val = 0;
let z_val = 75;
const lightFolder = gui.addFolder('Sun');
const lightPosition = {
  speed: 0.005,
  x: 75,
  y: 0,
  z: 75,
};
lightFolder.add(lightPosition, 'speed', 0, 0.1).onChange((value) => {
  lightSpeed = value;
});
lightFolder.add(lightPosition, 'x', 0, 150).onChange((value) => {
  x_val = value;
});
lightFolder.add(lightPosition, 'y', -100, 100).onChange((value) => {
  y_val = value;
});
lightFolder.add(lightPosition, 'z', 0, 150).onChange((value) => {
  z_val = value;
});
lightFolder.open();

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
const cloudGeometry = new THREE.SphereGeometry(50.5, 64, 64); // Slightly larger than Earth
const cloudMaterial = new THREE.ShaderMaterial({
  uniforms: {
    cloudTexture: { value: cloudTexture },
    lightDirection: earthMaterial.uniforms.lightDirection, // Use the same light
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D cloudTexture;
    uniform vec3 lightDirection;
    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
        vec4 cloudColor = texture2D(cloudTexture, vUv);

        // Light intensity calculation
        float lightIntensity = max(dot(vNormal, normalize(lightDirection)), 0.0);

        // Apply lighting to clouds
        vec3 finalColor = cloudColor.rgb * lightIntensity * 1.5;

        gl_FragColor = vec4(finalColor, cloudColor.a * 0.5); // Keep transparency
    }
  `,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
});

const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
scene.add(clouds);

// Particle system for vapor trail
const trailCount = 1000;
const createTrail = () => {
  const trailGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(trailCount * 3);
  const ages = new Float32Array(trailCount);

  for (let i = 0; i < trailCount; i++) {
    positions.set([0, 0, 0], i * 3);
    ages[i] = i / trailCount; // Normalize ages
  }

  trailGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  trailGeometry.setAttribute("age", new THREE.BufferAttribute(ages, 1));

  const trailMaterial = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(0xffffff) },
      opacity: { value: 1.0 },
    },
    vertexShader: `
      attribute float age;
      varying float vAge;
      void main() {
        vAge = age;
        gl_PointSize = 2.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float opacity;
      varying float vAge;

      void main() {
        float fade = 1.0 - vAge; // Older particles fade out
        gl_FragColor = vec4(color, opacity * fade);
      }
    `,
    transparent: true,
    depthWrite: false,
  });

  return new THREE.Points(trailGeometry, trailMaterial);
};

// Create separate trails for left and right wings
const leftVaporTrail = createTrail();
const rightVaporTrail = createTrail();
scene.add(leftVaporTrail, rightVaporTrail);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let targetPosition = new THREE.Vector3();
let targetDirection = new THREE.Vector3(0, 0, 1); // Initial direction (forward)
let lightAngle = 0;
function animate() {
  if (player) {
    const movementSpeed = 0.025;

    const directionFromCenter = new THREE.Vector3()
      .subVectors(player.position, ground.position)
      .normalize();

    //targetDirection.subVectors(targetDirection, directionFromCenter.multiplyScalar(targetDirection.dot(directionFromCenter)));
    //targetDirection.normalize();

    const movementVector = new THREE.Vector3()
      .copy(targetDirection)
      .multiplyScalar(movementSpeed);
    player.position.add(movementVector);

    player.position.copy(
      new THREE.Vector3()
        .subVectors(player.position, ground.position)
        .normalize()
        .multiplyScalar(50 + 1) // Sphere radius + offset
        .add(ground.position)
    );

    alignPlayerWithGround();

    // Update camera based on the current mode
    if (isFollowCamera) {
      updateFollowCamera();
    } else {
      updateCameraPosition();
    }
  }

  lightAngle += lightSpeed;
  earthMaterial.uniforms.lightDirection.value.set(
    x_val * Math.cos(lightAngle), 
    y_val, 
    z_val * Math.sin(lightAngle)
  );

  directionalLight.position.copy(earthMaterial.uniforms.lightDirection.value);
  lightHelper.position.copy(earthMaterial.uniforms.lightDirection.value);
  clouds.rotation.y += 0.00005;

  controls.update();
  updateVaporTrail(leftVaporTrail, -1);
  updateVaporTrail(rightVaporTrail, 1);
  composer.render();
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

// const trailLength = 0.0015; //Change this number to increase the length of the trail
const planeOptions = {
  trailLength: 0.0015,
};
gui.add(planeOptions, 'trailLength', 0.00, 0.005, 0.0001).onChange((value) => {
  planeOptions.trailLength = value;
});

function updateVaporTrail(vaporTrail, wingOffset) {
  if (!player) return;

  const positions = vaporTrail.geometry.attributes.position.array;
  const ages = vaporTrail.geometry.attributes.age.array;
  

  // Shift old particles
  for (let i = trailCount - 1; i > 0; i--) {
    positions[i * 3] = positions[(i - 1) * 3];
    positions[i * 3 + 1] = positions[(i - 1) * 3 + 1];
    positions[i * 3 + 2] = positions[(i - 1) * 3 + 2];

    ages[i] = Math.min(1.0, ages[i - 1] + planeOptions.trailLength);
  }

  // Add new particle at the wing position
  const wingPosition = new THREE.Vector3(wingOffset, 0, -0.1).applyMatrix4(player.matrixWorld);
  positions[0] = wingPosition.x;
  positions[1] = wingPosition.y;
  positions[2] = wingPosition.z;

  ages[0] = 0; // Reset new particle age

  // Update attributes
  vaporTrail.geometry.attributes.position.needsUpdate = true;
  vaporTrail.geometry.attributes.age.needsUpdate = true;
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
    //camera.position.set(50, 50, 100);
    camera.lookAt(player.position);
  }
}

// Add a GUI control for the camera mode
let isFollowCamera = false;
const cameraControls = {
  cameraMode: 'Top-Down', // Default mode
  toggleCamera: function () {
    isFollowCamera = !isFollowCamera; // Toggle the camera mode
    this.cameraMode = isFollowCamera ? 'Follow Plane' : 'Top-Down'; // Update the label

    controls.enabled = !isFollowCamera;
  },
};

// Add the toggle to the GUI (Disabled for now, since it doesn't work as intended)
// const cameraFolder = gui.addFolder('Camera');
// cameraFolder.add(cameraControls, 'cameraMode').name('Current Mode').listen(); // Display the current mode
// cameraFolder.add(cameraControls, 'toggleCamera').name('Toggle Camera'); // Add a button to toggle the mode
// cameraFolder.open();

const targetCameraPosition = new THREE.Vector3();
const targetCameraQuaternion = new THREE.Quaternion();
function updateFollowCamera() {
  if (!player) return;

  const cameraDistance = 15;
  const cameraHeight = 5;
  const cameraAngle = Math.PI / 12;

  const planeDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);

  const cameraOffset = new THREE.Vector3()
    .copy(planeDirection)
    .multiplyScalar(-cameraDistance)
    .add(new THREE.Vector3(0, cameraHeight, 0));

  targetCameraPosition.copy(player.position).add(cameraOffset);

  const lookAtPoint = new THREE.Vector3()
    .copy(planeDirection)
    .multiplyScalar(10)
    .add(player.position);

  // Smoothly interpolate the camera's position and rotation
  camera.position.lerp(targetCameraPosition, 0.1);
  camera.quaternion.slerp(targetCameraQuaternion, 0.1);
  camera.lookAt(lookAtPoint);
  camera.rotation.x = cameraAngle;
}

//Event Listeners
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('mousemove', (event) => {
  if (isFollowCamera) return; // Disable mouse control in follow mode

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
  if (!player) return;

  const movementSpeed = 0.025; // Adjust this value to control the speed of the plane

  // Calculate the plane's current position relative to the sphere's center
  const directionFromCenter = new THREE.Vector3()
    .subVectors(player.position, ground.position)
    .normalize();

  // Calculate the forward and right directions relative to the sphere's surface
  const forward = new THREE.Vector3()
    .copy(targetDirection)
    .normalize();
  const right = new THREE.Vector3()
    .crossVectors(directionFromCenter, forward)
    .normalize();

  // Adjust the target direction based on key input
  if (e.key === 'w' || e.key === 'ArrowUp') {
    targetDirection.add(forward.multiplyScalar(movementSpeed)).normalize();
  }
  if (e.key === 's' || e.key === 'ArrowDown') {
    targetDirection.sub(forward.multiplyScalar(movementSpeed)).normalize();
  }
  if (e.key === 'a' || e.key === 'ArrowLeft') {
    targetDirection.add(right.multiplyScalar(movementSpeed)).normalize();
  }
  if (e.key === 'd' || e.key === 'ArrowRight') {
    targetDirection.sub(right.multiplyScalar(movementSpeed)).normalize();
  }

  // Ensure the target direction is always tangential to the sphere's surface
  targetDirection.subVectors(targetDirection, directionFromCenter.multiplyScalar(targetDirection.dot(directionFromCenter))).normalize();
});
