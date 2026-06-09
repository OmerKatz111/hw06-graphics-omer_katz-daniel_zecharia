// =============================================================================
// Computer Graphics - Exercise 6 - Interactive Bowling Game
// =============================================================================
// Built on the completed HW05 static alley. HW06 adds the interactive layer:
//   1. Aiming & controls (move/aim the ball, oscillating power meter, release)
//   2. Simplified, hand-written ball physics (rolling, friction, curve, gutters)
//   3. Pin collision & toppling (sphere-vs-cylinder, pin-pin propagation)
//   4. Ten-frame bowling scoring (strikes, spares, open frames, running total)
//   5. Game flow / state machine (frames, resets, end-of-roll detection)
//
// All motion and collision are integrated by hand in animate() using delta time.
// No external physics engine is used.
// =============================================================================

import {OrbitControls} from './OrbitControls.js'

// ─── Scene / Renderer ────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// ─── Shared coordinate constants (same system as HW05) ───────────────────────
const LANE_TOP_Y = 0.1;     // Lane box height 0.2, centered at Y=0 → top at Y=0.1
const LANE_HALF  = 1.75;    // Lane is 3.5 wide → edges at X = ±1.75
const GUTTER_X   = 1.90;    // Gutter channel centers
const BALL_R     = 0.45;    // Bowling ball radius
const PIN_R      = 0.23;    // Pin bounding-cylinder radius (≈ belly radius)
const BALL_START_Z = 1.6;   // Ball aim position, just behind the foul line (Z=0)

function degrees_to_radians(degrees) {
  return degrees * (Math.PI / 180);
}

// =============================================================================
// HW05 SCENE (brought forward)
// =============================================================================

// ─── Lighting ────────────────────────────────────────────────────────────────
function setupLighting() {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  // main light, aimed down the lane so pins cast shadows
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(4, 26, 6);
  dirLight.target.position.set(0, 0, -25);
  scene.add(dirLight.target);
  dirLight.castShadow = true;
  dirLight.shadow.camera.left   =  -6;
  dirLight.shadow.camera.right  =   6;
  dirLight.shadow.camera.top    =  30;
  dirLight.shadow.camera.bottom = -30;
  dirLight.shadow.camera.near   =   1;
  dirLight.shadow.camera.far    =  90;
  dirLight.shadow.mapSize.width  = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.normalBias = 0.02;
  scene.add(dirLight);

  // fill light
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-5, 10, 10);
  scene.add(fillLight);
}

// ─── Camera ──────────────────────────────────────────────────────────────────
function setupCamera() {
  // Bowler's perspective: on the approach, looking down the lane toward pins
  camera.position.set(0, 5, 12);
}

// ─── Bowling lane surface (Z=0 → Z=-60) ──────────────────────────────────────
function createBowlingLane() {
  const geo = new THREE.BoxGeometry(3.5, 0.2, 60);
  const mat = new THREE.MeshPhongMaterial({ color: 0xDEB887, shininess: 80 });
  const lane = new THREE.Mesh(geo, mat);
  lane.position.set(0, 0, -30);
  lane.receiveShadow = true;
  scene.add(lane);
}

// ─── Approach area (Z=0 → Z=+15) ─────────────────────────────────────────────
function createApproachArea() {
  const geo = new THREE.BoxGeometry(3.5, 0.2, 15);
  const mat = new THREE.MeshPhongMaterial({ color: 0xC8A878, shininess: 50 });
  const approach = new THREE.Mesh(geo, mat);
  approach.position.set(0, 0, 7.5);
  approach.receiveShadow = true;
  scene.add(approach);
}

// ─── Gutters (recessed channels alongside the lane) ──────────────────────────
function createGutters() {
  const gutterMat = new THREE.MeshPhongMaterial({ color: 0x8B6914, shininess: 30 });
  [-GUTTER_X, GUTTER_X].forEach(x => {
    const geo = new THREE.BoxGeometry(0.3, 0.15, 60);
    const gutter = new THREE.Mesh(geo, gutterMat);
    gutter.position.set(x, -0.025, -30);
    gutter.receiveShadow = true;
    scene.add(gutter);
  });
}

// ─── Lane markings ───────────────────────────────────────────────────────────
function createLaneMarkings() {
  // Foul line — red, full lane width, at Z=0
  const foulLineGeo = new THREE.BoxGeometry(3.5, 0.01, 0.06);
  const foulLineMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  const foulLine = new THREE.Mesh(foulLineGeo, foulLineMat);
  foulLine.position.set(0, LANE_TOP_Y + 0.005, 0);
  scene.add(foulLine);

  // Approach dots — two rows on the approach area (Z=+3 and Z=+6)
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xbb8833 });
  const dotXPos = [-1.1, -0.55, 0, 0.55, 1.1];
  [3, 6].forEach(rowZ => {
    dotXPos.forEach(x => {
      const dotGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.01, 12);
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(x, LANE_TOP_Y + 0.005, rowZ);
      scene.add(dot);
    });
  });

  // Lane arrows — 7 V-shaped chevron markers at Z=-15
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xbb8833 });
  const arrowXPos = [-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2];
  arrowXPos.forEach(ax => {
    [-1, 1].forEach(side => {
      const armGeo = new THREE.BoxGeometry(0.045, 0.01, 0.22);
      const arm = new THREE.Mesh(armGeo, arrowMat);
      arm.rotation.y = side * degrees_to_radians(28);
      arm.position.set(ax + side * 0.06, LANE_TOP_Y + 0.006, -15);
      scene.add(arm);
    });
  });
}

// ─── Pin deck ────────────────────────────────────────────────────────────────
function createPinDeck() {
  const geo = new THREE.BoxGeometry(3.5, 0.205, 6);
  const mat = new THREE.MeshPhongMaterial({ color: 0xE8D5A0, shininess: 90 });
  const deck = new THREE.Mesh(geo, mat);
  deck.position.set(0, 0.0025, -58.5);
  deck.receiveShadow = true;
  scene.add(deck);
}

// ─── A single bowling pin (returns the group so the game can topple it) ──────
function createPin(x, z) {
  const pinGroup = new THREE.Group();

  // LatheGeometry profile: Vector2(radius, height), Y=0 = base, Y=1.25 = tip
  const profile = [
    new THREE.Vector2(0.001, 0.00),
    new THREE.Vector2(0.21,  0.01),
    new THREE.Vector2(0.23,  0.08),
    new THREE.Vector2(0.21,  0.16),
    new THREE.Vector2(0.17,  0.28),
    new THREE.Vector2(0.13,  0.42),
    new THREE.Vector2(0.10,  0.58),
    new THREE.Vector2(0.10,  0.66),
    new THREE.Vector2(0.13,  0.74),
    new THREE.Vector2(0.18,  0.87),
    new THREE.Vector2(0.18,  0.95),
    new THREE.Vector2(0.165, 1.04),
    new THREE.Vector2(0.142, 1.12),
    new THREE.Vector2(0.110, 1.18),
    new THREE.Vector2(0.075, 1.215),
    new THREE.Vector2(0.042, 1.236),
    new THREE.Vector2(0.018, 1.248),
    new THREE.Vector2(0.001, 1.25),  // rounded top
  ];

  const bodyGeo = new THREE.LatheGeometry(profile, 24);
  const bodyMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 70 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  pinGroup.add(body);

  // Red stripe ring at the neck
  const stripeGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.07, 24);
  const stripeMat = new THREE.MeshPhongMaterial({ color: 0xcc0000 });
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.y = 0.62;
  stripe.castShadow = true;
  stripe.receiveShadow = true;
  pinGroup.add(stripe);

  // Group origin sits at the base center on the lane surface → topple pivots here
  pinGroup.position.set(x, LANE_TOP_Y, z);
  scene.add(pinGroup);
  return pinGroup;
}

// Standard triangular formation (foul line Z=0, head pin at Z=-57)
const PIN_POSITIONS = [
  { x:  0.0, z: -57.000 }, // 1 — head pin
  { x: -0.5, z: -57.866 }, // 2
  { x:  0.5, z: -57.866 }, // 3
  { x: -1.0, z: -58.732 }, // 4
  { x:  0.0, z: -58.732 }, // 5
  { x:  1.0, z: -58.732 }, // 6
  { x: -1.5, z: -59.598 }, // 7
  { x: -0.5, z: -59.598 }, // 8
  { x:  0.5, z: -59.598 }, // 9
  { x:  1.5, z: -59.598 }, // 10
];

// Each pin: { group, home:{x,z}, standing, falling, fallDir:{x,z}, toppleAngle, propagated }
const pins = [];

function createPins() {
  PIN_POSITIONS.forEach(p => {
    const group = createPin(p.x, p.z);
    pins.push({
      group,
      home: { x: p.x, z: p.z },
      standing: true,
      falling: false,
      fallDir: { x: 0, z: -1 },
      toppleAngle: 0,
      propagated: false,
    });
  });
}

// ─── Bowling ball (returns the group so the game can roll it) ────────────────
let ball;        // THREE.Group
function createBowlingBall() {
  const ballGroup = new THREE.Group();

  const ballGeo = new THREE.SphereGeometry(BALL_R, 32, 32);
  const ballMat = new THREE.MeshPhongMaterial({
    color: 0x1a1a6e,
    shininess: 130,
    specular: new THREE.Color(0x888888),
  });
  const ballMesh = new THREE.Mesh(ballGeo, ballMat);
  ballMesh.castShadow = true;
  ballMesh.receiveShadow = true;
  ballGroup.add(ballMesh);

  const holeMat = new THREE.MeshPhongMaterial({ color: 0x080808 });
  function addHole(ox, oz) {
    const surfaceY = Math.sqrt(Math.max(0, BALL_R * BALL_R - ox * ox - oz * oz));
    const holeGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.22, 12);
    const hole = new THREE.Mesh(holeGeo, holeMat);
    hole.position.set(ox, surfaceY - 0.09, oz);
    ballGroup.add(hole);
  }
  addHole(-0.13,  0.08);   // Index finger
  addHole( 0.13,  0.08);   // Middle finger
  addHole(  0.0, -0.22);   // Thumb

  ballGroup.position.set(0, LANE_TOP_Y + BALL_R, BALL_START_Z);
  scene.add(ballGroup);
  ball = ballGroup;
}

// Curved aim guide shown while aiming — its bend visualises the spin/hook, and
// it slides left/right with the aim. (Replaces the old static arrow, which never
// reflected spin.)
let aimLine, aimHead;
function createAimGuide() {
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.9 });
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * AIM_STEPS), 3));
  aimLine = new THREE.Line(lineGeo, lineMat);
  aimLine.frustumCulled = false;
  scene.add(aimLine);

  const headGeo = new THREE.ConeGeometry(0.12, 0.4, 16);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffcc44 });
  aimHead = new THREE.Mesh(headGeo, headMat);
  scene.add(aimHead);
}

function setAimGuideVisible(v) {
  if (aimLine) aimLine.visible = v;
  if (aimHead) aimHead.visible = v;
}

// =============================================================================
// HW06 GAME STATE
// =============================================================================
// State machine: 'aiming' → 'power' → 'rolling' → 'resolving' → next roll/over
const STATE = { AIM: 'aiming', POWER: 'power', ROLLING: 'rolling', RESOLVING: 'resolving', OVER: 'gameover' };

const game = {
  state: STATE.AIM,
  frameIndex: 0,            // 0..9
  rollInFrame: 0,          // roll number within the current frame
  frames: [],              // [{ rolls: [..] }, ...] one per frame
  standingAtRelease: 10,   // pins standing the instant the ball was released
  firstBallOfRack: true,   // is the current ball the first thrown at a fresh full rack
  flashedThisRoll: false,  // has the outcome flash already fired for this roll
  // aim
  aimX: 0,                 // ball X along the foul line
  spin: 0,                 // -1..1 curve/hook amount
  // power meter
  power: 0,                // 0..1 locked power
  meterT: 0,               // oscillation phase
  meterDir: 1,
  // ball physics
  vel: new THREE.Vector3(0, 0, 0),
  inGutter: false,
  rollTime: 0,
  resolveTimer: 0,
};

// Physics tuning
const MIN_SPEED   = 22;    // units/sec at 0% power
const MAX_SPEED   = 44;    // units/sec at 100% power
const FRICTION    = 1.8;   // units/sec^2 deceleration along travel
const CURVE_ACCEL = 4.0;   // lateral accel per unit spin (units/sec^2)
const METER_SPEED = 1.7;   // power meter oscillations factor
const TOPPLE_SPEED = 7.0;  // pin topple angular speed (rad/sec)
const PROP_RADIUS  = 1.15; // pin-pin propagation distance
const SETTLE_TIME  = 1.2;  // seconds to let pins finish toppling before counting
const AIM_X_LIMIT  = 1.3;  // how far along the foul line the ball can move
const AIM_STEPS    = 90;   // points in the curved aim-preview line
const AIM_PREVIEW_SPEED = 30; // representative speed used to shape the aim preview

// =============================================================================
// HW06 UI: CONTROLS LIST + POWER METER + SCORECARD + STATUS
// =============================================================================
let scorecardEl, powerFillEl, powerMeterEl, statusEl, spinReadoutEl, orbitStateEl;

function createUI() {
  const style = document.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; }

    #controls-panel {
      position: absolute; bottom: 20px; left: 20px;
      background: rgba(0,0,0,0.72); color: #fff;
      padding: 12px 16px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.22);
      font-family: Arial, sans-serif; font-size: 13px; line-height: 1.8;
      min-width: 210px;
    }
    #controls-panel h3 {
      margin: 0 0 6px 0; font-size: 12px; color: #ffcc44;
      text-transform: uppercase; letter-spacing: 1px;
      border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 4px;
    }
    #controls-panel p { margin: 2px 0; }
    .key {
      display: inline-block; background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.35); border-radius: 3px;
      padding: 0 6px; font-size: 12px; font-weight: bold; letter-spacing: 0.03em;
    }

    #scorecard {
      position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.75); color: #fff;
      padding: 10px 14px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.22);
      font-family: Arial, sans-serif; white-space: nowrap;
    }
    #scorecard h3 {
      margin: 0 0 7px 0; text-align: center; font-size: 11px; color: #ffcc44;
      text-transform: uppercase; letter-spacing: 2px;
    }
    .sc-table { border-collapse: collapse; font-size: 11px; }
    .sc-table th, .sc-table td {
      border: 1px solid rgba(255,255,255,0.28); padding: 0; text-align: center;
      min-width: 42px;
    }
    .sc-table th { color: #aaa; background: rgba(255,255,255,0.05); font-size: 10px; padding: 3px 4px; }
    .sc-player { color: #ffcc44; font-weight: bold; font-size: 12px; padding: 0 6px; }
    .sc-frame.active { background: rgba(255,204,68,0.18); }
    .sc-rolls { display: flex; justify-content: flex-end; gap: 0; }
    .sc-roll {
      width: 14px; height: 14px; border-left: 1px solid rgba(255,255,255,0.18);
      border-bottom: 1px solid rgba(255,255,255,0.18);
      display: flex; align-items: center; justify-content: center; font-size: 10px;
    }
    .sc-score { font-size: 13px; font-weight: bold; min-height: 18px; padding: 1px 0 2px; }

    #power-meter {
      position: absolute; bottom: 26px; left: 50%; transform: translateX(-50%);
      width: 260px; background: rgba(0,0,0,0.72);
      border: 1px solid rgba(255,255,255,0.22); border-radius: 8px;
      padding: 8px 10px; font-family: Arial, sans-serif; color: #fff;
    }
    #power-meter .pm-label { font-size: 11px; color: #ffcc44; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; text-align: center; }
    #power-track {
      position: relative; height: 18px; width: 100%;
      background: rgba(255,255,255,0.12); border-radius: 4px; overflow: hidden;
    }
    #power-fill {
      position: absolute; left: 0; top: 0; height: 100%; width: 0%;
      background: linear-gradient(90deg, #3ad17a, #ffd24a, #ff4a4a);
      transition: none;
    }
    #spin-readout { margin-top: 6px; text-align: center; font-size: 12px; color: #ddd; }
    #orbit-state { font-weight: bold; color: #3ad17a; }

    #status {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      font-family: Arial, sans-serif; color: #fff; text-align: center;
      pointer-events: none; text-shadow: 0 2px 8px rgba(0,0,0,0.8);
    }
    #status .big { font-size: 30px; font-weight: bold; color: #ffcc44; }
    #status .sub { font-size: 16px; margin-top: 6px; }
  `;
  document.head.appendChild(style);

  // Controls panel (bottom-left)
  const controlsPanel = document.createElement('div');
  controlsPanel.id = 'controls-panel';
  controlsPanel.innerHTML = `
    <h3>Controls</h3>
    <p><span class="key">← →</span> &nbsp;Aim along foul line</p>
    <p><span class="key">↑ ↓</span> &nbsp;Spin / curve (hook)</p>
    <p><span class="key">Space</span> &nbsp;Start power → lock → release</p>
    <p><span class="key">R</span> &nbsp;Reset pins / new game</p>
    <p><span class="key">O</span> &nbsp;Toggle orbit camera <span id="orbit-state">ON</span></p>
  `;
  document.body.appendChild(controlsPanel);
  orbitStateEl = controlsPanel.querySelector('#orbit-state');

  // Scorecard (top-center)
  scorecardEl = document.createElement('div');
  scorecardEl.id = 'scorecard';
  document.body.appendChild(scorecardEl);

  // Power meter (bottom-center)
  powerMeterEl = document.createElement('div');
  powerMeterEl.id = 'power-meter';
  powerMeterEl.innerHTML = `
    <div class="pm-label">Power</div>
    <div id="power-track"><div id="power-fill"></div></div>
    <div id="spin-readout">Spin: straight</div>
  `;
  document.body.appendChild(powerMeterEl);
  powerFillEl = powerMeterEl.querySelector('#power-fill');
  spinReadoutEl = powerMeterEl.querySelector('#spin-readout');

  // Status banner (center)
  statusEl = document.createElement('div');
  statusEl.id = 'status';
  document.body.appendChild(statusEl);
}

// ─── Scorecard rendering ─────────────────────────────────────────────────────
// A single ball's glyph when it is NOT a spare ('X' strike, '-' miss, else count).
function pinGlyph(r) {
  if (r === 10) return 'X';
  if (r === 0) return '-';
  return String(r);
}

// Roll glyphs for a normal frame (1–9): two boxes, spare shown as '/'.
function normalFrameSymbols(rolls) {
  const s = [];
  if (rolls[0] !== undefined) s[0] = pinGlyph(rolls[0]);
  if (rolls[1] !== undefined) s[1] = (rolls[0] + rolls[1] === 10) ? '/' : pinGlyph(rolls[1]);
  return s;
}

// Roll glyphs for the 10th frame: up to three boxes. A '/' may only appear
// between two balls thrown at the SAME rack — reracks happen after a strike or
// after a spare, so a bonus ball on a fresh rack is shown by its own count.
function tenthFrameSymbols(rolls) {
  const s = [];
  if (rolls[0] === undefined) return s;
  s[0] = pinGlyph(rolls[0]);

  if (rolls[1] === undefined) return s;
  // Ball 2 shares ball 1's rack only when ball 1 was not a strike.
  s[1] = (rolls[0] !== 10 && rolls[0] + rolls[1] === 10) ? '/' : pinGlyph(rolls[1]);

  if (rolls[2] === undefined) return s;
  // Ball 3 shares ball 2's rack only when ball 1 was a strike and ball 2 was not.
  const ball3SharesRack = (rolls[0] === 10 && rolls[1] !== 10);
  s[2] = (ball3SharesRack && rolls[1] + rolls[2] === 10) ? '/' : pinGlyph(rolls[2]);
  return s;
}

function frameSymbols(frame, isTenth) {
  return isTenth ? tenthFrameSymbols(frame.rolls) : normalFrameSymbols(frame.rolls);
}

function renderScorecard() {
  const scores = computeCumulativeScores(game.frames);

  const header = Array.from({ length: 10 }, (_, i) => `<th>${i + 1}</th>`).join('');

  let cols = '';
  for (let f = 0; f < 10; f++) {
    const frame = game.frames[f] || { rolls: [] };
    const nBoxes = f === 9 ? 3 : 2;
    const syms = frameSymbols(frame, f === 9);
    let boxes = '';
    for (let i = 0; i < nBoxes; i++) {
      boxes += `<div class="sc-roll">${syms[i] || ''}</div>`;
    }
    const score = scores[f] != null ? scores[f] : '&nbsp;';
    const activeCls = f === game.frameIndex && game.state !== STATE.OVER ? ' active' : '';
    cols += `
      <td class="sc-frame${activeCls}">
        <div class="sc-rolls">${boxes}</div>
        <div class="sc-score">${score}</div>
      </td>`;
  }

  const total = (() => {
    for (let f = 9; f >= 0; f--) if (scores[f] != null) return scores[f];
    return 0;
  })();

  scorecardEl.innerHTML = `
    <h3>Bowling Scorecard &nbsp;·&nbsp; Total: ${total}</h3>
    <table class="sc-table">
      <tr><th>Player</th>${header}<th>Total</th></tr>
      <tr><td class="sc-player">Player 1</td>${cols}<td class="sc-score">${total}</td></tr>
    </table>
  `;
}

// =============================================================================
// HW06 SCORING — standard ten-pin rules
// =============================================================================
// Returns a 10-length array of cumulative scores; entries are null until the
// frame's score is fully determined (e.g. a strike needs the next two rolls).
function computeCumulativeScores(frames) {
  // Flatten all rolls in order so strike/spare bonuses can look ahead across frames.
  const flat = [];
  const start = [];
  for (let f = 0; f < frames.length; f++) {
    start[f] = flat.length;
    (frames[f].rolls || []).forEach(r => flat.push(r));
  }

  const out = new Array(10).fill(null);
  let cum = 0;
  let valid = true;
  for (let f = 0; f < 10; f++) {
    const fr = frames[f];
    if (!fr || fr.rolls.length === 0) { valid = false; }
    if (!valid) { out[f] = null; continue; }

    const i = start[f];
    const rolls = fr.rolls;

    if (f < 9) {
      if (rolls[0] === 10) {
        // Strike: 10 + next two rolls
        if (flat.length >= i + 3) { cum += 10 + flat[i + 1] + flat[i + 2]; out[f] = cum; }
        else { out[f] = null; valid = false; }
      } else if (rolls.length >= 2 && rolls[0] + rolls[1] === 10) {
        // Spare: 10 + next one roll
        if (flat.length >= i + 3) { cum += 10 + flat[i + 2]; out[f] = cum; }
        else { out[f] = null; valid = false; }
      } else if (rolls.length >= 2) {
        // Open frame
        cum += rolls[0] + rolls[1]; out[f] = cum;
      } else {
        out[f] = null; valid = false;
      }
    } else {
      // 10th frame: complete when the required number of rolls is present
      let complete;
      if (rolls[0] === 10 || (rolls.length >= 2 && rolls[0] + rolls[1] === 10)) {
        complete = rolls.length >= 3;
      } else {
        complete = rolls.length >= 2;
      }
      if (complete) { cum += rolls.reduce((a, b) => a + b, 0); out[f] = cum; }
      else { out[f] = null; }
    }
  }
  return out;
}

// =============================================================================
// HW06 GAME FLOW
// =============================================================================
function newGame() {
  game.frames = Array.from({ length: 10 }, () => ({ rolls: [] }));
  game.frameIndex = 0;
  game.rollInFrame = 0;
  game.firstBallOfRack = true;
  flashText = ''; flashTimer = 0;
  resetAllPins();
  resetBallToApproach();
  game.state = STATE.AIM;
  renderScorecard();
  renderCenter();
  updateOrbitIndicator();
}

function resetAllPins() {
  pins.forEach(p => {
    p.standing = true;
    p.falling = false;
    p.propagated = false;
    p.toppleAngle = 0;
    p.fallDir = { x: 0, z: -1 };
    p.group.position.set(p.home.x, LANE_TOP_Y, p.home.z);
    p.group.quaternion.identity();
    p.group.visible = true;
  });
}

function standingCount() {
  return pins.reduce((n, p) => n + (p.standing ? 1 : 0), 0);
}

function resetBallToApproach() {
  game.aimX = 0;
  game.spin = 0;
  game.power = 0;
  game.meterT = 0;
  game.meterDir = 1;
  game.inGutter = false;
  game.rollTime = 0;
  game.vel.set(0, 0, 0);
  ball.position.set(game.aimX, LANE_TOP_Y + BALL_R, BALL_START_Z);
  ball.quaternion.identity();
  setAimGuideVisible(true);
}

// Begin the power meter
function startPower() {
  game.state = STATE.POWER;
  game.meterT = 0;
  game.meterDir = 1;
}

// Lock power and release the ball with velocity from aim + power
function releaseBall() {
  game.power = Math.max(0.05, game.meterT);   // ensure a minimum nudge
  const speed = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * game.power;
  // Launch straight down-lane (−Z); the curve/hook comes from spin while rolling.
  game.vel.set(0, 0, -speed);
  game.standingAtRelease = standingCount();
  game.inGutter = false;
  game.rollTime = 0;
  game.flashedThisRoll = false;
  game.state = STATE.ROLLING;
  setAimGuideVisible(false);
}

// Called once a roll has fully settled — count pins and advance the game.
function finalizeRoll() {
  const knocked = game.standingAtRelease - standingCount();
  recordRoll(Math.max(0, knocked));
}

function recordRoll(knocked) {
  // Outcome flash. Normally this already fired live (the instant the rack cleared
  // or the ball guttered — see updateGame/updateBall); this is a guarded fallback
  // so it never double-fires. A strike is clearing a fresh full rack on its first
  // ball; clearing the remainder later is a spare (gutter-then-clear ⇒ SPARE).
  if (!game.flashedThisRoll) {
    if (game.inGutter) flash('GUTTER BALL!');
    else if (game.firstBallOfRack && knocked === 10) flash('STRIKE!');
    else if (!game.firstBallOfRack && knocked > 0 && knocked === game.standingAtRelease) flash('SPARE!');
    game.flashedThisRoll = true;
  }

  const frame = game.frames[game.frameIndex];
  frame.rolls.push(knocked);

  if (game.frameIndex < 9) {
    if (game.rollInFrame === 0 && knocked === 10) {
      advanceFrame();                 // strike → next frame, fresh rack
    } else if (game.rollInFrame === 0) {
      game.rollInFrame = 1;           // second ball at the remaining pins
      readyNextRoll(false);
    } else {
      advanceFrame();                 // open/spare second ball done
    }
  } else {
    handleTenthFrame(frame, knocked);
  }

  renderScorecard();
}

function handleTenthFrame(frame, knocked) {
  const rolls = frame.rolls;
  const n = rolls.length;

  if (n === 1) {
    game.rollInFrame = 1;
    // Strike on the first ball → fresh rack for the bonus balls
    readyNextRoll(rolls[0] === 10);
  } else if (n === 2) {
    if (rolls[0] === 10) {
      // Already had a strike → a third ball is coming; rerack if 2nd was also a strike
      game.rollInFrame = 2;
      readyNextRoll(rolls[1] === 10);
    } else if (rolls[0] + rolls[1] === 10) {
      // Spare → one bonus ball with a fresh rack
      game.rollInFrame = 2;
      readyNextRoll(true);
    } else {
      endGame();                       // open 10th frame → game over
    }
  } else {
    endGame();                         // third ball done
  }
}

function advanceFrame() {
  game.frameIndex += 1;
  game.rollInFrame = 0;
  if (game.frameIndex > 9) { endGame(); return; }
  readyNextRoll(true);
}

// Prepare the ball for the next roll; rerack pins when starting fresh.
function readyNextRoll(rerack) {
  if (rerack) resetAllPins();
  resetBallToApproach();
  game.firstBallOfRack = rerack;   // a fresh rack ⇒ this ball is the rack's first
  game.state = STATE.AIM;
}

function endGame() {
  game.state = STATE.OVER;
  setAimGuideVisible(false);
  renderCenter();
}

// =============================================================================
// HW06 INPUT HANDLING
// =============================================================================
let isOrbitEnabled = true;

function handleKeyDown(e) {
  const k = e.key;
  const code = e.code;   // physical key — layout-independent (works on Hebrew etc.)

  // 'O' orbit toggle — always available (carried from HW05)
  if (code === 'KeyO' || k.toLowerCase() === 'o') {
    isOrbitEnabled = !isOrbitEnabled;
    updateOrbitIndicator();
    return;
  }

  // 'R' reset / new game — always available
  if (code === 'KeyR' || k.toLowerCase() === 'r') {
    newGame();
    return;
  }

  if (game.state === STATE.AIM) {
    if (k === 'ArrowLeft')  { game.aimX = Math.max(-AIM_X_LIMIT, game.aimX - 0.12); }
    else if (k === 'ArrowRight') { game.aimX = Math.min(AIM_X_LIMIT, game.aimX + 0.12); }
    else if (k === 'ArrowUp')   { game.spin = Math.min(1, game.spin + 0.1); }
    else if (k === 'ArrowDown') { game.spin = Math.max(-1, game.spin - 0.1); }
    else if (k === ' ' || code === 'Space') { startPower(); }
    if (k.startsWith('Arrow')) { e.preventDefault(); }
  } else if (game.state === STATE.POWER) {
    if (k === ' ' || code === 'Space') { releaseBall(); }
  }
}

document.addEventListener('keydown', handleKeyDown);

// =============================================================================
// HW06 PHYSICS, COLLISION & SIMULATION (called every frame from animate)
// =============================================================================
function updateGame(dt) {
  // Tick down any active center-screen flash message.
  if (flashTimer > 0) { flashTimer -= dt; if (flashTimer <= 0) flashText = ''; }

  // Always animate any pins that are mid-topple, regardless of state.
  updateToppling(dt);

  switch (game.state) {
    case STATE.AIM:
      updateAim();
      break;
    case STATE.POWER:
      updatePowerMeter(dt);
      break;
    case STATE.ROLLING:
      updateBall(dt);
      updateBallPinCollisions();
      checkEndOfRoll();
      break;
    case STATE.RESOLVING:
      // Let pins finish toppling/propagating, then count.
      game.resolveTimer += dt;
      if (game.resolveTimer >= SETTLE_TIME) finalizeRoll();
      break;
  }

  // Announce a cleared rack the instant the last pin goes down, so STRIKE!/SPARE!
  // land with the crash rather than ~1s later when the roll is finalised.
  if ((game.state === STATE.ROLLING || game.state === STATE.RESOLVING) &&
      !game.flashedThisRoll && !game.inGutter && standingCount() === 0) {
    flash(game.firstBallOfRack ? 'STRIKE!' : 'SPARE!');
    game.flashedThisRoll = true;
  }
}

function updateAim() {
  ball.position.set(game.aimX, LANE_TOP_Y + BALL_R, BALL_START_Z);

  // Build a curved preview path using the same lateral-curve model as the roll,
  // so its bend visualises the spin/hook and it slides with the aim.
  const pos = aimLine.geometry.attributes.position.array;
  let x = game.aimX, z = BALL_START_Z, vx = 0;
  const dt = 0.04;
  let last = AIM_STEPS - 1;
  for (let i = 0; i < AIM_STEPS; i++) {
    pos[i * 3] = x; pos[i * 3 + 1] = LANE_TOP_Y + 0.03; pos[i * 3 + 2] = z;
    vx += game.spin * CURVE_ACCEL * dt;
    x += vx * dt;
    z += -AIM_PREVIEW_SPEED * dt;
    if (z < -57 || Math.abs(x) > LANE_HALF + 0.1) { last = i; break; }
  }
  // Collapse any unused points onto the end so the line doesn't trail off.
  for (let j = last + 1; j < AIM_STEPS; j++) {
    pos[j * 3] = pos[last * 3]; pos[j * 3 + 1] = pos[last * 3 + 1]; pos[j * 3 + 2] = pos[last * 3 + 2];
  }
  aimLine.geometry.attributes.position.needsUpdate = true;

  // Arrowhead at the end, pointing along the final segment.
  const p = Math.max(0, last - 1);
  const dir = new THREE.Vector3(pos[last * 3] - pos[p * 3], 0, pos[last * 3 + 2] - pos[p * 3 + 2]);
  if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
  dir.normalize();
  aimHead.position.set(pos[last * 3], LANE_TOP_Y + 0.03, pos[last * 3 + 2]);
  aimHead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
}

function updatePowerMeter(dt) {
  // Oscillate the meter between 0 and 1
  game.meterT += game.meterDir * METER_SPEED * dt;
  if (game.meterT >= 1) { game.meterT = 1; game.meterDir = -1; }
  else if (game.meterT <= 0) { game.meterT = 0; game.meterDir = 1; }
}

function updateBall(dt) {
  const v = game.vel;

  if (!game.inGutter) {
    // Optional curve/hook: lateral acceleration from spin, strongest mid-lane
    v.x += game.spin * CURVE_ACCEL * dt;
  }

  // Rolling friction: decelerate along the direction of travel
  const speed = v.length();
  if (speed > 0) {
    const drop = FRICTION * dt;
    const newSpeed = Math.max(0, speed - drop);
    v.multiplyScalar(newSpeed / speed);
  }

  // Integrate position from velocity (delta-time integration)
  ball.position.x += v.x * dt;
  ball.position.z += v.z * dt;

  // Roll the ball mesh visually about the axis perpendicular to travel
  const horizSpeed = Math.hypot(v.x, v.z);
  if (horizSpeed > 0.0001) {
    const axis = new THREE.Vector3(-v.z, 0, v.x).normalize();
    ball.rotateOnWorldAxis(axis, (horizSpeed * dt) / BALL_R);
  }

  // Gutter detection: ball edge passes the lane edge → drop into the channel
  if (!game.inGutter && Math.abs(ball.position.x) > LANE_HALF - 0.30) {
    game.inGutter = true;
    const side = Math.sign(ball.position.x) || 1;
    ball.position.x = side * GUTTER_X;
    game.vel.x = 0;                              // ride straight down the gutter
    game.spin = 0;
    flash('GUTTER BALL!');                       // announce at the moment it happens
    game.flashedThisRoll = true;
  }

  if (game.inGutter) {
    // Sink into the gutter channel
    ball.position.x = Math.sign(ball.position.x) * GUTTER_X;
    ball.position.y = Math.max(-0.25, ball.position.y - 1.5 * dt);
  }

  game.rollTime += dt;
}

// Sphere (ball) vs upright cylinder (pin) horizontal-distance test.
function updateBallPinCollisions() {
  if (game.inGutter) return;       // gutter balls hit nothing
  const bx = ball.position.x, bz = ball.position.z;
  const hitDist = BALL_R + PIN_R;
  const hitDist2 = hitDist * hitDist;

  pins.forEach(p => {
    if (!p.standing) return;
    const dx = p.home.x - bx;
    const dz = p.home.z - bz;
    if (dx * dx + dz * dz <= hitDist2) {
      // Topple away from the ball, blended with the ball's travel direction
      const away = new THREE.Vector2(dx, dz);
      if (away.lengthSq() < 1e-6) away.set(0, -1);
      away.normalize();
      const vel = new THREE.Vector2(game.vel.x, game.vel.z);
      if (vel.lengthSq() > 1e-6) { vel.normalize(); away.addScaledVector(vel, 0.6); away.normalize(); }
      knockPin(p, { x: away.x, z: away.y });
    }
  });
}

function knockPin(pin, dir) {
  pin.standing = false;
  pin.falling = true;
  pin.toppleAngle = 0;
  pin.propagated = false;
  pin.fallDir = dir;
}

// Animate toppling pins and propagate to standing neighbours.
function updateToppling(dt) {
  pins.forEach(p => {
    if (!p.falling) return;

    const d = p.fallDir;
    // Horizontal axis perpendicular to the fall direction (in the XZ plane)
    const axis = new THREE.Vector3(d.z, 0, -d.x);
    if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0);
    axis.normalize();

    p.toppleAngle = Math.min(Math.PI / 2, p.toppleAngle + TOPPLE_SPEED * dt);
    p.group.quaternion.setFromAxisAngle(axis, p.toppleAngle);

    // Pin-pin propagation: once a pin has leaned enough, it can knock a
    // standing neighbour that lies in its fall direction.
    if (!p.propagated && p.toppleAngle > 0.5) {
      p.propagated = true;
      pins.forEach(other => {
        if (other === p || !other.standing) return;
        const dx = other.home.x - p.home.x;
        const dz = other.home.z - p.home.z;
        const dist = Math.hypot(dx, dz);
        if (dist > PROP_RADIUS) return;
        // Only forward propagation: neighbour must be roughly in the fall dir
        const dot = (dx * d.x + dz * d.z) / (dist || 1);
        if (dot > 0.25) {
          knockPin(other, { x: dx / dist, z: dz / dist });
        }
      });
    }

    if (p.toppleAngle >= Math.PI / 2) p.falling = false;  // lies flat, done
  });
}

// End-of-roll detection: ball stops, passes the pins, or leaves the lane.
function checkEndOfRoll() {
  const speed = game.vel.length();
  const past = ball.position.z < -61;
  const stopped = speed < 1.2;
  const gutterDone = game.inGutter && ball.position.z < -57;
  const timeout = game.rollTime > 8;

  if (past || stopped || gutterDone || timeout) {
    game.state = STATE.RESOLVING;
    game.resolveTimer = 0;
  }
}

// =============================================================================
// HW06 HUD: CENTER BANNER (event flashes + game over), POWER METER, SPIN, ORBIT
// =============================================================================
// The center banner no longer parks persistent text over the lane — it's used
// only for brief event flashes and the GAME OVER screen.
let flashText = '';
let flashTimer = 0;
function flash(text, secs = 1.6) { flashText = text; flashTimer = secs; }

let _centerHTML = '';
function renderCenter() {
  let html = '';
  if (game.state === STATE.OVER) {
    const scores = computeCumulativeScores(game.frames);
    const total = scores[9] != null ? scores[9] : '';
    html = `<div class="big">GAME OVER</div><div class="sub">Final score: ${total} — press R for a new game</div>`;
  } else if (flashText) {
    html = `<div class="big">${flashText}</div>`;
  }
  if (html !== _centerHTML) { statusEl.innerHTML = html; _centerHTML = html; }
}

// Reflect the orbit on/off state in the controls panel (toggling had no visible
// effect before, so it looked like 'O' did nothing).
function updateOrbitIndicator() {
  if (!orbitStateEl) return;
  orbitStateEl.textContent = isOrbitEnabled ? 'ON' : 'OFF';
  orbitStateEl.style.color = isOrbitEnabled ? '#3ad17a' : '#bbb';
}

function updateHUD() {
  // Power meter fill: live during POWER, frozen at the locked value otherwise
  const pct = (game.state === STATE.POWER ? game.meterT : (game.state === STATE.AIM ? 0 : game.power)) * 100;
  powerFillEl.style.width = pct.toFixed(1) + '%';
  powerMeterEl.style.opacity = (game.state === STATE.AIM || game.state === STATE.POWER) ? '1' : '0.5';

  // Spin readout (off the lane, so the center view stays clear)
  if (spinReadoutEl) {
    const sp = game.spin;
    spinReadoutEl.textContent = Math.abs(sp) < 0.05
      ? 'Spin: straight'
      : `Spin: ${sp < 0 ? '◀ left' : 'right ▶'} ${Math.abs(sp).toFixed(2)}`;
  }

  // Center banner (event flash / game over)
  renderCenter();
}

// =============================================================================
// SETUP & ANIMATION LOOP
// =============================================================================
let controls;
function setupControls() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, -20);
  controls.update();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function init() {
  setupLighting();
  setupCamera();
  createBowlingLane();
  createApproachArea();
  createGutters();
  createLaneMarkings();
  createPinDeck();
  createPins();
  createBowlingBall();
  createAimGuide();
  createUI();
  setupControls();

  window.addEventListener('resize', onWindowResize);

  newGame();
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);  // clamp to avoid huge steps
  updateGame(dt);
  updateHUD();

  controls.enabled = isOrbitEnabled;
  controls.update();

  renderer.render(scene, camera);
}

init();
animate();
