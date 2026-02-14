import * as THREE from "three";

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

function makeOutlinedBox({ w, h, d, color, edgeOpacity = 0.28, roughness = 1 }) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);

  const edges = new THREE.EdgesGeometry(geo, 35);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0x0b0b10, transparent: true, opacity: edgeOpacity })
  );
  mesh.add(line);
  return mesh;
}

function makePixelDitherTexture() {
  // Tiny repeating alpha texture to "pixelize" fog a bit (no external assets).
  const size = 8;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const v = (x + y) % 2 === 0 ? 255 : 180;
      data[i + 0] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = v;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

function createCrane({ blockSize }) {
  const crane = new THREE.Group();

  const railWidth = blockSize * 0.18;
  const railLen = blockSize * 10.5;
  const railHeight = blockSize * 0.12;
  const railY = blockSize * 0.04;

  const railA = makeOutlinedBox({
    w: railWidth,
    h: railHeight,
    d: railLen,
    color: 0x2e3243,
    edgeOpacity: 0.18,
    roughness: 0.9,
  });
  const railB = railA.clone(true);
  railA.position.set(-blockSize * 3.8, railY, 0);
  railB.position.set(blockSize * 3.8, railY, 0);
  crane.add(railA, railB);

  const bridge = new THREE.Group();
  bridge.position.set(0, 0, 0);
  crane.add(bridge);

  const colH = blockSize * 2.2;
  const colW = blockSize * 0.35;
  const colD = blockSize * 0.35;
  const colColor = 0xffc44a;

  const leftCol = makeOutlinedBox({
    w: colW,
    h: colH,
    d: colD,
    color: colColor,
    edgeOpacity: 0.25,
    roughness: 0.8,
  });
  const rightCol = leftCol.clone(true);
  leftCol.position.set(-blockSize * 3.4, colH * 0.5 + railHeight, 0);
  rightCol.position.set(blockSize * 3.4, colH * 0.5 + railHeight, 0);

  const topBeam = makeOutlinedBox({
    w: blockSize * 7.4,
    h: blockSize * 0.32,
    d: blockSize * 0.48,
    color: 0xffd466,
    edgeOpacity: 0.18,
    roughness: 0.85,
  });
  topBeam.position.set(0, colH + railHeight + blockSize * 0.1, 0);

  bridge.add(leftCol, rightCol, topBeam);

  const trolley = new THREE.Group();
  bridge.add(trolley);
  const trolleyBody = makeOutlinedBox({
    w: blockSize * 0.62,
    h: blockSize * 0.46,
    d: blockSize * 0.52,
    color: 0x262a38,
    edgeOpacity: 0.28,
    roughness: 0.9,
  });
  trolleyBody.position.set(0, colH + railHeight + blockSize * 0.05, 0);
  trolley.add(trolleyBody);

  const hook = new THREE.Group();
  trolley.add(hook);

  const hookHead = makeOutlinedBox({
    w: blockSize * 0.34,
    h: blockSize * 0.22,
    d: blockSize * 0.34,
    color: 0x0b0b10,
    edgeOpacity: 0.15,
    roughness: 1,
  });
  hookHead.position.set(0, trolleyBody.position.y - blockSize * 0.5, 0);
  hook.add(hookHead);

  const cableMat = new THREE.LineBasicMaterial({ color: 0x0b0b10, transparent: true, opacity: 0.35 });
  const cableGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0)]);
  const cable = new THREE.Line(cableGeo, cableMat);
  trolley.add(cable);

  return { crane, bridge, trolley, trolleyBody, hook, hookHead, cable, dims: { colH, railHeight, railLen } };
}

function createBlocks({ blockSize }) {
  const g = new THREE.Group();
  const blocks = [];

  const palette = [
    0x6ad02f, // grass
    0x8a5a2b, // dirt
    0x67b2ff, // sky
    0xff3d81, // hot
    0x1a24ff, // ultra
    0xb6ff4a, // acid
    0xffd466, // crane-ish
  ];

  const grid = 3;
  const spacing = blockSize * 1.15;
  const z0 = -spacing * 1.1;

  // Leave one empty cell so the crane can rearrange blocks without overlaps.
  const empty = { x: 1, z: 1 };

  let idx = 0;
  for (let z = 0; z < grid; z++) {
    for (let x = 0; x < grid; x++) {
      if (x === empty.x && z === empty.z) continue;
      const c = palette[idx % palette.length];
      const mesh = makeOutlinedBox({
        w: blockSize * 0.92,
        h: blockSize * 0.92,
        d: blockSize * 0.92,
        color: c,
        edgeOpacity: 0.22,
        roughness: 0.95,
      });
      mesh.position.set((x - 1) * spacing, blockSize * 0.46, (z - 1) * spacing + z0);
      mesh.userData.grid = { x, z };
      g.add(mesh);
      blocks.push(mesh);
      idx++;
    }
  }

  return { group: g, blocks, spacing, grid, z0, empty };
}

function cellToWorld({ x, z, spacing, z0 }) {
  return {
    x: (x - 1) * spacing,
    z: (z - 1) * spacing + z0,
  };
}

function pickMove(blocks, empty) {
  const from = blocks[Math.floor(Math.random() * blocks.length)];
  return { from, to: { x: empty.x, z: empty.z } };
}

export function initThreeBackgroundCrane(canvas) {
  const prefersReduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReduce) return () => {};
  if (!supportsWebGL()) return () => {};

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();

  const camera = new THREE.OrthographicCamera(-6, 6, 6, -6, 0.1, 100);
  camera.position.set(9.5, 9.4, 10.8);
  camera.lookAt(0, 1.2, 0);
  camera.zoom = 86;
  camera.updateProjectionMatrix();

  const ambient = new THREE.AmbientLight(0xffffff, 0.76);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 0.72);
  key.position.set(6, 10, 4);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9fd5ff, 0.35);
  fill.position.set(-6, 6, -6);
  scene.add(fill);

  const blockSize = 1;

  const ground = makeOutlinedBox({
    w: 20,
    h: 0.15,
    d: 16,
    color: 0xf8f4ee,
    edgeOpacity: 0.06,
    roughness: 1,
  });
  ground.position.set(0, -0.02, -1.0);
  scene.add(ground);

  const hazeTex = makePixelDitherTexture();
  const hazeMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.28,
    alphaMap: hazeTex,
  });
  hazeTex.repeat.set(64, 32);
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), hazeMat);
  haze.position.set(0, 2.9, -7.2);
  haze.rotation.x = -Math.PI * 0.06;
  scene.add(haze);

  const blocksState = createBlocks({ blockSize });
  scene.add(blocksState.group);

  const { crane, bridge, trolley, trolleyBody, hook, hookHead, cable, dims } = createCrane({ blockSize });
  crane.position.set(0, 0, blocksState.group.position.z);
  scene.add(crane);

  // Animation state machine.
  const phase = {
    name: "moveToPick",
    t: 0,
    move: pickMove(blocksState.blocks, blocksState.empty),
    carried: null,
    start: {
      bridgeZ: 0,
      trolleyX: 0,
      hookY: 0,
    },
    target: {
      bridgeZ: 0,
      trolleyX: 0,
      hookY: 0,
    },
  };

  const hookDropY = -blockSize * 1.42;
  const cableTopY = trolleyBody.position.y - blockSize * 0.22;

  function syncCable() {
    const y0 = cableTopY;
    const y1 = hook.position.y + hookHead.position.y;
    const points = [new THREE.Vector3(0, y0, 0), new THREE.Vector3(0, y1, 0)];
    cable.geometry.setFromPoints(points);
    cable.geometry.attributes.position.needsUpdate = true;
  }

  function setTargetsForMoveToPick() {
    const b = phase.move.from;
    phase.start.bridgeZ = bridge.position.z;
    phase.start.trolleyX = trolley.position.x;
    phase.start.hookY = hook.position.y;

    phase.target.bridgeZ = b.position.z;
    phase.target.trolleyX = clamp(b.position.x, -blockSize * 3.1, blockSize * 3.1);
    phase.target.hookY = 0;
  }

  function setTargetsForMoveToPlace() {
    const to = phase.move.to;
    const { x, z } = cellToWorld({ x: to.x, z: to.z, spacing: blocksState.spacing, z0: blocksState.z0 });

    phase.start.bridgeZ = bridge.position.z;
    phase.start.trolleyX = trolley.position.x;
    phase.start.hookY = hook.position.y;

    phase.target.bridgeZ = z;
    phase.target.trolleyX = clamp(x, -blockSize * 3.1, blockSize * 3.1);
    phase.target.hookY = 0;
  }

  setTargetsForMoveToPick();

  const tmpV = new THREE.Vector3();
  let raf = 0;
  let running = true;

  const clock = new THREE.Clock();
  let acc = 0;
  const frameStep = 1 / 40; // cap the sim a bit: 40 fps

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);

    // Keep the orthographic framing stable across aspect ratios.
    const aspect = w / h;
    const base = 6;
    camera.left = -base * aspect;
    camera.right = base * aspect;
    camera.top = base;
    camera.bottom = -base;
    camera.updateProjectionMatrix();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function nextPhase(name) {
    phase.name = name;
    phase.t = 0;

    if (name === "moveToPick") {
      phase.move = pickMove(blocksState.blocks, blocksState.empty);
      setTargetsForMoveToPick();
    }

    if (name === "lowerToPick") {
      phase.start.hookY = hook.position.y;
      phase.target.hookY = hookDropY;
    }

    if (name === "raiseWithBlock") {
      phase.start.hookY = hook.position.y;
      phase.target.hookY = 0;
    }

    if (name === "moveToPlace") {
      setTargetsForMoveToPlace();
    }

    if (name === "lowerToPlace") {
      phase.start.hookY = hook.position.y;
      phase.target.hookY = hookDropY;
    }

    if (name === "raiseAfterDrop") {
      phase.start.hookY = hook.position.y;
      phase.target.hookY = 0;
    }
  }

  function attachBlock(block) {
    if (!block) return;
    phase.carried = block;

    // Convert world position to hook local.
    block.getWorldPosition(tmpV);
    hook.worldToLocal(tmpV);
    hook.add(block);
    block.position.copy(tmpV);
  }

  function detachBlock(block, targetWorldPos) {
    if (!block) return;
    phase.carried = null;

    // Convert hook local position to world, then to blocks group local.
    block.getWorldPosition(tmpV);
    hook.remove(block);
    blocksState.group.add(block);
    blocksState.group.worldToLocal(tmpV);
    block.position.copy(tmpV);

    // Snap to target.
    block.position.x = targetWorldPos.x;
    block.position.y = blockSize * 0.46;
    block.position.z = targetWorldPos.z;
  }

  function step(dt) {
    if (!running) return;

    acc += dt;
    while (acc >= frameStep) {
      acc -= frameStep;

      // subtle parallax drift
      haze.position.x = Math.sin(clock.elapsedTime * 0.05) * 0.35;

      const speed =
        phase.name === "moveToPick" || phase.name === "moveToPlace"
          ? 0.75
          : phase.name.includes("lower")
            ? 0.95
            : 0.9;

      phase.t = clamp(phase.t + frameStep * speed, 0, 1);
      const t = easeInOut(phase.t);

      if (phase.name === "moveToPick" || phase.name === "moveToPlace") {
        bridge.position.z = lerp(phase.start.bridgeZ, phase.target.bridgeZ, t);
        trolley.position.x = lerp(phase.start.trolleyX, phase.target.trolleyX, t);

        if (phase.t >= 1) {
          nextPhase(phase.name === "moveToPick" ? "lowerToPick" : "lowerToPlace");
        }
      } else {
        hook.position.y = lerp(phase.start.hookY, phase.target.hookY, t);

        if (phase.t >= 1) {
          if (phase.name === "lowerToPick") {
            attachBlock(phase.move.from);
            nextPhase("raiseWithBlock");
          } else if (phase.name === "raiseWithBlock") {
            nextPhase("moveToPlace");
          } else if (phase.name === "lowerToPlace") {
            const { x, z } = cellToWorld({
              x: phase.move.to.x,
              z: phase.move.to.z,
              spacing: blocksState.spacing,
              z0: blocksState.z0,
            });
            detachBlock(phase.move.from, { x, z });

            // Also update "grid" coordinates.
            const prev = { ...phase.move.from.userData.grid };
            phase.move.from.userData.grid.x = phase.move.to.x;
            phase.move.from.userData.grid.z = phase.move.to.z;
            blocksState.empty.x = prev.x;
            blocksState.empty.z = prev.z;
            nextPhase("raiseAfterDrop");
          } else if (phase.name === "raiseAfterDrop") {
            nextPhase("moveToPick");
          }
        }
      }

      syncCable();
    }
  }

  function render() {
    if (!running) return;
    step(clock.getDelta());
    renderer.render(scene, camera);
    raf = window.requestAnimationFrame(render);
  }

  raf = window.requestAnimationFrame(render);

  const onVis = () => {
    running = !document.hidden;
    if (running) raf = window.requestAnimationFrame(render);
  };
  document.addEventListener("visibilitychange", onVis, { passive: true });

  return () => {
    running = false;
    window.cancelAnimationFrame(raf);
    document.removeEventListener("visibilitychange", onVis);
    ro.disconnect();
    renderer.dispose();
  };
}
