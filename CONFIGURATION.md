# Project Configuration

## Commands
- `npm install` - Install dependencies (Express)
- `node index.js` - Start the application (serves on port 8000)
- Access via browser at `http://localhost:8000`

## Project Structure
- WebGL 3D interactive game using THREE.js
- Scene + game logic in `/src/hw6.js`
- OrbitControls for camera manipulation

## Code Style Guidelines
- ES modules (import/export)
- Use consistent spacing (2-space indentation)
- Descriptive variable names (e.g., `cameraTranslate` not `ct`)
- THREE.js objects follow conventions:
  - Scene, Camera, Renderer, Geometry, Material, Mesh
- Animation frame handling via requestAnimationFrame
- Event listeners for keyboard controls
- Camera/view controls through OrbitControls
- Functions use camelCase (e.g., `degreesToRadians`)
- Comments for explaining complex sections or calculations

## Implementation Notes
- Toggle orbit camera with 'o' key; reset / new game with 'r' key
- Game simulation (ball motion, collisions, toppling) advances in the animate() loop
- Simplified, hand-written physics — no external physics engine
- Scene interactions should follow THREE.js patterns
