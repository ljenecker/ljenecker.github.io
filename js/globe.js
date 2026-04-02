import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const COUNTRIES = [
  { name: 'South Africa', lat: -30.56, lng: 22.94, hq: true },
  { name: 'Nigeria',      lat: 9.08,   lng: 8.68 },
  { name: 'Kenya',        lat: -0.02,  lng: 37.91 },
  { name: 'Ghana',        lat: 7.95,   lng: -1.02 },
  { name: 'Tanzania',     lat: -6.37,  lng: 34.89 },
  { name: 'Uganda',       lat: 1.37,   lng: 32.29 },
  { name: 'Mozambique',   lat: -18.67, lng: 35.53 },
  { name: 'Zimbabwe',     lat: -19.02, lng: 29.15 },
];

const COLORS = {
  navy:  0x052a64,
  green: 0x4ba755,
  light: 0xd9d9d9,
  white: 0xffffff,
};

// Canvas texture colors
const C_OCEAN      = '#041e4a'; // Deep navy ocean
const C_LAND       = '#0a3a6e'; // Slightly lighter navy for world land
const C_AFRICA     = '#0d4d8a'; // Brighter blue for African countries
const C_IEGF       = '#1a7a3a'; // Dark green for IEGF countries
const C_BORDER     = '#1a6090'; // Country border lines
const C_AFRICA_BDR = '#4ba755'; // Green borders for Africa
const C_GRID       = 'rgba(100,140,200,0.12)'; // Subtle grid

const GLOBE_RADIUS = 1;
const PIN_HEIGHT = 0.12;
const isMobile = window.innerWidth < 768;

let scene, camera, renderer, labelRenderer, controls, globe;
let pinMeshes = [];
let raycaster, pointer;
let isVisible = false;
let autoRotateDir = 1;

/* ── Coordinate helpers ── */

function latLngToVec3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/* ── Canvas Earth Texture ── */

function createEarthTexture(geojson) {
  const W = isMobile ? 1024 : 2048;
  const H = W / 2;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Ocean background
  ctx.fillStyle = C_OCEAN;
  ctx.fillRect(0, 0, W, H);

  // Subtle lat/lng grid
  ctx.strokeStyle = C_GRID;
  ctx.lineWidth = 1;
  for (let lat = -60; lat <= 80; lat += 15) {
    const y = (1 - (lat + 90) / 180) * H;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let lng = -180; lng < 180; lng += 15) {
    const x = ((lng + 180) / 360) * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  // Helper: project lng/lat to canvas x/y
  function toXY(lng, lat) {
    const x = ((lng + 180) / 360) * W;
    const y = ((90 - lat) / 180) * H;
    return [x, y];
  }

  // Draw a polygon ring on canvas
  function drawRing(ring, fill, stroke) {
    if (!ring || ring.length < 3) return;
    ctx.beginPath();
    const [x0, y0] = toXY(ring[0][0], ring[0][1]);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < ring.length; i++) {
      const [x, y] = toXY(ring[i][0], ring[i][1]);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  // Sort: draw world first, then Africa, then IEGF on top
  const sorted = [...geojson.features].sort((a, b) => {
    const order = { w: 0, a: 1, i: 2 };
    return (order[a.properties.t] || 0) - (order[b.properties.t] || 0);
  });

  sorted.forEach((feature) => {
    const tag = feature.properties.t;
    const fill = tag === 'i' ? C_IEGF : tag === 'a' ? C_AFRICA : C_LAND;
    const stroke = tag === 'w' ? C_BORDER : C_AFRICA_BDR;
    const coords = feature.geometry.coordinates;
    const type = feature.geometry.type;

    if (type === 'Polygon') {
      coords.forEach((ring) => drawRing(ring, fill, stroke));
    } else if (type === 'MultiPolygon') {
      coords.forEach((polygon) => {
        polygon.forEach((ring) => drawRing(ring, fill, stroke));
      });
    }
  });

  return new THREE.CanvasTexture(canvas);
}

/* ── Globe ── */

function createGlobe(texture) {
  const segments = isMobile ? 48 : 64;
  const geo = new THREE.SphereGeometry(GLOBE_RADIUS, segments, segments);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uGreen: { value: new THREE.Color(COLORS.green) },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform vec3 uGreen;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;

      void main() {
        vec3 texColor = texture2D(uTexture, vUv).rgb;

        // Fresnel rim glow
        vec3 viewDir = normalize(-vPosition);
        float fresnel = 1.0 - dot(viewDir, vNormal);
        fresnel = pow(fresnel, 2.5);
        vec3 color = mix(texColor, uGreen, fresnel * 0.5);

        // Lighting
        float light = dot(vNormal, normalize(vec3(1.0, 1.0, 1.0))) * 0.35 + 0.65;
        color *= light;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  globe = new THREE.Mesh(geo, material);
  scene.add(globe);

  // Atmosphere glow
  if (!isMobile) {
    const atmosGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.12, 32, 32);
    const atmosMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(COLORS.green) },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vec3 viewDir = normalize(-vPosition);
          float fresnel = 1.0 - dot(viewDir, vNormal);
          fresnel = pow(fresnel, 4.0);
          gl_FragColor = vec4(uColor, fresnel * 0.25);
        }
      `,
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(atmosGeo, atmosMat));
  }
}

/* ── Pins ── */

function createPins() {
  const pinGroup = new THREE.Group();
  globe.add(pinGroup);

  COUNTRIES.forEach((country) => {
    const pos = latLngToVec3(country.lat, country.lng, GLOBE_RADIUS);

    const shaftHeight = country.hq ? PIN_HEIGHT * 1.5 : PIN_HEIGHT;
    const shaftGeo = new THREE.CylinderGeometry(0.006, 0.006, shaftHeight, 8);
    const shaftMat = new THREE.MeshBasicMaterial({ color: COLORS.green });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);

    const headSize = country.hq ? 0.035 : 0.025;
    const headGeo = new THREE.SphereGeometry(headSize, 12, 12);
    const headMat = new THREE.MeshBasicMaterial({
      color: country.hq ? 0xf59e0b : COLORS.green,
    });
    const head = new THREE.Mesh(headGeo, headMat);

    const ringGeo = new THREE.RingGeometry(0.02, 0.035, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: COLORS.green,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.userData.pulse = true;
    ring.userData.phase = Math.random() * Math.PI * 2;

    const pinContainer = new THREE.Group();
    pinContainer.position.copy(pos);
    pinContainer.lookAt(pos.clone().multiplyScalar(2));

    shaft.position.z = shaftHeight / 2;
    shaft.rotation.x = Math.PI / 2;
    head.position.z = shaftHeight;

    pinContainer.add(shaft);
    pinContainer.add(head);
    pinContainer.add(ring);

    head.userData.country = country;
    pinMeshes.push(head);

    const labelEl = document.createElement('div');
    labelEl.className = 'globe-label' + (country.hq ? ' globe-label--hq' : '');
    labelEl.textContent = country.name + (country.hq ? ' (HQ)' : '');
    const label = new CSS2DObject(labelEl);
    label.position.z = shaftHeight + 0.04;
    pinContainer.add(label);

    pinGroup.add(pinContainer);
  });
}

/* ── Scene Setup ── */

function initScene(container, texture) {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0.5, 3.2);

  renderer = new THREE.WebGLRenderer({
    antialias: !isMobile,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'globe-labels';
  container.appendChild(labelRenderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.3;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minPolarAngle = Math.PI * 0.3;
  controls.maxPolarAngle = Math.PI * 0.7;
  controls.minAzimuthAngle = -Math.PI * 0.35;
  controls.maxAzimuthAngle = Math.PI * 0.35;

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  createGlobe(texture);
  createPins();

  // Set initial rotation so Africa faces camera (don't touch globe.rotation)
  globe.rotation.y = -2.8;

  handleResize(container);

  const ro = new ResizeObserver(() => handleResize(container));
  ro.observe(container);

  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);

  controls.addEventListener('start', () => { controls.autoRotate = false; });
  controls.addEventListener('end', () => {
    setTimeout(() => { controls.autoRotate = true; }, 3000);
  });
}

/* ── Interaction ── */

function handleResize(container) {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
}

function onPointerMove(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  checkHover();
}

function onPointerDown(e) {
  onPointerMove(e);
  checkHover();
}

function checkHover() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pinMeshes);

  pinMeshes.forEach((mesh) => {
    const label = mesh.parent?.children.find(c => c instanceof CSS2DObject);
    if (label) label.element.classList.toggle('visible', false);
  });

  if (hits.length > 0) {
    const mesh = hits[0].object;
    const label = mesh.parent?.children.find(c => c instanceof CSS2DObject);
    if (label) label.element.classList.toggle('visible', true);
  }
}

/* ── Animation ── */

function animate() {
  if (!isVisible) {
    requestAnimationFrame(animate);
    return;
  }

  // Reverse auto-rotate direction at azimuth limits
  const azimuth = controls.getAzimuthalAngle();
  if (azimuth >= controls.maxAzimuthAngle * 0.95) {
    controls.autoRotateSpeed = -Math.abs(controls.autoRotateSpeed);
  } else if (azimuth <= controls.minAzimuthAngle * 0.95) {
    controls.autoRotateSpeed = Math.abs(controls.autoRotateSpeed);
  }

  controls.update();

  const time = performance.now() * 0.001;
  scene.traverse((obj) => {
    if (obj.userData.pulse) {
      const s = 1 + 0.3 * Math.sin(time * 2 + obj.userData.phase);
      obj.scale.set(s, s, 1);
      obj.material.opacity = 0.6 - 0.3 * Math.sin(time * 2 + obj.userData.phase);
    }
  });

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  requestAnimationFrame(animate);
}

/* ── Init ── */

function init(geojson) {
  const container = document.getElementById('globe-canvas-wrap');
  if (!container) return;

  const testCanvas = document.createElement('canvas');
  const hasWebGL = !!(testCanvas.getContext('webgl2') || testCanvas.getContext('webgl'));
  if (!hasWebGL) {
    container.innerHTML = '<div class="globe-fallback">Interactive globe requires WebGL</div>';
    return;
  }

  let texture;
  if (geojson) {
    texture = createEarthTexture(geojson);
  } else {
    // Fallback: plain navy texture
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = C_OCEAN;
    ctx.fillRect(0, 0, 512, 256);
    texture = new THREE.CanvasTexture(c);
  }

  initScene(container, texture);
  animate();

  const visObserver = new IntersectionObserver((entries) => {
    isVisible = entries[0].isIntersecting;
  }, { threshold: 0.1 });
  visObserver.observe(container);
  isVisible = true;

  document.addEventListener('visibilitychange', () => {
    isVisible = !document.hidden;
  });
}

// Preload GeoJSON immediately so data is ready when the section scrolls in
const section = document.getElementById('globe-section');
if (section) {
  const geojsonReady = fetch('assets/world.geojson')
    .then((r) => r.json())
    .catch(() => null);

  const lazyObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      lazyObserver.disconnect();
      geojsonReady.then((geojson) => init(geojson));
    }
  }, { rootMargin: '300px' });
  lazyObserver.observe(section);
}
