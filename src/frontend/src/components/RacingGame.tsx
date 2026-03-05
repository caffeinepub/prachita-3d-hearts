import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================
// Types
// ============================================================
type GameState = "idle" | "countdown" | "playing" | "gameover";

interface PlayerState {
  x: number; // normalized -1 to 1 within road
  speed: number;
  steer: number;
  nitro: number;
  nitroActive: boolean;
  nitroTimer: number;
  nitroCooldown: number;
  crashed: boolean;
  crashTimer: number;
  spinAngle: number;
  lap: number;
  lapProgress: number;
  position: number; // race position 1-4
  bestLap: number;
  lapTimer: number;
}

interface BotCar {
  id: number;
  name: string;
  color: string;
  accentColor: string;
  x: number;
  speed: number;
  targetSpeed: number;
  lapProgress: number;
  lap: number;
  z: number; // visual z offset relative to player
}

interface Star {
  x: number;
  y: number;
  r: number;
  twinkle: number;
  speed: number;
}

interface TrackSegment {
  curve: number; // -1 to 1
  color: string;
}

// ============================================================
// Constants
// ============================================================
const W = 960;
const H = 540;
const BASE_SPEED = 0.04;
const MAX_SPEED = 0.12;
const NITRO_SPEED = 0.16;
const ACCEL = 0.001;
const BRAKE_DECEL = 0.003;
const COAST_DECEL = 0.0005;
const STEER_SPEED = 0.06;
const STEER_RETURN = 0.03;
const ROAD_WIDTH = 0.4; // screen fraction
const HORIZON_Y = 200;
const TOTAL_LAPS = 3;
const TRACK_LENGTH = 600;

const BOT_CONFIGS = [
  { id: 1, name: "NEON-X", color: "#ff4422", accentColor: "#ff8800" },
  { id: 2, name: "VOLT-7", color: "#00e5ff", accentColor: "#0099ff" },
  { id: 3, name: "VIPER", color: "#ff00aa", accentColor: "#aa00ff" },
  { id: 4, name: "GHOST", color: "#76ff03", accentColor: "#00ff88" },
];

// ============================================================
// Generate track
// ============================================================
function generateTrack(): TrackSegment[] {
  const segs: TrackSegment[] = [];
  const stripeColors = ["#1a1a2e", "#111128"];
  for (let i = 0; i < TRACK_LENGTH; i++) {
    const c = Math.sin(i * 0.04) * 0.6 + Math.sin(i * 0.09) * 0.3;
    segs.push({ curve: c, color: stripeColors[Math.floor(i / 4) % 2] });
  }
  return segs;
}

// ============================================================
// Draw pseudo-3D road (Mode-7 style)
// ============================================================
function drawRoad(
  ctx: CanvasRenderingContext2D,
  playerZ: number,
  playerX: number,
  track: TrackSegment[],
  bots: BotCar[],
  t: number,
) {
  const segH = (H - HORIZON_Y) / 120;

  let x = 0; // road center offset
  let dx = 0; // curve delta
  let cumulativeCurveX = 0;

  // Draw road segments back to front
  for (let row = 0; row < 120; row++) {
    const screenY = H - row * segH - segH;

    // Road width at this depth
    const rw = ROAD_WIDTH * W * (row / 120) * 1.5;
    const centerX = W / 2 + x - playerX * rw * 0.8;

    const si = (Math.floor(playerZ) + (120 - row)) % TRACK_LENGTH;
    const seg = track[si];

    dx += seg.curve * 0.8;
    x += dx * 0.4;
    cumulativeCurveX = x;

    // Road surface
    const roadColor = seg.color;
    ctx.fillStyle = roadColor;
    ctx.fillRect(centerX - rw / 2, screenY, rw, segH + 1);

    // Neon edge lines
    // Left edge (magenta)
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#ff00ff";
    ctx.fillStyle = "#ff00cc";
    ctx.fillRect(centerX - rw / 2 - 4, screenY, 4, segH + 1);

    // Right edge (cyan)
    ctx.shadowColor = "#00ffff";
    ctx.fillStyle = "#00e5ff";
    ctx.fillRect(centerX + rw / 2, screenY, 4, segH + 1);
    ctx.shadowBlur = 0;

    // Road shoulder (darker)
    ctx.fillStyle = "#0a0020";
    ctx.fillRect(0, screenY, centerX - rw / 2 - 4, segH + 1);
    ctx.fillRect(
      centerX + rw / 2 + 4,
      screenY,
      W - (centerX + rw / 2 + 4),
      segH + 1,
    );

    // Lane dividers (white dashes)
    const dashPhase = (playerZ * 8 + row * 2) % 10;
    if (dashPhase < 5) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      // Center line
      ctx.fillRect(centerX - 2, screenY, 4, segH + 1);
      // Lane lines
      ctx.globalAlpha = 0.3;
      ctx.fillRect(centerX - rw / 4 - 1, screenY, 2, segH + 1);
      ctx.fillRect(centerX + rw / 4 - 1, screenY, 2, segH + 1);
      ctx.globalAlpha = 1;
    }

    // Road color stripes for speed sensation
    if (Math.floor((playerZ * 10 + row) / 4) % 2 === 0) {
      ctx.globalAlpha = 0.04;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(centerX - rw / 2, screenY, rw, segH + 1);
      ctx.globalAlpha = 1;
    }

    // Highway barrier pylons on sides
    if (row % 15 === 0 && row > 5) {
      const pylonH = segH * 3;
      const pylonW = rw * 0.04;
      // Left pylon
      ctx.fillStyle = "#ff4422";
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#ff4422";
      ctx.fillRect(centerX - rw / 2 - 20, screenY - pylonH, pylonW, pylonH);
      // Right pylon
      ctx.fillStyle = "#00e5ff";
      ctx.shadowColor = "#00e5ff";
      ctx.fillRect(
        centerX + rw / 2 + 20 - pylonW,
        screenY - pylonH,
        pylonW,
        pylonH,
      );
      ctx.shadowBlur = 0;
    }

    // Draw bot cars at their z position
    for (const bot of bots) {
      const botDepth = Math.floor(bot.z); // visual z relative to player
      if (botDepth === row) {
        const botScaleW = rw * 0.25;
        const botScaleH = botScaleW * 0.5;
        const botCenterX = centerX + bot.x * rw * 0.5;
        drawBotCar(
          ctx,
          botCenterX,
          screenY - botScaleH * 0.6,
          botScaleW,
          botScaleH,
          bot,
          t,
        );
      }
    }
  }

  // Return curve for camera
  return cumulativeCurveX;
}

// ============================================================
// Draw bot car (scaled)
// ============================================================
function drawBotCar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  bot: BotCar,
  _t: number,
) {
  ctx.save();
  ctx.translate(cx, cy);

  const bodyH = h * 0.5;
  const bodyW = w * 0.9;

  // Shadow under car
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(0, h * 0.6, bodyW * 0.5, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Neon underglow
  ctx.shadowBlur = 12;
  ctx.shadowColor = bot.accentColor;
  ctx.fillStyle = `${bot.accentColor}66`;
  ctx.beginPath();
  ctx.ellipse(0, h * 0.4, bodyW * 0.45, h * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Wheels
  const wR = h * 0.22;
  const wheelPositions = [
    { x: -bodyW * 0.38, y: h * 0.3 },
    { x: bodyW * 0.38, y: h * 0.3 },
    { x: -bodyW * 0.32, y: -h * 0.05 },
    { x: bodyW * 0.32, y: -h * 0.05 },
  ];
  for (const wp of wheelPositions) {
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(wp.x, wp.y, wR, 0, Math.PI * 2);
    ctx.fill();
    // Wheel shine
    ctx.fillStyle = "#555";
    ctx.beginPath();
    ctx.arc(wp.x - wR * 0.2, wp.y - wR * 0.2, wR * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  // Main body (trapezoid shape)
  ctx.shadowBlur = 15;
  ctx.shadowColor = bot.color;
  const bodyGrad = ctx.createLinearGradient(
    -bodyW / 2,
    -bodyH,
    bodyW / 2,
    bodyH * 0.2,
  );
  bodyGrad.addColorStop(0, bot.accentColor);
  bodyGrad.addColorStop(0.5, bot.color);
  bodyGrad.addColorStop(1, `${bot.color}88`);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(-bodyW * 0.4, h * 0.25);
  ctx.lineTo(-bodyW / 2, h * 0.05);
  ctx.lineTo(-bodyW * 0.3, -bodyH * 0.4);
  ctx.lineTo(bodyW * 0.3, -bodyH * 0.4);
  ctx.lineTo(bodyW / 2, h * 0.05);
  ctx.lineTo(bodyW * 0.4, h * 0.25);
  ctx.closePath();
  ctx.fill();

  // Cabin
  ctx.fillStyle = "#0a0a1a";
  ctx.fillRect(-bodyW * 0.22, -bodyH * 0.85, bodyW * 0.44, bodyH * 0.5);

  // Windshield
  ctx.fillStyle = "rgba(100,200,255,0.4)";
  ctx.fillRect(-bodyW * 0.2, -bodyH * 0.8, bodyW * 0.4, bodyH * 0.4);

  // Headlights
  ctx.shadowBlur = 20;
  ctx.shadowColor = "#ffffff";
  ctx.fillStyle = "#fffde7";
  ctx.fillRect(-bodyW * 0.42, -h * 0.05, bodyW * 0.12, h * 0.1);
  ctx.fillRect(bodyW * 0.3, -h * 0.05, bodyW * 0.12, h * 0.1);

  // Name label
  ctx.shadowBlur = 0;
  ctx.font = `bold ${Math.max(8, h * 0.3)}px 'Courier New', monospace`;
  ctx.fillStyle = bot.accentColor;
  ctx.textAlign = "center";
  ctx.shadowBlur = 8;
  ctx.shadowColor = bot.accentColor;
  ctx.fillText(bot.name, 0, -bodyH - 4);
  ctx.textAlign = "left";
  ctx.shadowBlur = 0;

  ctx.restore();
}

// ============================================================
// Draw player car
// ============================================================
function drawPlayerCar(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  t: number,
) {
  const cx = W / 2;
  const cy = H - 100;
  const w = 120;
  const h = 55;

  ctx.save();
  ctx.translate(cx, cy);

  // Spin if crashed
  if (player.crashed) {
    ctx.rotate(player.spinAngle);
  } else {
    // Steer lean
    ctx.rotate(player.steer * 0.08);
  }

  // Shadow
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(0, h * 0.9, w * 0.4, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Neon underglow (cyan)
  ctx.shadowBlur = 20;
  ctx.shadowColor = "#00e5ff";
  ctx.fillStyle = "#00e5ff33";
  ctx.beginPath();
  ctx.ellipse(0, h * 0.7, w * 0.38, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Exhaust flame
  const flamePhase = t * 12;
  const flameLen = (player.nitroActive ? 40 : 20) + Math.sin(flamePhase) * 8;
  const flameColor = player.nitroActive ? "#0088ff" : "#ff6600";
  const flameGradient = ctx.createLinearGradient(0, 0, 0, flameLen);
  flameGradient.addColorStop(0, flameColor);
  flameGradient.addColorStop(0.5, player.nitroActive ? "#00ffff" : "#ff4400");
  flameGradient.addColorStop(1, "transparent");

  ctx.shadowBlur = 20;
  ctx.shadowColor = flameColor;
  // Left exhaust
  ctx.fillStyle = flameGradient;
  ctx.beginPath();
  ctx.moveTo(-w * 0.22, h * 0.1);
  ctx.lineTo(-w * 0.28, h * 0.1 + flameLen);
  ctx.lineTo(-w * 0.16, h * 0.1 + flameLen);
  ctx.closePath();
  ctx.fill();
  // Right exhaust
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.1);
  ctx.lineTo(w * 0.16, h * 0.1 + flameLen);
  ctx.lineTo(w * 0.28, h * 0.1 + flameLen);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Wheels (spinning)
  const wheelRot = t * 20 * (player.speed / BASE_SPEED);
  const wRadius = 14;
  const wheelPositions = [
    { x: -w * 0.45, y: h * 0.25 },
    { x: w * 0.45, y: h * 0.25 },
    { x: -w * 0.38, y: -h * 0.1 },
    { x: w * 0.38, y: -h * 0.1 },
  ];

  for (const wp of wheelPositions) {
    ctx.save();
    ctx.translate(wp.x, wp.y);
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(0, 0, wRadius, 0, Math.PI * 2);
    ctx.fill();
    // Spinning spokes (motion blur)
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;
    for (let s = 0; s < 3; s++) {
      const angle = wheelRot + (s * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(
        Math.cos(angle) * (wRadius - 2),
        Math.sin(angle) * (wRadius - 2),
      );
      ctx.stroke();
    }
    // Rim
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, wRadius - 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Main body
  const bodyGrad = ctx.createLinearGradient(-w / 2, -h * 0.6, w / 2, h * 0.3);
  bodyGrad.addColorStop(0, "#ff6644");
  bodyGrad.addColorStop(0.3, "#ff1744");
  bodyGrad.addColorStop(0.7, "#cc0020");
  bodyGrad.addColorStop(1, "#880010");
  ctx.shadowBlur = 20;
  ctx.shadowColor = "#ff1744";
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(-w * 0.48, h * 0.3);
  ctx.lineTo(-w / 2, h * 0.05);
  ctx.bezierCurveTo(-w / 2, -h * 0.3, -w * 0.3, -h * 0.5, -w * 0.1, -h * 0.5);
  ctx.lineTo(w * 0.1, -h * 0.5);
  ctx.bezierCurveTo(w * 0.3, -h * 0.5, w / 2, -h * 0.3, w / 2, h * 0.05);
  ctx.lineTo(w * 0.48, h * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Cockpit / cabin
  ctx.fillStyle = "#0a0a20";
  ctx.beginPath();
  ctx.moveTo(-w * 0.22, h * 0.05);
  ctx.bezierCurveTo(-w * 0.25, -h * 0.4, -w * 0.15, -h * 0.45, 0, -h * 0.45);
  ctx.bezierCurveTo(
    w * 0.15,
    -h * 0.45,
    w * 0.25,
    -h * 0.4,
    w * 0.22,
    h * 0.05,
  );
  ctx.closePath();
  ctx.fill();

  // Windshield
  const windGrad = ctx.createLinearGradient(-w * 0.18, -h * 0.4, w * 0.18, 0);
  windGrad.addColorStop(0, "rgba(100,200,255,0.6)");
  windGrad.addColorStop(1, "rgba(50,100,200,0.2)");
  ctx.fillStyle = windGrad;
  ctx.beginPath();
  ctx.moveTo(-w * 0.18, 0);
  ctx.lineTo(-w * 0.15, -h * 0.38);
  ctx.lineTo(w * 0.15, -h * 0.38);
  ctx.lineTo(w * 0.18, 0);
  ctx.closePath();
  ctx.fill();

  // Headlights
  ctx.shadowBlur = 30;
  ctx.shadowColor = "#ffffcc";
  ctx.fillStyle = "#fffde7";
  ctx.fillRect(-w * 0.5, -h * 0.12, w * 0.14, h * 0.14);
  ctx.fillRect(w * 0.36, -h * 0.12, w * 0.14, h * 0.14);
  // Headlight beams
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "#ffffaa";
  ctx.beginPath();
  ctx.moveTo(-w * 0.43, -h * 0.05);
  ctx.lineTo(-w * 0.7, -H + HORIZON_Y + 50);
  ctx.lineTo(-w * 0.2, -H + HORIZON_Y + 50);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.43, -h * 0.05);
  ctx.lineTo(w * 0.2, -H + HORIZON_Y + 50);
  ctx.lineTo(w * 0.7, -H + HORIZON_Y + 50);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // Tail lights
  ctx.shadowBlur = 15;
  ctx.shadowColor = "#ff1744";
  ctx.fillStyle = "#ff1744";
  ctx.fillRect(-w * 0.5, h * 0.08, w * 0.12, h * 0.14);
  ctx.fillRect(w * 0.38, h * 0.08, w * 0.12, h * 0.14);

  // Nitro glow strips
  if (player.nitroActive) {
    ctx.shadowBlur = 30;
    ctx.shadowColor = "#00e5ff";
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, -h * 0.2);
    ctx.lineTo(-w * 0.45, h * 0.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.45, -h * 0.2);
    ctx.lineTo(w * 0.45, h * 0.15);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

// ============================================================
// Draw background (sky + cityscape)
// ============================================================
function drawBackground(
  ctx: CanvasRenderingContext2D,
  t: number,
  stars: Star[],
  speed: number,
  _curveOffset: number,
) {
  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
  skyGrad.addColorStop(0, "#010008");
  skyGrad.addColorStop(0.4, "#050018");
  skyGrad.addColorStop(0.7, "#0a0030");
  skyGrad.addColorStop(1, "#180040");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, HORIZON_Y);

  // Nebula blobs
  const nebOffset = (t * 8) % W;
  const nebGrad1 = ctx.createRadialGradient(
    200 + nebOffset * 0.1,
    80,
    10,
    200 + nebOffset * 0.1,
    80,
    120,
  );
  nebGrad1.addColorStop(0, "rgba(150,0,200,0.06)");
  nebGrad1.addColorStop(1, "transparent");
  ctx.fillStyle = nebGrad1;
  ctx.fillRect(0, 0, W, HORIZON_Y);

  const nebGrad2 = ctx.createRadialGradient(
    700 - nebOffset * 0.05,
    100,
    10,
    700 - nebOffset * 0.05,
    100,
    100,
  );
  nebGrad2.addColorStop(0, "rgba(0,100,200,0.07)");
  nebGrad2.addColorStop(1, "transparent");
  ctx.fillStyle = nebGrad2;
  ctx.fillRect(0, 0, W, HORIZON_Y);

  // Stars (parallax with speed)
  const starShift = (t * speed * 80) % W;
  for (const star of stars) {
    const sx = (star.x - starShift * star.r * 0.5 + W * 2) % W;
    const alpha = 0.4 + 0.6 * Math.abs(Math.sin(t * star.speed + star.twinkle));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#e8d8ff";
    ctx.shadowBlur = star.r > 1 ? 4 : 0;
    ctx.shadowColor = "#cc88ff";
    ctx.beginPath();
    ctx.arc(sx, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // Mountain silhouettes
  ctx.fillStyle = "#050018";
  ctx.beginPath();
  ctx.moveTo(0, HORIZON_Y);
  const mShift = (t * 15) % W;
  const mountainPoints = [
    [0, HORIZON_Y],
    [50, HORIZON_Y - 40],
    [120, HORIZON_Y - 80],
    [200, HORIZON_Y - 50],
    [280, HORIZON_Y - 110],
    [360, HORIZON_Y - 70],
    [440, HORIZON_Y - 95],
    [520, HORIZON_Y - 55],
    [600, HORIZON_Y - 85],
    [680, HORIZON_Y - 40],
    [760, HORIZON_Y - 75],
    [840, HORIZON_Y - 50],
    [920, HORIZON_Y - 90],
    [W, HORIZON_Y - 40],
    [W, HORIZON_Y],
  ];
  for (const [mx, my] of mountainPoints) {
    ctx.lineTo((mx - mShift * 0.3 + W * 2) % W, my);
  }
  ctx.closePath();
  ctx.fill();

  // City skyline with windows
  ctx.fillStyle = "#080020";
  const bShift = (t * 30) % W;
  const buildings: [number, number, number][] = [
    [30, 55, 40],
    [80, 80, 35],
    [120, 65, 25],
    [150, 90, 30],
    [195, 70, 35],
    [240, 100, 30],
    [280, 75, 25],
    [315, 110, 40],
    [365, 85, 30],
    [405, 65, 25],
    [440, 95, 35],
    [485, 75, 30],
    [525, 115, 40],
    [575, 80, 30],
    [615, 70, 25],
    [650, 90, 35],
    [695, 100, 30],
    [735, 75, 25],
    [770, 85, 35],
    [815, 65, 30],
    [855, 95, 40],
    [905, 80, 30],
    [945, 70, 25],
  ];
  for (const [bx, bh, bw] of buildings) {
    const rx = (bx - bShift * 0.5 + W * 2) % W;
    ctx.fillRect(rx, HORIZON_Y - bh, bw, bh);
    // Windows
    const rows = Math.floor(bh / 14);
    const cols = Math.floor(bw / 10);
    for (let wr = 0; wr < rows; wr++) {
      for (let wc = 0; wc < cols; wc++) {
        const wlit = Math.sin(bx * 0.3 + wr * 7 + wc * 11 + t * 0.4) > 0.2;
        if (wlit) {
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = "#ffee88";
          ctx.fillRect(rx + wc * 10 + 2, HORIZON_Y - bh + wr * 14 + 4, 5, 6);
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#080020";
        }
      }
    }
  }

  // Horizon glow
  const horizGrad = ctx.createLinearGradient(
    0,
    HORIZON_Y - 20,
    0,
    HORIZON_Y + 5,
  );
  horizGrad.addColorStop(0, "rgba(100,0,200,0.15)");
  horizGrad.addColorStop(0.5, "rgba(200,0,255,0.25)");
  horizGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = horizGrad;
  ctx.fillRect(0, HORIZON_Y - 20, W, 25);
}

// ============================================================
// Draw HUD
// ============================================================
function drawHUD(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  _t: number,
  countdownValue: number,
) {
  // Speedometer (bottom-left)
  const speedoX = 100;
  const speedoY = H - 70;
  const speedoR = 55;
  const kmh = Math.round((player.speed / MAX_SPEED) * 320);

  // Speedometer background
  ctx.save();
  ctx.translate(speedoX, speedoY);

  ctx.shadowBlur = 20;
  ctx.shadowColor = "#00e5ff";
  ctx.strokeStyle = "rgba(0,229,255,0.3)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, speedoR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(0,0,20,0.7)";
  ctx.beginPath();
  ctx.arc(0, 0, speedoR, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Gauge arc (red → green)
  const startAngle = Math.PI * 0.75;
  const maxAngle = Math.PI * 1.5;
  const speedFrac = player.speed / MAX_SPEED;
  const needleAngle = startAngle + speedFrac * maxAngle;

  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, speedoR - 8, startAngle, startAngle + maxAngle);
  ctx.stroke();

  const gaugeColor =
    speedFrac < 0.5 ? "#76ff03" : speedFrac < 0.8 ? "#ff9100" : "#ff1744";
  ctx.shadowBlur = 15;
  ctx.shadowColor = gaugeColor;
  ctx.strokeStyle = gaugeColor;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, speedoR - 8, startAngle, needleAngle);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Needle
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.shadowBlur = 10;
  ctx.shadowColor = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(
    Math.cos(needleAngle) * (speedoR - 12),
    Math.sin(needleAngle) * (speedoR - 12),
  );
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Center dot
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  // Speed number
  ctx.font = "bold 20px 'Courier New', monospace";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(String(kmh), 0, 12);

  ctx.font = "8px 'Courier New', monospace";
  ctx.fillStyle = "#aaaaff";
  ctx.fillText("KM/H", 0, 24);

  ctx.textAlign = "left";
  ctx.restore();

  // Nitro bar (bottom center)
  const nitroX = W / 2 - 100;
  const nitroY = H - 28;
  const nitroW = 200;
  const nitroH = 14;

  ctx.fillStyle = "rgba(0,0,20,0.7)";
  ctx.fillRect(nitroX, nitroY, nitroW, nitroH);

  const nitroPct = player.nitro / 100;
  const nitroColor = player.nitroActive ? "#00ffff" : "#0066ff";
  ctx.shadowBlur = player.nitroActive ? 20 : 8;
  ctx.shadowColor = nitroColor;
  ctx.fillStyle = nitroColor;
  const nitroFillW = nitroW * nitroPct;
  ctx.fillRect(nitroX, nitroY, nitroFillW, nitroH);

  ctx.strokeStyle = "rgba(0,100,255,0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(nitroX, nitroY, nitroW, nitroH);
  ctx.shadowBlur = 0;

  ctx.font = "9px 'Courier New', monospace";
  ctx.fillStyle = "#aaddff";
  ctx.textAlign = "center";
  ctx.fillText(
    player.nitroActive ? "NITRO BOOST!" : "NITRO [SPACE]",
    W / 2,
    H - 34,
  );
  ctx.textAlign = "left";

  // Position display (top center)
  const posNames = ["1ST", "2ND", "3RD", "4TH"];
  const posName = posNames[Math.min(3, player.position - 1)];
  const posColor =
    player.position === 1
      ? "#ffdd00"
      : player.position === 2
        ? "#cccccc"
        : "#ff9900";

  ctx.font = `bold 42px 'Courier New', monospace`;
  ctx.fillStyle = posColor;
  ctx.shadowBlur = 25;
  ctx.shadowColor = posColor;
  ctx.textAlign = "center";
  ctx.fillText(posName, W / 2, 55);
  ctx.shadowBlur = 0;

  // Lap counter (top left)
  ctx.font = "bold 18px 'Courier New', monospace";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.fillText(
    `LAP  ${Math.min(player.lap, TOTAL_LAPS)} / ${TOTAL_LAPS}`,
    24,
    40,
  );

  ctx.font = "12px 'Courier New', monospace";
  ctx.fillStyle = "#aaaaff";
  if (player.bestLap < 999) {
    ctx.fillText(`BEST: ${player.bestLap.toFixed(1)}s`, 24, 58);
  }

  // Timer (top right)
  ctx.textAlign = "right";
  ctx.font = "bold 16px 'Courier New', monospace";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`${player.lapTimer.toFixed(1)}s`, W - 24, 40);

  ctx.font = "10px 'Courier New', monospace";
  ctx.fillStyle = "#aaaaff";
  ctx.fillText("LAP TIME", W - 24, 55);
  ctx.textAlign = "left";

  // Speed lines at high speed
  if (player.speed > MAX_SPEED * 0.7) {
    const intensity = (player.speed - MAX_SPEED * 0.7) / (MAX_SPEED * 0.3);
    ctx.globalAlpha = intensity * 0.4;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    for (let sl = 0; sl < 12; sl++) {
      const sx = Math.random() * W * 0.2;
      const sy = HORIZON_Y + Math.random() * (H - HORIZON_Y);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - 30 - Math.random() * 60, sy);
      ctx.stroke();

      const sx2 = W - Math.random() * W * 0.2;
      ctx.beginPath();
      ctx.moveTo(sx2, sy);
      ctx.lineTo(sx2 + 30 + Math.random() * 60, sy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Countdown
  if (countdownValue > 0) {
    ctx.textAlign = "center";
    const cdColors = ["#ff1744", "#ff1744", "#ff1744", "#00ff44"];
    const cdColor =
      countdownValue === 0 ? "#00ff44" : cdColors[Math.min(3, countdownValue)];
    ctx.font = `bold 120px 'Courier New', monospace`;
    ctx.fillStyle = cdColor;
    ctx.shadowBlur = 60;
    ctx.shadowColor = cdColor;
    ctx.fillText(
      countdownValue > 0 ? String(countdownValue) : "GO!",
      W / 2,
      H / 2 + 40,
    );
    ctx.shadowBlur = 0;
    ctx.textAlign = "left";
  }

  // Mini-map (bottom right)
  const mmX = W - 120;
  const mmY = H - 100;
  const mmW = 100;
  const mmH = 80;

  ctx.fillStyle = "rgba(0,0,20,0.75)";
  ctx.strokeStyle = "rgba(0,229,255,0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  drawRoundedRect2(ctx, mmX, mmY, mmW, mmH, 6);
  ctx.fill();
  ctx.stroke();

  // Oval track shape
  ctx.strokeStyle = "#334466";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(
    mmX + mmW / 2,
    mmY + mmH / 2,
    mmW * 0.38,
    mmH * 0.35,
    0,
    0,
    Math.PI * 2,
  );
  ctx.stroke();

  // Player dot on mini-map
  const playerAngle = (player.lapProgress / 1) * Math.PI * 2 - Math.PI / 2;
  const pdx = Math.cos(playerAngle) * mmW * 0.38;
  const pdy = Math.sin(playerAngle) * mmH * 0.35;
  ctx.fillStyle = "#ff1744";
  ctx.shadowBlur = 8;
  ctx.shadowColor = "#ff1744";
  ctx.beginPath();
  ctx.arc(mmX + mmW / 2 + pdx, mmY + mmH / 2 + pdy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawRoundedRect2(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ============================================================
// Main RacingGame component
// ============================================================
interface RacingGameProps {
  onClose: () => void;
}

export default function RacingGame({ onClose }: RacingGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [finalText, setFinalText] = useState("");

  const stateRef = useRef(gameState);
  const playerRef = useRef<PlayerState>({
    x: 0,
    speed: 0,
    steer: 0,
    nitro: 100,
    nitroActive: false,
    nitroTimer: 0,
    nitroCooldown: 0,
    crashed: false,
    crashTimer: 0,
    spinAngle: 0,
    lap: 1,
    lapProgress: 0,
    position: 1,
    bestLap: 999,
    lapTimer: 0,
  });
  const botsRef = useRef<BotCar[]>([]);
  const keysRef = useRef<Record<string, boolean>>({});
  const trackRef = useRef<TrackSegment[]>([]);
  const starsRef = useRef<Star[]>([]);
  const playerZRef = useRef(0);
  const countdownRef = useRef(0);
  const countdownTimerRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const raceFinishedRef = useRef(false);

  // Init static resources
  useEffect(() => {
    trackRef.current = generateTrack();
    starsRef.current = Array.from({ length: 200 }, () => ({
      x: Math.random() * W,
      y: Math.random() * (HORIZON_Y - 10),
      r: 0.5 + Math.random() * 1.5,
      twinkle: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 2,
    }));
  }, []);

  // Key handlers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      keysRef.current[e.key] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [onClose]);

  // Start game
  const startGame = useCallback(() => {
    playerRef.current = {
      x: 0,
      speed: 0,
      steer: 0,
      nitro: 100,
      nitroActive: false,
      nitroTimer: 0,
      nitroCooldown: 0,
      crashed: false,
      crashTimer: 0,
      spinAngle: 0,
      lap: 1,
      lapProgress: 0,
      position: 1,
      bestLap: 999,
      lapTimer: 0,
    };
    playerZRef.current = 0;
    raceFinishedRef.current = false;

    // Setup bots
    botsRef.current = BOT_CONFIGS.map((bc, i) => ({
      ...bc,
      x: i % 2 === 0 ? -0.4 : 0.4,
      speed: BASE_SPEED * (0.85 + Math.random() * 0.15),
      targetSpeed: BASE_SPEED * (0.85 + Math.random() * 0.15),
      lapProgress: -0.05 * (i + 1),
      lap: 1,
      z: 20 + i * 15,
    }));

    // Countdown
    countdownRef.current = 3;
    countdownTimerRef.current = 1;
    stateRef.current = "countdown";
    setGameState("countdown");
    setFinalText("");
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = (now: number) => {
      const delta = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;
      const t = now / 1000;

      const localState = stateRef.current;
      const p = playerRef.current;
      const bots = botsRef.current;
      const track = trackRef.current;

      // === UPDATE ===

      // Countdown
      if (localState === "countdown") {
        countdownTimerRef.current -= delta;
        if (countdownTimerRef.current <= 0) {
          countdownRef.current--;
          countdownTimerRef.current = 1;
          if (countdownRef.current <= 0) {
            countdownRef.current = 0;
            stateRef.current = "playing";
            setGameState("playing");
          }
        }
      }

      if (localState === "playing" || localState === "countdown") {
        const keys = keysRef.current;
        const canInput = localState === "playing" && !p.crashed;

        // Nitro activation
        if (
          canInput &&
          (keys[" "] || keys.Shift) &&
          p.nitro > 0 &&
          p.nitroCooldown <= 0 &&
          !p.nitroActive
        ) {
          p.nitroActive = true;
          p.nitroTimer = 2;
        }

        // Nitro state
        if (p.nitroActive) {
          p.nitroTimer -= delta;
          p.nitro = Math.max(0, p.nitro - 20 * delta);
          if (p.nitroTimer <= 0 || p.nitro <= 0) {
            p.nitroActive = false;
            p.nitroCooldown = 8;
          }
        } else {
          if (p.nitroCooldown > 0) {
            p.nitroCooldown -= delta;
          } else {
            p.nitro = Math.min(100, p.nitro + 10 * delta);
          }
        }

        // Crash state
        if (p.crashed) {
          p.crashTimer -= delta;
          p.spinAngle += 8 * delta;
          if (p.crashTimer <= 0) {
            p.crashed = false;
            p.speed = BASE_SPEED * 0.5;
            p.x = Math.max(-0.7, Math.min(0.7, p.x));
          }
        } else if (canInput) {
          // Acceleration/braking
          const maxSpd = p.nitroActive ? NITRO_SPEED : MAX_SPEED;
          if (keys.ArrowUp || keys.w || keys.W) {
            p.speed = Math.min(maxSpd, p.speed + ACCEL);
          } else if (keys.ArrowDown || keys.s || keys.S) {
            p.speed = Math.max(0, p.speed - BRAKE_DECEL);
          } else {
            if (p.speed < BASE_SPEED) {
              p.speed = Math.min(BASE_SPEED, p.speed + ACCEL * 0.5);
            } else {
              p.speed = Math.max(BASE_SPEED, p.speed - COAST_DECEL);
            }
          }

          // Steering
          if (keys.ArrowLeft || keys.a || keys.A) {
            p.steer = Math.max(-1, p.steer - STEER_SPEED);
          } else if (keys.ArrowRight || keys.d || keys.D) {
            p.steer = Math.min(1, p.steer + STEER_SPEED);
          } else {
            p.steer *= 1 - STEER_RETURN;
            if (Math.abs(p.steer) < 0.01) p.steer = 0;
          }

          // Apply steering
          p.x = Math.max(
            -1.1,
            Math.min(1.1, p.x + p.steer * p.speed * 6 * delta),
          );

          // Off-road crash
          if (Math.abs(p.x) > 0.95) {
            p.crashed = true;
            p.crashTimer = 3;
            p.speed = 0;
            p.spinAngle = 0;
          }
        }

        // Move player forward
        if (!p.crashed) {
          playerZRef.current += p.speed;
          p.lapProgress += p.speed / TRACK_LENGTH;
          p.lapTimer += delta;

          if (p.lapProgress >= 1) {
            p.lapProgress -= 1;
            if (p.bestLap > p.lapTimer) p.bestLap = p.lapTimer;
            p.lapTimer = 0;
            p.lap++;
            if (p.lap > TOTAL_LAPS && !raceFinishedRef.current) {
              raceFinishedRef.current = true;
              stateRef.current = "gameover";
              setGameState("gameover");
              setFinalText(
                p.position === 1
                  ? "🏆 RACE WINNER!"
                  : `FINISHED IN ${["1ST", "2ND", "3RD", "4TH"][Math.min(3, p.position - 1)]} PLACE`,
              );
            }
          }
        }

        // Update bots
        for (const bot of bots) {
          // Random speed variation
          if (Math.random() < 0.02) {
            bot.targetSpeed = BASE_SPEED * (0.82 + Math.random() * 0.18);
          }
          bot.speed += (bot.targetSpeed - bot.speed) * delta * 2;
          bot.lapProgress += bot.speed / TRACK_LENGTH;
          if (bot.lapProgress >= 1) {
            bot.lapProgress -= 1;
            bot.lap++;
          }

          // Lane switching
          if (Math.random() < 0.005) {
            bot.x = (Math.random() - 0.5) * 1.4;
          }

          // Visual z (how far ahead/behind player)
          const progDiff =
            bot.lapProgress + (bot.lap - 1) - (p.lapProgress + (p.lap - 1));
          bot.z = 30 + progDiff * TRACK_LENGTH * 12;
        }

        // Calculate race position
        const playerTotal = p.lapProgress + (p.lap - 1);
        const botsAhead = bots.filter(
          (b) => b.lapProgress + (b.lap - 1) > playerTotal,
        ).length;
        p.position = botsAhead + 1;
      }

      // === RENDER ===
      ctx.clearRect(0, 0, W, H);

      drawBackground(ctx, t, starsRef.current, p.speed, 0);

      // Draw road with bots embedded
      const visibleBots = botsRef.current
        .map((b) => ({
          ...b,
          z: Math.max(
            0,
            Math.min(
              119,
              Math.round(
                (b.lapProgress + (b.lap - 1) - (p.lapProgress + (p.lap - 1))) *
                  TRACK_LENGTH *
                  0.15 +
                  30,
              ),
            ),
          ),
        }))
        .filter((b) => b.z > 2 && b.z < 115);

      if (localState !== "idle") {
        drawRoad(ctx, playerZRef.current, p.x, track, visibleBots, t);
        drawPlayerCar(ctx, p, t);
        drawHUD(ctx, p, t, countdownRef.current > 0 ? countdownRef.current : 0);

        // Controls hint
        ctx.font = "10px 'Courier New', monospace";
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.textAlign = "center";
        ctx.fillText(
          "↑/W: Accelerate | ↓/S: Brake | ←→/AD: Steer | Space/Shift: Nitro Boost",
          W / 2,
          H - 10,
        );
        ctx.textAlign = "left";
      } else {
        // Idle: show road preview
        drawRoad(ctx, t * 2, 0, track, [], t);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync state ref
  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "#010008",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      data-ocid="racing.canvas_target"
    >
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
        }}
      />

      {/* Close button */}
      <button
        type="button"
        data-ocid="racing.close_button"
        onClick={onClose}
        aria-label="Close racing game"
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 60,
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "1px solid rgba(0,229,255,0.5)",
          background: "rgba(0,0,20,0.7)",
          color: "#00e5ff",
          fontSize: "1.2rem",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(8px)",
          transition: "all 0.2s",
        }}
      >
        ✕
      </button>

      {/* Idle Screen */}
      {gameState === "idle" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            background:
              "radial-gradient(ellipse at center, rgba(0,0,30,0.7) 0%, rgba(0,0,5,0.96) 100%)",
          }}
        >
          <div
            style={{
              fontSize: "clamp(2rem, 6vw, 4.5rem)",
              fontWeight: 900,
              fontFamily: "'Courier New', monospace",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              background:
                "linear-gradient(135deg, #00e5ff 0%, #0066ff 40%, #ff00aa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 40px rgba(0,229,255,0.5))",
            }}
          >
            🏎 CYBER RACE
          </div>
          <div
            style={{
              color: "rgba(150,200,255,0.6)",
              fontFamily: "'Courier New', monospace",
              fontSize: "0.8rem",
              letterSpacing: "0.18em",
              textAlign: "center",
              lineHeight: 2,
            }}
          >
            3 LAPS · 4 OPPONENTS · PURE SPEED
            <br />↑ W: Gas | ↓ S: Brake | ← → A D: Steer | Space: Nitro
          </div>
          <button
            type="button"
            data-ocid="racing.primary_button"
            onClick={startGame}
            style={{
              padding: "14px 52px",
              borderRadius: "4px",
              border: "none",
              background: "linear-gradient(135deg, #00e5ff22, #0066ff33)",
              color: "#ffffff",
              fontSize: "1rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              fontFamily: "'Courier New', monospace",
              cursor: "pointer",
              boxShadow:
                "0 0 30px rgba(0,229,255,0.4), 0 0 60px rgba(0,102,255,0.2), inset 0 0 20px rgba(0,229,255,0.1)",
              outline: "1px solid rgba(0,229,255,0.5)",
              transition: "all 0.25s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 0 50px rgba(0,229,255,0.7), 0 0 100px rgba(0,102,255,0.4), inset 0 0 30px rgba(0,229,255,0.2)";
              (e.currentTarget as HTMLButtonElement).style.outline =
                "1px solid rgba(0,229,255,0.9)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 0 30px rgba(0,229,255,0.4), 0 0 60px rgba(0,102,255,0.2), inset 0 0 20px rgba(0,229,255,0.1)";
              (e.currentTarget as HTMLButtonElement).style.outline =
                "1px solid rgba(0,229,255,0.5)";
            }}
          >
            START RACE
          </button>
          <div
            style={{
              color: "rgba(255,255,255,0.2)",
              fontSize: "0.65rem",
              letterSpacing: "0.15em",
              fontFamily: "'Courier New', monospace",
            }}
          >
            ESC to close
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === "gameover" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            background: "rgba(0,0,15,0.88)",
            backdropFilter: "blur(4px)",
          }}
          data-ocid="racing.modal"
        >
          <div
            style={{
              fontSize: "clamp(1.6rem, 5vw, 3rem)",
              fontWeight: 900,
              fontFamily: "'Courier New', monospace",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: finalText.includes("WINNER") ? "#ffdd00" : "#00e5ff",
              textShadow: finalText.includes("WINNER")
                ? "0 0 30px #ffdd00, 0 0 60px rgba(255,220,0,0.5)"
                : "0 0 30px #00e5ff, 0 0 60px rgba(0,229,255,0.5)",
            }}
          >
            {finalText}
          </div>
          <div
            style={{
              color: "rgba(150,200,255,0.6)",
              fontFamily: "'Courier New', monospace",
              fontSize: "0.85rem",
              letterSpacing: "0.15em",
            }}
          >
            {`Best Lap: ${playerRef.current.bestLap < 999 ? `${playerRef.current.bestLap.toFixed(1)}s` : "—"}`}
          </div>
          <button
            type="button"
            data-ocid="racing.primary_button"
            onClick={startGame}
            style={{
              padding: "12px 44px",
              borderRadius: "4px",
              border: "1px solid rgba(0,229,255,0.5)",
              background: "transparent",
              color: "#00e5ff",
              fontSize: "0.9rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontFamily: "'Courier New', monospace",
              cursor: "pointer",
              textShadow: "0 0 12px #00e5ff",
              boxShadow: "0 0 20px rgba(0,229,255,0.4)",
              transition: "all 0.2s",
            }}
          >
            RACE AGAIN
          </button>
        </div>
      )}
    </div>
  );
}
