import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const lerp = (a, b, t) => a + (b - a) * t;

function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl") || c.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

function ensureFullscreenCanvas(canvas) {
  // If a renderer ever set inline width/height, it breaks `inset: 0` sizing.
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.display = "block";
}

function makeWingGeometry(sign = 1) {
  // A single low-poly triangle wing.
  const geo = new THREE.BufferGeometry();
  const verts = new Float32Array([
    0, 0, 0,
    1.18 * sign, 0.06, 0.02,
    0.42 * sign, -0.22, 0.6,
  ]);
  geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

function createSkyCraneBird({ scale = 1, tint = 0xffffff } = {}) {
  const g = new THREE.Group();

  const mat = new THREE.MeshStandardMaterial({
    color: tint,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
  });

  const dark = new THREE.MeshStandardMaterial({
    color: 0x0b0b10,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });

  // Body
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), mat);
  body.scale.set(1.7, 1.0, 1.1);
  body.rotation.y = Math.PI / 4;
  g.add(body);

  // Neck
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.68, 0.16), mat);
  neck.position.set(0.32, 0.42, -0.05);
  neck.rotation.z = -0.55;
  g.add(neck);

  // Head
  const head = new THREE.Mesh(new THREE.TetrahedronGeometry(0.16, 0), mat);
  head.position.set(0.58, 0.72, -0.06);
  head.rotation.y = -0.35;
  g.add(head);

  // Beak
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 4, 1), dark);
  beak.position.set(0.76, 0.72, -0.05);
  beak.rotation.z = -Math.PI / 2;
  g.add(beak);

  // Wings (separate pivots so flapping looks decent).
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0xf4f7ff,
    roughness: 0.96,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  const leftWingPivot = new THREE.Group();
  const rightWingPivot = new THREE.Group();

  leftWingPivot.position.set(0.05, 0.15, 0.02);
  rightWingPivot.position.set(0.05, 0.15, 0.02);

  const leftWing = new THREE.Mesh(makeWingGeometry(-1), wingMat);
  const rightWing = new THREE.Mesh(makeWingGeometry(1), wingMat);

  leftWing.rotation.x = 0.32;
  rightWing.rotation.x = 0.32;

  leftWingPivot.add(leftWing);
  rightWingPivot.add(rightWing);

  g.add(leftWingPivot, rightWingPivot);

  // Tail
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 4, 1), dark);
  tail.position.set(-0.46, 0.05, 0.06);
  tail.rotation.z = Math.PI / 2;
  tail.rotation.y = -0.1;
  g.add(tail);

  g.scale.setScalar(scale);

  return {
    group: g,
    leftWingPivot,
    rightWingPivot,
  };
}

export function initThreeBackgroundSky(canvas) {
  if (!supportsWebGL()) return () => {};

  const prefersReduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  ensureFullscreenCanvas(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x67b2ff, 8, 18);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
  camera.position.set(0.6, 2.5, 10.5);
  camera.lookAt(0, 1.3, 0);

  // Foreground (screen-space) scene for little props that should sit "on the grass".
  const hudScene = new THREE.Scene();
  const hudCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
  hudCamera.position.set(0, 0, 900);

  const hudHemi = new THREE.HemisphereLight(0xe7fbff, 0x6b4b2a, 1.1);
  hudHemi.position.set(0, 800, 0);
  hudScene.add(hudHemi);

  const hudSun = new THREE.DirectionalLight(0xffffff, 0.75);
  hudSun.position.set(700, 900, 500);
  hudScene.add(hudSun);

  const groundEl = document.querySelector(".mc-ground");

  // Hemisphere light (as in the reference).
  const hemi = new THREE.HemisphereLight(0xe7fbff, 0xb97a34, 1.15);
  hemi.position.set(0, 8, 0);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 0.55);
  sun.position.set(6, 10, 4);
  scene.add(sun);

  // Soft cloud-ish haze plane.
  const hazeTex = (() => {
    const size = 8;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const a = (x + y) % 2 === 0 ? 240 : 160;
        data[i + 0] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = a;
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  })();

  hazeTex.repeat.set(64, 32);
  const haze = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 22),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
      alphaMap: hazeTex,
    })
  );
  haze.position.set(0, 4.2, -8);
  haze.rotation.x = -Math.PI * 0.06;
  scene.add(haze);

  // A couple of birds. "Журавль" in the sky.
  const birds = [];
  const b1 = createSkyCraneBird({ scale: 1.15, tint: 0xffffff });
  const b2 = createSkyCraneBird({ scale: 0.9, tint: 0xf0f6ff });
  const b3 = createSkyCraneBird({ scale: 0.72, tint: 0xf7f7ff });
  birds.push(
    { ...b1, speed: 0.042, y: 3.55, z: -3.2, offset: 0.1, amp: 0.55 },
    { ...b2, speed: 0.033, y: 2.95, z: -4.7, offset: 0.44, amp: 0.48 },
    { ...b3, speed: 0.026, y: 3.2, z: -6.4, offset: 0.78, amp: 0.42 }
  );

  for (const b of birds) {
    scene.add(b.group);
  }

  const cows = {
    left: null,
    right: null,
    size: new THREE.Vector3(1, 1, 1),
    baseY: 0,
    bobAmp: 0,
    rotBase: 0,
  };

  // Load a CC-BY cow model and place two of them near the grass line.
  // Source: https://poly.pizza/m/0OToIgkcVM7 (Poly by Google, CC-BY 3.0)
  try {
    const loader = new GLTFLoader();
    loader.load(
      "/models/cow-polygoogle.glb",
      (gltf) => {
        const template = gltf.scene;

        template.traverse((o) => {
          if (!o.isMesh) return;
          // Background prop: keep it cheap and always visible.
          o.castShadow = false;
          o.receiveShadow = false;
          o.frustumCulled = false;
        });

        template.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(template);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Normalize: center on X/Z, sit on Y=0.
        template.position.x -= center.x;
        template.position.z -= center.z;
        template.position.y -= box.min.y;

        cows.size.copy(size);

        const left = template.clone(true);
        const right = template.clone(true);

        left.rotation.y = Math.PI * 0.08;
        right.rotation.y = -Math.PI * 0.08;

        cows.left = left;
        cows.right = right;

        hudScene.add(left, right);
        resize();
      },
      undefined,
      () => {
        // Keep the page usable even if the model fails to load.
      }
    );
  } catch {
    // Ignore loader errors (SSR/WebGL constraints, etc.).
  }

  const clock = new THREE.Clock();
  let raf = 0;
  let running = true;

  const pixelScale = 2; // lower-res buffer, scaled up by CSS (pixel vibe)

  function resize() {
    ensureFullscreenCanvas(canvas);

    const w = window.innerWidth;
    const h = window.innerHeight;

    renderer.setSize(Math.max(1, Math.floor(w / pixelScale)), Math.max(1, Math.floor(h / pixelScale)), false);

    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    // HUD camera uses CSS pixels as world units (works with our low-res buffer + CSS scaling).
    hudCamera.left = -w / 2;
    hudCamera.right = w / 2;
    hudCamera.top = h / 2;
    hudCamera.bottom = -h / 2;
    hudCamera.updateProjectionMatrix();

    if (cows.left && cows.right) {
      const groundH = groundEl?.getBoundingClientRect?.().height ?? Math.max(0, h * 0.22);
      const grassTopY = -h / 2 + groundH;

      const desiredH = clamp(h * 0.17, 110, 190);
      const scale = desiredH / Math.max(0.001, cows.size.y);

      cows.left.scale.setScalar(scale);
      cows.right.scale.setScalar(scale);

      const widthPx = cows.size.x * scale;
      const margin = clamp(w * 0.06, 54, 140);

      const xLeft = -w / 2 + margin + widthPx / 2;
      const xRight = w / 2 - margin - widthPx / 2;

      cows.baseY = grassTopY - 6;
      cows.bobAmp = clamp(h * 0.006, 2, 6);
      cows.rotBase = Math.PI * 0.08;

      cows.left.position.set(xLeft, cows.baseY, 0);
      cows.right.position.set(xRight, cows.baseY, 0);

      cows.left.rotation.y = cows.rotBase;
      cows.right.rotation.y = -cows.rotBase;
    }
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });

  function update(t) {
    // Parallax drift for haze.
    haze.position.x = Math.sin(t * 0.07) * 0.55;

    for (const b of birds) {
      const tt = (t * b.speed + b.offset) % 1;
      const x = lerp(-10.5, 11.2, tt);
      const y = b.y + Math.sin(tt * Math.PI * 2) * 0.35;

      b.group.position.set(x, y, b.z);
      b.group.rotation.y = -0.25;
      b.group.rotation.z = Math.sin(tt * Math.PI * 2) * 0.08;

      const flap = Math.sin(t * 6.2 + b.offset * 10) * b.amp;
      b.leftWingPivot.rotation.z = -0.22 + flap;
      b.rightWingPivot.rotation.z = 0.22 - flap;
    }

    if (cows.left && cows.right) {
      const bobL = Math.sin(t * 0.9) * cows.bobAmp;
      const bobR = Math.sin(t * 0.9 + 1.4) * cows.bobAmp;

      cows.left.position.y = cows.baseY + bobL;
      cows.right.position.y = cows.baseY + bobR;

      cows.left.rotation.z = Math.sin(t * 0.55) * 0.02;
      cows.right.rotation.z = -Math.sin(t * 0.55) * 0.02;
    }
  }

  function render() {
    if (!running) return;

    const t = clock.getElapsedTime();
    if (!prefersReduce) update(t);

    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(hudScene, hudCamera);

    if (!prefersReduce) raf = window.requestAnimationFrame(render);
  }

  raf = window.requestAnimationFrame(render);

  const onVis = () => {
    if (prefersReduce) return;
    running = !document.hidden;
    if (running) raf = window.requestAnimationFrame(render);
  };

  if (!prefersReduce) document.addEventListener("visibilitychange", onVis, { passive: true });

  return () => {
    running = false;
    window.cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", onVis);
    renderer.dispose();
  };
}
