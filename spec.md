# Prachita 3D Hearts

## Current State
A romantic 3D website with:
- Intro bouncing heart animation (28 hearts raining down)
- 3D rotating heart in center with "Prachita" name in gold script
- Dark romantic background with starfield and floating hearts
- Prachita's photo in a circular frame at bottom-right

## Requested Changes (Diff)

### Add
- Two 3D bears hugging animation in the scene — using the uploaded bear sticker images (image.png / image-1.png). Displayed as animated 3D sprites/cards that do a hugging wobble animation, positioned in the scene (above or near the heart, or as a separate overlay).
- Video player in the bottom-left corner in a rectangular frame. Since no video file was actually uploaded (only bear images were received), add a styled rectangular video frame placeholder at bottom-left that accepts an mp4 source. Use a subtle frosted glass rectangular frame.

### Modify
- App.tsx: add BearHug component (3D animated bears using the sticker images as planes in Three.js, with a gentle hugging bobble/squeeze animation via useFrame). Add VideoFrame component at bottom-left as a fixed positioned overlay.
- index.css: add styles for the video frame and bear animation.

### Remove
- Nothing removed.

## Implementation Plan
1. Create BearHug component in App.tsx: two textured planes using the bear sticker images, animated with a gentle squeeze/hug cycle (scale and rotation oscillation via useFrame), positioned in 3D scene near the top or sides of the heart.
2. Create VideoFrame component: fixed bottom-left rectangular frame with frosted glass styling. Since no video was uploaded, show a styled placeholder with a "play" button and note that a video can be added.
3. Add corresponding CSS classes in index.css for the video frame.
4. Wire both components into the main App render tree.
