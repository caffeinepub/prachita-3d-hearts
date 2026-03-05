import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================
// Types
// ============================================================
type GameState = "idle" | "countdown" | "playing" | "gameover";
type FighterAction =
  | "idle"
  | "walk"
  | "punch"
  | "kick"
  | "block"
  | "hurt"
  | "jump"
  | "ko";

interface Vec2 {
  x: number;
  y: number;
}

interface Fighter {
  pos: Vec2;
  vel: Vec2;
  hp: number;
  maxHp: number;
  hpDecay: number; // delayed bar
  superGauge: number;
  action: FighterAction;
  actionTimer: number;
  facing: number; // 1 = right, -1 = left
  isBlocking: boolean;
  hitFlash: number;
  comboCount: number;
  comboTimer: number;
  isAI: boolean;
  airborne: boolean;
  koTimer: number;
  superActive: boolean;
  superTimer: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: "spark" | "orb" | "smoke" | "number";
  value?: number;
}

interface Star {
  x: number;
  y: number;
  r: number;
  twinkle: number;
  twinkleSpeed: number;
}

interface Building {
  x: number;
  w: number;
  h: number;
  windows: { x: number; y: number; lit: boolean; flickerTimer: number }[];
}

interface NeonStrip {
  x: number;
  y: number;
  h: number;
  color: string;
  offset: number;
}

// ============================================================
// Constants
// ============================================================
const W = 960;
const H = 540;
const FLOOR_Y = H - 90;
const GRAVITY = 1800;
const JUMP_VEL = -700;
const PLAYER_SPEED = 300;
const HIT_RANGE = 130;
const PUNCH_DMG = 10;
const KICK_DMG = 15;
const AI_PUNCH_DMG = 8;
const AI_KICK_DMG = 12;
const SUPER_DMG = 40;
const ACTION_DURATION = 0.35;
const CHAR_H = 100;

// ============================================================
// Canvas helpers
// ============================================================
function drawGlowCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  glow: number,
) {
  ctx.save();
  ctx.shadowBlur = glow;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
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
// Draw futuristic warrior on canvas
// ============================================================
function drawWarrior(
  ctx: CanvasRenderingContext2D,
  fighter: Fighter,
  baseColor: string,
  accentColor: string,
  t: number,
) {
  const { pos, action, facing, hitFlash, isBlocking, airborne } = fighter;
  const x = pos.x;
  const y = pos.y;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);

  const flash = hitFlash > 0;
  const bodyColor = flash ? "#ffffff" : baseColor;
  const glow = flash ? 40 : 20;
  const glowColor = flash ? "#ffffff" : accentColor;

  const bob = action === "idle" ? Math.sin(t * 3) * 3 : 0;
  const pulse = 0.85 + Math.sin(t * 4) * 0.15;

  ctx.shadowBlur = glow;
  ctx.shadowColor = glowColor;

  // KO slump
  if (action === "ko") {
    ctx.save();
    ctx.rotate(Math.PI / 2.2);
    ctx.translate(-20, -30);
  }

  // === LEGS ===
  let rLegAngle = 0;
  let lLegAngle = 0;
  if (action === "walk") {
    rLegAngle = Math.sin(t * 10) * 0.5;
    lLegAngle = -Math.sin(t * 10) * 0.5;
  } else if (action === "kick") {
    rLegAngle = -1.0;
    lLegAngle = 0.2;
  } else if (airborne) {
    rLegAngle = 0.4;
    lLegAngle = -0.4;
  }

  // Right leg (thigh + shin)
  ctx.save();
  ctx.translate(12, -30 + bob);
  ctx.rotate(rLegAngle);
  ctx.fillStyle = bodyColor;
  ctx.fillRect(-6, 0, 12, 28);
  ctx.translate(0, 28);
  ctx.rotate(rLegAngle > 0 ? rLegAngle * 0.5 : 0);
  ctx.fillRect(-5, 0, 10, 26);
  // boot
  ctx.fillStyle = accentColor;
  ctx.fillRect(-6, 24, 14, 8);
  ctx.restore();

  // Left leg
  ctx.save();
  ctx.translate(-12, -30 + bob);
  ctx.rotate(lLegAngle);
  ctx.fillStyle = bodyColor;
  ctx.fillRect(-6, 0, 12, 28);
  ctx.translate(0, 28);
  ctx.rotate(lLegAngle > 0 ? lLegAngle * 0.5 : 0);
  ctx.fillRect(-5, 0, 10, 26);
  ctx.fillStyle = accentColor;
  ctx.fillRect(-8, 24, 14, 8);
  ctx.restore();

  // === TORSO ===
  const torsoLean = action === "walk" ? Math.sin(t * 10) * 2 : 0;
  ctx.save();
  ctx.translate(0, -CHAR_H * 0.5 + bob + torsoLean);

  // Waist/hip
  ctx.fillStyle = bodyColor;
  ctx.fillRect(-18, 20, 36, 20);

  // Chest armor plate
  const chestGrad = ctx.createLinearGradient(-18, -10, 18, 30);
  chestGrad.addColorStop(0, flash ? "#fff" : accentColor);
  chestGrad.addColorStop(0.4, bodyColor);
  chestGrad.addColorStop(1, flash ? "#fff" : accentColor);
  ctx.fillStyle = chestGrad;
  ctx.fillRect(-18, -10, 36, 32);

  // Chest energy lines
  if (!flash) {
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7 * pulse;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(0, 8);
    ctx.lineTo(12, 0);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Shoulder pads
  ctx.fillStyle = bodyColor;
  ctx.fillRect(-26, -14, 16, 12);
  ctx.fillRect(10, -14, 16, 12);
  // shoulder accent
  ctx.fillStyle = accentColor;
  ctx.fillRect(-26, -14, 16, 4);
  ctx.fillRect(10, -14, 16, 4);

  // === ARMS ===
  let rArmAngle = action === "idle" ? -0.3 + Math.sin(t * 2) * 0.05 : -0.3;
  let lArmAngle = action === "idle" ? 0.3 - Math.sin(t * 2) * 0.05 : 0.3;
  let rForeAngle = 0;

  if (action === "punch") {
    rArmAngle = -1.4;
    rForeAngle = 0.4;
  } else if (action === "block" || isBlocking) {
    rArmAngle = -1.0;
    lArmAngle = 1.0;
    rForeAngle = -1.2;
  } else if (action === "walk") {
    rArmAngle = -0.3 + Math.sin(t * 10) * 0.4;
    lArmAngle = 0.3 - Math.sin(t * 10) * 0.4;
  } else if (airborne) {
    rArmAngle = -0.8;
    lArmAngle = 0.8;
  }

  // Right arm
  ctx.save();
  ctx.translate(-22, -4);
  ctx.rotate(rArmAngle);
  ctx.fillStyle = bodyColor;
  ctx.fillRect(-5, 0, 10, 22);
  ctx.translate(0, 22);
  ctx.rotate(rForeAngle);
  ctx.fillRect(-4, 0, 8, 20);
  // fist / glove
  if (action === "punch") {
    ctx.shadowBlur = 30;
    ctx.shadowColor = accentColor;
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(0, 22, 8, 0, Math.PI * 2);
    ctx.fill();
    // energy trail
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(-10, 18, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-20, 14, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = glow;
    ctx.shadowColor = glowColor;
  } else {
    ctx.fillStyle = accentColor;
    ctx.fillRect(-5, 18, 10, 8);
  }
  ctx.restore();

  // Left arm
  ctx.save();
  ctx.translate(22, -4);
  ctx.rotate(lArmAngle);
  ctx.fillStyle = bodyColor;
  ctx.fillRect(-5, 0, 10, 22);
  ctx.translate(0, 22);
  ctx.fillRect(-4, 0, 8, 20);
  ctx.fillStyle = accentColor;
  ctx.fillRect(-5, 18, 10, 8);
  ctx.restore();

  // === HEAD ===
  const headBob = Math.sin(t * 3) * 1.5;
  ctx.save();
  ctx.translate(0, -28 + headBob);

  // Helmet
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.arc(0, -18, 16, Math.PI, 0, false);
  ctx.fillRect(-16, -18, 32, 18);
  ctx.fill();

  // Visor
  const visorGrad = ctx.createLinearGradient(-12, -24, 12, -8);
  visorGrad.addColorStop(0, flash ? "#ffffff" : `${accentColor}cc`);
  visorGrad.addColorStop(1, flash ? "#ffffff44" : `${accentColor}44`);
  ctx.fillStyle = visorGrad;
  ctx.shadowBlur = 15;
  ctx.shadowColor = accentColor;
  ctx.fillRect(-12, -22, 24, 10);

  // Eye glow
  ctx.shadowBlur = 20;
  ctx.shadowColor = accentColor;
  ctx.fillStyle = accentColor;
  ctx.fillRect(-9, -18, 6, 4);
  ctx.fillRect(3, -18, 6, 4);
  ctx.shadowBlur = glow;
  ctx.shadowColor = glowColor;

  // Neck/jaw
  ctx.fillStyle = bodyColor;
  ctx.fillRect(-8, -2, 16, 10);
  ctx.restore();

  // === BLOCK SHIELD ===
  if ((action === "block" || isBlocking) && !flash) {
    ctx.globalAlpha = 0.3 * pulse;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 30;
    ctx.shadowColor = accentColor;
    ctx.beginPath();
    ctx.arc(0, -20, 55, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.globalAlpha = 0.1 * pulse;
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(0, -20, 55, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore(); // torso

  if (action === "ko") ctx.restore(); // ko slump

  ctx.restore(); // main transform
}

// ============================================================
// Draw background
// ============================================================
function drawBackground(
  ctx: CanvasRenderingContext2D,
  t: number,
  stars: Star[],
  buildings: Building[],
  neonStrips: NeonStrip[],
  shakeX: number,
  shakeY: number,
) {
  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
  skyGrad.addColorStop(0, "#050010");
  skyGrad.addColorStop(0.4, "#0d0025");
  skyGrad.addColorStop(0.7, "#1a0040");
  skyGrad.addColorStop(1, "#0a0020");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, FLOOR_Y);

  // Stars
  for (const star of stars) {
    const alpha =
      0.4 + 0.6 * Math.abs(Math.sin(t * star.twinkleSpeed + star.twinkle));
    ctx.globalAlpha = alpha;
    drawGlowCircle(ctx, star.x, star.y, star.r, "#e8d8ff", star.r * 4);
  }
  ctx.globalAlpha = 1;

  // Far city silhouette (static, deepest)
  ctx.fillStyle = "#07001a";
  for (const b of buildings) {
    ctx.fillRect(b.x, FLOOR_Y - b.h - 60, b.w, b.h + 60);
    // windows
    for (const win of b.windows) {
      if (win.lit) {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = "#ffee88";
        ctx.fillRect(b.x + win.x, FLOOR_Y - b.h - 60 + win.y, 4, 5);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#07001a";
      }
    }
  }

  // Mid arena walls with neon strips
  ctx.fillStyle = "#0a0020";
  ctx.fillRect(0, FLOOR_Y - 200, W, 200);

  // Neon strip lights on walls (animate up/down)
  for (const strip of neonStrips) {
    const offset = (t * 60 + strip.offset) % strip.h;
    const grad = ctx.createLinearGradient(
      strip.x,
      strip.y - strip.h + offset,
      strip.x,
      strip.y + offset,
    );
    grad.addColorStop(0, `${strip.color}00`);
    grad.addColorStop(0.5, strip.color);
    grad.addColorStop(1, `${strip.color}00`);
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(strip.x - 2, strip.y - strip.h, 4, strip.h * 2);
    ctx.globalAlpha = 1;
  }

  // Crowd silhouettes (sway)
  ctx.fillStyle = "#0e0030";
  const crowdY = FLOOR_Y - 160;
  for (let i = 0; i < 40; i++) {
    const cx = 20 + i * 24 + Math.sin(t * 0.8 + i * 0.7) * 3;
    const ch = 50 + Math.sin(i * 1.3) * 20;
    // head
    ctx.beginPath();
    ctx.arc(cx, crowdY - ch, 6, 0, Math.PI * 2);
    ctx.fill();
    // body
    ctx.fillRect(cx - 5, crowdY - ch + 6, 10, ch - 6);
  }

  // Floor - reflective dark with perspective grid
  const floorGrad = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
  floorGrad.addColorStop(0, "#0d0030");
  floorGrad.addColorStop(1, "#000010");
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);

  // Floor reflection glow under fighters
  const reflGrad = ctx.createRadialGradient(
    W / 2,
    FLOOR_Y,
    0,
    W / 2,
    FLOOR_Y,
    300,
  );
  reflGrad.addColorStop(0, "rgba(100, 0, 255, 0.15)");
  reflGrad.addColorStop(1, "transparent");
  ctx.fillStyle = reflGrad;
  ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);

  // Perspective grid lines
  const vp = { x: W / 2, y: FLOOR_Y };
  ctx.strokeStyle = "#5500ff";
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.25;
  // Horizontal lines
  for (let gy = FLOOR_Y; gy < H; gy += 15) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(W, gy);
    ctx.stroke();
  }
  // Vanishing lines
  for (let i = 0; i <= 12; i++) {
    const gx = (i / 12) * W;
    ctx.beginPath();
    ctx.moveTo(vp.x, vp.y);
    ctx.lineTo(gx, H);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Scanlines overlay
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = "#000000";
  for (let sy = 0; sy < H; sy += 3) {
    ctx.fillRect(0, sy, W, 1);
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}

// ============================================================
// Draw HUD
// ============================================================
function drawHUD(
  ctx: CanvasRenderingContext2D,
  player: Fighter,
  ai: Fighter,
  round: number,
  timer: number,
  introText: string,
  introAlpha: number,
) {
  const BAR_W = 320;
  const BAR_H = 18;
  const SUPER_H = 8;
  const margin = 30;

  // Player health bar (left)
  const pPct = player.hp / player.maxHp;
  const pDecayPct = player.hpDecay / player.maxHp;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  drawRoundedRect(ctx, margin, 28, BAR_W, BAR_H, 4);
  ctx.fill();

  // Decay bar (darker)
  ctx.fillStyle = "#aa0033";
  drawRoundedRect(ctx, margin, 28, BAR_W * pDecayPct, BAR_H, 4);
  ctx.fill();

  // HP bar
  const pBarColor =
    pPct > 0.5 ? "#00e5ff" : pPct > 0.25 ? "#ff9100" : "#ff1744";
  ctx.shadowBlur = 12;
  ctx.shadowColor = pBarColor;
  ctx.fillStyle = pBarColor;
  drawRoundedRect(ctx, margin, 28, BAR_W * pPct, BAR_H, 4);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Player super gauge
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(margin, 52, BAR_W, SUPER_H);
  const pSuperColor = player.superGauge >= 100 ? "#ffff00" : "#9900ff";
  ctx.shadowBlur = player.superGauge >= 100 ? 15 : 5;
  ctx.shadowColor = pSuperColor;
  ctx.fillStyle = pSuperColor;
  ctx.fillRect(margin, 52, BAR_W * (player.superGauge / 100), SUPER_H);
  ctx.shadowBlur = 0;

  // Player label
  ctx.font = "bold 11px 'Courier New', monospace";
  ctx.fillStyle = "#00e5ff";
  ctx.shadowBlur = 8;
  ctx.shadowColor = "#00e5ff";
  ctx.fillText("PLAYER 1", margin, 22);
  ctx.shadowBlur = 0;

  // Super label
  if (player.superGauge >= 100) {
    ctx.font = "bold 9px 'Courier New', monospace";
    ctx.fillStyle = "#ffff00";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#ffff00";
    ctx.fillText("SUPER READY! [S]", margin, 72);
    ctx.shadowBlur = 0;
  }

  // AI health bar (right)
  const aiPct = ai.hp / ai.maxHp;
  const aiDecayPct = ai.hpDecay / ai.maxHp;
  const aiX = W - margin - BAR_W;

  ctx.fillStyle = "rgba(0,0,0,0.7)";
  drawRoundedRect(ctx, aiX, 28, BAR_W, BAR_H, 4);
  ctx.fill();

  ctx.fillStyle = "#aa0033";
  drawRoundedRect(
    ctx,
    aiX + BAR_W * (1 - aiDecayPct),
    28,
    BAR_W * aiDecayPct,
    BAR_H,
    4,
  );
  ctx.fill();

  const aiBarColor =
    aiPct > 0.5 ? "#ff4422" : aiPct > 0.25 ? "#ff9100" : "#ff1744";
  ctx.shadowBlur = 12;
  ctx.shadowColor = aiBarColor;
  ctx.fillStyle = aiBarColor;
  drawRoundedRect(ctx, aiX + BAR_W * (1 - aiPct), 28, BAR_W * aiPct, BAR_H, 4);
  ctx.fill();
  ctx.shadowBlur = 0;

  // AI super gauge
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(aiX, 52, BAR_W, SUPER_H);
  const aiSuperColor = ai.superGauge >= 100 ? "#ffff00" : "#cc3300";
  ctx.shadowBlur = ai.superGauge >= 100 ? 15 : 5;
  ctx.shadowColor = aiSuperColor;
  ctx.fillStyle = aiSuperColor;
  ctx.fillRect(
    aiX + BAR_W * (1 - ai.superGauge / 100),
    52,
    BAR_W * (ai.superGauge / 100),
    SUPER_H,
  );
  ctx.shadowBlur = 0;

  ctx.font = "bold 11px 'Courier New', monospace";
  ctx.fillStyle = "#ff4422";
  ctx.shadowBlur = 8;
  ctx.shadowColor = "#ff4422";
  ctx.textAlign = "right";
  ctx.fillText("AI WARRIOR", W - margin, 22);
  ctx.textAlign = "left";
  ctx.shadowBlur = 0;

  // Center VS
  ctx.textAlign = "center";
  ctx.font = "bold 22px 'Courier New', monospace";
  ctx.fillStyle = "#ffffff";
  ctx.shadowBlur = 20;
  ctx.shadowColor = "#ffffff";
  ctx.fillText("VS", W / 2, 40);
  ctx.shadowBlur = 0;

  // Round
  ctx.font = "bold 12px 'Courier New', monospace";
  ctx.fillStyle = "#aaaaff";
  ctx.fillText(`ROUND ${round}`, W / 2, 58);

  // Timer
  ctx.font = "bold 28px 'Courier New', monospace";
  const timerColor = timer <= 10 ? "#ff1744" : "#ffffff";
  ctx.fillStyle = timerColor;
  ctx.shadowBlur = timer <= 10 ? 20 : 0;
  ctx.shadowColor = "#ff1744";
  ctx.fillText(String(Math.ceil(timer)), W / 2, 90);
  ctx.shadowBlur = 0;

  // Combo counters
  if (player.comboCount >= 2 && player.comboTimer > 0) {
    ctx.font = `bold ${24 + player.comboCount * 4}px 'Courier New', monospace`;
    ctx.fillStyle = "#ffff00";
    ctx.shadowBlur = 25;
    ctx.shadowColor = "#ffff00";
    ctx.textAlign = "left";
    ctx.fillText(`${player.comboCount}x COMBO!`, margin + BAR_W + 10, 45);
    ctx.shadowBlur = 0;
  }

  if (ai.comboCount >= 2 && ai.comboTimer > 0) {
    ctx.font = `bold ${24 + ai.comboCount * 4}px 'Courier New', monospace`;
    ctx.fillStyle = "#ff9100";
    ctx.shadowBlur = 25;
    ctx.shadowColor = "#ff9100";
    ctx.textAlign = "right";
    ctx.fillText(`${ai.comboCount}x COMBO!`, aiX - 10, 45);
    ctx.shadowBlur = 0;
  }

  ctx.textAlign = "left";

  // Intro text
  if (introAlpha > 0) {
    ctx.globalAlpha = introAlpha;
    ctx.textAlign = "center";
    ctx.font = `bold 72px 'Courier New', monospace`;
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 40;
    ctx.shadowColor = "#ffffff";
    ctx.fillText(introText, W / 2, H / 2);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }
}

// ============================================================
// Draw particles
// ============================================================
function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    if (p.type === "number" && p.value !== undefined) {
      ctx.font = "bold 20px 'Courier New', monospace";
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 15;
      ctx.shadowColor = p.color;
      ctx.textAlign = "center";
      ctx.fillText(`-${p.value}`, p.x, p.y);
      ctx.textAlign = "left";
    } else if (p.type === "smoke") {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.shadowBlur = 15;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.textAlign = "left";
}

// ============================================================
// Create fighters
// ============================================================
function createFighter(x: number, isAI: boolean): Fighter {
  return {
    pos: { x, y: FLOOR_Y },
    vel: { x: 0, y: 0 },
    hp: 100,
    maxHp: 100,
    hpDecay: 100,
    superGauge: 0,
    action: "idle",
    actionTimer: 0,
    facing: isAI ? -1 : 1,
    isBlocking: false,
    hitFlash: 0,
    comboCount: 0,
    comboTimer: 0,
    isAI,
    airborne: false,
    koTimer: 0,
    superActive: false,
    superTimer: 0,
  };
}

// ============================================================
// Main FighterGame
// ============================================================
interface FighterGameProps {
  onClose: () => void;
}

export default function FighterGame({ onClose }: FighterGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [winner, setWinner] = useState<"player" | "ai" | null>(null);
  const [resultText, setResultText] = useState("");

  // All game state in refs for animation loop
  const stateRef = useRef(gameState);
  const playerRef = useRef<Fighter>(createFighter(W * 0.3, false));
  const aiRef = useRef<Fighter>(createFighter(W * 0.7, true));
  const keysRef = useRef<Record<string, boolean>>({});
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);
  const buildingsRef = useRef<Building[]>([]);
  const neonStripsRef = useRef<NeonStrip[]>([]);
  const particleIdRef = useRef(0);
  const aiTimerRef = useRef(0);
  const shakeRef = useRef({ x: 0, y: 0, timer: 0 });
  const superFlashRef = useRef(0);
  const roundRef = useRef(1);
  const timerRef = useRef(60);
  const introTextRef = useRef("");
  const introAlphaRef = useRef(0);
  const introPhaseRef = useRef(0);
  const introTimerRef = useRef(0);
  const gameOverFiredRef = useRef(false);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const aiStateRef = useRef<
    "APPROACH" | "ATTACK" | "RETREAT" | "BLOCK" | "JUMP_ATTACK"
  >("APPROACH");

  // Initialize static scene objects
  useEffect(() => {
    starsRef.current = Array.from({ length: 120 }, () => ({
      x: Math.random() * W,
      y: Math.random() * (FLOOR_Y * 0.65),
      r: 0.5 + Math.random() * 1.5,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.5 + Math.random() * 2,
    }));

    buildingsRef.current = Array.from({ length: 22 }, (_, i) => {
      const bw = 30 + Math.random() * 50;
      const bh = 60 + Math.random() * 140;
      const bx = i * 46 - 10;
      const windows: Building["windows"] = [];
      const rows = Math.floor(bh / 18);
      const cols = Math.floor(bw / 12);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          windows.push({
            x: 4 + c * 12,
            y: 10 + r * 18,
            lit: Math.random() > 0.4,
            flickerTimer: Math.random() * 10,
          });
        }
      }
      return { x: bx, w: bw, h: bh, windows };
    });

    neonStripsRef.current = [
      { x: 60, y: FLOOR_Y, h: 200, color: "#00e5ff", offset: 0 },
      { x: 160, y: FLOOR_Y, h: 160, color: "#9900ff", offset: 40 },
      { x: W - 60, y: FLOOR_Y, h: 200, color: "#ff4422", offset: 20 },
      { x: W - 160, y: FLOOR_Y, h: 160, color: "#ff00aa", offset: 60 },
      { x: W / 2 - 120, y: FLOOR_Y, h: 180, color: "#5500ff", offset: 10 },
      { x: W / 2 + 120, y: FLOOR_Y, h: 180, color: "#0055ff", offset: 30 },
    ];
  }, []);

  // Spawn particles (stored in refs to avoid closure issues in game loop)
  const spawnHitParticlesRef = useRef(
    (x: number, y: number, color: string, count: number, dmg: number) => {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const speed = 100 + Math.random() * 250;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 100,
          life: 0.4 + Math.random() * 0.4,
          maxLife: 0.4 + Math.random() * 0.4,
          color,
          size: 3 + Math.random() * 5,
          type: "spark",
        });
      }
      particlesRef.current.push({
        x,
        y: y - 30,
        vx: (Math.random() - 0.5) * 50,
        vy: -80,
        life: 1.2,
        maxLife: 1.2,
        color: "#ffffff",
        size: 0,
        type: "number",
        value: dmg,
      });
      particleIdRef.current++;
    },
  );

  const spawnKOParticlesRef = useRef((x: number, y: number) => {
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2;
      const speed = 100 + Math.random() * 400;
      const colors = ["#ff4422", "#ff9100", "#ffff00", "#ffffff"];
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 200,
        life: 0.8 + Math.random() * 0.8,
        maxLife: 0.8 + Math.random() * 0.8,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 8,
        type: i % 4 === 0 ? "orb" : "spark",
      });
    }
    for (let i = 0; i < 20; i++) {
      particlesRef.current.push({
        x: x + (Math.random() - 0.5) * 60,
        y,
        vx: (Math.random() - 0.5) * 60,
        vy: -20 - Math.random() * 80,
        life: 1.5 + Math.random() * 1,
        maxLife: 1.5 + Math.random() * 1,
        color: "rgba(80, 40, 120, 0.5)",
        size: 15 + Math.random() * 25,
        type: "smoke",
      });
    }
  });

  // Screen shake
  const triggerShakeRef = useRef((intensity: number) => {
    shakeRef.current = {
      x: (Math.random() - 0.5) * intensity,
      y: (Math.random() - 0.5) * intensity,
      timer: 0.12,
    };
  });

  // Start game
  const startGame = useCallback(() => {
    playerRef.current = createFighter(W * 0.28, false);
    aiRef.current = createFighter(W * 0.72, true);
    particlesRef.current = [];
    aiTimerRef.current = 0.5;
    shakeRef.current = { x: 0, y: 0, timer: 0 };
    superFlashRef.current = 0;
    roundRef.current = 1;
    timerRef.current = 60;
    introPhaseRef.current = 0;
    introTimerRef.current = 0;
    introTextRef.current = "ROUND 1";
    introAlphaRef.current = 0;
    gameOverFiredRef.current = false;
    aiStateRef.current = "APPROACH";
    setWinner(null);
    setGameState("countdown");
    stateRef.current = "countdown";
  }, []);

  // ESC key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (stateRef.current === "playing" || stateRef.current === "countdown") {
        keysRef.current[e.key] = true;
      }
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

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let localState = stateRef.current;
    stateRef.current = localState;

    const loop = (now: number) => {
      const delta = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;
      const t = now / 1000;

      // Sync state
      localState = stateRef.current;

      // === UPDATE ===
      const p = playerRef.current;
      const ai = aiRef.current;

      // Screen shake decay
      if (shakeRef.current.timer > 0) {
        shakeRef.current.timer -= delta;
        if (shakeRef.current.timer <= 0) {
          shakeRef.current = { x: 0, y: 0, timer: 0 };
        } else {
          shakeRef.current.x = (Math.random() - 0.5) * 10;
          shakeRef.current.y = (Math.random() - 0.5) * 10;
        }
      }

      // Super flash decay
      if (superFlashRef.current > 0) superFlashRef.current -= delta;

      // Flicker windows
      for (const b of buildingsRef.current) {
        for (const win of b.windows) {
          win.flickerTimer -= delta;
          if (win.flickerTimer <= 0) {
            win.lit = Math.random() > 0.3;
            win.flickerTimer = 2 + Math.random() * 8;
          }
        }
      }

      // HP decay
      p.hpDecay = Math.max(p.hp, p.hpDecay - 15 * delta);
      ai.hpDecay = Math.max(ai.hp, ai.hpDecay - 15 * delta);

      // Countdown intro
      if (localState === "countdown") {
        introTimerRef.current += delta;
        const phase = introPhaseRef.current;
        if (phase === 0) {
          // Slide in ROUND X
          introAlphaRef.current = Math.min(1, introTimerRef.current / 0.3);
          if (introTimerRef.current > 1.2) {
            introPhaseRef.current = 1;
            introTimerRef.current = 0;
            introTextRef.current = "FIGHT!";
          }
        } else if (phase === 1) {
          // Zoom in FIGHT
          introAlphaRef.current = Math.max(0, 1 - introTimerRef.current / 0.8);
          if (introTimerRef.current > 0.8) {
            introAlphaRef.current = 0;
            stateRef.current = "playing";
            localState = "playing";
            setGameState("playing");
          }
        }
      }

      if (localState === "playing") {
        // Timer
        timerRef.current -= delta;
        if (timerRef.current <= 0) {
          timerRef.current = 0;
          if (!gameOverFiredRef.current) {
            gameOverFiredRef.current = true;
            const w = p.hp > ai.hp ? "player" : "ai";
            stateRef.current = "gameover";
            setGameState("gameover");
            setWinner(w);
            setResultText(
              w === "player" ? "TIME OUT - YOU WIN!" : "TIME OUT - YOU LOSE!",
            );
            spawnKOParticlesRef.current(W / 2, H / 2);
          }
        }

        const keys = keysRef.current;

        // === PLAYER INPUT ===
        p.isBlocking = !!(keys.c || keys.C);
        p.facing = p.pos.x < ai.pos.x ? 1 : -1;

        // Movement
        if (
          !p.isBlocking &&
          p.action !== "punch" &&
          p.action !== "kick" &&
          p.action !== "hurt" &&
          p.action !== "ko"
        ) {
          if (keys.ArrowLeft || keys.a || keys.A) {
            p.pos.x = Math.max(60, p.pos.x - PLAYER_SPEED * delta);
            if (p.action !== "jump") p.action = "walk";
          } else if (keys.ArrowRight || keys.d || keys.D) {
            p.pos.x = Math.min(W - 60, p.pos.x + PLAYER_SPEED * delta);
            if (p.action !== "jump") p.action = "walk";
          } else if (p.action === "walk") {
            p.action = "idle";
          }
        }

        // Jump
        if ((keys.ArrowUp || keys.w || keys.W) && !p.airborne) {
          p.vel.y = JUMP_VEL;
          p.airborne = true;
          p.action = "jump";
        }

        // Super move
        if ((keys.s || keys.S) && p.superGauge >= 100 && !p.superActive) {
          p.superActive = true;
          p.superTimer = 1.0;
          p.superGauge = 0;
          superFlashRef.current = 0.3;
          triggerShakeRef.current(20);
          const dist = Math.abs(p.pos.x - ai.pos.x);
          if (dist < 280) {
            const dmg = ai.isBlocking ? SUPER_DMG * 0.3 : SUPER_DMG;
            ai.hp = Math.max(0, ai.hp - dmg);
            ai.superGauge = Math.max(0, ai.superGauge - 30);
            ai.hitFlash = 0.4;
            ai.action = "hurt";
            ai.actionTimer = 0.5;
            spawnHitParticlesRef.current(
              ai.pos.x,
              ai.pos.y - 60,
              "#ffff00",
              30,
              Math.floor(dmg),
            );
          }
        }
        if (p.superActive) {
          p.superTimer -= delta;
          if (p.superTimer <= 0) p.superActive = false;
        }

        // Attack
        if (
          p.action !== "punch" &&
          p.action !== "kick" &&
          p.action !== "hurt" &&
          p.action !== "ko"
        ) {
          if (keys.z || keys.Z) {
            p.action = "punch";
            p.actionTimer = ACTION_DURATION;
            const dist = Math.abs(p.pos.x - ai.pos.x);
            if (dist < HIT_RANGE) {
              const dmg = ai.isBlocking
                ? Math.floor(PUNCH_DMG * 0.15)
                : PUNCH_DMG;
              ai.hp = Math.max(0, ai.hp - dmg);
              ai.hitFlash = 0.2;
              if (!ai.isBlocking) {
                ai.action = "hurt";
                ai.actionTimer = 0.18;
              }
              p.superGauge = Math.min(100, p.superGauge + 8);
              p.comboCount++;
              p.comboTimer = 1.5;
              spawnHitParticlesRef.current(
                ai.pos.x,
                ai.pos.y - 60,
                "#00e5ff",
                20,
                dmg,
              );
              triggerShakeRef.current(8);
            }
          } else if (keys.x || keys.X) {
            p.action = "kick";
            p.actionTimer = ACTION_DURATION + 0.1;
            const dist = Math.abs(p.pos.x - ai.pos.x);
            if (dist < HIT_RANGE + 20) {
              const dmg = ai.isBlocking ? Math.floor(KICK_DMG * 0.1) : KICK_DMG;
              ai.hp = Math.max(0, ai.hp - dmg);
              ai.hitFlash = 0.25;
              if (!ai.isBlocking) {
                ai.action = "hurt";
                ai.actionTimer = 0.22;
              }
              p.superGauge = Math.min(100, p.superGauge + 12);
              p.comboCount++;
              p.comboTimer = 1.5;
              spawnHitParticlesRef.current(
                ai.pos.x,
                ai.pos.y - 40,
                "#ff9100",
                20,
                dmg,
              );
              triggerShakeRef.current(10);
            }
          }
        }

        // Combo timer
        p.comboTimer -= delta;
        if (p.comboTimer <= 0) {
          p.comboCount = 0;
          p.comboTimer = 0;
        }
        ai.comboTimer -= delta;
        if (ai.comboTimer <= 0) {
          ai.comboCount = 0;
          ai.comboTimer = 0;
        }

        // Action timer
        if (p.actionTimer > 0) {
          p.actionTimer -= delta;
          if (p.actionTimer <= 0) {
            if (p.action !== "ko") p.action = p.airborne ? "jump" : "idle";
            p.actionTimer = 0;
          }
        }

        // Gravity
        if (p.airborne) {
          p.vel.y += GRAVITY * delta;
          p.pos.y += p.vel.y * delta;
          if (p.pos.y >= FLOOR_Y) {
            p.pos.y = FLOOR_Y;
            p.vel.y = 0;
            p.airborne = false;
            if (p.action === "jump") p.action = "idle";
          }
        }

        if (p.hitFlash > 0) p.hitFlash -= delta;

        // === AI LOGIC ===
        ai.facing = ai.pos.x < p.pos.x ? 1 : -1;
        aiTimerRef.current -= delta;
        const dist = Math.abs(ai.pos.x - p.pos.x);

        if (
          ai.action !== "hurt" &&
          ai.action !== "ko" &&
          ai.action !== "punch" &&
          ai.action !== "kick"
        ) {
          // State machine
          if (dist > 250) aiStateRef.current = "APPROACH";
          else if (dist < 60) aiStateRef.current = "RETREAT";
          else if (ai.hp < 30 && Math.random() < 0.01)
            aiStateRef.current = "BLOCK";
          else if (dist < HIT_RANGE && Math.random() < 0.005)
            aiStateRef.current = "ATTACK";

          if (aiStateRef.current === "APPROACH") {
            const dir = p.pos.x > ai.pos.x ? 1 : -1;
            ai.pos.x += dir * 220 * delta;
            ai.action = "walk";
          } else if (aiStateRef.current === "RETREAT") {
            const dir = p.pos.x > ai.pos.x ? -1 : 1;
            ai.pos.x = Math.max(
              60,
              Math.min(W - 60, ai.pos.x + dir * 200 * delta),
            );
            ai.action = "walk";
          } else if (aiStateRef.current === "BLOCK") {
            ai.isBlocking = true;
            ai.action = "block";
            setTimeout(() => {
              aiStateRef.current = "APPROACH";
              ai.isBlocking = false;
            }, 600);
          } else if (dist < 180) {
            ai.action = "idle";
          }

          // Jump attack
          if (
            aiTimerRef.current <= 0 &&
            dist < 220 &&
            Math.random() < 0.15 &&
            !ai.airborne
          ) {
            ai.vel.y = JUMP_VEL;
            ai.airborne = true;
            ai.action = "jump";
            aiTimerRef.current = 1.5 + Math.random() * 1;
          }

          // Regular attack
          if (aiTimerRef.current <= 0 && dist < HIT_RANGE) {
            const atkType = Math.random() < 0.5 ? "punch" : "kick";
            ai.action = atkType;
            ai.actionTimer = ACTION_DURATION;
            aiTimerRef.current = 0.7 + Math.random() * 0.8;
            aiStateRef.current = "APPROACH";

            // 30% block
            ai.isBlocking = Math.random() < 0.3;

            const dmg = atkType === "punch" ? AI_PUNCH_DMG : AI_KICK_DMG;
            const actualDmg = p.isBlocking ? Math.floor(dmg * 0.15) : dmg;
            p.hp = Math.max(0, p.hp - actualDmg);
            p.hitFlash = 0.2;
            if (!p.isBlocking) {
              p.action = "hurt";
              p.actionTimer = 0.18;
            }
            ai.superGauge = Math.min(100, ai.superGauge + 10);
            ai.comboCount++;
            ai.comboTimer = 1.5;
            spawnHitParticlesRef.current(
              p.pos.x,
              p.pos.y - 60,
              "#ff4422",
              20,
              actualDmg,
            );
            triggerShakeRef.current(8);
          }

          // AI Super
          if (ai.superGauge >= 100 && dist < 250) {
            ai.superGauge = 0;
            const dmg = p.isBlocking ? Math.floor(SUPER_DMG * 0.3) : SUPER_DMG;
            p.hp = Math.max(0, p.hp - dmg);
            p.hitFlash = 0.4;
            if (!p.isBlocking) {
              p.action = "hurt";
              p.actionTimer = 0.5;
            }
            spawnHitParticlesRef.current(
              p.pos.x,
              p.pos.y - 60,
              "#ff00aa",
              30,
              dmg,
            );
            triggerShakeRef.current(18);
          }
        }

        if (ai.actionTimer > 0) {
          ai.actionTimer -= delta;
          if (ai.actionTimer <= 0) {
            if (ai.action !== "ko") ai.action = ai.airborne ? "jump" : "idle";
            ai.actionTimer = 0;
          }
        }

        // AI gravity
        if (ai.airborne) {
          ai.vel.y += GRAVITY * delta;
          ai.pos.y += ai.vel.y * delta;
          if (ai.pos.y >= FLOOR_Y) {
            ai.pos.y = FLOOR_Y;
            ai.vel.y = 0;
            ai.airborne = false;
            if (ai.action === "jump") ai.action = "idle";
          }
        }

        if (ai.hitFlash > 0) ai.hitFlash -= delta;

        // KO check
        if (!gameOverFiredRef.current) {
          if (ai.hp <= 0) {
            ai.hp = 0;
            ai.action = "ko";
            gameOverFiredRef.current = true;
            spawnKOParticlesRef.current(ai.pos.x, ai.pos.y - 60);
            triggerShakeRef.current(25);
            setTimeout(() => {
              stateRef.current = "gameover";
              setGameState("gameover");
              setWinner("player");
              setResultText("🏆 YOU WIN! PERFECT!");
            }, 1200);
          } else if (p.hp <= 0) {
            p.hp = 0;
            p.action = "ko";
            gameOverFiredRef.current = true;
            spawnKOParticlesRef.current(p.pos.x, p.pos.y - 60);
            triggerShakeRef.current(25);
            setTimeout(() => {
              stateRef.current = "gameover";
              setGameState("gameover");
              setWinner("ai");
              setResultText("💀 YOU LOSE... FIGHT AGAIN!");
            }, 1200);
          }
        }

        // Update particles
        particlesRef.current = particlesRef.current
          .map((pt) => ({
            ...pt,
            x: pt.x + pt.vx * delta,
            y: pt.y + pt.vy * delta,
            vy: pt.type === "smoke" ? pt.vy - 20 * delta : pt.vy + 400 * delta,
            vx: pt.vx * (pt.type === "smoke" ? 0.98 : 0.96),
            life: pt.life - delta,
          }))
          .filter((pt) => pt.life > 0);
      }

      // === RENDER ===
      ctx.clearRect(0, 0, W, H);

      const shake = shakeRef.current;
      drawBackground(
        ctx,
        t,
        starsRef.current,
        buildingsRef.current,
        neonStripsRef.current,
        shake.x,
        shake.y,
      );

      // Super flash
      if (superFlashRef.current > 0) {
        ctx.globalAlpha = superFlashRef.current * 0.8;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }

      if (localState !== "idle") {
        // Shadow under fighters
        ctx.save();
        ctx.translate(shake.x, shake.y);
        ctx.globalAlpha = 0.4;
        const shadowGrad1 = ctx.createRadialGradient(
          p.pos.x,
          FLOOR_Y,
          0,
          p.pos.x,
          FLOOR_Y,
          50,
        );
        shadowGrad1.addColorStop(0, "rgba(0, 150, 255, 0.5)");
        shadowGrad1.addColorStop(1, "transparent");
        ctx.fillStyle = shadowGrad1;
        ctx.beginPath();
        ctx.ellipse(p.pos.x, FLOOR_Y + 5, 50, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        const shadowGrad2 = ctx.createRadialGradient(
          ai.pos.x,
          FLOOR_Y,
          0,
          ai.pos.x,
          FLOOR_Y,
          50,
        );
        shadowGrad2.addColorStop(0, "rgba(255, 80, 0, 0.5)");
        shadowGrad2.addColorStop(1, "transparent");
        ctx.fillStyle = shadowGrad2;
        ctx.beginPath();
        ctx.ellipse(ai.pos.x, FLOOR_Y + 5, 50, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();

        // Draw fighters
        drawWarrior(ctx, p, "#00aadd", "#00e5ff", t);
        drawWarrior(ctx, ai, "#cc3300", "#ff4422", t);

        // Draw particles
        ctx.save();
        ctx.translate(shake.x, shake.y);
        drawParticles(ctx, particlesRef.current);
        ctx.restore();

        // HUD
        drawHUD(
          ctx,
          p,
          ai,
          roundRef.current,
          timerRef.current,
          introTextRef.current,
          introAlphaRef.current,
        );
      }

      // Controls hint (during play)
      if (localState === "playing") {
        ctx.font = "10px 'Courier New', monospace";
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.textAlign = "center";
        ctx.fillText(
          "Z: Punch | X: Kick | C: Block | ←→: Move | W/↑: Jump | S: Super",
          W / 2,
          H - 12,
        );
        ctx.textAlign = "left";
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync state ref when state changes
  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "#050010",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      data-ocid="fighter.canvas_target"
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
        data-ocid="fighter.close_button"
        onClick={onClose}
        aria-label="Close fighter game"
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 60,
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "1px solid rgba(255,70,34,0.5)",
          background: "rgba(0,0,0,0.7)",
          color: "#ff4422",
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
              "radial-gradient(ellipse at center, rgba(20,0,40,0.85) 0%, rgba(0,0,0,0.96) 100%)",
          }}
        >
          <div
            style={{
              fontSize: "clamp(1.8rem, 5vw, 3.5rem)",
              fontWeight: 900,
              fontFamily: "'Courier New', monospace",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              background:
                "linear-gradient(135deg, #00e5ff 0%, #9900ff 50%, #ff4422 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 30px rgba(0,200,255,0.6))",
            }}
          >
            ⚔ CYBER WARRIORS
          </div>
          <div
            style={{
              color: "rgba(200,180,255,0.6)",
              fontFamily: "'Courier New', monospace",
              fontSize: "0.8rem",
              letterSpacing: "0.2em",
              textAlign: "center",
              lineHeight: 2,
            }}
          >
            Z — Punch &nbsp;|&nbsp; X — Kick &nbsp;|&nbsp; C — Block
            &nbsp;|&nbsp; S — Super Move
            <br />← → / A D — Move &nbsp;|&nbsp; ↑ / W — Jump
          </div>
          <button
            type="button"
            data-ocid="fighter.primary_button"
            onClick={startGame}
            style={{
              padding: "14px 52px",
              borderRadius: "4px",
              border: "none",
              background: "linear-gradient(135deg, #00e5ff22, #9900ff33)",
              color: "#ffffff",
              fontSize: "1rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              fontFamily: "'Courier New', monospace",
              cursor: "pointer",
              boxShadow:
                "0 0 30px rgba(0,200,255,0.4), 0 0 60px rgba(153,0,255,0.2), inset 0 0 20px rgba(0,200,255,0.1)",
              outline: "1px solid rgba(0,229,255,0.5)",
              transition: "all 0.25s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 0 50px rgba(0,200,255,0.7), 0 0 100px rgba(153,0,255,0.4), inset 0 0 30px rgba(0,200,255,0.2)";
              (e.currentTarget as HTMLButtonElement).style.outline =
                "1px solid rgba(0,229,255,0.9)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 0 30px rgba(0,200,255,0.4), 0 0 60px rgba(153,0,255,0.2), inset 0 0 20px rgba(0,200,255,0.1)";
              (e.currentTarget as HTMLButtonElement).style.outline =
                "1px solid rgba(0,229,255,0.5)";
            }}
          >
            START BATTLE
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
            background: "rgba(0,0,10,0.85)",
            backdropFilter: "blur(4px)",
          }}
          data-ocid="fighter.modal"
        >
          <div
            style={{
              fontSize: "clamp(1.6rem, 5vw, 3rem)",
              fontWeight: 900,
              fontFamily: "'Courier New', monospace",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: winner === "player" ? "#00e5ff" : "#ff4422",
              textShadow:
                winner === "player"
                  ? "0 0 30px #00e5ff, 0 0 60px rgba(0,229,255,0.5)"
                  : "0 0 30px #ff4422, 0 0 60px rgba(255,68,34,0.5)",
              animation: "pulse 1s ease-in-out infinite",
            }}
          >
            {resultText}
          </div>
          <button
            type="button"
            data-ocid="fighter.primary_button"
            onClick={startGame}
            style={{
              padding: "12px 44px",
              borderRadius: "4px",
              border: `1px solid ${winner === "player" ? "#00e5ff" : "#ff4422"}`,
              background: "transparent",
              color: winner === "player" ? "#00e5ff" : "#ff4422",
              fontSize: "0.9rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontFamily: "'Courier New', monospace",
              cursor: "pointer",
              textShadow: `0 0 12px ${winner === "player" ? "#00e5ff" : "#ff4422"}`,
              boxShadow: `0 0 20px ${winner === "player" ? "rgba(0,229,255,0.4)" : "rgba(255,68,34,0.4)"}`,
              transition: "all 0.2s",
            }}
          >
            FIGHT AGAIN
          </button>
        </div>
      )}
    </div>
  );
}
