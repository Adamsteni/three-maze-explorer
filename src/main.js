import * as THREE from 'three';

const scoreEl = document.querySelector('#score');
const statusEl = document.querySelector('#status');
const overlay = document.querySelector('#overlay');
const overlayTitle = document.querySelector('#overlay-title');
const overlayText = document.querySelector('#overlay-text');

const COLS = 11;
const ROWS = 11;
const CELL = 3;
const WALL_H = 2.4;
const WALL_T = 0.3;
const ORB_COUNT = 5;
const HALF = (COLS - 1) / 2;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0f14);
scene.fog = new THREE.Fog(0x0a0f14, 18, 55);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xfff2cc, 1.5);
sun.position.set(10, 20, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);
const glow = new THREE.PointLight(0x67e8f9, 1.2, 14);
scene.add(glow);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(COLS * CELL + 4, ROWS * CELL + 4),
  new THREE.MeshStandardMaterial({ color: 0x141c22 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

function cellToWorld(gx, gy) {
  return new THREE.Vector3((gx - HALF) * CELL, 0, (gy - HALF) * CELL);
}

function generateMaze() {
  const cells = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ t: true, r: true, b: true, l: true, visited: false }))
  );
  const stack = [[0, 0]];
  cells[0][0].visited = true;

  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const opts = [];
    if (y > 0 && !cells[y - 1][x].visited) opts.push([x, y - 1, 't', 'b']);
    if (x < COLS - 1 && !cells[y][x + 1].visited) opts.push([x + 1, y, 'r', 'l']);
    if (y < ROWS - 1 && !cells[y + 1][x].visited) opts.push([x, y + 1, 'b', 't']);
    if (x > 0 && !cells[y][x - 1].visited) opts.push([x - 1, y, 'l', 'r']);
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const [nx, ny, dir, opp] = opts[Math.floor(Math.random() * opts.length)];
    cells[y][x][dir] = false;
    cells[ny][nx][opp] = false;
    cells[ny][nx].visited = true;
    stack.push([nx, ny]);
  }

  for (let y = 0; y < ROWS - 1; y++) {
    for (let x = 0; x < COLS - 1; x++) {
      if (Math.random() < 0.12) {
        cells[y][x].r = false;
        cells[y][x + 1].l = false;
      }
      if (Math.random() < 0.12) {
        cells[y][x].b = false;
        cells[y + 1][x].t = false;
      }
    }
  }
  return cells;
}

let cells = generateMaze();

const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
const hWallGeo = new THREE.BoxGeometry(CELL + WALL_T, WALL_H, WALL_T);
const vWallGeo = new THREE.BoxGeometry(WALL_T, WALL_H, CELL + WALL_T);

function buildWalls() {
  const group = new THREE.Group();
  const add = (geo, gx, gy, wx, wz) => {
    const m = new THREE.Mesh(geo, wallMat);
    const w = cellToWorld(gx, gy);
    m.position.set(w.x + wx, WALL_H / 2, w.z + wz);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  };
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (cells[y][x].t) add(hWallGeo, x, y, 0, -CELL / 2);
      if (cells[y][x].l) add(vWallGeo, x, y, -CELL / 2, 0);
      if (y === ROWS - 1 && cells[y][x].b) add(hWallGeo, x, y, 0, CELL / 2);
      if (x === COLS - 1 && cells[y][x].r) add(vWallGeo, x, y, CELL / 2, 0);
    }
  }
  return group;
}

let wallGroup = buildWalls();
scene.add(wallGroup);

const player = new THREE.Mesh(
  new THREE.SphereGeometry(0.45, 24, 24),
  new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x0e4f5c })
);
player.castShadow = true;
player.position.copy(cellToWorld(0, 0)).setY(0.45);
scene.add(player);

const portal = new THREE.Mesh(
  new THREE.TorusGeometry(0.9, 0.14, 12, 40),
  new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0x6b0f1d, emissiveIntensity: 1.5 })
);
const exitWorld = cellToWorld(COLS - 1, ROWS - 1);
portal.position.set(exitWorld.x, 1.1, exitWorld.z);
scene.add(portal);

const orbGeo = new THREE.SphereGeometry(0.3, 16, 16);
const orbMat = new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0x7a5c00, emissiveIntensity: 1.4 });
const orbs = [];

let collected = 0;
let won = false;
let moving = false;
let moveT = 0;
let fromPos = new THREE.Vector3();
let toPos = new THREE.Vector3();
let gx = 0;
let gy = 0;

function placeOrbs() {
  for (const o of orbs) scene.remove(o);
  orbs.length = 0;
  collected = 0;
  let placed = 0;
  while (placed < ORB_COUNT) {
    const x = Math.floor(Math.random() * COLS);
    const y = Math.floor(Math.random() * ROWS);
    if ((x === 0 && y === 0) || (x === COLS - 1 && y === ROWS - 1)) continue;
    if (orbs.some((o) => o.userData.gx === x && o.userData.gy === y)) continue;
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orb.position.copy(cellToWorld(x, y)).setY(0.6);
    orb.userData = { gx: x, gy: y };
    scene.add(orb);
    orbs.push(orb);
    placed++;
  }
}

function reset() {
  scene.remove(wallGroup);
  cells = generateMaze();
  wallGroup = buildWalls();
  scene.add(wallGroup);
  gx = 0;
  gy = 0;
  moving = false;
  won = false;
  player.position.copy(cellToWorld(0, 0)).setY(0.45);
  portal.material.color.setHex(0xf43f5e);
  portal.material.emissive.setHex(0x6b0f1d);
  placeOrbs();
  updateHud();
  overlay.classList.add('hidden');
}

function updateHud() {
  scoreEl.textContent = `Orbs: ${collected} / ${ORB_COUNT}`;
  statusEl.textContent =
    collected === ORB_COUNT ? 'Portal open — reach the green ring!' : 'Find the glowing orbs';
}

function win() {
  won = true;
  overlayTitle.textContent = 'You Escaped!';
  overlayText.textContent = `All ${ORB_COUNT} orbs collected — press R or click to play again`;
  overlay.classList.remove('hidden');
}

function tryMove(dx, dy) {
  if (moving || won) return;
  const wall = cells[gy][gx];
  if (dx === 1 && wall.r) return;
  if (dx === -1 && wall.l) return;
  if (dy === 1 && wall.b) return;
  if (dy === -1 && wall.t) return;
  gx = THREE.MathUtils.clamp(gx + dx, 0, COLS - 1);
  gy = THREE.MathUtils.clamp(gy + dy, 0, ROWS - 1);
  fromPos.copy(player.position);
  toPos.copy(cellToWorld(gx, gy)).setY(0.45);
  moveT = 0;
  moving = true;
}

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (won && e.code === 'KeyR') {
    reset();
    return;
  }
  if (e.code === 'KeyW' || e.code === 'ArrowUp') tryMove(0, -1);
  if (e.code === 'KeyS' || e.code === 'ArrowDown') tryMove(0, 1);
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') tryMove(-1, 0);
  if (e.code === 'KeyD' || e.code === 'ArrowRight') tryMove(1, 0);
});

overlay.addEventListener('click', () => {
  if (won) reset();
});

const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (moving) {
    moveT = Math.min(1, moveT + dt / 0.14);
    player.position.lerpVectors(fromPos, toPos, moveT);
    if (moveT >= 1) {
      moving = false;
      const idx = orbs.findIndex((o) => o.userData.gx === gx && o.userData.gy === gy);
      if (idx !== -1) {
        scene.remove(orbs[idx]);
        orbs.splice(idx, 1);
        collected++;
        updateHud();
        if (collected === ORB_COUNT) {
          portal.material.color.setHex(0x4ade80);
          portal.material.emissive.setHex(0x14532d);
        }
      }
      if (gx === COLS - 1 && gy === ROWS - 1 && collected === ORB_COUNT) win();
    }
  }

  for (let i = 0; i < orbs.length; i++) {
    orbs[i].position.y = 0.6 + Math.sin(t * 3 + i) * 0.15;
    orbs[i].rotation.y += dt * 2;
  }
  portal.rotation.z += dt * (collected === ORB_COUNT ? 2.5 : 0.8);

  glow.position.set(player.position.x, 2, player.position.z);
  player.scale.setScalar(1 + Math.sin(t * 4) * 0.05);

  camTarget.set(player.position.x, 11, player.position.z + 8.5);
  camera.position.lerp(camTarget, Math.min(1, dt * 4));
  camera.lookAt(player.position.x, 0, player.position.z);

  renderer.render(scene, camera);
}

placeOrbs();
updateHud();
camera.position.set(cellToWorld(0, 0).x, 11, cellToWorld(0, 0).z + 8.5);
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
