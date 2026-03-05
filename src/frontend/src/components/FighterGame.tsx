import { Canvas, useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

// ============================================================
// Types
// ============================================================
type GameState = "idle" | "playing" | "gameover";
type FighterAction =
  | "idle"
  | "walk"
  | "punch"
  | "kick"
  | "block"
  | "hit"
  | "jump";

interface FighterState {
  x: number;
  y: number;
  velY: number;
  hp: number;
  action: FighterAction;
  actionTimer: number;
  facing: 1 | -1;
  isBlocking: boolean;
  hitFlash: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  color: string;
}

// ============================================================
// Constants
// ============================================================
const FLOOR_Y = 0;
const GRAVITY = -18;
const JUMP_VEL = 9;
const PLAYER_SPEED = 4;
const HIT_RANGE = 2.0;
const PLAYER_PUNCH_DMG = 10;
const PLAYER_KICK_DMG = 15;
const AI_PUNCH_DMG = 8;
const AI_KICK_DMG = 12;
const ACTION_DURATION = 0.35;

// ============================================================
// Stickman Mesh
// ============================================================
interface StickmanProps {
  position: [number, number, number];
  color: string;
  glowColor: string;
  action: FighterAction;
  facing: number;
  hitFlash: number;
  isBlocking: boolean;
  clock: THREE.Clock;
  timeOffset?: number;
}

function Stickman({
  position,
  color,
  glowColor,
  action,
  facing,
  hitFlash,
  isBlocking,
  clock,
  timeOffset = 0,
}: StickmanProps) {
  const groupRef = useRef<THREE.Group>(null);
  const rArmRef = useRef<THREE.Mesh>(null);
  const lArmRef = useRef<THREE.Mesh>(null);
  const rLegRef = useRef<THREE.Mesh>(null);
  const lLegRef = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const t = clock.getElapsedTime() + timeOffset;
    if (!groupRef.current || !bodyRef.current) return;

    // Hit flash
    const _mat = (ref: React.RefObject<THREE.Mesh>) => {
      if (ref.current) {
        const m = ref.current.material as THREE.MeshStandardMaterial;
        const c = hitFlash > 0 ? "#ffffff" : color;
        m.color.set(c);
        m.emissive.set(hitFlash > 0 ? "#ff4444" : glowColor);
        m.emissiveIntensity = hitFlash > 0 ? 1.5 : 0.3;
      }
    };

    // Body bob
    const idleY = Math.sin(t * 2.5) * 0.03;
    bodyRef.current.position.y = idleY;

    // Action animations
    if (action === "punch") {
      if (rArmRef.current) rArmRef.current.rotation.z = -facing * 1.2;
      if (lArmRef.current) lArmRef.current.rotation.z = facing * 0.5;
    } else if (action === "kick") {
      if (rLegRef.current) rLegRef.current.rotation.z = -facing * 1.0;
      if (lLegRef.current) lLegRef.current.rotation.z = facing * 0.2;
    } else if (isBlocking || action === "block") {
      if (rArmRef.current) rArmRef.current.rotation.z = facing * 0.8;
      if (lArmRef.current) lArmRef.current.rotation.z = -facing * 0.8;
      bodyRef.current.position.z = 0.15;
    } else if (action === "walk") {
      const swing = Math.sin(t * 8) * 0.5;
      if (rArmRef.current) rArmRef.current.rotation.z = -facing * swing * 0.7;
      if (lArmRef.current) lArmRef.current.rotation.z = facing * swing * 0.7;
      if (rLegRef.current) rLegRef.current.rotation.z = facing * swing;
      if (lLegRef.current) lLegRef.current.rotation.z = -facing * swing;
    } else {
      // idle
      const gentleSwing = Math.sin(t * 1.5) * 0.08;
      if (rArmRef.current)
        rArmRef.current.rotation.z = -facing * (0.4 + gentleSwing);
      if (lArmRef.current)
        lArmRef.current.rotation.z = facing * (0.4 + gentleSwing);
      if (rLegRef.current) rLegRef.current.rotation.z = 0;
      if (lLegRef.current) lLegRef.current.rotation.z = 0;
      bodyRef.current.position.z = 0;
    }
  });

  const actualColor = hitFlash > 0 ? "#ffffff" : color;
  const emissiveColor = hitFlash > 0 ? "#ff4444" : glowColor;
  const emissiveInt = hitFlash > 0 ? 1.5 : 0.3;

  const mat = (
    <meshStandardMaterial
      color={actualColor}
      emissive={emissiveColor}
      emissiveIntensity={emissiveInt}
      metalness={0.3}
      roughness={0.4}
    />
  );

  return (
    <group ref={groupRef} position={position} scale={[facing, 1, 1]}>
      <group ref={bodyRef}>
        {/* Head */}
        <mesh position={[0, 1.5, 0]}>
          <sphereGeometry args={[0.2, 12, 10]} />
          {mat}
        </mesh>

        {/* Body */}
        <mesh position={[0, 0.85, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.6, 8]} />
          {mat}
        </mesh>

        {/* Right Arm */}
        <mesh ref={rArmRef} position={[0.28, 1.05, 0]} rotation={[0, 0, -0.4]}>
          <cylinderGeometry args={[0.05, 0.05, 0.4, 8]} />
          {mat}
        </mesh>

        {/* Left Arm */}
        <mesh ref={lArmRef} position={[-0.28, 1.05, 0]} rotation={[0, 0, 0.4]}>
          <cylinderGeometry args={[0.05, 0.05, 0.4, 8]} />
          {mat}
        </mesh>

        {/* Right Leg */}
        <mesh ref={rLegRef} position={[0.12, 0.3, 0]} rotation={[0, 0, 0.1]}>
          <cylinderGeometry args={[0.05, 0.05, 0.5, 8]} />
          {mat}
        </mesh>

        {/* Left Leg */}
        <mesh ref={lLegRef} position={[-0.12, 0.3, 0]} rotation={[0, 0, -0.1]}>
          <cylinderGeometry args={[0.05, 0.05, 0.5, 8]} />
          {mat}
        </mesh>

        {/* Eyes */}
        <mesh position={[0.07, 1.56, 0.16]}>
          <sphereGeometry args={[0.04, 6, 6]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[-0.07, 1.56, 0.16]}>
          <sphereGeometry args={[0.04, 6, 6]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
    </group>
  );
}

// ============================================================
// Hit Particles
// ============================================================
function HitParticles({ particles }: { particles: Particle[] }) {
  return (
    <>
      {particles.map((p) => (
        <mesh key={p.id} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[0.06 * (p.life / p.maxLife), 6, 6]} />
          <meshBasicMaterial
            color={p.color}
            transparent
            opacity={p.life / p.maxLife}
          />
        </mesh>
      ))}
    </>
  );
}

// ============================================================
// Arena Scene
// ============================================================
interface ArenaSceneProps {
  gameState: GameState;
  onGameOver: (winner: "player" | "ai") => void;
  player: React.MutableRefObject<FighterState>;
  ai: React.MutableRefObject<FighterState>;
  onHpUpdate: (p: number, a: number) => void;
}

function ArenaScene({
  gameState,
  onGameOver,
  player,
  ai,
  onHpUpdate,
}: ArenaSceneProps) {
  const keysRef = useRef<Record<string, boolean>>({});
  const particlesRef = useRef<Particle[]>([]);
  const particleIdRef = useRef(0);
  const clockRef = useRef(new THREE.Clock());
  const aiTimerRef = useRef(0);
  const [_tick, setTick] = useState(0);
  const gameOverFiredRef = useRef(false);

  useEffect(() => {
    if (gameState !== "playing") return;
    clockRef.current.start();
    gameOverFiredRef.current = false;
    const onDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
    };
    const onUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [gameState]);

  const spawnParticles = useCallback((x: number, y: number, color: string) => {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      particlesRef.current.push({
        id: particleIdRef.current++,
        x,
        y,
        z: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 2,
        vz: (Math.random() - 0.5) * 2,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.5 + Math.random() * 0.3,
        color,
      });
    }
  }, []);

  useFrame((_, delta) => {
    if (gameState !== "playing") return;

    const p = player.current;
    const a = ai.current;
    const keys = keysRef.current;

    // --- Player input ---
    p.isBlocking = !!(keys.c || keys.C);
    p.facing = p.x < a.x ? 1 : -1;

    // Movement
    if (keys.ArrowLeft || keys.a || keys.A) {
      p.x = Math.max(-3.5, p.x - PLAYER_SPEED * delta);
      if (p.action === "idle") p.action = "walk";
    } else if (keys.ArrowRight || keys.d || keys.D) {
      p.x = Math.min(3.5, p.x + PLAYER_SPEED * delta);
      if (p.action === "idle") p.action = "walk";
    } else {
      if (p.action === "walk") p.action = "idle";
    }

    // Jump
    if ((keys.ArrowUp || keys.w || keys.W) && p.y <= FLOOR_Y + 0.01) {
      p.velY = JUMP_VEL;
    }

    // Attack
    if (p.action !== "punch" && p.action !== "kick" && (keys.z || keys.Z)) {
      p.action = "punch";
      p.actionTimer = ACTION_DURATION;
      // Deal damage at peak
      const dist = Math.abs(p.x - a.x);
      if (dist < HIT_RANGE) {
        const dmg = a.isBlocking ? PLAYER_PUNCH_DMG * 0.2 : PLAYER_PUNCH_DMG;
        a.hp = Math.max(0, a.hp - dmg);
        a.action = "hit";
        a.actionTimer = 0.2;
        a.hitFlash = 0.2;
        spawnParticles(a.x, a.y + 1.0, "#ff4444");
      }
    }
    if (p.action !== "punch" && p.action !== "kick" && (keys.x || keys.X)) {
      p.action = "kick";
      p.actionTimer = ACTION_DURATION;
      const dist = Math.abs(p.x - a.x);
      if (dist < HIT_RANGE) {
        const dmg = a.isBlocking ? PLAYER_KICK_DMG * 0.2 : PLAYER_KICK_DMG;
        a.hp = Math.max(0, a.hp - dmg);
        a.action = "hit";
        a.actionTimer = 0.25;
        a.hitFlash = 0.25;
        spawnParticles(a.x, a.y + 0.5, "#ff9100");
      }
    }

    // Action timer
    if (p.actionTimer > 0) {
      p.actionTimer -= delta;
      if (p.actionTimer <= 0) {
        p.action = "idle";
        p.actionTimer = 0;
      }
    }

    // Gravity
    p.velY += GRAVITY * delta;
    p.y += p.velY * delta;
    if (p.y < FLOOR_Y) {
      p.y = FLOOR_Y;
      p.velY = 0;
    }

    // Hit flash
    if (p.hitFlash > 0) p.hitFlash -= delta;

    // --- AI logic ---
    a.facing = a.x < p.x ? 1 : -1;
    aiTimerRef.current -= delta;
    const dist = Math.abs(a.x - p.x);

    if (a.action !== "punch" && a.action !== "kick" && a.action !== "hit") {
      // Move toward player
      if (dist > 1.4) {
        a.x += (p.x - a.x > 0 ? 1 : -1) * 2.5 * delta;
        a.action = "walk";
      } else {
        a.action = "idle";
      }

      // Attack
      if (aiTimerRef.current <= 0 && dist < HIT_RANGE) {
        const attackType = Math.random() < 0.5 ? "punch" : "kick";
        a.action = attackType;
        a.actionTimer = ACTION_DURATION;
        aiTimerRef.current = 0.8 + Math.random() * 1.0;

        // Random block
        a.isBlocking = Math.random() < 0.2;

        const dmg = attackType === "punch" ? AI_PUNCH_DMG : AI_KICK_DMG;
        const actualDmg = p.isBlocking ? dmg * 0.2 : dmg;
        p.hp = Math.max(0, p.hp - actualDmg);
        p.action = "hit";
        p.actionTimer = 0.2;
        p.hitFlash = 0.2;
        spawnParticles(p.x, p.y + 1.0, "#00aaff");
      }
    }

    if (a.actionTimer > 0) {
      a.actionTimer -= delta;
      if (a.actionTimer <= 0) {
        a.action = "idle";
        a.actionTimer = 0;
      }
    }

    // AI gravity
    a.velY += GRAVITY * delta;
    a.y += a.velY * delta;
    if (a.y < FLOOR_Y) {
      a.y = FLOOR_Y;
      a.velY = 0;
    }

    if (a.hitFlash > 0) a.hitFlash -= delta;

    // Particles
    particlesRef.current = particlesRef.current
      .map((pt) => ({
        ...pt,
        x: pt.x + pt.vx * delta,
        y: pt.y + pt.vy * delta,
        z: pt.z + pt.vz * delta,
        vy: pt.vy - 8 * delta,
        life: pt.life - delta,
      }))
      .filter((pt) => pt.life > 0);

    onHpUpdate(Math.max(0, p.hp), Math.max(0, a.hp));

    // Game over
    if (!gameOverFiredRef.current) {
      if (a.hp <= 0) {
        gameOverFiredRef.current = true;
        onGameOver("player");
      } else if (p.hp <= 0) {
        gameOverFiredRef.current = true;
        onGameOver("ai");
      }
    }

    setTick((n) => n + 1);
  });

  const p = player.current;
  const a = ai.current;

  return (
    <>
      {/* Lights */}
      <ambientLight intensity={0.4} color="#100020" />
      <pointLight
        position={[-4, 6, 4]}
        color="#00aaff"
        intensity={3}
        distance={20}
      />
      <pointLight
        position={[4, 6, 4]}
        color="#ff4422"
        intensity={3}
        distance={20}
      />
      <pointLight
        position={[0, 8, 0]}
        color="#ffffff"
        intensity={1}
        distance={25}
      />

      {/* Sky */}
      <mesh>
        <sphereGeometry args={[50, 12, 8]} />
        <meshBasicMaterial color="#080010" side={THREE.BackSide} />
      </mesh>

      {/* Arena floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 6]} />
        <meshStandardMaterial color="#0d001a" roughness={0.9} metalness={0.2} />
      </mesh>

      {/* Floor glow lines */}
      {[-2, 0, 2].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.005, 0]}>
          <planeGeometry args={[0.04, 6]} />
          <meshBasicMaterial
            color={x === 0 ? "#ffffff" : "#333"}
            transparent
            opacity={0.3}
          />
        </mesh>
      ))}

      {/* Back wall */}
      <mesh position={[0, 2, -3.5]}>
        <planeGeometry args={[14, 8]} />
        <meshStandardMaterial color="#0a0018" roughness={1} />
      </mesh>

      {/* Neon accent strips on walls */}
      <mesh position={[-6.8, 1.5, -3]}>
        <boxGeometry args={[0.05, 3, 0.05]} />
        <meshBasicMaterial color="#00aaff" />
      </mesh>
      <mesh position={[6.8, 1.5, -3]}>
        <boxGeometry args={[0.05, 3, 0.05]} />
        <meshBasicMaterial color="#ff4422" />
      </mesh>

      {/* Player (blue/cyan) */}
      <Stickman
        position={[p.x, p.y, 0]}
        color="#00ccff"
        glowColor="#0066ff"
        action={p.action}
        facing={p.facing}
        hitFlash={p.hitFlash}
        isBlocking={p.isBlocking}
        clock={clockRef.current}
        timeOffset={0}
      />

      {/* AI (red/orange) */}
      <Stickman
        position={[a.x, a.y, 0]}
        color="#ff6633"
        glowColor="#ff2200"
        action={a.action}
        facing={a.facing}
        hitFlash={a.hitFlash}
        isBlocking={a.isBlocking}
        clock={clockRef.current}
        timeOffset={1.5}
      />

      {/* Particles */}
      <HitParticles particles={particlesRef.current} />
    </>
  );
}

// ============================================================
// Health Bar
// ============================================================
function HealthBar({
  hp,
  label,
  color,
  align,
}: {
  hp: number;
  label: string;
  color: string;
  align: "left" | "right";
}) {
  const pct = Math.max(0, Math.min(100, hp));
  const barColor = pct > 50 ? color : pct > 25 ? "#ff9100" : "#ff1744";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: align === "left" ? "row" : "row-reverse",
        alignItems: "center",
        gap: 10,
        width: "40%",
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          letterSpacing: "0.15em",
          fontFamily: "'Courier New', monospace",
          color: color,
          textShadow: `0 0 8px ${color}`,
          minWidth: 70,
          textAlign: align,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          height: 12,
          background: "rgba(0,0,0,0.6)",
          borderRadius: 6,
          border: `1px solid ${color}44`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${barColor}88, ${barColor})`,
            borderRadius: 4,
            boxShadow: `0 0 8px ${barColor}88`,
            transition: "width 0.1s ease, background 0.3s",
            float: align === "right" ? "right" : "left",
          }}
        />
      </div>
      <div
        style={{
          fontSize: "0.7rem",
          fontFamily: "'Courier New', monospace",
          color: barColor,
          minWidth: 36,
          textAlign: align === "left" ? "right" : "left",
        }}
      >
        {Math.ceil(hp)}
      </div>
    </div>
  );
}

// ============================================================
// Main FighterGame component
// ============================================================
interface FighterGameProps {
  onClose: () => void;
}

function createFighter(x: number): FighterState {
  return {
    x,
    y: 0,
    velY: 0,
    hp: 100,
    action: "idle",
    actionTimer: 0,
    facing: 1,
    isBlocking: false,
    hitFlash: 0,
  };
}

export default function FighterGame({ onClose }: FighterGameProps) {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [winner, setWinner] = useState<"player" | "ai" | null>(null);
  const [playerHp, setPlayerHp] = useState(100);
  const [aiHp, setAiHp] = useState(100);

  const playerRef = useRef<FighterState>(createFighter(-2));
  const aiRef = useRef<FighterState>(createFighter(2));

  const handleGameOver = useCallback((w: "player" | "ai") => {
    setWinner(w);
    setGameState("gameover");
  }, []);

  const handleHpUpdate = useCallback((p: number, a: number) => {
    setPlayerHp(p);
    setAiHp(a);
  }, []);

  const startGame = useCallback(() => {
    playerRef.current = createFighter(-2);
    aiRef.current = { ...createFighter(2), facing: -1 };
    setPlayerHp(100);
    setAiHp(100);
    setWinner(null);
    setGameState("playing");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "#080010",
        overflow: "hidden",
      }}
      data-ocid="fighter.canvas_target"
    >
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
          background: "rgba(0,0,0,0.6)",
          color: "#ff4422",
          fontSize: "1.2rem",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(8px)",
        }}
      >
        ✕
      </button>

      {/* Idle screen */}
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
            background: "rgba(0,0,0,0.88)",
          }}
        >
          <div
            style={{
              fontSize: "clamp(1.8rem, 5vw, 3.5rem)",
              fontWeight: 900,
              fontFamily: "'Courier New', monospace",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              background: "linear-gradient(135deg, #00ccff, #ff4422)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 20px rgba(0,200,255,0.5))",
            }}
          >
            ⚔ EPIC BATTLE
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.45)",
              fontFamily: "Georgia, serif",
              fontSize: "0.85rem",
              letterSpacing: "0.18em",
              textAlign: "center",
              lineHeight: 1.8,
            }}
          >
            Z — Punch &nbsp;|&nbsp; X — Kick &nbsp;|&nbsp; C — Block
            <br />← → — Move &nbsp;|&nbsp; ↑ W — Jump
          </div>
          <button
            type="button"
            data-ocid="fighter.primary_button"
            onClick={startGame}
            style={{
              padding: "14px 48px",
              borderRadius: "999px",
              border: "2px solid",
              borderImage: "linear-gradient(135deg, #00ccff, #ff4422) 1",
              background: "transparent",
              color: "#ffffff",
              fontSize: "1rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontFamily: "'Courier New', monospace",
              cursor: "pointer",
              boxShadow:
                "0 0 20px rgba(0,200,255,0.3), 0 0 20px rgba(255,68,34,0.2)",
              transition: "all 0.2s",
              outline: "2px solid transparent",
              outlineOffset: "2px",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "rgba(255,255,255,0.06)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 0 40px rgba(0,200,255,0.5), 0 0 40px rgba(255,68,34,0.3)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "transparent";
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 0 20px rgba(0,200,255,0.3), 0 0 20px rgba(255,68,34,0.2)";
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

      {/* Game Over screen */}
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
            background: "rgba(0,0,0,0.88)",
          }}
        >
          <div
            style={{
              fontSize: "clamp(1.6rem, 5vw, 3rem)",
              fontWeight: 900,
              fontFamily: "'Courier New', monospace",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: winner === "player" ? "#00ccff" : "#ff4422",
              textShadow:
                winner === "player"
                  ? "0 0 20px #00ccff, 0 0 40px rgba(0,200,255,0.5)"
                  : "0 0 20px #ff4422, 0 0 40px rgba(255,68,34,0.5)",
            }}
          >
            {winner === "player" ? "🏆 YOU WIN!" : "💀 YOU LOSE!"}
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.55)",
              fontFamily: "Georgia, serif",
              fontSize: "0.9rem",
              letterSpacing: "0.15em",
            }}
          >
            {winner === "player"
              ? "The enemy has been defeated!"
              : "Better luck next time, warrior..."}
          </div>
          <button
            type="button"
            onClick={startGame}
            style={{
              padding: "12px 40px",
              borderRadius: "999px",
              border: `2px solid ${winner === "player" ? "#00ccff" : "#ff4422"}`,
              background: "transparent",
              color: winner === "player" ? "#00ccff" : "#ff4422",
              fontSize: "0.9rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontFamily: "'Courier New', monospace",
              cursor: "pointer",
              textShadow: `0 0 8px ${winner === "player" ? "#00ccff" : "#ff4422"}`,
              boxShadow: `0 0 15px ${winner === "player" ? "rgba(0,200,255,0.35)" : "rgba(255,68,34,0.35)"}`,
            }}
          >
            FIGHT AGAIN
          </button>
        </div>
      )}

      {/* HUD - Health bars */}
      {(gameState === "playing" || gameState === "gameover") && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 0,
            right: 0,
            zIndex: 10,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 16,
            padding: "0 60px 0 60px",
            pointerEvents: "none",
          }}
        >
          <HealthBar
            hp={playerHp}
            label="Player 1"
            color="#00ccff"
            align="left"
          />
          <div
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: "0.85rem",
              color: "#ffffff",
              letterSpacing: "0.12em",
              textShadow: "0 0 10px #ffffff88",
              minWidth: 30,
              textAlign: "center",
            }}
          >
            VS
          </div>
          <HealthBar hp={aiHp} label="Enemy" color="#ff4422" align="right" />
        </div>
      )}

      {/* Controls reminder (playing only) */}
      {gameState === "playing" && (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            color: "rgba(255,255,255,0.25)",
            fontSize: "0.6rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            fontFamily: "'Courier New', monospace",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          Z: Punch &nbsp;|&nbsp; X: Kick &nbsp;|&nbsp; C: Block &nbsp;|&nbsp; ←
          → Move &nbsp;|&nbsp; ↑ Jump
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 1.5, 8], fov: 60 }}
        shadows
        gl={{ antialias: true }}
        style={{ position: "absolute", inset: 0 }}
      >
        {gameState === "playing" && (
          <ArenaScene
            gameState={gameState}
            onGameOver={handleGameOver}
            player={playerRef}
            ai={aiRef}
            onHpUpdate={handleHpUpdate}
          />
        )}
        {gameState === "idle" && (
          <>
            <ambientLight intensity={0.6} />
            <pointLight position={[-4, 4, 4]} color="#00aaff" intensity={2} />
            <pointLight position={[4, 4, 4]} color="#ff4422" intensity={2} />
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[14, 6]} />
              <meshStandardMaterial color="#0d001a" roughness={0.9} />
            </mesh>
          </>
        )}
        {gameState === "gameover" && (
          <>
            <ambientLight intensity={0.3} />
            <pointLight
              position={[0, 4, 4]}
              color={winner === "player" ? "#00aaff" : "#ff4422"}
              intensity={3}
            />
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[14, 6]} />
              <meshStandardMaterial color="#0d001a" roughness={0.9} />
            </mesh>
          </>
        )}
      </Canvas>
    </div>
  );
}
