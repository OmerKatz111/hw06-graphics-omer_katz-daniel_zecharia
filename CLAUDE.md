# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Computer Graphics course Exercise 6: an interactive WebGL bowling game built with THREE.js
(r128 via CDN). HW06 builds on HW05 (the static bowling alley). Students take their finished
HW05 scene and add the interactive game layer: aiming + power controls, a rolling ball with
simplified hand-written physics, pin collision and toppling, and a full 10-frame scoring
system. There is no external physics engine — all motion and collision are hand-written in
the `animate()` loop using delta time.

## Running the Application

```bash
npm install
node index.js
# Open http://localhost:8000 in browser
```

No build step. Express serves `index.html` at root and static files from `/src`.

## Architecture

- `index.js` — Express server (port 8000), serves static files from `/src`
- `index.html` — Loads THREE.js from CDN, then `src/hw6.js` as ES module
- `src/hw6.js` — Main scene file. All student work goes here. Ships with the bare HW05
  starter lane plus `// TODO (HW06)` scaffold regions for game state, the power meter,
  input handling, physics/collision, and scoring. Students paste their completed HW05
  scene in first, then implement the interactive systems.
- `src/OrbitControls.js` — THREE.js OrbitControls (vendored, do not modify)

THREE.js is loaded globally via CDN `<script>` tag (not imported as a module), so `THREE`
is available as a global. OrbitControls is imported as an ES module from the local file.

## Code Style

- ES modules (`import`/`export`)
- 2-space indentation
- camelCase for functions (e.g., `degreesToRadians`)
- THREE.js naming conventions for objects (Scene, Camera, Mesh, etc.)
- Helper: `degrees_to_radians()` already exists in hw6.js

## Key Interactions (HW06)

- Aim/move the ball along the foul line, set power via an oscillating meter, release
- 'O' toggles orbit camera (carried over from HW05)
- 'R' resets pins / starts a new game
- All 3D objects should cast/receive shadows; scene is responsive to window resize

## Physics Approach

Simplified, hand-written physics only — **do NOT add a physics engine** (no cannon-es,
ammo.js, etc.). Integrate the ball's position from velocity using delta time, detect
gutter balls by lane-edge bounds, and use sphere-vs-cylinder distance tests for ball–pin
and pin–pin collisions. Topple pins by animating a rotation about the contact axis.

## Coordinate System (shared with HW05)

Foul line at Z=0, lane extends to negative Z, head pin ≈ Z=-57. Keep this so HW05 work
carries over directly.
