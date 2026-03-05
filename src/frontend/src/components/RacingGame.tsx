import { Canvas, useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

// ============================================================
// Types
// ============================================================
interface Obstacle {
  id: number;
  x: number;
  z: number;
  color: string;
}

type GameState = "idle" | "playing" | "gameover";

// ============================================================
// Constants
// ============================================================
const ROAD_WIDTH = 6;
const LANE_X = [-1.8, 0, 1.8];
const SEGMENT_LENGTH = 20;
const SEGMENT_COUNT = 10;
const BASE_SPEED = 18;
const OBSTACLE_COLORS = ["#ff6b35", "#00e5ff", "#ff1744", "#76ff03", "#ff9100"];

// ============================================================
// Road Segment
// ============================================================
function RoadSegment({ zPos }: { zPos: number }) {
  return (
    <group position={[0, 0, zPos]}>
      {/* Road surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROAD_WIDTH, SEGMENT_LENGTH]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Left edge stripe */}
      <mesh
        position={[-ROAD_WIDTH / 2 + 0.15, 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.25, SEGMENT_LENGTH]} />
        <meshStandardMaterial
          color="#ff2d55"
          emissive="#ff2d55"
          emissiveIntensity={0.6}
        />
      </mesh>
      {/* Right edge stripe */}
      <mesh
        position={[ROAD_WIDTH / 2 - 0.15, 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.25, SEGMENT_LENGTH]} />
        <meshStandardMaterial
          color="#ff2d55"
          emissive="#ff2d55"
          emissiveIntensity={0.6}
        />
      </mesh>
      {/* Center dashed lines - using z-position as stable key */}
      {[2, 6, 10, 14, 18].map((zOff) => (
        <mesh
          key={`center-z${zOff}`}
          position={[0, 0.01, -SEGMENT_LENGTH / 2 + zOff]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.1, 1.5]} />
          <meshStandardMaterial color="#ffffff" opacity={0.5} transparent />
        </mesh>
      ))}
      {/* Left lane dash */}
      {[2, 6, 10, 14, 18].map((zOff) => (
        <mesh
          key={`left-z${zOff}`}
          position={[-1.8, 0.01, -SEGMENT_LENGTH / 2 + zOff]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.06, 1.2]} />
          <meshStandardMaterial color="#ffffff" opacity={0.3} transparent />
        </mesh>
      ))}
      {/* Right lane dash */}
      {[2, 6, 10, 14, 18].map((zOff) => (
        <mesh
          key={`right-z${zOff}`}
          position={[1.8, 0.01, -SEGMENT_LENGTH / 2 + zOff]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.06, 1.2]} />
          <meshStandardMaterial color="#ffffff" opacity={0.3} transparent />
        </mesh>
      ))}
    </group>
  );
}

// ============================================================
// Player Car
// ============================================================
function PlayerCar({ xPos }: { xPos: number }) {
  return (
    <group position={[xPos, 0.25, 0]}>
      {/* Car body */}
      <mesh castShadow>
        <boxGeometry args={[0.9, 0.3, 1.8]} />
        <meshStandardMaterial
          color="#ff1744"
          emissive="#ff1744"
          emissiveIntensity={0.3}
          metalness={0.7}
          roughness={0.2}
        />
      </mesh>
      {/* Car roof */}
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[0.7, 0.22, 1.0]} />
        <meshStandardMaterial color="#cc0020" metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Front windshield */}
      <mesh position={[0, 0.3, -0.42]} castShadow>
        <boxGeometry args={[0.65, 0.15, 0.08]} />
        <meshStandardMaterial
          color="#88ddff"
          opacity={0.7}
          transparent
          metalness={0.9}
          roughness={0.0}
        />
      </mesh>
      {/* Headlights */}
      <mesh position={[-0.3, 0.05, -0.9]}>
        <boxGeometry args={[0.2, 0.1, 0.05]} />
        <meshStandardMaterial
          color="#fffde7"
          emissive="#fff176"
          emissiveIntensity={2}
        />
      </mesh>
      <mesh position={[0.3, 0.05, -0.9]}>
        <boxGeometry args={[0.2, 0.1, 0.05]} />
        <meshStandardMaterial
          color="#fffde7"
          emissive="#fff176"
          emissiveIntensity={2}
        />
      </mesh>
      {/* Tail lights */}
      <mesh position={[-0.3, 0.05, 0.91]}>
        <boxGeometry args={[0.2, 0.1, 0.05]} />
        <meshStandardMaterial
          color="#ff1744"
          emissive="#ff1744"
          emissiveIntensity={2}
        />
      </mesh>
      <mesh position={[0.3, 0.05, 0.91]}>
        <boxGeometry args={[0.2, 0.1, 0.05]} />
        <meshStandardMaterial
          color="#ff1744"
          emissive="#ff1744"
          emissiveIntensity={2}
        />
      </mesh>
      {/* Wheels */}
      {[
        { p: [-0.48, -0.1, -0.6] as [number, number, number], k: "fl" },
        { p: [0.48, -0.1, -0.6] as [number, number, number], k: "fr" },
        { p: [-0.48, -0.1, 0.6] as [number, number, number], k: "rl" },
        { p: [0.48, -0.1, 0.6] as [number, number, number], k: "rr" },
      ].map(({ p, k }) => (
        <mesh key={`pw-${k}`} position={p} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.18, 0.18, 0.12, 12]} />
          <meshStandardMaterial color="#111" metalness={0.4} roughness={0.8} />
        </mesh>
      ))}
      {/* Neon underbody glow */}
      <pointLight
        position={[0, -0.25, 0]}
        color="#ff1744"
        intensity={1.5}
        distance={2}
      />
    </group>
  );
}

// ============================================================
// Obstacle Car
// ============================================================
function ObstacleCar({ obstacle }: { obstacle: Obstacle }) {
  return (
    <group position={[obstacle.x, 0.25, obstacle.z]}>
      <mesh castShadow>
        <boxGeometry args={[0.85, 0.28, 1.7]} />
        <meshStandardMaterial
          color={obstacle.color}
          emissive={obstacle.color}
          emissiveIntensity={0.2}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, 0.26, 0]}>
        <boxGeometry args={[0.65, 0.2, 0.95]} />
        <meshStandardMaterial color="#222" metalness={0.4} roughness={0.5} />
      </mesh>
      {[
        { p: [-0.45, -0.1, -0.55] as [number, number, number], k: "fl" },
        { p: [0.45, -0.1, -0.55] as [number, number, number], k: "fr" },
        { p: [-0.45, -0.1, 0.55] as [number, number, number], k: "rl" },
        { p: [0.45, -0.1, 0.55] as [number, number, number], k: "rr" },
      ].map(({ p, k }) => (
        <mesh key={`ow-${k}`} position={p} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.17, 0.17, 0.11, 10]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
    </group>
  );
}

// ============================================================
// Game Scene
// ============================================================
interface GameSceneProps {
  gameState: GameState;
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
}

function GameScene({ gameState, onGameOver, onScoreUpdate }: GameSceneProps) {
  const playerXRef = useRef(0);
  const targetXRef = useRef(0);
  const keysRef = useRef<Record<string, boolean>>({});
  const obstaclesRef = useRef<Obstacle[]>([]);
  const scoreRef = useRef(0);
  const nextObstacleTimeRef = useRef(0);
  const obstacleIdRef = useRef(0);
  const segmentZsRef = useRef<number[]>([]);
  const playerMeshRef = useRef<THREE.Group>(null);
  const _cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [_renderTick, setRenderTick] = useState(0);

  // Initialize segments
  useEffect(() => {
    segmentZsRef.current = Array.from(
      { length: SEGMENT_COUNT },
      (_, i) => -i * SEGMENT_LENGTH,
    );
    obstaclesRef.current = [];
    scoreRef.current = 0;
    playerXRef.current = 0;
    targetXRef.current = 0;
    nextObstacleTimeRef.current = 1.5;
  }, []);

  useEffect(() => {
    if (gameState !== "playing") return;
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

  useFrame((state, delta) => {
    if (gameState !== "playing") return;

    const t = state.clock.elapsedTime;
    const speed = BASE_SPEED + scoreRef.current * 0.008;
    scoreRef.current += delta * 12;
    onScoreUpdate(Math.floor(scoreRef.current));

    // Input
    const keys = keysRef.current;
    if (keys.ArrowLeft || keys.a || keys.A) {
      targetXRef.current = Math.max(
        -ROAD_WIDTH / 2 + 0.6,
        targetXRef.current - delta * 5,
      );
    }
    if (keys.ArrowRight || keys.d || keys.D) {
      targetXRef.current = Math.min(
        ROAD_WIDTH / 2 - 0.6,
        targetXRef.current + delta * 5,
      );
    }

    // Smooth player movement
    playerXRef.current +=
      (targetXRef.current - playerXRef.current) * Math.min(1, delta * 10);

    // Scroll road segments
    for (let i = 0; i < segmentZsRef.current.length; i++) {
      segmentZsRef.current[i] += speed * delta;
      if (segmentZsRef.current[i] > SEGMENT_LENGTH * 1.5) {
        segmentZsRef.current[i] -= SEGMENT_COUNT * SEGMENT_LENGTH;
      }
    }

    // Spawn obstacles
    nextObstacleTimeRef.current -= delta;
    if (nextObstacleTimeRef.current <= 0) {
      const laneX = LANE_X[Math.floor(Math.random() * LANE_X.length)];
      obstaclesRef.current.push({
        id: obstacleIdRef.current++,
        x: laneX,
        z: -90,
        color:
          OBSTACLE_COLORS[Math.floor(Math.random() * OBSTACLE_COLORS.length)],
      });
      nextObstacleTimeRef.current =
        1.2 - Math.min(0.8, scoreRef.current * 0.00025);
    }

    // Move obstacles
    obstaclesRef.current = obstaclesRef.current
      .map((ob) => ({ ...ob, z: ob.z + speed * delta }))
      .filter((ob) => ob.z < 8);

    // Collision detection (simple AABB)
    const px = playerXRef.current;
    for (const ob of obstaclesRef.current) {
      if (Math.abs(ob.z - 0) < 1.5 && Math.abs(ob.x - px) < 0.9) {
        onGameOver(Math.floor(scoreRef.current));
        return;
      }
    }

    // Update camera position to follow car
    state.camera.position.x +=
      (playerXRef.current - state.camera.position.x) * 0.08;
    state.camera.position.y = 3.5 + Math.sin(t * 0.5) * 0.05;
    state.camera.position.z = 7;
    state.camera.lookAt(playerXRef.current, 0.3, -8);

    // Bobbing on car
    if (playerMeshRef.current) {
      playerMeshRef.current.position.x = playerXRef.current;
      playerMeshRef.current.rotation.z =
        -(targetXRef.current - playerXRef.current) * 0.05;
    }

    setRenderTick((n) => n + 1);
  });

  // Expose refs for rendering
  const segments = segmentZsRef.current;
  const obstacles = obstaclesRef.current;

  return (
    <>
      {/* Lights */}
      <ambientLight intensity={0.4} color="#0a0015" />
      <pointLight
        position={[0, 8, 5]}
        color="#ff2d55"
        intensity={3}
        distance={30}
      />
      <pointLight
        position={[-8, 4, -10]}
        color="#00e5ff"
        intensity={2}
        distance={25}
      />
      <pointLight
        position={[8, 4, -10]}
        color="#ff9100"
        intensity={1.5}
        distance={20}
      />
      <directionalLight
        position={[0, 10, 5]}
        intensity={0.6}
        color="#ffffff"
        castShadow
      />

      {/* Sky dome */}
      <mesh>
        <sphereGeometry args={[120, 16, 8]} />
        <meshBasicMaterial color="#050010" side={THREE.BackSide} />
      </mesh>

      {/* Road segments pool - segment slot index is structurally stable */}
      {segments.map((z, segIdx) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: segment pool is fixed-size, positionally stable
        <RoadSegment key={segIdx} zPos={z} />
      ))}

      {/* Side barriers */}
      <mesh position={[-ROAD_WIDTH / 2 - 0.4, 0.3, -40]} receiveShadow>
        <boxGeometry args={[0.4, 0.6, 200]} />
        <meshStandardMaterial
          color="#1a0010"
          emissive="#ff2d55"
          emissiveIntensity={0.15}
        />
      </mesh>
      <mesh position={[ROAD_WIDTH / 2 + 0.4, 0.3, -40]} receiveShadow>
        <boxGeometry args={[0.4, 0.6, 200]} />
        <meshStandardMaterial
          color="#1a0010"
          emissive="#00e5ff"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* Player car */}
      <group ref={playerMeshRef} position={[playerXRef.current, 0, 0]}>
        <PlayerCar xPos={0} />
      </group>

      {/* Obstacles */}
      {obstacles.map((ob) => (
        <ObstacleCar key={ob.id} obstacle={ob} />
      ))}
    </>
  );
}

// ============================================================
// HUD
// ============================================================
function HUD({ score, speed }: { score: number; speed: number }) {
  const maxSpeed = BASE_SPEED + 200 * 0.008;
  const pct = Math.min(100, (speed / maxSpeed) * 100);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 5,
        fontFamily: "'Courier New', monospace",
      }}
    >
      {/* Score */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          color: "#fff",
          fontSize: "1.4rem",
          letterSpacing: "0.2em",
          textShadow: "0 0 12px #00e5ff, 0 0 24px #00e5ff88",
          background: "rgba(0,0,0,0.4)",
          padding: "4px 20px",
          borderRadius: "999px",
          border: "1px solid rgba(0,229,255,0.3)",
        }}
      >
        {String(score).padStart(6, "0")}
      </div>

      {/* Speed bar */}
      <div
        style={{
          position: "absolute",
          left: 20,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            color: "#ff9100",
            fontSize: "0.6rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            textShadow: "0 0 8px #ff9100",
          }}
        >
          Speed
        </span>
        <div
          style={{
            width: 12,
            height: 100,
            background: "rgba(0,0,0,0.5)",
            border: "1px solid rgba(255,145,0,0.4)",
            borderRadius: 6,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              width: "100%",
              height: `${pct}%`,
              background:
                pct > 75
                  ? "linear-gradient(0deg, #ff1744, #ff9100)"
                  : "linear-gradient(0deg, #00e5ff, #76ff03)",
              borderRadius: 4,
              transition: "height 0.1s ease",
              boxShadow: `0 0 8px ${pct > 75 ? "#ff174488" : "#00e5ff88"}`,
            }}
          />
        </div>
        <span
          style={{
            color: pct > 75 ? "#ff1744" : "#76ff03",
            fontSize: "0.55rem",
            textShadow: `0 0 6px ${pct > 75 ? "#ff1744" : "#76ff03"}`,
          }}
        >
          {Math.floor(speed)} km/h
        </span>
      </div>

      {/* Controls hint */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.35)",
          fontSize: "0.6rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        ← → Arrow keys to steer
      </div>
    </div>
  );
}

// ============================================================
// Main RacingGame component
// ============================================================
interface RacingGameProps {
  onClose: () => void;
}

export default function RacingGame({ onClose }: RacingGameProps) {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [_score, setScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);
  const speedRef = useRef(BASE_SPEED);

  const handleGameOver = useCallback((s: number) => {
    setFinalScore(s);
    setGameState("gameover");
  }, []);

  const handleScoreUpdate = useCallback((s: number) => {
    setCurrentScore(s);
    speedRef.current = BASE_SPEED + s * 0.008;
  }, []);

  const startGame = useCallback(() => {
    setScore(0);
    setCurrentScore(0);
    setGameState("playing");
  }, []);

  // ESC to close
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
        background: "#050010",
        overflow: "hidden",
      }}
      data-ocid="racing.canvas_target"
    >
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
          border: "1px solid rgba(255,45,85,0.5)",
          background: "rgba(0,0,0,0.6)",
          color: "#ff2d55",
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
            background:
              "radial-gradient(ellipse at center, rgba(5,0,16,0.6) 0%, rgba(0,0,0,0.95) 100%)",
          }}
        >
          <div
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: "clamp(2rem, 6vw, 4rem)",
              fontWeight: 900,
              letterSpacing: "0.15em",
              color: "#00e5ff",
              textShadow:
                "0 0 20px #00e5ff, 0 0 40px #00e5ff, 0 0 80px rgba(0,229,255,0.4)",
              textTransform: "uppercase",
            }}
          >
            🏎 RACING GAME
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.5)",
              fontFamily: "Georgia, serif",
              fontSize: "0.9rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            Dodge the traffic · Go faster
          </div>
          <button
            type="button"
            data-ocid="racing.primary_button"
            onClick={startGame}
            style={{
              padding: "14px 48px",
              borderRadius: "999px",
              border: "2px solid #00e5ff",
              background: "transparent",
              color: "#00e5ff",
              fontSize: "1rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              fontFamily: "'Courier New', monospace",
              cursor: "pointer",
              textShadow: "0 0 10px #00e5ff",
              boxShadow:
                "0 0 20px rgba(0,229,255,0.3), inset 0 0 20px rgba(0,229,255,0.05)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "rgba(0,229,255,0.12)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 0 40px rgba(0,229,255,0.5), inset 0 0 30px rgba(0,229,255,0.1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "transparent";
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 0 20px rgba(0,229,255,0.3), inset 0 0 20px rgba(0,229,255,0.05)";
            }}
          >
            START RACE
          </button>
          <div
            style={{
              color: "rgba(255,255,255,0.25)",
              fontSize: "0.7rem",
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
            background: "rgba(0,0,0,0.85)",
          }}
        >
          <div
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: "clamp(1.8rem, 5vw, 3.5rem)",
              fontWeight: 900,
              letterSpacing: "0.15em",
              color: "#ff1744",
              textShadow: "0 0 20px #ff1744, 0 0 40px rgba(255,23,68,0.5)",
              textTransform: "uppercase",
            }}
          >
            GAME OVER
          </div>
          <div
            style={{
              fontFamily: "'Courier New', monospace",
              color: "#fff",
              fontSize: "1.1rem",
              letterSpacing: "0.12em",
            }}
          >
            Score:{" "}
            <span style={{ color: "#00e5ff", textShadow: "0 0 10px #00e5ff" }}>
              {String(finalScore).padStart(6, "0")}
            </span>
          </div>
          <button
            type="button"
            onClick={startGame}
            style={{
              padding: "12px 40px",
              borderRadius: "999px",
              border: "2px solid #ff1744",
              background: "transparent",
              color: "#ff1744",
              fontSize: "0.9rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontFamily: "'Courier New', monospace",
              cursor: "pointer",
              textShadow: "0 0 8px #ff1744",
              boxShadow: "0 0 15px rgba(255,23,68,0.3)",
            }}
          >
            PLAY AGAIN
          </button>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 3.5, 7], fov: 65 }}
        shadows
        gl={{ antialias: true }}
        style={{ position: "absolute", inset: 0 }}
      >
        {gameState === "playing" && (
          <GameScene
            gameState={gameState}
            onGameOver={handleGameOver}
            onScoreUpdate={handleScoreUpdate}
          />
        )}
        {gameState === "idle" && (
          <>
            <ambientLight intensity={0.5} />
            <pointLight position={[0, 4, 0]} color="#00e5ff" intensity={3} />
            {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
              <RoadSegment
                key={`seg-${i * SEGMENT_LENGTH}`}
                zPos={-i * SEGMENT_LENGTH}
              />
            ))}
          </>
        )}
      </Canvas>

      {/* HUD overlay (only during play) */}
      {gameState === "playing" && (
        <HUD score={currentScore} speed={speedRef.current} />
      )}
    </div>
  );
}
