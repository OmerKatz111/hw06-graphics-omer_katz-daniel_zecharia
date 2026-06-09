# Exercise 6 – Interactive Bowling Game with THREE.js

## Overview
This exercise adds the **interactive game layer** on top of the static bowling alley you
built in HW05. You will implement aiming and power controls, a rolling ball with
simplified physics, pin collision and toppling, and a complete 10-frame scoring system.
Start from your finished HW05 scene (copy it into `hw6.js`).

## Tasks - HW06 INTERACTIVE GAME
1. Aiming & controls:
   - Move / aim the ball along the foul line (e.g. arrow keys)
   - Optional spin / curve adjustment
   - An oscillating power meter (start it, lock the power, release the ball)
   - Keep the 'O' key orbit-camera toggle from HW05
   - Show the controls on screen (reuse your HW05 controls container)

2. Ball physics (simplified, hand-written):
   - Ball rolls down the lane based on chosen power and direction
   - Integrate position from velocity using delta time in the animate() loop
   - Gutter ball when the ball leaves the lane edges (knocks down 0 pins)
   - Optional curve / hook
   - Ball stops at the pin end

3. Pin collision & toppling:
   - Detect ball <-> pin collisions (sphere vs pin bounding cylinder)
   - Basic pin <-> pin propagation (knocked pins can topple neighbours)
   - Animate pins falling over and remove them once down
   - Track which pins remain standing

4. 10-frame scoring system:
   - Standard 10 frames, 2 rolls each (3 in the 10th on a strike/spare)
   - Strikes ('X'), spares ('/'), and open frames
   - Running total displayed in your HW05 scorecard container
   - Reset pins between rolls / frames

5. Game flow & state:
   - Detect end of roll, count fallen pins, update score, advance the frame
   - Reset the ball to the approach for the next roll
   - 'R' to reset pins / start a new game

## Technical Requirements
- All objects continue to cast and receive shadows
- The scene remains responsive when the browser window is resized
- Use simplified, hand-written physics in the animate() loop — **no physics engine**
- Keep the same coordinate system as HW05 (foul line at Z=0, pins at negative Z,
  head pin ≈ Z=-57)

## Getting Started
- The starter `hw6.js` includes the same bare lane from HW05 so the project runs.
- Copy your completed HW05 scene into `hw6.js`, then fill in the `// TODO (HW06)` regions.
- Reuse the `degrees_to_radians()` helper for rotations.

## Reference
- Standard bowling lane: ~60ft long x 3.5ft wide
- Bowling pin height ~15 inches; bowling ball diameter ~8.5 inches
- Pin spacing: 12 inches center-to-center in an equilateral triangle
- Bowling scoring: a strike scores 10 + next 2 rolls; a spare scores 10 + next 1 roll
