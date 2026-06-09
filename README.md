# Computer Graphics - Exercise 6 - Interactive Bowling Game

This exercise builds on **HW05** (the static bowling alley). In HW06 you turn that
static scene into a playable bowling game: aiming and power controls, a rolling ball
with simplified physics, pins that get knocked down, and full 10-frame scoring.

## Getting Started
1. Clone this repository to your local machine
2. Make sure you have Node.js installed
3. Install dependencies: `npm install`
4. Start the local web server: `node index.js`
5. Open your browser and go to http://localhost:8000

## Bring Your HW05 Work Forward
The starter `src/hw6.js` ships with the **same bare lane** you were given in HW05 so the
project runs immediately. Copy the full contents of your completed HW05 `hw5.js`
(lane, markings, gutters, pins, ball, lighting, UI containers, orbit camera) into
`src/hw6.js`, then implement the HW06 interactive systems marked with `// TODO (HW06)`.

## Complete Instructions
**All detailed instructions, requirements, and grading can be found in:**
`bowling_exercise_instructions.html` (open it in a browser).

## Group Members
- Omer Katz
- Daniel Zecharia

## Gameplay Video & Screenshots
- 🎥 **Video:** [`gameplay.mp4`](gameplay.mp4) — a full playthrough: aiming and releasing with the power meter, the ball rolling and knocking down pins, a gutter ball, and the scorecard updating across frames (including a strike and a spare).
- 📸 **Screenshots:** see the [`screenshots/`](screenshots/) folder — aiming, the power meter, a roll in progress, a gutter ball, and the scorecard.

## Control Scheme
| Key | Action |
| --- | --- |
| **← / →** | Aim — move the ball left/right along the foul line |
| **↑ / ↓** | Adjust spin / curve (hook) before release |
| **Space** | Start the oscillating power meter; press again to lock power and release the ball |
| **R** | Reset pins / start a new game |
| **O** | Toggle the orbit camera (carried over from HW05) |

The game is a small state machine — `aiming → power → rolling → resolving → next roll`.
Aim and spin input is only accepted while aiming; the power meter only oscillates in the
power state; `O` and `R` work at any time.

## Implemented Features
- Aiming along the foul line with a live aim arrow, an oscillating on-screen power meter,
  and velocity-on-release proportional to the locked power.
- Hand-written ball physics integrated from velocity using delta time (`THREE.Clock`),
  with rolling friction, an optional curve/hook from spin, and gutter detection (the ball
  drops into the channel and knocks down zero pins).
- Ball–pin collision via a sphere-vs-cylinder horizontal-distance test, an animated topple
  (rotation about the contact axis to flat), and forward pin-to-pin propagation. Standing
  pins are tracked exactly; a short settle delay lets cascades finish before counting.
- Full ten-frame scoring with strikes (`X`), spares (`/`), open frames, correct bonus
  rules, the special 10th-frame third ball, and a running cumulative total rendered in the
  scorecard. (Verified: perfect game = 300, all spares = 150, sample game = 249.)
- Game flow: end-of-roll detection, frame advancement, pin reracking between frames/rolls,
  ball reset to the approach, and a clear GAME OVER state with the final score.

### Bonus features
- Ball hook / curve dynamics driven by the ↑/↓ spin input.

## Known Limitations
- Physics is intentionally simplified (no bounce/momentum transfer to the ball); pin-to-pin
  propagation is a directional distance heuristic rather than rigid-body simulation.

## Technical Details
- Run the server with: `node index.js`
- Access at http://localhost:8000 in your web browser
- Built with THREE.js (r128) — simplified, hand-written physics (no physics engine)
