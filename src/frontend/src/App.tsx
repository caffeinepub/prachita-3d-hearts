import { Environment, OrbitControls, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AnimatePresence, motion } from "motion/react";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import MusicPlayer from "./components/MusicPlayer";

const RacingGame = lazy(() => import("./components/RacingGame"));
const FighterGame = lazy(() => import("./components/FighterGame"));

// ===== HEART GEOMETRY HELPER =====
function createHeartShape(): THREE.Shape {
  const shape = new THREE.Shape();
  const x = 0;
  const y = 0;
  // Heart parametric curve using bezier control points
  shape.moveTo(x, y + 0.5);
  shape.bezierCurveTo(x, y + 0.5, x - 0.1, y + 0.9, x - 0.5, y + 0.9);
  shape.bezierCurveTo(x - 1.0, y + 0.9, x - 1.0, y + 0.4, x - 1.0, y + 0.4);
  shape.bezierCurveTo(x - 1.0, y + 0.1, x - 0.8, y - 0.2, x - 0.5, y - 0.4);
  shape.bezierCurveTo(x - 0.2, y - 0.65, x, y - 0.85, x, y - 1.0);
  shape.bezierCurveTo(x, y - 0.85, x + 0.2, y - 0.65, x + 0.5, y - 0.4);
  shape.bezierCurveTo(x + 0.8, y - 0.2, x + 1.0, y + 0.1, x + 1.0, y + 0.4);
  shape.bezierCurveTo(x + 1.0, y + 0.4, x + 1.0, y + 0.9, x + 0.5, y + 0.9);
  shape.bezierCurveTo(x + 0.1, y + 0.9, x, y + 0.5, x, y + 0.5);
  return shape;
}

// ===== 3D HEART MESH =====
function Heart3D() {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  const { geometry, glowGeometry } = useMemo(() => {
    const shape = createHeartShape();
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 0.5,
      bevelEnabled: true,
      bevelSegments: 12,
      steps: 2,
      bevelSize: 0.08,
      bevelThickness: 0.08,
    };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.center();

    const glowSettings: THREE.ExtrudeGeometryOptions = {
      depth: 0.55,
      bevelEnabled: true,
      bevelSegments: 6,
      steps: 1,
      bevelSize: 0.15,
      bevelThickness: 0.12,
    };
    const glowGeo = new THREE.ExtrudeGeometry(shape, glowSettings);
    glowGeo.center();

    return { geometry: geo, glowGeometry: glowGeo };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.4;
      groupRef.current.rotation.x = Math.sin(t * 0.3) * 0.15;
      groupRef.current.position.y = Math.sin(t * 0.5) * 0.08;
    }
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.3 + Math.sin(t * 1.5) * 0.15;
    }
    if (glowRef.current) {
      const glowMat = glowRef.current.material as THREE.MeshStandardMaterial;
      glowMat.opacity = 0.12 + Math.sin(t * 1.5) * 0.06;
    }
  });

  return (
    <group ref={groupRef} scale={[1.8, 1.8, 1.8]}>
      {/* Outer glow layer */}
      <mesh ref={glowRef} geometry={glowGeometry} scale={[1.05, 1.05, 1.05]}>
        <meshStandardMaterial
          color="#ff2d55"
          emissive="#ff1744"
          emissiveIntensity={0.8}
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Main heart */}
      <mesh ref={meshRef} geometry={geometry} castShadow>
        <meshStandardMaterial
          color="#d90026"
          emissive="#ff1744"
          emissiveIntensity={0.3}
          metalness={0.4}
          roughness={0.2}
          envMapIntensity={1.2}
        />
      </mesh>

      {/* Shiny top layer */}
      <mesh geometry={geometry} scale={[1.001, 1.001, 1.001]}>
        <meshStandardMaterial
          color="#ff6b8a"
          emissive="#ff2d55"
          emissiveIntensity={0.15}
          metalness={0.9}
          roughness={0.05}
          transparent
          opacity={0.35}
          envMapIntensity={2}
        />
      </mesh>
    </group>
  );
}

// ===== FLOATING PARTICLES (3D) =====
function FloatingParticles() {
  const particlesRef = useRef<THREE.Points>(null);

  const { positions, velocities } = useMemo(() => {
    const count = 120;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 15;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
      vel[i * 3] = (Math.random() - 0.5) * 0.005;
      vel[i * 3 + 1] = Math.random() * 0.005 + 0.002;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.003;
    }
    return { positions: pos, velocities: vel };
  }, []);

  useFrame(() => {
    if (!particlesRef.current) return;
    const geo = particlesRef.current.geometry;
    const pos = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < pos.length / 3; i++) {
      pos[i * 3] += velocities[i * 3];
      pos[i * 3 + 1] += velocities[i * 3 + 1];
      pos[i * 3 + 2] += velocities[i * 3 + 2];
      if (pos[i * 3 + 1] > 8) {
        pos[i * 3 + 1] = -8;
        pos[i * 3] = (Math.random() - 0.5) * 20;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
      }
    }
    geo.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#ff6b8a"
        size={0.06}
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ===== LIGHT SETUP =====
function SceneLights() {
  const light1Ref = useRef<THREE.PointLight>(null);
  const light2Ref = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (light1Ref.current) {
      light1Ref.current.intensity = 3 + Math.sin(t * 1.2) * 0.8;
      light1Ref.current.position.x = Math.sin(t * 0.4) * 3;
      light1Ref.current.position.y = Math.cos(t * 0.3) * 2 + 1;
    }
    if (light2Ref.current) {
      light2Ref.current.intensity = 2 + Math.cos(t * 0.9) * 0.6;
      light2Ref.current.position.x = -Math.sin(t * 0.35) * 4;
    }
  });

  return (
    <>
      <ambientLight intensity={0.3} color="#1a0010" />
      <pointLight
        ref={light1Ref}
        position={[3, 2, 4]}
        color="#ff2d55"
        intensity={3}
        distance={20}
      />
      <pointLight
        ref={light2Ref}
        position={[-4, 1, 3]}
        color="#ff6b8a"
        intensity={2}
        distance={15}
      />
      <pointLight
        position={[0, -3, 5]}
        color="#9b1742"
        intensity={1.5}
        distance={12}
      />
      <pointLight
        position={[0, 4, -2]}
        color="#ff1744"
        intensity={1}
        distance={10}
      />
      {/* Soft fill */}
      <directionalLight position={[0, 5, 5]} color="#ffd0dd" intensity={0.4} />
    </>
  );
}

// ===== NAME TEXT (SVG overlay approach) =====
// Using HTML overlay for the name since Text/Text3D requires font files

// ===== INTRO BOUNCING HEARTS (CSS/HTML) =====
interface BounceHeart {
  id: number;
  x: number;
  landY: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
  rotStart: number;
  rotMid: number;
  rotEnd: number;
  opacity: number;
}

function IntroHearts({ onComplete }: { onComplete: () => void }) {
  const [hearts, setHearts] = useState<BounceHeart[]>([]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const colors = [
      "#ff2d55",
      "#ff1744",
      "#ff6b8a",
      "#e91e63",
      "#f44336",
      "#ff4081",
      "#c62828",
      "#ff8a80",
      "#ad1457",
    ];
    const generated: BounceHeart[] = Array.from({ length: 28 }, (_, i) => ({
      id: i,
      x: 5 + Math.random() * 90,
      landY: 30 + Math.random() * 55,
      size: 20 + Math.random() * 55,
      delay: Math.random() * 1.4,
      duration: 1.6 + Math.random() * 1.0,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotStart: (Math.random() - 0.5) * 40,
      rotMid: (Math.random() - 0.5) * 20,
      rotEnd: (Math.random() - 0.5) * 10,
      opacity: 0.65 + Math.random() * 0.35,
    }));
    setHearts(generated);

    const maxTime = Math.max(
      ...generated.map((h) => (h.delay + h.duration) * 1000),
    );
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 600);
    }, maxTime - 200);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          {hearts.map((heart) => (
            <div
              key={heart.id}
              className="heart-intro absolute"
              style={
                {
                  left: `${heart.x}%`,
                  top: 0,
                  width: heart.size,
                  height: heart.size,
                  "--land-y": `${heart.landY}vh`,
                  "--rot-start": `${heart.rotStart}deg`,
                  "--rot-mid": `${heart.rotMid}deg`,
                  "--rot-mid2": `${heart.rotMid * 0.5}deg`,
                  "--rot-end": `${heart.rotEnd}deg`,
                  animationDelay: `${heart.delay}s`,
                  animationDuration: `${heart.duration}s`,
                  opacity: heart.opacity,
                } as React.CSSProperties
              }
            >
              <HeartSVG color={heart.color} />
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ===== SVG HEART COMPONENT =====
function HeartSVG({
  color = "#ff2d55",
  size = "100%",
}: { color?: string; size?: string | number }) {
  return (
    <svg
      viewBox="0 0 100 90"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Heart"
      style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
    >
      <title>Heart</title>
      <path
        d="M50,80 C50,80 10,55 10,30 C10,15 20,5 35,5 C42,5 48,9 50,13 C52,9 58,5 65,5 C80,5 90,15 90,30 C90,55 50,80 50,80 Z"
        fill={color}
      />
    </svg>
  );
}

// ===== BACKGROUND FLOATING HEARTS (HTML/CSS) =====
interface BgHeart {
  id: number;
  x: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
  maxOpacity: number;
  scaleStart: number;
  scaleEnd: number;
}

function BackgroundHearts() {
  const hearts = useMemo<BgHeart[]>(() => {
    const colors = [
      "#ff2d55",
      "#ff1744",
      "#ff6b8a",
      "#e91e63",
      "#c62828",
      "#ff4081",
    ];
    return Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: Math.random() * 95,
      size: 12 + Math.random() * 30,
      delay: Math.random() * 8,
      duration: 8 + Math.random() * 12,
      color: colors[Math.floor(Math.random() * colors.length)],
      maxOpacity: 0.08 + Math.random() * 0.12,
      scaleStart: 0.3 + Math.random() * 0.4,
      scaleEnd: 0.6 + Math.random() * 0.6,
    }));
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {hearts.map((heart) => (
        <div
          key={heart.id}
          className="bg-heart-particle absolute bottom-0"
          style={
            {
              left: `${heart.x}%`,
              width: heart.size,
              height: heart.size,
              animationDelay: `${heart.delay}s`,
              animationDuration: `${heart.duration}s`,
              "--scale-start": heart.scaleStart,
              "--scale-end": heart.scaleEnd,
              "--max-opacity": heart.maxOpacity,
            } as React.CSSProperties
          }
        >
          <HeartSVG color={heart.color} />
        </div>
      ))}
    </div>
  );
}

// ===== STARFIELD =====
function Starfield() {
  const stars = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 1 + Math.random() * 2.5,
        delay: Math.random() * 4,
        duration: 2 + Math.random() * 3,
      })),
    [],
  );

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      {stars.map((star) => (
        <div
          key={star.id}
          className="star-twinkle absolute rounded-full"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            background: "oklch(0.95 0.04 20 / 0.8)",
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

// ===== VIDEO FRAME (HTML overlay) =====
interface VideoFrameProps {
  show: boolean;
}

function VideoFrame({ show }: VideoFrameProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed bottom-8 left-8 z-30 pointer-events-auto"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Label */}
          <motion.div
            className="mb-2 flex items-center gap-2"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-rose-400/50" />
            <span
              className="text-xs tracking-[0.3em] uppercase"
              style={{
                color: "oklch(0.72 0.14 350 / 0.75)",
                fontFamily: "Georgia, serif",
              }}
            >
              Our Moments
            </span>
          </motion.div>

          {/* Frame */}
          <div
            className="video-frame-glass rounded-lg overflow-hidden"
            style={{ width: 220, height: 140 }}
            data-ocid="video.panel"
          >
            <video
              src="/assets/WhatsApp Video 2026-03-05 at 6.44.40 PM-3.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ===== BEAR HUG 3D =====
function BearHug3D() {
  const bear1Ref = useRef<THREE.Mesh>(null);
  const bear2Ref = useRef<THREE.Mesh>(null);
  const [bear1Tex, bear2Tex] = useTexture([
    "/assets/uploads/image-1.png",
    "/assets/uploads/image-1-2.png",
  ]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // Bear 1: leads the cycle
    if (bear1Ref.current) {
      const t1 = t;
      bear1Ref.current.position.x = -1.4 + Math.sin(t1 * 1.4) * 0.12;
      bear1Ref.current.position.y = 3.2 + Math.sin(t1 * 1.1) * 0.1;
      bear1Ref.current.rotation.z =
        0.12 + Math.sin(t1 * 1.4) * (5 * (Math.PI / 180));
    }

    // Bear 2: lags by ~0.5s phase offset
    if (bear2Ref.current) {
      const t2 = t + 0.5;
      bear2Ref.current.position.x = 1.4 - Math.sin(t2 * 1.4) * 0.12;
      bear2Ref.current.position.y = 3.2 + Math.sin(t2 * 1.1) * 0.1;
      bear2Ref.current.rotation.z =
        -0.12 - Math.sin(t2 * 1.4) * (5 * (Math.PI / 180));
    }
  });

  return (
    <group>
      {/* Soft pink light near bears */}
      <pointLight
        position={[0, 3.5, 2]}
        color="#ffb3c6"
        intensity={1.8}
        distance={8}
      />

      {/* Bear 1 — left, facing slightly right */}
      <mesh ref={bear1Ref} position={[-1.4, 3.2, 1]} rotation={[0, 0.12, 0.12]}>
        <planeGeometry args={[2.5, 2.5]} />
        <meshStandardMaterial
          map={bear1Tex}
          transparent
          alphaTest={0.1}
          side={THREE.DoubleSide}
          metalness={0}
          roughness={0.8}
        />
      </mesh>

      {/* Bear 2 — right, facing slightly left (mirrored) */}
      <mesh
        ref={bear2Ref}
        position={[1.4, 3.2, 1]}
        rotation={[0, -0.12, -0.12]}
        scale={[-1, 1, 1]}
      >
        <planeGeometry args={[2.5, 2.5]} />
        <meshStandardMaterial
          map={bear2Tex}
          transparent
          alphaTest={0.1}
          side={THREE.DoubleSide}
          metalness={0}
          roughness={0.8}
        />
      </mesh>
    </group>
  );
}

// ===== CAMERA SETUP =====
function CameraSetup() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 0, 6);
  }, [camera]);
  return null;
}

// ===== MAIN APP =====
export default function App() {
  const [introComplete, setIntroComplete] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showRacing, setShowRacing] = useState(false);
  const [showFighter, setShowFighter] = useState(false);

  const handleIntroComplete = () => {
    setIntroComplete(true);
    setTimeout(() => setShowContent(true), 200);
    setTimeout(() => setShowImage(true), 800);
    setTimeout(() => setShowVideo(true), 1200);
  };

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 30%, oklch(0.14 0.06 300) 0%, oklch(0.07 0.03 300) 50%, oklch(0.04 0.02 280) 100%)",
      }}
    >
      {/* Starfield */}
      <Starfield />

      {/* Background floating hearts */}
      <BackgroundHearts />

      {/* Deep vignette */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, oklch(0.04 0.02 280 / 0.7) 100%)",
        }}
      />

      {/* 3D Canvas */}
      <div className="canvas-container z-10" data-ocid="hero.canvas_target">
        <Canvas
          shadows
          camera={{ position: [0, 0, 6], fov: 50 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
          }}
          style={{ background: "transparent" }}
        >
          <Suspense fallback={null}>
            <CameraSetup />
            <SceneLights />
            <FloatingParticles />
            <BearHug3D />
            {introComplete && <Heart3D />}
            <Environment preset="night" />
            <OrbitControls
              enablePan={false}
              enableZoom={false}
              autoRotate={false}
              minPolarAngle={Math.PI / 4}
              maxPolarAngle={(3 * Math.PI) / 4}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Intro Bouncing Hearts */}
      {!introComplete && <IntroHearts onComplete={handleIntroComplete} />}

      {/* Main content overlay */}
      <AnimatePresence>
        {showContent && (
          <motion.div
            className="fixed inset-0 z-20 pointer-events-none flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.0 }}
          >
            {/* Top label */}
            <motion.div
              className="mb-6 flex items-center gap-3"
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-rose-400/60" />
              <span
                className="text-xs tracking-[0.35em] uppercase"
                style={{
                  color: "oklch(0.75 0.12 350 / 0.8)",
                  fontFamily: "Georgia, serif",
                }}
              >
                with love
              </span>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-rose-400/60" />
            </motion.div>

            {/* Name "Prachita" - centered over the 3D heart */}
            <motion.div
              className="relative flex flex-col items-center"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                delay: 0.5,
                duration: 1.0,
                type: "spring",
                stiffness: 60,
                damping: 15,
              }}
            >
              {/* Decorative top ornament */}
              <motion.div
                className="mb-2 text-rose-400/60 text-xl tracking-widest"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.6 }}
              >
                ✦ ❤ ✦
              </motion.div>

              {/* The name */}
              <div
                className="name-glow select-none"
                style={{
                  fontFamily:
                    "'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif",
                  fontSize: "clamp(3.5rem, 8vw, 7rem)",
                  fontWeight: 700,
                  fontStyle: "italic",
                  letterSpacing: "0.08em",
                  lineHeight: 1,
                  background:
                    "linear-gradient(135deg, oklch(0.95 0.08 60) 0%, oklch(0.88 0.18 40) 30%, oklch(0.82 0.2 20) 50%, oklch(0.88 0.18 40) 70%, oklch(0.95 0.08 60) 100%)",
                  backgroundSize: "200% auto",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  animation: "shimmer 3.5s linear infinite",
                  position: "relative",
                  zIndex: 30,
                }}
              >
                Prachita
              </div>

              {/* Decorative bottom ornament */}
              <motion.div
                className="mt-2"
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ delay: 1.0, duration: 0.8 }}
              >
                <div
                  style={{
                    height: 2,
                    width: "80%",
                    margin: "0 auto",
                    background:
                      "linear-gradient(90deg, transparent, oklch(0.72 0.22 20), oklch(0.82 0.18 75), oklch(0.72 0.22 20), transparent)",
                    borderRadius: 2,
                  }}
                />
              </motion.div>
            </motion.div>

            {/* Subtitle */}
            <motion.p
              className="mt-8 text-sm tracking-[0.25em] uppercase"
              style={{
                color: "oklch(0.7 0.1 350 / 0.7)",
                fontFamily: "Georgia, serif",
                fontStyle: "italic",
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.8 }}
            >
              Forever in my heart
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image card - bottom right — circular romantic portrait frame */}
      <AnimatePresence>
        {showImage && (
          <motion.div
            className="fixed bottom-8 right-8 z-30 floating-sway pointer-events-auto"
            initial={{ opacity: 0, scale: 0.5, x: 40, y: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            transition={{
              duration: 1.1,
              type: "spring",
              stiffness: 60,
              damping: 16,
            }}
            data-ocid="photo.card"
          >
            {/* Outer glow ring */}
            <div className="photo-outer-ring">
              {/* Rotating decorative ring */}
              <div className="photo-spin-ring" />
              {/* Inner glass border */}
              <div className="photo-inner-border">
                {/* The circular portrait */}
                <div className="photo-circle-frame pulse-glow-photo">
                  <img
                    src="/assets/uploads/R8RGEBU-1.jpeg"
                    alt="Prachita"
                    className="photo-portrait"
                  />
                  {/* Soft inner vignette */}
                  <div className="photo-vignette" />
                </div>
              </div>
            </div>
            {/* Name badge below photo */}
            <motion.div
              className="photo-name-badge"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.7 }}
            >
              <div className="photo-name-inner">
                <span className="photo-name-text">Prachita</span>
                <span className="photo-name-heart">❤</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top-left decorative label */}
      <AnimatePresence>
        {showContent && (
          <motion.div
            className="fixed top-6 left-6 z-30 pointer-events-none"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.5, duration: 0.8 }}
          >
            <div className="flex items-center gap-2">
              <div style={{ width: 28, height: 28, opacity: 0.6 }}>
                <HeartSVG color="#ff2d55" />
              </div>
              <div>
                <p
                  className="text-xs tracking-[0.2em] uppercase"
                  style={{
                    color: "oklch(0.65 0.12 350 / 0.7)",
                    fontFamily: "Georgia, serif",
                  }}
                >
                  A moment
                </p>
                <p
                  className="text-xs"
                  style={{
                    color: "oklch(0.55 0.08 300 / 0.5)",
                    fontFamily: "Georgia, serif",
                  }}
                >
                  of love
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Frame - bottom left */}
      <VideoFrame show={showVideo} />

      {/* Music Player */}
      <MusicPlayer />

      {/* Game Launch Buttons */}
      <AnimatePresence>
        {showContent && (
          <motion.div
            className="fixed z-30 pointer-events-auto"
            style={{
              bottom: "4.5rem",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 12,
              whiteSpace: "nowrap",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.8, duration: 0.7 }}
          >
            <button
              type="button"
              data-ocid="games.racing_button"
              onClick={() => setShowRacing(true)}
              style={{
                padding: "7px 18px",
                borderRadius: "999px",
                border: "1px solid oklch(0.55 0.22 350 / 0.4)",
                background: "oklch(0.1 0.04 300 / 0.65)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                color: "oklch(0.85 0.12 60)",
                fontSize: "0.75rem",
                letterSpacing: "0.1em",
                fontFamily: "Georgia, serif",
                cursor: "pointer",
                boxShadow:
                  "0 0 16px oklch(0.62 0.25 20 / 0.2), inset 0 1px 0 oklch(0.8 0.1 350 / 0.1)",
                transition: "all 0.25s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "oklch(0.72 0.22 60 / 0.7)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "oklch(0.95 0.15 60)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 0 28px oklch(0.72 0.22 60 / 0.35), inset 0 1px 0 oklch(0.8 0.1 60 / 0.2)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "oklch(0.55 0.22 350 / 0.4)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "oklch(0.85 0.12 60)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 0 16px oklch(0.62 0.25 20 / 0.2), inset 0 1px 0 oklch(0.8 0.1 350 / 0.1)";
              }}
            >
              🏎 Racing Game
            </button>
            <button
              type="button"
              data-ocid="games.fighter_button"
              onClick={() => setShowFighter(true)}
              style={{
                padding: "7px 18px",
                borderRadius: "999px",
                border: "1px solid oklch(0.55 0.22 350 / 0.4)",
                background: "oklch(0.1 0.04 300 / 0.65)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                color: "oklch(0.85 0.12 350)",
                fontSize: "0.75rem",
                letterSpacing: "0.1em",
                fontFamily: "Georgia, serif",
                cursor: "pointer",
                boxShadow:
                  "0 0 16px oklch(0.62 0.25 20 / 0.2), inset 0 1px 0 oklch(0.8 0.1 350 / 0.1)",
                transition: "all 0.25s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "oklch(0.72 0.22 350 / 0.7)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "oklch(0.95 0.15 350)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 0 28px oklch(0.72 0.22 350 / 0.35), inset 0 1px 0 oklch(0.8 0.1 350 / 0.2)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "oklch(0.55 0.22 350 / 0.4)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "oklch(0.85 0.12 350)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 0 16px oklch(0.62 0.25 20 / 0.2), inset 0 1px 0 oklch(0.8 0.1 350 / 0.1)";
              }}
            >
              ⚔ Fighter Game
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Overlays */}
      <Suspense fallback={null}>
        {showRacing && <RacingGame onClose={() => setShowRacing(false)} />}
        {showFighter && <FighterGame onClose={() => setShowFighter(false)} />}
      </Suspense>

      {/* Footer */}
      <div className="fixed bottom-4 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <p
          className="text-xs"
          style={{
            color: "oklch(0.4 0.05 290 / 0.6)",
            fontFamily: "Georgia, serif",
          }}
        >
          © {new Date().getFullYear()}. Built with{" "}
          <span style={{ color: "oklch(0.62 0.25 20 / 0.8)" }}>♥</span> using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto"
            style={{
              color: "oklch(0.55 0.1 290 / 0.7)",
              textDecoration: "none",
            }}
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </div>
  );
}
