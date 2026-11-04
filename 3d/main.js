// Jehanzeb Ali, 3D experiment: a scroll-driven flight across floating islands,
// one island per chapter. Everything is built from primitives, no model files.
import * as THREE from 'three';
import { EffectComposer } from './vendor/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/postprocessing/OutputPass.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.querySelector('.world');
const loader = document.querySelector('[data-loader]');
const loaderBar = document.querySelector('[data-loader-bar]');
const sections = [...document.querySelectorAll('.ch')];
const hint = document.querySelector('[data-hint]');

// ---------- palette (matches the classic site's darkroom + amber) ----------
const C = {
  paper: 0x14110e, fog: 0x1a1511, amber: 0xeb9a45, amberDeep: 0x8a4f22, ink: 0xece6dc,
  rock: 0x3a3029, rockDark: 0x241d18, top: 0x4d4034, grass: 0x5b5a3a, field: 0x3d5a34,
  red: 0xe0533d, green: 0x8fd18a, white: 0xf3ede2,
};

// ---------- renderer ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.documentElement.classList.add('no-webgl');
  loader.classList.add('is-done');
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.paper);
scene.fog = new THREE.Fog(C.fog, 18, 70);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);

scene.add(new THREE.HemisphereLight(0xffd9b0, 0x1a120c, 1.1));
const key = new THREE.DirectionalLight(0xffc48a, 2.2);
key.position.set(-10, 18, 12);
scene.add(key);
const rim = new THREE.DirectionalLight(0x6f8cff, 0.6);
rim.position.set(10, 4, -14);
scene.add(rim);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.5, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- loading ----------
const manager = new THREE.LoadingManager();
manager.onProgress = (_u, done, total) => { loaderBar.style.width = `${Math.round((done / total) * 100)}%`; };
let revealed = false;
const reveal = () => { if (revealed) return; revealed = true; loaderBar.style.width = '100%'; setTimeout(() => loader.classList.add('is-done'), 250); };
manager.onLoad = reveal;
setTimeout(reveal, 6000);
const texLoader = new THREE.TextureLoader(manager);
const tex = (url) => { const t = texLoader.load(url); t.colorSpace = THREE.SRGBColorSpace; return t; };

// ---------- helpers ----------
const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0.05, ...opts });
const glow = (color, intensity = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, flatShading: true });
const mesh = (geo, material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); return m; };

// seeded random so the islands look the same on every visit
let seed = 7;
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// jitter vertices by position hash, so seam duplicates move together and no cracks open
function jitter(geo, amt, keepTop = false) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    if (keepTop && v.y > geo.userData.topY - 0.01) continue;
    const h = Math.sin(v.x * 12.9898 + v.y * 78.233 + v.z * 37.719) * 43758.5453;
    const r = h - Math.floor(h);
    const h2 = Math.sin(v.x * 93.989 + v.y * 67.345 + v.z * 12.345) * 24634.6345;
    const r2 = h2 - Math.floor(h2);
    p.setXYZ(i, v.x + (r - 0.5) * amt, v.y + (r2 - 0.5) * amt * 0.6, v.z + (r2 - 0.5) * amt);
  }
  geo.computeVertexNormals();
  return geo;
}

function label(text, sub, { w = 512, h = 256, color = '#ece6dc', size = 120 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `200 ${size}px "Sofia Sans Extra Condensed", sans-serif`;
  g.fillText(text.toUpperCase(), w / 2, sub ? h * 0.4 : h / 2);
  if (sub) { g.fillStyle = '#eb9a45'; g.font = `400 ${Math.round(size * 0.32)}px "Sofia Sans Extra Condensed", sans-serif`; g.fillText(sub.toUpperCase(), w / 2, h * 0.8); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(w / 160, h / 160, 1);
  return s;
}

// interactive registry
const clickables = [];   // meshes the raycaster tests
const boingers = [];     // groups that squash and stretch when clicked
const tickers = [];      // per-frame animations: fn(time, dt)
function makeBoing(group, url, opens = false) {
  group.userData.boing = { v: 0, s: 0 };
  group.userData.url = url;
  group.userData.opens = opens;
  group.traverse((o) => { if (o.isMesh) { o.userData.owner = group; clickables.push(o); } });
  boingers.push(group);
}

// ---------- island ----------
function island(radius, topColor = C.top) {
  const g = new THREE.Group();
  const topGeo = new THREE.CylinderGeometry(radius, radius * 0.94, 0.5, 10, 1);
  g.add(mesh(jitter(topGeo, 0.12), mat(topColor), 0, -0.25, 0));
  const rockGeo = new THREE.ConeGeometry(radius * 0.96, radius * 1.7, 10, 4);
  rockGeo.rotateX(Math.PI);
  g.add(mesh(jitter(rockGeo, radius * 0.22), mat(C.rock), 0, -0.5 - radius * 0.85, 0));
  // little satellite rocks
  for (let i = 0; i < 4; i++) {
    const a = rand() * Math.PI * 2, d = radius * (1.25 + rand() * 0.5), s = 0.25 + rand() * 0.45;
    const r = mesh(jitter(new THREE.IcosahedronGeometry(s, 0), 0.1), mat(C.rockDark), Math.cos(a) * d, -1 - rand() * 2.5, Math.sin(a) * d);
    const base = r.position.y, ph = rand() * 6;
    tickers.push((t) => { r.position.y = base + Math.sin(t * 0.8 + ph) * 0.25; r.rotation.y = t * 0.2 + ph; });
    g.add(r);
  }
  // tiny lights on the rim
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    g.add(mesh(new THREE.SphereGeometry(0.06, 6, 4), glow(C.amber, 3), Math.cos(a) * (radius - 0.25), 0.08, Math.sin(a) * (radius - 0.25)));
  }
  return g;
}

function tree(x, z, s = 1) {
  const t = new THREE.Group();
  t.add(mesh(new THREE.CylinderGeometry(0.06 * s, 0.09 * s, 0.5 * s, 5), mat(0x4a3424), 0, 0.25 * s, 0));
  t.add(mesh(jitter(new THREE.ConeGeometry(0.42 * s, 1.0 * s, 6), 0.06), mat(0x55603a), 0, 0.9 * s, 0));
  t.add(mesh(jitter(new THREE.ConeGeometry(0.32 * s, 0.75 * s, 6), 0.05), mat(0x67703f), 0, 1.3 * s, 0));
  t.position.set(x, 0, z);
  return t;
}

// in-world screen: shows a poster, swaps to video while its island is in view
const videos = [];
function screen(w, h, poster, video, url) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(w + 0.18, h + 0.18, 0.12), mat(0x0d0b09, { roughness: 0.4, metalness: 0.4 }), 0, 0, -0.07));
  const edge = mesh(new THREE.BoxGeometry(w + 0.26, 0.04, 0.04), glow(C.amber, 2.5), 0, -h / 2 - 0.14, 0);
  g.add(edge);
  const screenMat = new THREE.MeshBasicMaterial({ map: tex(poster), toneMapped: false });
  const plane = mesh(new THREE.PlaneGeometry(w, h), screenMat, 0, 0, 0.0);
  g.add(plane);
  if (video) {
    const v = document.createElement('video');
    Object.assign(v, { src: video, muted: true, loop: true, playsInline: true, preload: 'none' });
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    const vt = new THREE.VideoTexture(v); vt.colorSpace = THREE.SRGBColorSpace;
    v.addEventListener('playing', () => { screenMat.map = vt; screenMat.needsUpdate = true; }, { once: true });
    videos.push({ el: v, group: g });
  }
  makeBoing(g, url, true);
  return g;
}

function float(obj, amp = 0.15, speed = 1, phase = rand() * 6) {
  const base = obj.position.y;
  tickers.push((t) => { obj.position.y = base + Math.sin(t * speed + phase) * amp; });
  return obj;
}

// ---------- the islands ----------
const STOPS = []; // { center, side } per chapter
const world = new THREE.Group();
scene.add(world);

// 1. 2017 Unreal at uni: arcade cabinet ringed by six game cards
{
  const c = new THREE.Vector3(0, 0, 0);
  const g = island(3.4); g.position.copy(c); world.add(g);
  const cab = new THREE.Group();
  const body = mat(0x2b2119);
  cab.add(mesh(new THREE.BoxGeometry(1.3, 2.3, 1.1), body, 0, 1.15, 0));
  cab.add(mesh(new THREE.BoxGeometry(1.4, 0.4, 1.2), glow(C.amber, 1.6), 0, 2.45, 0.05));
  const panel = mesh(new THREE.BoxGeometry(1.3, 0.12, 0.6), mat(0x3b2d22), 0, 1.25, 0.7); panel.rotation.x = 0.35; cab.add(panel);
  cab.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), mat(0x222222), -0.3, 1.45, 0.75));
  cab.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), glow(C.red, 1.5), -0.3, 1.62, 0.75));
  [0.05, 0.25, 0.45].forEach((x, i) => cab.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10), glow([C.amber, C.green, 0x6f8cff][i], 1.8), x, 1.36, 0.7)));
  const imgs = ['uni-bloodening', 'uni-rabid', 'uni-scurvy', 'uni-rerilla', 'uni-crushing', 'uni-extras'];
  const urls = ['bygfbJhBPi0', 'kD5erxwy0vY', '-8QyaQrEbNs', '-BHlsEPcJto', '_O61F6eO5oI', 'RzQGOUZhFEU'].map((id) => `https://www.youtube.com/watch?v=${id}`);
  const textures = imgs.map((n) => tex(`../media/${n}.jpg`));
  const crt = new THREE.MeshBasicMaterial({ map: textures[0], toneMapped: false });
  const crtMesh = mesh(new THREE.PlaneGeometry(1.0, 0.75), crt, 0, 1.9, 0.56); crtMesh.rotation.x = -0.12; cab.add(crtMesh);
  let shown = 0;
  tickers.push((t) => { const n = Math.floor(t / 2.2) % 6; if (n !== shown) { shown = n; crt.map = textures[n]; } });
  makeBoing(cab, urls[0]);
  g.add(cab);
  // orbiting cards
  const ring = new THREE.Group(); ring.position.y = 1.6; g.add(ring);
  textures.forEach((t, i) => {
    const card = new THREE.Group();
    card.add(mesh(new THREE.BoxGeometry(1.42, 0.84, 0.05), mat(0x0d0b09)));
    card.add(mesh(new THREE.PlaneGeometry(1.34, 0.76), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }), 0, 0, 0.03));
    const a = (i / 6) * Math.PI * 2;
    card.position.set(Math.cos(a) * 2.7, Math.sin(i * 1.7) * 0.4, Math.sin(a) * 2.7);
    card.rotation.y = -a + Math.PI / 2;
    makeBoing(card, urls[i], true);
    ring.add(card);
  });
  tickers.push((t) => { ring.rotation.y = t * 0.18; });
  g.add(tree(-2.4, -1.4, 0.8), tree(2.3, -1.8, 1));
  STOPS.push({ center: c });
}

// 2. 2020 Remio VR: giant headset, trees, a bouncing basketball, screen with the trailer
{
  const c = new THREE.Vector3(16, 2.5, -10);
  const g = island(3.6, C.grass); g.position.copy(c); world.add(g);
  const hs = new THREE.Group();
  const shell = mat(0xe9e3d8, { roughness: 0.5 });
  hs.add(mesh(new THREE.BoxGeometry(2.0, 1.1, 1.0), shell));
  hs.add(mesh(new THREE.BoxGeometry(1.84, 0.94, 0.06), mat(0x15110e, { roughness: 0.2, metalness: 0.6 }), 0, 0, 0.52));
  [-0.45, 0.45].forEach((x) => hs.add(mesh(new THREE.TorusGeometry(0.26, 0.05, 6, 16), glow(C.amber, 2.2), x, 0, 0.56)));
  const strap = mesh(new THREE.TorusGeometry(1.05, 0.08, 6, 20, Math.PI), mat(0x2b2520), 0, 0, -0.45); strap.rotation.x = Math.PI / 2; strap.rotation.z = Math.PI; hs.add(strap);
  hs.position.set(-0.6, 2.6, 0.6); hs.rotation.set(0.15, 0.5, 0);
  tickers.push((t) => { hs.rotation.y = 0.5 + Math.sin(t * 0.6) * 0.5; hs.rotation.x = 0.15 + Math.sin(t * 0.9) * 0.08; });
  float(hs, 0.2, 1.1);
  makeBoing(hs, 'https://www.meta.com/experiences/remio/5120897861344596/');
  g.add(hs);
  g.add(tree(-2.5, -1.3, 1.1), tree(-1.6, -2.4, 0.8), tree(2.7, 0.8, 0.9), tree(-2.8, 1.2, 0.7));
  // hoop + ball
  const hoop = new THREE.Group();
  hoop.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), mat(0x444444), 0, 1.1, 0));
  hoop.add(mesh(new THREE.BoxGeometry(0.9, 0.6, 0.05), mat(C.white), 0, 2.3, 0.1));
  const rimT = mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 14), glow(C.red, 1.2), 0, 2.1, 0.35); rimT.rotation.x = Math.PI / 2; hoop.add(rimT);
  hoop.position.set(2.2, 0, -1.6); hoop.rotation.y = -0.7; g.add(hoop);
  const ball = mesh(new THREE.IcosahedronGeometry(0.2, 1), mat(0xd9702c), 1.4, 0.2, -0.6);
  tickers.push((t) => { const b = Math.abs(Math.sin(t * 2.6)); ball.position.y = 0.2 + b * 1.4; ball.rotation.x = t * 3; });
  makeBoing(ball, 'https://www.meta.com/experiences/animal-blocks/26317184997880598/');
  g.add(ball);
  const sc = screen(3.6, 2.025, '../media/remio-house.jpg', '../media/remio-house.mp4', 'https://www.meta.com/experiences/remio/5120897861344596/');
  sc.position.set(0.9, 4.6, -1.2); sc.rotation.y = -0.25; float(sc, 0.12, 0.7); g.add(sc);
  STOPS.push({ center: c });
}

// 3. 2025 NFL on Roblox: a mini field, goalposts, a football looping end to end, a 400K+ sign
{
  const c = new THREE.Vector3(32, -0.5, -4);
  const g = island(3.8); g.position.copy(c); world.add(g);
  const field = new THREE.Group();
  field.add(mesh(new THREE.BoxGeometry(5.2, 0.08, 2.8), mat(C.field), 0, 0.04, 0));
  for (let i = -4; i <= 4; i++) field.add(mesh(new THREE.BoxGeometry(0.03, 0.01, 2.6), new THREE.MeshBasicMaterial({ color: C.white }), i * 0.55, 0.09, 0));
  [-2.4, 2.4].forEach((x, i) => {
    const post = new THREE.Group();
    const y = glow(0xf2c84b, 0.7);
    post.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6), y, 0, 0.5, 0));
    post.add(mesh(new THREE.BoxGeometry(0.06, 0.06, 1.2), y, 0, 1.0, 0));
    [-0.6, 0.6].forEach((z) => post.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), y, 0, 1.55, z)));
    post.position.x = x; field.add(post);
    field.add(mesh(new THREE.BoxGeometry(0.5, 0.012, 2.6), new THREE.MeshBasicMaterial({ color: i ? 0x2f4fa8 : 0x9b2a2a }), x * 1.0 - Math.sign(x) * 0.1, 0.095, 0));
  });
  g.add(field);
  const fb = new THREE.Group();
  const leather = mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(0x7a4426)); leather.scale.set(1.6, 1, 1); fb.add(leather);
  fb.add(mesh(new THREE.BoxGeometry(0.22, 0.03, 0.05), new THREE.MeshBasicMaterial({ color: C.white }), 0, 0.19, 0));
  tickers.push((t) => {
    const p = (t * 0.35) % 2, k = p < 1 ? p : 2 - p, dir = p < 1 ? 1 : -1;
    fb.position.set(-2.2 + k * 4.4, 0.4 + Math.sin(k * Math.PI) * 2.4, Math.sin(k * Math.PI) * 0.3);
    fb.rotation.set(t * 6, 0, dir * (0.6 - k * 1.2));
  });
  makeBoing(fb, 'https://www.roblox.com/games/184199275');
  g.add(fb);
  const sign = label('400K+', 'daily players', { size: 150 }); sign.position.set(-1.6, 3.8, -1.4); float(sign, 0.15, 0.9); g.add(sign);
  const sc = screen(3.6, 2.025, '../media/nfl-play.jpg', '../media/nfl-play.mp4', 'https://www.roblox.com/games/184199275');
  sc.position.set(1.4, 3.5, -2.2); sc.rotation.y = -0.3; float(sc, 0.12, 0.8); g.add(sc);
  STOPS.push({ center: c });
}

// 4. TableSide: a dish on a turntable, a scan ring sweeping it, a phone holding the AR view
{
  const c = new THREE.Vector3(47, 3, -15);
  const g = island(3.3); g.position.copy(c); world.add(g);
  const table = new THREE.Group();
  table.add(mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.12, 20), mat(0x6b4a33, { flatShading: false }), 0, 1.1, 0));
  table.add(mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.1, 8), mat(0x3e2c20), 0, 0.55, 0));
  g.add(table);
  const dish = new THREE.Group(); dish.position.y = 1.18;
  dish.add(mesh(new THREE.CylinderGeometry(0.85, 0.7, 0.06, 28), mat(C.white, { flatShading: false, roughness: 0.3 }), 0, 0.03, 0));
  const cake = new THREE.Group(); cake.position.y = 0.06;
  cake.add(mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 24, 1, false, 0, Math.PI * 1.6), mat(0x8a5a32), 0, 0.06, 0));
  cake.add(mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.38, 24, 1, false, 0, Math.PI * 1.6), mat(0xf1dcae, { flatShading: false }), 0, 0.31, 0));
  cake.add(mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 24, 1, false, 0, Math.PI * 1.6), mat(0xa83246, { flatShading: false, roughness: 0.3 }), 0, 0.53, 0));
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 1.5 + 0.2; cake.add(mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(0xc4202f, { roughness: 0.3 }), Math.cos(a) * 0.42, 0.6, -Math.sin(a) * 0.42)); }
  dish.add(cake);
  tickers.push((t) => { dish.rotation.y = t * 0.5; });
  makeBoing(dish, 'https://tableside.pk/');
  g.add(dish);
  // scan ring + scan points
  const ringM = mesh(new THREE.TorusGeometry(1.0, 0.025, 6, 48), glow(C.amber, 3)); ringM.rotation.x = Math.PI / 2; g.add(ringM);
  const pts = []; for (let i = 0; i < 600; i++) { const a = rand() * Math.PI * 1.6, r = Math.sqrt(rand()) * 0.62, y = rand() * 0.6; pts.push(Math.cos(a) * r, y, -Math.sin(a) * r); }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const cloud = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: C.amber, size: 0.03, transparent: true, opacity: 0.9 }));
  cloud.position.y = 0.06; dish.add(cloud);
  tickers.push((t) => {
    const k = (Math.sin(t * 1.4) + 1) / 2;
    ringM.position.y = 1.25 + k * 0.75; ringM.scale.setScalar(1 - k * 0.15);
    cloud.material.opacity = 0.25 + 0.6 * (1 - k);
  });
  // phone
  const phone = new THREE.Group();
  phone.add(mesh(new THREE.BoxGeometry(0.95, 1.9, 0.08), mat(0x111111, { roughness: 0.3, metalness: 0.5 })));
  phone.add(mesh(new THREE.PlaneGeometry(0.85, 1.78), new THREE.MeshBasicMaterial({ map: tex('../media/ts-ar.jpg'), toneMapped: false }), 0, 0, 0.045));
  phone.position.set(-1.9, 2.6, 0.6); phone.rotation.set(-0.1, 0.6, 0.12); float(phone, 0.18, 1.2);
  makeBoing(phone, 'https://tableside.pk/');
  g.add(phone);
  const sc = screen(3.2, 1.8, '../media/ts-scan.jpg', '../media/ts-scan.mp4', 'https://tableside.pk/');
  sc.position.set(1.3, 3.9, -1.6); sc.rotation.y = -0.3; float(sc, 0.12, 0.7); g.add(sc);
  STOPS.push({ center: c });
}

// 5. Valar: a firewall of bricks; packets fly at it; red secrets get bounced, the rest reach the model orb
{
  const c = new THREE.Vector3(63, 0.5, -7);
  const g = island(3.8); g.position.copy(c); g.rotation.y = 0.75; world.add(g);
  const cols = 9, rows = 5;
  const bricks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.24, 0.3), glow(C.amberDeep, 0.6), cols * rows);
  const m4 = new THREE.Matrix4();
  for (let r = 0, i = 0; r < rows; r++) for (let k = 0; k < cols; k++, i++) { m4.makeTranslation(0, 0.2 + r * 0.27, -1.6 + k * 0.37 + (r % 2) * 0.18); bricks.setMatrixAt(i, m4); }
  bricks.position.x = 0.2; g.add(bricks);
  const wallFlash = { v: 0 };
  tickers.push((t, dt) => { wallFlash.v = Math.max(0, wallFlash.v - dt * 2); bricks.material.emissiveIntensity = 0.6 + wallFlash.v * 2.5; });
  // model orb
  const orb = new THREE.Group();
  orb.add(mesh(new THREE.IcosahedronGeometry(0.75, 1), new THREE.MeshStandardMaterial({ color: 0x9fb4ff, emissive: 0x5a73ff, emissiveIntensity: 1.2, wireframe: true })));
  orb.add(mesh(new THREE.IcosahedronGeometry(0.4, 0), glow(0x7d93ff, 2)));
  orb.position.set(2.2, 1.6, 0); float(orb, 0.15, 1);
  tickers.push((t) => { orb.rotation.y = t * 0.6; orb.rotation.x = t * 0.3; });
  makeBoing(orb, 'https://valar.digital/');
  g.add(orb);
  // DGX box
  const dgx = new THREE.Group();
  dgx.add(mesh(new THREE.BoxGeometry(0.9, 0.35, 0.9), mat(0xb08d57, { metalness: 0.7, roughness: 0.35 })));
  for (let i = 0; i < 5; i++) dgx.add(mesh(new THREE.BoxGeometry(0.7, 0.02, 0.04), glow(C.green, 1.5), 0, 0.12 - i * 0.05, 0.46));
  dgx.position.set(2.4, 0.2, 1.8); dgx.rotation.y = -0.4;
  makeBoing(dgx, 'https://valar.digital/'); g.add(dgx);
  // packets
  const packetGeo = new THREE.OctahedronGeometry(0.1, 0);
  const pm = { ok: glow(C.ink, 1.5), bad: glow(C.red, 2.5) };
  const packets = [];
  for (let i = 0; i < 14; i++) {
    const p = mesh(packetGeo, pm.ok); g.add(p);
    packets.push({ m: p, t: -i * 0.35, bad: false, z: 0, y: 0, dead: 0 });
  }
  const spawn = (p) => { p.t = 0; p.bad = rand() < 0.3; p.m.material = p.bad ? pm.bad : pm.ok; p.z = (rand() - 0.5) * 2.6; p.y = 0.4 + rand() * 1.1; p.dead = 0; p.m.visible = true; };
  packets.forEach(spawn); packets.forEach((p, i) => { p.t = -i * 0.3; });
  tickers.push((t, dt) => {
    for (const p of packets) {
      p.t += dt * 0.45;
      if (p.t < 0) { p.m.visible = false; continue; }
      p.m.visible = true;
      const x0 = -3, wall = 0.05;
      if (p.bad && p.t > 0.5) {
        if (!p.dead) { p.dead = 0.001; wallFlash.v = 1; }
        p.dead += dt;
        p.m.position.set(wall - p.dead * 1.8, p.y + p.dead * 1.2 - p.dead * p.dead * 4, p.z);
        if (p.dead > 1.2) spawn(p);
      } else {
        const x = x0 + p.t * 6.4;
        const into = Math.max(0, x - 0.2) / 2;
        p.m.position.set(x, p.y + (1.6 - p.y) * Math.min(1, into), p.z * (1 - Math.min(1, into)));
        if (x > 2.2) spawn(p);
      }
      p.m.rotation.y += dt * 4;
    }
  });
  const sign = label('Valar', 'AI firewall', { size: 150 }); sign.position.set(-1.6, 3.4, -1.2); float(sign, 0.12, 0.8); g.add(sign);
  STOPS.push({ center: c });
}

// 6. Next: three prototypes on pedestals (an atom for Ustaad, a lime for Lime, a solving sudoku)
{
  const c = new THREE.Vector3(78, 3, -16);
  const g = island(3.4, C.grass); g.position.copy(c); world.add(g);
  const pedestal = (x, z) => { const p = mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.7, 8), mat(0x2b231c), x, 0.35, z); g.add(p); g.add(mesh(new THREE.TorusGeometry(0.6, 0.02, 4, 24), glow(C.amber, 2), x, 0.72, z).rotateX(Math.PI / 2)); };
  // Ustaad atom
  pedestal(-1.9, 0.6);
  const atom = new THREE.Group(); atom.position.set(-1.9, 1.8, 0.6);
  atom.add(mesh(new THREE.IcosahedronGeometry(0.22, 1), glow(C.amber, 1.5)));
  for (let i = 0; i < 3; i++) {
    const orbit = new THREE.Group(); orbit.rotation.set(i * 1.05, i * 0.6, 0);
    orbit.add(mesh(new THREE.TorusGeometry(0.62, 0.012, 4, 40), glow(C.ink, 0.6)));
    const e = mesh(new THREE.SphereGeometry(0.06, 8, 6), glow(0x7d93ff, 3), 0.62, 0, 0); orbit.add(e);
    tickers.push((t) => { e.position.set(Math.cos(t * (2 + i)) * 0.62, Math.sin(t * (2 + i)) * 0.62, 0); });
    atom.add(orbit);
  }
  float(atom, 0.12, 1.3); makeBoing(atom); g.add(atom);
  const l1 = label('Ustaad', 'physics', { size: 110 }); l1.scale.multiplyScalar(0.55); l1.position.set(-1.9, 2.9, 0.6); g.add(l1);
  // Lime
  pedestal(0.2, -0.6);
  const lime = new THREE.Group(); lime.position.set(0.2, 1.5, -0.6);
  const fruit = mesh(jitter(new THREE.IcosahedronGeometry(0.45, 1), 0.04), mat(0x7fb23a, { roughness: 0.6 })); fruit.scale.set(1, 0.85, 0.85); lime.add(fruit);
  const leaf = mesh(new THREE.ConeGeometry(0.1, 0.4, 4), mat(0x3f6b2a), 0.1, 0.45, 0); leaf.rotation.z = -0.8; lime.add(leaf);
  tickers.push((t) => { lime.rotation.y = t * 0.8; });
  float(lime, 0.14, 1.1, 2); makeBoing(lime); g.add(lime);
  const l2 = label('Lime', 'PSX', { size: 110 }); l2.scale.multiplyScalar(0.55); l2.position.set(0.2, 2.5, -0.6); g.add(l2);
  // Sudoku: 9x9 tiles rising as the board "solves"
  pedestal(2.0, 0.9);
  const board = new THREE.Group(); board.position.set(2.0, 0.78, 0.9); board.rotation.y = -0.4;
  const tileGeo = new THREE.BoxGeometry(0.1, 0.06, 0.1);
  const tiles = [];
  for (let i = 0; i < 81; i++) {
    const x = i % 9, z = Math.floor(i / 9);
    const tm = mesh(tileGeo, tiles[0] ? tiles[0].material : mat(0x3a3029), (x - 4) * 0.115 + Math.floor(x / 3) * 0.02 - 0.02, 0, (z - 4) * 0.115 + Math.floor(z / 3) * 0.02 - 0.02);
    tm.userData.phase = rand(); board.add(tm); tiles.push(tm);
  }
  const lit = glow(C.amber, 1.4), dim = tiles[0].material;
  tickers.push((t) => { const k = (t * 0.12) % 1.2; tiles.forEach((tm) => { const on = tm.userData.phase < k; tm.material = on ? lit : dim; tm.position.y = on ? 0.04 : 0; }); });
  makeBoing(board); g.add(board);
  const l3 = label('Sudoku', 'by technique', { size: 110 }); l3.scale.multiplyScalar(0.55); l3.position.set(2.0, 1.9, 0.9); g.add(l3);
  g.add(tree(-2.6, -1.6, 0.9), tree(2.7, -1.5, 0.7));
  STOPS.push({ center: c });
}

// floating paper planes carrying "mail" across the final view
{
  const planeGeo = new THREE.ConeGeometry(0.25, 0.8, 3); planeGeo.rotateZ(-Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const p = mesh(planeGeo, glow(C.ink, 0.4)); p.scale.y = 0.25; world.add(p);
    const r = 30 + i * 4, h = 10 + i * 1.5, sp = 0.05 + i * 0.012, ph = i * 1.3;
    tickers.push((t) => { const a = t * sp + ph; p.position.set(39 + Math.cos(a) * r, h + Math.sin(t * 0.5 + i) * 1.2, -9 + Math.sin(a) * r * 0.6); p.rotation.y = -a - Math.PI / 2; });
  }
}

// dust motes across the whole world
const dust = (() => {
  const n = 1400, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = -20 + rand() * 120; pos[i * 3 + 1] = -12 + rand() * 30; pos[i * 3 + 2] = -45 + rand() * 60; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffc58a, size: 0.07, transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(pts);
  return pts;
})();
tickers.push((t) => { dust.position.y = Math.sin(t * 0.1) * 0.6; dust.rotation.y = Math.sin(t * 0.05) * 0.02; });

// a slow amber "sun" disc far behind everything
{
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(235,154,69,0.5)'); grad.addColorStop(0.2, 'rgba(200,116,46,0.22)'); grad.addColorStop(0.55, 'rgba(160,90,36,0.06)'); grad.addColorStop(1, 'rgba(160,90,36,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false, transparent: true, depthWrite: false }));
  sun.position.set(40, 8, -90); sun.scale.set(60, 60, 1);
  scene.add(sun);
}

// ---------- camera path ----------
// Stops: intro, six islands, outro. Islands sit to the right of the text card on wide screens,
// and in the top half on tall screens where the card sits at the bottom.
let camCurve, lookCurve;
const N = STOPS.length + 2;
function buildPath() {
  const tall = innerWidth / innerHeight < 0.9;
  const camPts = [], lookPts = [];
  const first = STOPS[0].center, last = STOPS[STOPS.length - 1].center;
  camPts.push(new THREE.Vector3(first.x - 16, first.y + 10, first.z + 24));
  lookPts.push(new THREE.Vector3(first.x + 10, first.y - 1, first.z - 8));
  for (const { center: c } of STOPS) {
    if (tall) { camPts.push(c.clone().add(new THREE.Vector3(0.5, 5.5, 16))); lookPts.push(c.clone().add(new THREE.Vector3(0.3, -0.8, 0))); }
    else { camPts.push(c.clone().add(new THREE.Vector3(-3.5, 4.8, 16))); lookPts.push(c.clone().add(new THREE.Vector3(-4.8, 1.4, 0))); }
  }
  const mid = new THREE.Vector3().addVectors(first, last).multiplyScalar(0.5);
  camPts.push(new THREE.Vector3(mid.x + (tall ? 0 : -8), tall ? 40 : 30, mid.z + (tall ? 95 : 70)));
  lookPts.push(new THREE.Vector3(mid.x + (tall ? 0 : -11), tall ? -6 : -1, mid.z));
  camCurve = new THREE.CatmullRomCurve3(camPts, false, 'centripetal');
  lookCurve = new THREE.CatmullRomCurve3(lookPts, false, 'centripetal');
}
buildPath();

// scroll -> path position, with a plateau at each stop so the camera rests while a card is read
const plateau = (f) => { const a = 0.18, b = 0.82; if (f <= a) return 0; if (f >= b) return 1; const x = (f - a) / (b - a); return x * x * (3 - 2 * x); };
let target = 0, current = 0;
function readScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  const s = p * (N - 1), i = Math.min(N - 2, Math.floor(s));
  target = (i + plateau(s - i)) / (N - 1);
  if (scrollY > 40) hint.classList.add('is-gone');
}
addEventListener('scroll', readScroll, { passive: true });
readScroll(); current = target;

// active chapter: card highlight, dots, which videos play
const dotsNav = document.querySelector('[data-dots]');
const dots = sections.map((s) => {
  const a = document.createElement('a'); a.href = `#${s.id}`;
  a.innerHTML = `<span>${s.dataset.label}</span>`; a.setAttribute('aria-label', s.dataset.label);
  dotsNav.appendChild(a); return a;
});
let active = -1;
function setActive(i) {
  if (i === active) return; active = i;
  sections.forEach((s, n) => s.classList.toggle('is-active', n === i));
  dots.forEach((d, n) => (n === i ? d.setAttribute('aria-current', 'step') : d.removeAttribute('aria-current')));
}
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setActive(sections.indexOf(e.target)); }), { rootMargin: '-45% 0px -45% 0px' });
sections.forEach((s) => io.observe(s));
setActive(0);

function syncVideos() {
  const at = current * (N - 1); // 1..6 are islands
  videos.forEach(({ el, group }) => {
    // find which stop owns this screen by its world position
    const wp = group.getWorldPosition(new THREE.Vector3());
    let nearest = 0, best = Infinity;
    STOPS.forEach((s, i) => { const d = s.center.distanceTo(wp); if (d < best) { best = d; nearest = i + 1; } });
    const near = Math.abs(at - nearest) < 0.75 && !reduce && !document.hidden;
    if (near && el.paused) { el.preload = 'auto'; el.play().catch(() => {}); }
    else if (!near && !el.paused) el.pause();
  });
}

// ---------- pointer: parallax, hover, click ----------
const pointer = new THREE.Vector2(9, 9), parallax = new THREE.Vector2(), parallaxT = new THREE.Vector2();
const ray = new THREE.Raycaster();
let hovered = null;
addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (e.pointerType === 'mouse') parallaxT.set(pointer.x, pointer.y);
});
// the canvas sits under the chapters, so listen on the window and ignore clicks on the cards
let downAt = [0, 0];
addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
addEventListener('pointerup', (e) => {
  if (e.target.closest('.card, .hud, .dots, a, button')) return;
  if (Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 8) return; // a drag or scroll, not a tap
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  const hit = pick();
  if (!hit) return;
  const owner = hit.object.userData.owner;
  const b = owner.userData.boing;
  b.v += 7; // kick the spring
  burst(hit.point);
  // screens and game cards open their project; props just bounce
  if (owner.userData.opens && owner.userData.url) setTimeout(() => window.open(owner.userData.url, '_blank', 'noopener'), 180);
});
function pick() {
  ray.setFromCamera(pointer, camera);
  const hits = ray.intersectObjects(clickables, false);
  return hits.find((h) => h.object.visible) || null;
}

// little amber sparks where you click
const sparks = [];
const sparkGeo = new THREE.TetrahedronGeometry(0.06, 0);
const sparkMat = glow(C.amber, 3);
function burst(at) {
  for (let i = 0; i < 14; i++) {
    const m = mesh(sparkGeo, sparkMat); m.position.copy(at); scene.add(m);
    sparks.push({ m, v: new THREE.Vector3((rand() - 0.5) * 4, rand() * 4 + 1, (rand() - 0.5) * 4), life: 0.9 });
  }
}

// ---------- resize ----------
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 0.9 ? 55 : 42; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); bloom.resolution.set(innerWidth, innerHeight);
  buildPath(); readScroll();
});
dispatchEvent(new Event('resize'));

// ---------- loop ----------
const clock = new THREE.Clock();
const camPos = new THREE.Vector3(), lookAt = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
let videoTick = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = reduce ? 0 : clock.elapsedTime;
  current += (target - current) * (reduce ? 1 : 1 - Math.pow(0.0015, dt));
  parallax.lerp(parallaxT, 1 - Math.pow(0.02, dt));

  camCurve.getPoint(current, camPos); lookCurve.getPoint(current, lookAt);
  side.subVectors(lookAt, camPos).cross(up).normalize();
  camPos.addScaledVector(side, parallax.x * 0.8).addScaledVector(up, parallax.y * 0.5);
  camera.position.copy(camPos); camera.lookAt(lookAt);
  // open the fog up as the camera pulls back for the intro and outro overviews
  const along = current * (N - 1), wide = Math.max(Math.max(0, 1 - along), Math.max(0, along - (N - 2)));
  scene.fog.near = 18 + wide * 40; scene.fog.far = 70 + wide * 80;

  if (!reduce) for (const f of tickers) f(t, dt);

  // squash and stretch springs
  for (const g of boingers) {
    const b = g.userData.boing;
    b.v += (-b.s * 120 - b.v * 9) * dt; b.s += b.v * dt;
    g.scale.set(1 - b.s * 0.25, 1 + b.s * 0.35, 1 - b.s * 0.25);
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]; s.life -= dt; s.v.y -= 9 * dt; s.m.position.addScaledVector(s.v, dt); s.m.rotation.x += dt * 8; s.m.scale.setScalar(Math.max(0.01, s.life));
    if (s.life <= 0) { scene.remove(s.m); sparks.splice(i, 1); }
  }

  // hover
  const hit = pointer.x < 2 ? pick() : null;
  const owner = hit ? hit.object.userData.owner : null;
  if (owner !== hovered) { hovered = owner; document.body.classList.toggle('is-hovering-3d', !!owner); }

  if ((videoTick += dt) > 0.3) { videoTick = 0; syncVideos(); }
  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
