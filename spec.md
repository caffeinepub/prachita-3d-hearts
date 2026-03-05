# Prachita 3D Hearts

## Current State
- Full romantic 3D website with hearts, bears, photo frame, video, music player
- Two game overlays: RacingGame.tsx (3D R3F car dodging obstacles) and FighterGame.tsx (3D R3F stickman vs AI)
- Both games are functional but visually simple — box geometries, no animations, no "wow" factor

## Requested Changes (Diff)

### Add
- **FighterGame**: Full 2D Canvas-based futuristic fighting game with:
  - Animated sprite-style characters (hand-drawn via canvas arcs/paths) with smooth walk, punch, kick, jump, block, hurt, KO animations using frame-based keyframe system
  - Dynamic particle burst system on hits (sparks, energy orbs, screen flash)
  - Cinematic intro: "ROUND 1 - FIGHT!" text with zoom animation
  - Combo counter, floating damage numbers
  - Neon cyberpunk arena background with animated city skyline, scrolling grid floor, animated crowd silhouettes
  - Screen shake on heavy hits, chromatic aberration flash effect
  - AI with multiple difficulty patterns (approach, retreat, combo chains)
  - Super move meter that fills up; player can execute a screen-filling energy blast
  - Rich HUD: health bars with animated damage decay, power gauge, timer countdown, round display
- **RacingGame**: Full 2D Canvas-based futuristic racing game with:
  - Multi-layer parallax scrolling background: distant nebula, city skyline layer, mid-ground buildings, near-ground barriers — all animated
  - Player car drawn with canvas (sleek futuristic design, neon underglows, animated exhaust flames, rotating wheels)
  - AI bot cars that actively race against player (overtake, brake, switch lanes) not just static obstacles
  - Road drawn with perspective foreshortening (pseudo-3D horizon effect like F-Zero/OutRun)
  - Nitro boost mechanic: collect energy pickups, activate for speed burst with flame trail
  - Lap/position system: 3 laps, player position among 4 AI cars shown
  - Crash animation: spinning car, explosion particles, 3-second respawn
  - Rich HUD: speedometer dial, lap counter, position indicator, nitro bar, mini-map
  - Dynamic weather: rain streaks that affect handling

### Modify
- Replace existing `FighterGame.tsx` entirely with new 2D canvas implementation
- Replace existing `RacingGame.tsx` entirely with new 2D canvas implementation
- Keep same props interface (`onClose: () => void`) so App.tsx needs no changes

### Remove
- Old 3D R3F game scenes inside FighterGame and RacingGame (replaced by 2D Canvas)

## Implementation Plan
1. Rewrite `FighterGame.tsx`: Canvas 2D engine, animated fighter characters, particle system, neon cyberpunk arena, AI logic, combo/super system, full HUD
2. Rewrite `RacingGame.tsx`: Canvas 2D engine, pseudo-3D road, parallax city background, AI bot racers, nitro system, lap tracking, full HUD
3. Validate build (typecheck, lint, build)
