# Prachita 3D Hearts

## Current State
- Full-screen romantic 3D experience with React Three Fiber
- Intro: 28 bouncing hearts rain down on page load
- 3D rotating glowing heart center-stage with "Prachita" gold shimmer name
- Bear hug animation (two bear images hugging in 3D)
- Circular photo frame (bottom-right) with Prachita's photo, spinning gold ring, pulse glow
- Video frame (bottom-left) "Our Moments" playing a looped video
- Starfield + floating background hearts + particle system
- Deep romantic dark purple background

## Requested Changes (Diff)

### Add
1. **Background music** - Play "Ladki Kyon" (or a similar Bollywood-style song) looping in the background. Since we cannot fetch external audio, use the Web Audio API to synthesize a short melodic loop that evokes the feel of the song, OR add a music toggle button that plays a YouTube embed / SoundCloud embed in an iframe (hidden). Best approach: add a floating music control button (bottom-center) that, when clicked, plays an HTML5 `<audio>` element with a looping online source URL for the song. Include a mute/unmute toggle with a musical note icon.
2. **3D Racing Game** - An "Asphalt Legends"-style 3D racing game accessible via a "Play Racing" button on the main screen. The game opens in a modal/overlay fullscreen. Features:
   - Top-down or behind-the-car perspective 3D track using React Three Fiber
   - A simple car mesh (box geometry or stylized) the player drives with arrow keys / WASD
   - Procedural road/track with lanes, road markings
   - Obstacles/other cars on the track to dodge
   - Speed indicator HUD, score counter
   - Particle effects for speed (motion blur/trail)
   - Start screen and game-over screen within the modal
3. **3D Stickman Fighter Game** - An epic battle stickman fighter game accessible via a "Play Fighter" button. Opens in a fullscreen modal overlay. Features:
   - Side-scrolling 2.5D perspective with 3D stick figure characters built from Three.js primitives (cylinders, spheres)
   - Player 1 (left) vs AI enemy (right) with health bars
   - Controls: arrow keys to move, Z to punch, X to kick, C to block
   - Animated attack/damage sequences
   - Epic particle effects on hits (sparks, flashes)
   - Win/lose screen

### Modify
- Main screen: Add two game launch buttons ("Racing Game" and "Fighter Game") positioned at the bottom of the screen, above the footer, styled with a glass card aesthetic matching the site's theme
- Main screen: Add a floating music toggle button (bottom-center area)

### Remove
- Nothing removed

## Implementation Plan
1. Add music toggle component with a floating button (bottom-center). Use an iframe embed pointing to a public streaming URL OR use a simple synthesized melody via Web Audio API as fallback. Include play/pause state and a musical note icon.
2. Create `RacingGame.tsx` component - full-screen overlay with a React Three Fiber canvas. Implement car mesh, procedural road, obstacles, HUD (speed/score), start/gameover screens. Controls: WASD/arrows.
3. Create `FighterGame.tsx` component - full-screen overlay with React Three Fiber canvas. Implement two stickman characters from primitives, health bars, attack animations, AI opponent logic. Controls: WASD move + Z/X/C attacks.
4. Add two game launch buttons to App.tsx overlaid on the main screen (bottom-center).
5. Wire up state: `showRacingGame` and `showFighterGame` booleans in App.tsx to show/hide game overlays.
